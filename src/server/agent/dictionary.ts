import "server-only";
import { z } from "zod";
import { CATALOG } from "@/lib/schema-catalog";
import { DictionaryEntry } from "@/lib/schemas";
import { executeQuery } from "../sql/execute";
import { emptyUsage, streamStructured } from "./claude";
import { SCHEMA_DDL } from "./context";

const Proposals = z.object({
  entries: z.array(DictionaryEntry).min(10).max(80),
});

const TEXT_ENUMS = new Set(["industry", "country", "timezone", "role", "tier", "status", "cancel_reason", "type", "feature", "category", "priority"]);

/**
 * Profiles each column (null share, common values for categorical text,
 * min/max for numbers) so proposed descriptions are grounded in the data,
 * not guessed from column names. Runs through the same read-only executor.
 */
export async function profileColumns(): Promise<string> {
  const lines: string[] = [];
  for (const { table, columns } of CATALOG) {
    const nullExprs = columns.map(([c]) => `round(100.0 * count(*) filter (where ${c} is null) / greatest(count(*), 1), 1) as "${c}"`).join(", ");
    const nulls = await executeQuery(`select count(*) as n, ${nullExprs} from northwind.${table}`, {});
    const row = nulls.rows[0]!;
    lines.push(`${table} (${row[0]} rows)`);
    for (const [i, [c]] of columns.entries()) {
      const nullPct = Number(row[i + 1]);
      let extra = "";
      if (TEXT_ENUMS.has(c)) {
        const top = await executeQuery(`select ${c}::text as v, count(*) as n from northwind.${table} group by 1 order by 2 desc limit 6`, {});
        extra = ` values: ${top.rows.map((r) => `${r[0] ?? "NULL"} (${r[1]})`).join(", ")}`;
      } else if (/(_cents|_at)$/.test(c)) {
        const mm = await executeQuery(`select min(${c})::text as lo, max(${c})::text as hi${c.endsWith("_cents") ? `, count(*) filter (where ${c} < 0) as neg` : ""} from northwind.${table}`, {});
        const r = mm.rows[0]!;
        extra = ` range: ${r[0]} … ${r[1]}${r[2] !== undefined ? `; negative rows: ${r[2]}` : ""}`;
      } else if (c.startsWith("is_")) {
        const t = await executeQuery(`select count(*) filter (where ${c}) as t from northwind.${table}`, {});
        extra = ` true in ${t.rows[0]![0]} rows`;
      }
      lines.push(`  ${c}: ${nullPct}% null${extra}`);
    }
  }
  return lines.join("\n");
}

const SYSTEM = `You document a Postgres database for a data dictionary that an analytics agent will read.
Propose a plain-English description for every table and every column, written for a founder or developer
without a data team. Be concrete and useful for writing correct queries: units, what NULL means, which values
exist, and gotchas that would make a metric wrong (test or internal accounts, rows that represent changes rather
than entities, negative amounts, timezone conventions). Only state what the schema and the profile support;
when a meaning is a likely inference rather than certain, say "likely". One or two sentences each, under 300 characters.
Use column null for table-level entries.

${SCHEMA_DDL}`;

export async function proposeDictionary(model: string) {
  const profile = await profileColumns();
  const usage = emptyUsage();
  const out = await streamStructured({
    model,
    effort: "low",
    maxTokens: 16_000,
    system: SYSTEM,
    user: `<column_profile>\n${profile}\n</column_profile>`,
    schema: Proposals,
    usage,
  });
  return { entries: out.entries, usage, model };
}
