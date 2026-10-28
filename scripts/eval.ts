/**
 * Golden-set eval: runs the live agent on each question in eval/golden.ts,
 * grades its headline answer against the hand-written ground truth, and
 * writes src/data/eval-results.json (rendered on /stack) plus full traces
 * to eval/runs/. Costs real API money (~$0.10–0.25 per question).
 *
 *   npm run eval                 all questions
 *   npm run eval -- --only id,id run a subset (results are merged)
 *   npm run eval -- --truth      print ground truth only, no agent calls
 *   npm run eval -- --regrade    re-score the saved traces in eval/runs/ (no agent calls)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { GOLDEN, type GoldenQuestion } from "../eval/golden";
import { loadEnv, requireEnv } from "./env";

loadEnv();
const { runAgent } = await import("../src/server/agent/pipeline");
const { env } = await import("../src/server/env");
const { DEFAULT_DICTIONARY } = await import("../src/data/dictionary");
type RunEvent = import("../src/lib/schemas").RunEvent;
type Cell = import("../src/lib/schemas").Cell;

const OUT = "src/data/eval-results.json";
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1]!.split(",") : null;
const questions = GOLDEN.filter((g) => !only || only.includes(g.id));

const db = postgres(requireEnv("DATABASE_URL_READONLY"), { prepare: false, max: 2 });

async function truthOf(g: GoldenQuestion): Promise<string | number> {
  const [row] = await db.unsafe(g.truth);
  if (!row) throw new Error(`truth query for ${g.id} returned no rows`);
  return g.kind === "number" ? Number(row.value) : String(row.label);
}

/** The agent's headline answer: the first KPI in plan order (numbers) or first breakdown (labels). */
function headline(g: GoldenQuestion, events: RunEvent[]) {
  const plan = events.find((e) => e.type === "plan");
  if (!plan || plan.type !== "plan") return { metric: null, value: null as Cell };
  const results = new Map(events.flatMap((e) => (e.type === "result" ? [[e.metric_id, e.result] as const] : [])));
  const preferred = g.kind === "number" ? ["kpi"] : ["bar", "table"];
  // Pick by plan order, not by what succeeded: a blocked headline is no answer.
  const metric = plan.plan.metrics.find((m) => preferred.includes(m.chart)) ?? plan.plan.metrics[0];
  if (!metric) return { metric: null, value: null as Cell };
  const r = results.get(metric.id);
  if (!r) return { metric: metric.id, value: null as Cell };
  const row = r.rows[0];
  if (!row) return { metric: metric.id, value: null as Cell };
  const pick = (name: string, type: "number" | "text") => {
    const i = r.columns.findIndex((c) => c.name === name);
    if (i >= 0) return row[i]!;
    const j = r.columns.findIndex((c) => (type === "number" ? c.type === "number" : c.type === "text"));
    return j >= 0 ? row[j]! : null;
  };
  return { metric: metric.id, value: g.kind === "number" ? pick("value", "number") : pick("label", "text") };
}

