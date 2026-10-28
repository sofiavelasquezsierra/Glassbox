/**
 * Applies supabase/migrations/*.sql in order using the admin connection,
 * then sets passwords for the least-privilege roles and writes their
 * connection strings to .env.local. Safe to re-run.
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { loadEnv, requireEnv, writeEnvVar } from "./env";

loadEnv();
const adminUrl = requireEnv("DATABASE_URL_ADMIN");
const sql = postgres(adminUrl, { prepare: false, onnotice: () => {}, max: 1 });

/** Supabase pooler usernames are "<role>.<project-ref>"; direct ones are just "<role>". */
function urlForRole(role: string, password: string): string {
  const u = new URL(adminUrl);
  const ref = decodeURIComponent(u.username).split(".")[1];
  u.username = ref ? `${role}.${ref}` : role;
  u.password = password;
  return u.toString();
}

async function main() {
  await sql`create schema if not exists glassbox_meta`;
  await sql`create table if not exists glassbox_meta.migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql<{ name: string }[]>`select name from glassbox_meta.migrations`).map((r) => r.name));

  const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip   ${file}`);
      continue;
    }
    const body = readFileSync(`supabase/migrations/${file}`, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into glassbox_meta.migrations (name) values (${file})`;
    });
    console.log(`  apply  ${file}`);
  }

  for (const [role, envName] of [
    ["glassbox_reader", "DATABASE_URL_READONLY"],
    ["glassbox_app", "DATABASE_URL_APP"],
  ] as const) {
    if (process.env[envName]) {
      console.log(`  keep   ${role} (${envName} already set)`);
      continue;
    }
    const password = randomBytes(24).toString("base64url");
    await sql.unsafe(`alter role ${role} with password '${password}'`);
    writeEnvVar(envName, urlForRole(role, password));
    console.log(`  role   ${role}: password set, ${envName} written to .env.local`);
  }
}

main()
  .then(() => console.log("migrations complete"))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
