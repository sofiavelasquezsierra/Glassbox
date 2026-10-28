import "server-only";
import { randomUUID } from "node:crypto";
import { DEMO_AS_OF } from "@/lib/constants";
import {
  IntentOutput,
  PlanOutput,
  QueryDraft,
  QueryReview,
  type Assumption,
  type DictionaryEntry,
  type MetricReview,
  type PlanMetric,
  type QueryResult,
  type RunEvent,
  type StepId,
  type StepStatus,
} from "@/lib/schemas";
import { env } from "../env";
import { signSql, verifySql } from "../sign";
import { executeQuery, ExecutionError } from "../sql/execute";
import { assumptionParams, compileNamed, ParamError } from "../sql/params";
import { validateSelect } from "../sql/validate";
import { emptyUsage, StepError, streamStructured } from "./claude";
import { renderDictionary } from "./context";
import { INTENT_SYSTEM, PLAN_SYSTEM, REVIEW_SYSTEM, SQL_SYSTEM } from "./prompts";

/** A minimal async queue: producers push events, the route handler drains them. */
function channel<T>() {
  const buffer: T[] = [];
  let wake: (() => void) | undefined;
  let closed = false;
  return {
    push(v: T) {
      buffer.push(v);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
    async *drain(): AsyncGenerator<T> {
      for (;;) {
        while (buffer.length) yield buffer.shift()!;
        if (closed) return;
        await new Promise<void>((r) => (wake = r));
        wake = undefined;
      }
    },
  };
}

const lastMatch = (text: string, re: RegExp) => {
  let m: RegExpExecArray | null;
  let last: string | undefined;
  re.lastIndex = 0;
  while ((m = re.exec(text))) last = m[1];
  return last;
};

export interface RunOptions {
  question: string;
  dictionary: DictionaryEntry[];
  signal?: AbortSignal;
}

/**
 * The agent: intent → plan → SQL → review → execute. Yields RunEvents as
 * work progresses. Model failures end the run with a visible run.error;
 * per-metric failures (validation, review block, execution) are partial.
 */
export async function* runAgent(opts: RunOptions): AsyncGenerator<RunEvent> {
  const ch = channel<RunEvent>();
  const work = pipeline(opts, ch.push).finally(() => ch.close());
  yield* ch.drain();
  await work;
}

async function pipeline({ question, dictionary, signal }: RunOptions, emit: (e: RunEvent) => void): Promise<void> {
  const started = Date.now();
  const models = env.models();
  const usage = emptyUsage();
  const dict = renderDictionary(dictionary);
  let lastDetail = "";

  const step = (s: StepId, status: StepStatus, label: string, extra: { detail?: string; model?: string } = {}) => {
    lastDetail = extra.detail ?? "";
    emit({ type: "step", step: s, status, label, ...extra });
  };
  const detail = (s: StepId, label: string, d: string | undefined, model: string) => {
    if (d && d !== lastDetail) step(s, "running", label, { detail: d, model });
  };

  emit({ type: "run.start", run_id: randomUUID(), question, as_of: DEMO_AS_OF, mode: "live" });

  try {
    // ── 1. Intent ────────────────────────────────────────────────────────────
    step("intent", "running", "Reading the schema", { model: models.intent });
    const intent = await streamStructured({
      model: models.intent,
      effort: "low",
      maxTokens: 4_000,
      system: INTENT_SYSTEM,
      user: `${dict}\n\n<question>${question}</question>`,
      schema: IntentOutput,
      usage,
      signal,
    });
    emit({ type: "intent", intent });
    if (!intent.answerable) {
      step("intent", "warn", "Can't answer this from the data", { detail: intent.reason_if_unanswerable ?? undefined });
      emit({ type: "run.error", message: intent.reason_if_unanswerable ?? "This question can't be answered from the Northwind schema.", retryable: false });
      return;
    }
    step("intent", "done", intent.status, { model: models.intent });

    // ── 2. Plan ──────────────────────────────────────────────────────────────
    const planLabel = "Planning metrics and assumptions";
    step("plan", "running", planLabel, { model: models.plan });
    const plan = await streamStructured({
      model: models.plan,
      effort: "medium",
      maxTokens: 16_000,
      system: PLAN_SYSTEM,
      user: `${dict}\n\n<question>${question}</question>\n<intent>${JSON.stringify(intent)}</intent>`,
      schema: PlanOutput,
      usage,
      signal,
      onText: (t) => {
        const label = lastMatch(t, /"label"\s*:\s*"([^"]{1,60})"/g);
        const title = lastMatch(t, /"title"\s*:\s*"([^"]{1,60})"/g);
        detail("plan", planLabel, label ? `Defining “${label}”` : title ? `Choosing “${title}”` : undefined, models.plan);
      },
      check: (p) => {
        try {
          assumptionParams(p.assumptions);
          return [];
        } catch (e) {
          return [e instanceof ParamError ? e.message : "invalid assumption values"];
        }
      },
    });
    emit({ type: "plan", plan });
    step("plan", "done", plan.status, { model: models.plan });

    const params = assumptionParams(plan.assumptions);
    const titleOf = (id: string) => plan.metrics.find((m) => m.id === id)?.title ?? id;

    // ── 3–5. Per metric, in parallel: SQL → review → execute ─────────────────
    // Each metric runs its own chain so charts appear as soon as they're ready.
    // The three step cards aggregate progress across metrics.
    const n = plan.metrics.length;
    const counts = { sql: 0, review: 0, flagged: 0, executed: 0, failed: 0 };
    const queriesWord = (k: number) => `${k} ${k === 1 ? "query" : "queries"}`;
    const runtimes: number[] = [];
    step("sql", "running", "Writing SQL", { model: models.sql });

    const chain = async (metric: PlanMetric) => {
      const planText = JSON.stringify(plan);
      const draft = await streamStructured({
        model: models.sql,
        effort: "medium",
        maxTokens: 16_000,
        system: SQL_SYSTEM,
        user: `${dict}\n\n<question>${question}</question>\n<plan>${planText}</plan>\n<write_metric>${metric.id}</write_metric>`,
        schema: QueryDraft,
        usage,
        signal,
        onThinking: (t) => counts.sql === 0 && detail("sql", "Writing SQL", t, models.sql),
        check: (d) => checkQuery(metric, d.sql, params),
      });
      const used = compileNamed(draft.sql, params).used;
      emit({ type: "sql", metric_id: metric.id, sql: draft.sql, explanation: draft.explanation, params: used, signature: signSql(metric.id, draft.sql) });
      counts.sql++;
      if (counts.sql < n) step("sql", "running", "Writing SQL", { detail: `${counts.sql} of ${n} written`, model: models.sql });
      else step("sql", "done", `Wrote ${queriesWord(n)}`, { model: models.sql });

      if (counts.review === 0 && counts.sql === 1) step("review", "running", "Reviewing queries", { model: models.review });
      const r = await streamStructured({
        model: models.review,
        effort: "medium",
        maxTokens: 16_000,
        system: REVIEW_SYSTEM,
        user: [
          dict,
          `<question>${question}</question>`,
          `<plan>${planText}</plan>`,
          `<resolved_parameters>${JSON.stringify(params)}</resolved_parameters>`,
          `<query metric_id="${metric.id}">\n${draft.sql}\n</query>`,
        ].join("\n\n"),
        schema: QueryReview,
        usage,
        signal,
        onThinking: (t) => counts.review === 0 && detail("review", "Reviewing queries", t, models.review),
        check: (rv) => checkReview(metric, rv, params),
      });
      const review: MetricReview = { metric_id: metric.id, ...r };
      const chosen = r.rewritten_sql ?? (r.verdict === "block" ? null : draft.sql);
      emit({ type: "review", review, final_sql: chosen, signature: chosen ? signSql(metric.id, chosen) : null });
      counts.review++;
      if (r.verdict !== "pass") counts.flagged++;
      const flaggedNote = counts.flagged ? `, ${counts.flagged} flagged` : "";
      if (counts.review < n) step("review", "running", "Reviewing queries", { detail: `${counts.review} of ${n} reviewed${flaggedNote}`, model: models.review });
      else step("review", counts.flagged ? "warn" : "done", `Reviewed ${queriesWord(n)}${counts.flagged ? `: ${counts.flagged} flagged` : ": all pass"}`, { model: models.review });

      if (!chosen) {
        emit({ type: "metric.error", metric_id: metric.id, stage: "review", message: `Blocked by reviewer: ${r.summary}` });
        counts.failed++;
        return;
      }
      if (counts.executed + counts.failed === 0) step("execute", "running", "Running queries read-only");
      try {
        const result = await executeQuery(chosen, params);
        runtimes.push(result.runtime_ms);
        emit({ type: "result", metric_id: metric.id, result });
        counts.executed++;
      } catch (e) {
        const message = e instanceof ExecutionError || e instanceof ParamError ? e.message : "query failed";
        emit({ type: "metric.error", metric_id: metric.id, stage: "execute", message });
        counts.failed++;
      }
    };

    // A model failure in one metric's chain fails only that metric.
    const settled = await Promise.allSettled(plan.metrics.map(chain));
    settled.forEach((s, i) => {
      if (s.status === "rejected") {
        const e = s.reason;
        const message = e instanceof StepError ? e.message : "The agent failed on this metric.";
        if (!(e instanceof StepError)) console.error("[glassbox] metric chain failure", e);
        emit({ type: "metric.error", metric_id: plan.metrics[i]!.id, stage: "validate", message });
        counts.failed++;
      }
    });
    if (settled.every((s) => s.status === "rejected")) {
      const first = settled[0] as PromiseRejectedResult;
      throw first.reason instanceof StepError ? first.reason : new StepError("The agent failed on every metric.", true);
    }
    if (counts.sql < n) step("sql", counts.sql ? "warn" : "error", `Wrote ${counts.sql} of ${n} queries`, { model: models.sql });
    if (counts.review < n) step("review", counts.review ? "warn" : "error", `Reviewed ${counts.review} of ${n} queries`, { model: models.review });
    step(
      "execute",
      counts.executed === 0 ? "error" : counts.failed ? "warn" : "done",
      counts.executed === 0
        ? "No queries ran"
        : `Ran ${queriesWord(counts.executed)} in ${Math.max(...runtimes)} ms${counts.failed ? `, ${counts.failed} didn't run` : ""}`,
    );
  } catch (e) {
    if (signal?.aborted) {
      emit({ type: "run.error", message: "The run was cancelled.", retryable: true });
    } else if (e instanceof StepError) {
      emit({ type: "run.error", message: e.message, retryable: e.retryable });
    } else {
      console.error("[glassbox] pipeline failure", e);
      emit({ type: "run.error", message: "Something went wrong running the agent.", retryable: true });
    }
  } finally {
    emit({ type: "run.done", usage, elapsed_ms: Date.now() - started });
  }
}