function grade(g: GoldenQuestion, expected: string | number, got: Cell): boolean {
  if (got === null) return false;
  if (g.kind === "label") {
    // Agents sometimes decorate labels ("Tidewell Robotics (#122)"); compare the name itself.
    const norm = (v: unknown) => String(v).toLowerCase().replace(/\s*[(\[].*?[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();
    return norm(got) === norm(expected);
  }
  const n = Number(got);
  const e = Number(expected);
  if (!Number.isFinite(n)) return false;
  const tol = g.tolerance ?? 0;
  return Math.abs(n - e) <= Math.max(tol * Math.abs(e), 1e-9);
}

interface EvalRow {
  id: string;
  question: string;
  trap: string;
  kind: GoldenQuestion["kind"];
  unit?: GoldenQuestion["unit"];
  expected: string | number;
  got: Cell;
  pass: boolean;
  headline_metric: string | null;
  reviewer: { verdict: string; codes: string[]; rewrote: boolean }[];
  metrics: number;
  latency_ms: number;
  cost_usd: number;
  error: string | null;
}

async function evaluate(g: GoldenQuestion): Promise<EvalRow> {
  const events: RunEvent[] = [];
  const t0 = Date.now();
  for await (const e of runAgent({ question: g.question, dictionary: DEFAULT_DICTIONARY })) events.push(e);
  const latency = Date.now() - t0;
  mkdirSync("eval/runs", { recursive: true });
  writeFileSync(`eval/runs/${g.id}.json`, JSON.stringify({ latency_ms: latency, events }, null, 2));
  return score(g, events, latency);
}

async function score(g: GoldenQuestion, events: RunEvent[], latency: number): Promise<EvalRow> {
  const expected = await truthOf(g);

  const { metric, value } = headline(g, events);
  const done = events.find((e) => e.type === "run.done");
  const runError = events.find((e) => e.type === "run.error");
  return {
    id: g.id,
    question: g.question,
    trap: g.trap,
    kind: g.kind,
    unit: g.unit,
    expected,
    got: value,
    pass: grade(g, expected, value),
    headline_metric: metric,
    reviewer: events.flatMap((e) =>
      e.type === "review" ? [{ verdict: e.review.verdict, codes: e.review.issues.map((i) => i.code), rewrote: e.review.rewritten_sql !== null }] : [],
    ),
    metrics: events.filter((e) => e.type === "sql").length,
    latency_ms: latency,
    cost_usd: done?.type === "run.done" ? Number(done.usage.cost_usd.toFixed(4)) : 0,
    error: runError?.type === "run.error" ? runError.message : null,
  };
}

if (args.includes("--truth")) {
  for (const g of questions) console.log(g.id.padEnd(28), await truthOf(g));
  await db.end();
  process.exit(0);
}

const regrade = args.includes("--regrade");
const rows: EvalRow[] = [];
if (regrade) {
  for (const g of questions) {
    if (!existsSync(`eval/runs/${g.id}.json`)) continue;
    const saved = JSON.parse(readFileSync(`eval/runs/${g.id}.json`, "utf8")) as { latency_ms: number; events: RunEvent[] };
    const row = await score(g, saved.events, saved.latency_ms);
    rows.push(row);
    console.log(`${row.pass ? "PASS" : "FAIL"}  ${row.id.padEnd(28)} expected ${row.expected}  got ${row.got}`);
  }
}
// Two at a time keeps us well inside rate limits.
const queue = regrade ? [] : [...questions];
await Promise.all(
  [0, 1].map(async () => {
    for (let g = queue.shift(); g; g = queue.shift()) {
      const row = await evaluate(g);
      rows.push(row);
      console.log(`${row.pass ? "PASS" : "FAIL"}  ${row.id.padEnd(28)} expected ${row.expected}  got ${row.got}  (${(row.latency_ms / 1000).toFixed(0)}s, $${row.cost_usd.toFixed(3)})${row.error ? `  error: ${row.error}` : ""}`);
    }
  }),
);

type Report = { ran_at: string; results: EvalRow[]; history?: { ran_at: string; passed: number; total: number; cost_usd: number; note?: string }[] };
const previous: Report | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const merged = GOLDEN.flatMap((g) => rows.find((r) => r.id === g.id) ?? previous?.results.find((r) => r.id === g.id) ?? []);
const latencies = merged.map((r) => r.latency_ms).sort((a, b) => a - b);
const passed = merged.filter((r) => r.pass).length;
const cost = Number(merged.reduce((s, r) => s + r.cost_usd, 0).toFixed(3));
const ranAt = regrade && previous ? previous.ran_at : new Date().toISOString();
// Every full agent run is kept so the page can show run-to-run variance.
const history = [...(previous?.history ?? [])];
if (!regrade) history.push({ ran_at: ranAt, passed, total: merged.length, cost_usd: cost, ...(only ? { note: `partial: ${only.join(",")}` } : {}) });
else if (history.length) history[history.length - 1] = { ...history.at(-1)!, passed, note: "re-graded" };
const report = {
  ran_at: ranAt,
  models: env.models(),
  dictionary: "default starter entries (src/data/dictionary.ts)",
  summary: {
    passed,
    total: merged.length,
    cost_usd: cost,
    median_latency_ms: latencies[Math.floor(latencies.length / 2)] ?? 0,
    reviewer_flagged: merged.filter((r) => r.reviewer.some((v) => v.verdict !== "pass")).length,
  },
  results: merged,
  history,
};
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(`\n${report.summary.passed}/${report.summary.total} passed · $${report.summary.cost_usd} · median ${(report.summary.median_latency_ms / 1000).toFixed(0)}s → ${OUT}`);
await db.end();
process.exit(0);
