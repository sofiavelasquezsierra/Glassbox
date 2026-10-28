import { z } from "zod";
import { DATA_TABLES } from "./constants";
import { Assumption } from "./assumptions";

export { Assumption } from "./assumptions";

/**
 * Zod is the source of truth for every model output and every event the
 * server streams. Model outputs are requested with these schemas as
 * structured-output formats and then validated again here, strictly.
 */

const snake = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const line = (max: number) => z.string().min(1).max(max);

// ── Step outputs ─────────────────────────────────────────────────────────────

export const IntentOutput = z.object({
  status: line(120).describe('Short human-readable status, e.g. "Found subscriptions and events"'),
  category: z.enum(["retention", "revenue", "support", "engagement", "growth", "other"]),
  tables: z.array(z.enum(DATA_TABLES)).min(1).max(DATA_TABLES.length),
  answerable: z.boolean(),
  reason_if_unanswerable: z.string().max(240).nullable(),
});
export type IntentOutput = z.infer<typeof IntentOutput>;

export const ChartKind = z.enum(["kpi", "line", "bar", "table"]);
export const MetricUnit = z.enum(["count", "percent", "usd", "hours", "ratio"]);

export const PlanMetric = z.object({
  id: snake,
  title: line(80),
  description: line(400).describe("What this metric shows and how it is defined, in plain English"),
  chart: ChartKind,
  unit: MetricUnit,
  assumptions: z.array(snake).max(8).describe("Keys of assumptions this metric depends on"),
});
export type PlanMetric = z.infer<typeof PlanMetric>;

export const PlanOutput = z
  .object({
    status: line(120),
    headline: line(240).describe("One-line framing of how the question will be answered"),
    metrics: z.array(PlanMetric).min(1).max(4),
    assumptions: z.array(Assumption).min(1).max(8),
  })
  .superRefine((plan, ctx) => {
    const keys = new Set(plan.assumptions.map((a) => a.key));
    if (keys.size !== plan.assumptions.length) ctx.addIssue({ code: "custom", message: "assumption keys must be unique" });
    const ids = new Set(plan.metrics.map((m) => m.id));
    if (ids.size !== plan.metrics.length) ctx.addIssue({ code: "custom", message: "metric ids must be unique" });
    for (const m of plan.metrics) {
      for (const k of m.assumptions) {
        if (!keys.has(k)) ctx.addIssue({ code: "custom", message: `metric ${m.id} references unknown assumption ${k}` });
      }
    }
  });
export type PlanOutput = z.infer<typeof PlanOutput>;

/** One SQL call per metric, so metrics are written and reviewed in parallel. */
export const QueryDraft = z.object({
  sql: z.string().min(1).max(8_000),
  explanation: line(400).describe("One line on how the query computes the metric"),
});
export type QueryDraft = z.infer<typeof QueryDraft>;

export const ReviewIssueCode = z.enum([
  "join_fanout",
  "null_handling",
  "timezone",
  "test_leakage",
  "question_mismatch",
  "date_range",
  "other",
]);

export const ReviewIssue = z.object({
  code: ReviewIssueCode,
  severity: z.enum(["warn", "block"]),
  message: line(400).describe("One line a developer can act on"),
});
export type ReviewIssue = z.infer<typeof ReviewIssue>;

export const QueryReview = z.object({
  verdict: z.enum(["pass", "warn", "block"]),
  summary: line(400),
  issues: z.array(ReviewIssue).max(6),
  rewritten_sql: z.string().max(8_000).nullable().describe("A corrected query when you can fix the problem, else null"),
});
export type QueryReview = z.infer<typeof QueryReview>;

export const MetricReview = QueryReview.extend({ metric_id: snake });
export type MetricReview = z.infer<typeof MetricReview>;

// ── Execution results ────────────────────────────────────────────────────────

export const Cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type Cell = z.infer<typeof Cell>;

export const ResultColumn = z.object({ name: z.string(), type: z.enum(["number", "text", "date", "timestamp", "boolean"]) });

export const QueryResult = z.object({
  columns: z.array(ResultColumn),
  rows: z.array(z.array(Cell)),
  row_count: z.number().int(),
  truncated: z.boolean(),
  runtime_ms: z.number(),
  executed_at: z.string(),
  plan_cost: z.number(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type QueryResult = z.infer<typeof QueryResult>;

// ── Data dictionary (client-supplied context) ────────────────────────────────

export const DictionaryEntry = z.object({
  table: z.enum(DATA_TABLES),
  column: z.string().regex(/^[a-z_][a-z0-9_]*$/).nullable(),
  description: z.string().min(1).max(300),
});
export type DictionaryEntry = z.infer<typeof DictionaryEntry>;

// ── Streamed events ──────────────────────────────────────────────────────────

export const StepId = z.enum(["intent", "plan", "sql", "review", "execute"]);
export type StepId = z.infer<typeof StepId>;

export const StepStatus = z.enum(["pending", "running", "done", "warn", "error", "skipped"]);
export type StepStatus = z.infer<typeof StepStatus>;

export const Usage = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  cost_usd: z.number(),
});
export type Usage = z.infer<typeof Usage>;

export const RunEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.start"), run_id: z.string(), question: z.string(), as_of: z.string(), mode: z.enum(["live", "cached"]) }),
  z.object({ type: z.literal("step"), step: StepId, status: StepStatus, label: z.string(), detail: z.string().optional(), model: z.string().optional() }),
  z.object({ type: z.literal("intent"), intent: IntentOutput }),
  z.object({ type: z.literal("plan"), plan: PlanOutput }),
  z.object({ type: z.literal("sql"), metric_id: z.string(), sql: z.string(), explanation: z.string(), params: z.array(z.string()), signature: z.string() }),
  z.object({ type: z.literal("review"), review: MetricReview, final_sql: z.string().nullable(), signature: z.string().nullable() }),
  z.object({ type: z.literal("result"), metric_id: z.string(), result: QueryResult }),
  z.object({ type: z.literal("metric.error"), metric_id: z.string(), stage: z.enum(["validate", "review", "execute"]), message: z.string() }),
  z.object({ type: z.literal("run.error"), message: z.string(), retryable: z.boolean() }),
  z.object({ type: z.literal("run.done"), usage: Usage, elapsed_ms: z.number() }),
  z.object({ type: z.literal("run.fallback"), reason: z.string(), cached_run: z.string() }),
]);
export type RunEvent = z.infer<typeof RunEvent>;

// ── API request bodies ───────────────────────────────────────────────────────

export const RunRequest = z.object({
  question: z.string().trim().min(3).max(300),
  dictionary: z.array(DictionaryEntry).max(120).default([]),
});

export const RerunRequest = z.object({
  assumptions: z.array(Assumption).min(1).max(8),
  metrics: z
    .array(z.object({ metric_id: snake, sql: z.string().max(8_000), signature: z.string().max(128) }))
    .min(1)
    .max(4),
});
