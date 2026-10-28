/**
 * Runs the live agent once from the terminal and prints its event stream.
 *   npm run ask -- "How's retention this quarter?" [--json out.json]
 */
import { writeFileSync } from "node:fs";
import { loadEnv } from "./env";

loadEnv();
const { runAgent } = await import("../src/server/agent/pipeline");
const { DEFAULT_DICTIONARY } = await import("../src/data/dictionary");

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const out = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : undefined;
const question = args.join(" ") || "How's retention this quarter?";

const t0 = Date.now();
const events = [];
for await (const e of runAgent({ question, dictionary: DEFAULT_DICTIONARY })) {
  events.push({ t: Date.now() - t0, ...e });
  const ts = `${((Date.now() - t0) / 1000).toFixed(1)}s`.padStart(6);
  switch (e.type) {
    case "step":
      console.log(`${ts}  [${e.step}] ${e.status.padEnd(7)} ${e.label}${e.detail ? ` · ${e.detail}` : ""}`);
      break;
    case "plan":
      console.log(`${ts}  plan: ${e.plan.headline}`);
      for (const a of e.plan.assumptions) console.log(`         assume ${a.key} = ${JSON.stringify(a.value)}  (${a.rationale})`);
      for (const m of e.plan.metrics) console.log(`         metric ${m.id} [${m.chart}] ${m.title}`);
      break;
    case "sql":
      console.log(`${ts}  sql ${e.metric_id}:\n${e.sql.replace(/^/gm, "           ")}`);
      break;
    case "review":
      console.log(`${ts}  review ${e.review.metric_id}: ${e.review.verdict.toUpperCase()} ${e.review.summary}`);
      for (const i of e.review.issues) console.log(`           - ${i.severity} ${i.code}: ${i.message}`);
      if (e.review.rewritten_sql) console.log(`           (rewritten)\n${e.review.rewritten_sql.replace(/^/gm, "           ")}`);
      break;
    case "result":
      console.log(`${ts}  result ${e.metric_id}: ${e.result.row_count} rows, ${e.result.runtime_ms} ms → ${JSON.stringify(e.result.rows.slice(0, 4))}`);
      break;
    case "metric.error":
    case "run.error":
      console.log(`${ts}  ${e.type}: ${e.message}`);
      break;
    case "run.done":
      console.log(`${ts}  done: ${e.usage.input_tokens} in / ${e.usage.output_tokens} out tokens, $${e.usage.cost_usd.toFixed(3)}`);
      break;
  }
}
if (out) writeFileSync(out, JSON.stringify(events, null, 2));
process.exit(0);
