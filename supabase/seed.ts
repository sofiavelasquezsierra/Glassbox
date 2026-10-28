/**
 * Loads the deterministic Northwind Cloud dataset into Supabase.
 *   npm run db:seed            truncate + insert, then print the manifest
 *   npm run db:seed -- --dry   generate only, print the manifest
 * The manifest (row counts + content hash) is written to supabase/seed-manifest.json
 * so `npm run db:verify` can confirm the database matches the generator.
 */
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { loadEnv, requireEnv } from "../scripts/env";
import { generate, manifest, TABLE_ORDER } from "./generate";

async function main() {
  const dry = process.argv.includes("--dry");
  const data = generate();
  const m = manifest(data);
  console.table(Object.fromEntries(Object.entries(m.tables).map(([k, v]) => [k, v])));
  writeFileSync("supabase/seed-manifest.json", JSON.stringify(m, null, 2) + "\n");
  if (dry) return;

  loadEnv();
  const sql = postgres(requireEnv("DATABASE_URL_ADMIN"), { prepare: false, onnotice: () => {}, max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`truncate ${[...TABLE_ORDER].reverse().map((t) => `northwind.${t}`).join(", ")}`);
      for (const t of TABLE_ORDER) {
        const rows = data[t] as unknown as Record<string, unknown>[];
        const cols = Object.keys(rows[0]!);
        // Stay well under Postgres' 65,535 bind-parameter limit.
        const batch = Math.floor(30_000 / cols.length);
        for (let i = 0; i < rows.length; i += batch) {
          await tx`insert into ${tx(`northwind.${t}`)} ${tx(rows.slice(i, i + batch) as never, ...cols)}`;
        }
        process.stdout.write(`  ${t.padEnd(16)} ${rows.length}\n`);
      }
    });
    await sql`analyze northwind.events`;
    console.log("seed complete");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
