/**
 * Proves the agent's database role can read but never write.
 * Connects as glassbox_reader (DATABASE_URL_READONLY) and expects every
 * write or escalation attempt below to fail. Also checks row counts against
 * supabase/seed-manifest.json.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { loadEnv, requireEnv } from "./env";

loadEnv();
const reader = postgres(requireEnv("DATABASE_URL_READONLY"), { prepare: false, onnotice: () => {}, max: 1 });
const app = postgres(requireEnv("DATABASE_URL_APP"), { prepare: false, onnotice: () => {}, max: 1 });

let failures = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

async function mustFail(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    bad(`${label} — unexpectedly succeeded`);
  } catch (e) {
    ok(`${label} — rejected: ${(e as Error).message.split("\n")[0]}`);
  }
}

async function main() {
  console.log("glassbox_reader");
  const [{ n }] = await reader<[{ n: number }]>`select count(*)::int n from northwind.organizations`;
  ok(`can read northwind.organizations (${n} rows)`);
  const [{ ro, timeout, path }] = await reader<[{ ro: string; timeout: string; path: string }]>`
    select current_setting('default_transaction_read_only') ro, current_setting('statement_timeout') timeout, current_setting('search_path') path`;
  ro === "on" ? ok("default_transaction_read_only = on") : bad(`default_transaction_read_only = ${ro}`);
  timeout === "5s" ? ok("statement_timeout = 5s") : bad(`statement_timeout = ${timeout}`);
  ok(`search_path = ${path}`);

  await mustFail("INSERT into northwind.plans", () => reader`insert into northwind.plans values (99, 'x', 'free', 0, false)`);
  await mustFail("UPDATE after disabling read-only for the session", () =>
    reader.begin(async (tx) => {
      await tx`set transaction read write`;
      await tx`update northwind.users set role = 'owner' where id = 1`;
    }),
  );
  await mustFail("SET default_transaction_read_only = off; UPDATE", () =>
    reader.unsafe("set default_transaction_read_only = off; update northwind.users set role = 'owner' where id = 1"),
  );
  await mustFail("DELETE from northwind.events", () => reader`delete from northwind.events where id = 1`);
  await mustFail("CREATE TABLE in northwind", () => reader`create table northwind.pwned (id int)`);
  await mustFail("CREATE TABLE in public", () => reader`create table public.pwned (id int)`);
  await mustFail("read glassbox_meta.rate_limits", () => reader`select * from glassbox_meta.rate_limits`);
  await mustFail("read auth.users", () => reader`select * from auth.users limit 1`);
  await mustFail("call glassbox_meta.hit()", () => reader`select glassbox_meta.hit('x', interval '1 hour')`);
  await mustFail("pg_sleep beyond statement_timeout", () => reader`select pg_sleep(6)`);

  console.log("glassbox_app");
  const [{ hit }] = await app<[{ hit: number }]>`select glassbox_meta.hit('verify', interval '1 minute') hit`;
  ok(`can call glassbox_meta.hit() (returned ${hit})`);
  await mustFail("read northwind.users", () => app`select * from northwind.users limit 1`);
  await mustFail("write glassbox_meta.rate_limits directly", () => app`delete from glassbox_meta.rate_limits`);

  console.log("seed manifest");
  const manifest = JSON.parse(readFileSync("supabase/seed-manifest.json", "utf8")) as { tables: Record<string, { rows: number }> };
  for (const [table, { rows }] of Object.entries(manifest.tables)) {
    const [{ c }] = await reader.unsafe<[{ c: number }]>(`select count(*)::int c from northwind.${table}`);
    c === rows ? ok(`${table}: ${c} rows`) : bad(`${table}: ${c} rows, manifest says ${rows}`);
  }

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([reader.end(), app.end()]));