async function checkSql(sql: string, params: Record<string, string | number | boolean>): Promise<string | null> {
  const v = await validateSelect(sql);
  if (!v.ok) return v.message;
  try {
    compileNamed(sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

async function checkQuery(metric: PlanMetric, sql: string, params: Record<string, string | number | boolean>) {
  const err = await checkSql(sql, params);
  if (err) return [err];
  // A chip the user can edit must actually change the query.
  const used = new Set(compileNamed(sql, params).used);
  const missing = metric.assumptions.filter((k) => ![...used].some((p) => p === k || p.startsWith(`${k}_`)));
  return missing.map((k) => `assumption ${k} is listed for this metric but the query never uses :${k}`);
}

async function checkReview(metric: PlanMetric, r: QueryReview, params: Record<string, string | number | boolean>) {
  const problems: string[] = [];
  if (r.verdict === "pass" && r.issues.length > 0) problems.push("verdict pass must not list issues");
  if (r.verdict !== "pass" && r.issues.length === 0) problems.push(`verdict ${r.verdict} needs at least one issue`);
  if (r.rewritten_sql) problems.push(...(await checkQuery(metric, r.rewritten_sql, params)).map((p) => `rewritten_sql: ${p}`));
  return problems;
}

// ── Re-running with edited assumptions ───────────────────────────────────────

export interface RerunOutcome {
  metric_id: string;
  result?: QueryResult;
  error?: string;
}

/**
 * Re-executes previously generated queries with new assumption values.
 * No model calls: the SQL is unchanged, only bound parameters differ.
 * Signatures ensure only server-generated SQL can be re-run.
 */
export async function rerunMetrics(
  assumptions: Assumption[],
  metrics: { metric_id: string; sql: string; signature: string }[],
): Promise<RerunOutcome[]> {
  const params = assumptionParams(assumptions);
  return Promise.all(
    metrics.map(async (m): Promise<RerunOutcome> => {
      if (!verifySql(m.metric_id, m.sql, m.signature)) return { metric_id: m.metric_id, error: "query signature is invalid" };
      try {
        return { metric_id: m.metric_id, result: await executeQuery(m.sql, params) };
      } catch (e) {
        return { metric_id: m.metric_id, error: e instanceof ExecutionError || e instanceof ParamError ? e.message : "query failed" };
      }
    }),
  );
}
