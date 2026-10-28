import type { Assumption } from "./assumptions";
import type { MetricView } from "./run-types";
import type { IntentOutput, PlanOutput, QueryResult, RunEvent, StepId, StepStatus, Usage } from "./schemas";

export const STEP_ORDER: StepId[] = ["intent", "plan", "sql", "review", "execute"];
export const STEP_NAMES: Record<StepId, string> = { intent: "Intent", plan: "Plan", sql: "SQL", review: "Review", execute: "Execute" };

export interface StepState {
  status: StepStatus;
  label?: string;
  detail?: string;
  model?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  mode: "live" | "cached";
  question: string;
  startedAt: number;
  steps: Record<StepId, StepState>;
  intent?: IntentOutput;
  plan?: PlanOutput;
  /** The agent's assumption values, for undo and "changed" markers. */
  original: Assumption[];
  /** Current values, possibly edited by the user. */
  assumptions: Assumption[];
  /** Previous assumption sets, most recent last (for Cmd/Ctrl+Z). */
  history: Assumption[][];
  metrics: Record<string, MetricView>;
  order: string[];
  usage?: Usage;
  elapsedMs?: number;
  error?: { message: string; retryable: boolean };
  notice?: string;
  rerunning: string[];
  rerunError?: string;
}

const freshSteps = (): Record<StepId, StepState> =>
  Object.fromEntries(STEP_ORDER.map((s) => [s, { status: "pending" as StepStatus }])) as Record<StepId, StepState>;

export const initialRun: RunState = {
  status: "idle",
  mode: "cached",
  question: "",
  startedAt: 0,
  steps: freshSteps(),
  original: [],
  assumptions: [],
  history: [],
  metrics: {},
  order: [],
  rerunning: [],
};

export type RunAction =
  | { type: "start"; question: string; mode: "live" | "cached"; at: number }
  | { type: "event"; event: RunEvent; at: number }
  | { type: "notice"; message: string }
  | { type: "fail"; message: string; retryable: boolean }
  | { type: "edit"; assumptions: Assumption[]; affected: string[] }
  | { type: "undo"; affected: string[] }
  | { type: "rerun.result"; results: { metric_id: string; result?: QueryResult; error?: string }[] }
  | { type: "rerun.error"; message: string; affected: string[] };

function patchMetric(state: RunState, id: string, patch: Partial<MetricView>): RunState {
  const current = state.metrics[id];
  if (!current) return state;
  return { ...state, metrics: { ...state.metrics, [id]: { ...current, ...patch } } };
}

/** Assumption keys a set of bound parameter names belongs to. */
export function keysForParams(params: string[], assumptions: Assumption[]): string[] {
  const keys = new Set<string>();
  for (const p of params) {
    for (const a of assumptions) {
      if (p === a.key || (a.type === "date_range" && p.startsWith(`${a.key}_`))) keys.add(a.key);
    }
  }
  return [...keys];
}

function applyEvent(state: RunState, e: RunEvent, at: number): RunState {
  switch (e.type) {
    case "run.start":
      return state;
    case "step": {
      const prev = state.steps[e.step];
      const step: StepState = {
        ...prev,
        status: e.status,
        label: e.label,
        detail: e.detail,
        model: e.model ?? prev.model,
        startedAt: prev.startedAt ?? at,
        endedAt: e.status === "running" ? undefined : at,
      };
      return { ...state, steps: { ...state.steps, [e.step]: step } };
    }
    case "intent":
      return { ...state, intent: e.intent };
    case "plan": {
      const metrics: Record<string, MetricView> = {};
      for (const m of e.plan.metrics) metrics[m.id] = { metric: m, phase: "writing", uses: [] };
      return { ...state, plan: e.plan, original: e.plan.assumptions, assumptions: e.plan.assumptions, history: [], metrics, order: e.plan.metrics.map((m) => m.id) };
    }
    case "sql":
      return patchMetric(state, e.metric_id, { sql: e.sql, explanation: e.explanation, signature: e.signature, phase: "reviewing", uses: keysForParams(e.params, state.assumptions) });
    case "review": {
      const id = e.review.metric_id;
      if (!e.final_sql) return patchMetric(state, id, { review: e.review, phase: "blocked" });
      // The reviewer may rewrite with different parameters; recompute which chips drive it.
      const params = [...e.final_sql.matchAll(/(?<![:\w]):([a-z][a-z0-9_]*)/g)].map((m) => m[1]!);
      return patchMetric(state, id, { review: e.review, finalSql: e.final_sql, signature: e.signature ?? undefined, phase: "running", uses: keysForParams(params, state.assumptions) });
    }
    case "result":
      return patchMetric(state, e.metric_id, { result: e.result, phase: "done", error: undefined });
    case "metric.error":
      return patchMetric(state, e.metric_id, { phase: e.stage === "review" ? "blocked" : "error", error: { stage: e.stage, message: e.message } });
    case "run.error":
      return { ...state, error: { message: e.message, retryable: e.retryable } };
    case "run.fallback":
      return { ...state, notice: e.reason };
    case "run.done": {
      // Anything still in flight when the run ends didn't finish.
      const metrics = Object.fromEntries(
        Object.entries(state.metrics).map(([id, m]) => [id, ["writing", "reviewing", "running", "planned"].includes(m.phase) ? { ...m, phase: "error" as const, error: m.error ?? { stage: "validate", message: "The run ended before this metric finished." } } : m]),
      );
      const steps = Object.fromEntries(Object.entries(state.steps).map(([k, s]) => [k, s.status === "running" ? { ...s, status: "error" as StepStatus, endedAt: at } : s])) as Record<StepId, StepState>;
      return { ...state, metrics, steps, usage: e.usage, elapsedMs: e.elapsed_ms, status: state.error && !state.plan ? "error" : "done" };
    }
  }
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "start":
      return { ...initialRun, status: "running", mode: action.mode, question: action.question, startedAt: action.at, steps: freshSteps() };
    case "event":
      return applyEvent(state, action.event, action.at);
    case "notice":
      return { ...state, notice: action.message };
    case "fail":
      return { ...state, status: "error", error: { message: action.message, retryable: action.retryable } };
    case "edit": {
      let next: RunState = { ...state, history: [...state.history, state.assumptions], assumptions: action.assumptions, rerunError: undefined };
      next = { ...next, rerunning: [...new Set([...state.rerunning, ...action.affected])] };
      for (const id of action.affected) next = patchMetric(next, id, { phase: "rerunning" });
      return next;
    }
    case "undo": {
      const prev = state.history.at(-1);
      if (!prev) return state;
      let next: RunState = { ...state, assumptions: prev, history: state.history.slice(0, -1), rerunning: [...new Set([...state.rerunning, ...action.affected])] };
      for (const id of action.affected) next = patchMetric(next, id, { phase: "rerunning" });
      return next;
    }
    case "rerun.result": {
      let next = state;
      for (const r of action.results) {
        next = r.result
          ? patchMetric(next, r.metric_id, { result: r.result, phase: "done", error: undefined })
          : patchMetric(next, r.metric_id, { phase: "error", error: { stage: "execute", message: r.error ?? "re-run failed" } });
      }
      const done = new Set(action.results.map((r) => r.metric_id));
      return { ...next, rerunning: next.rerunning.filter((id) => !done.has(id)) };
    }
    case "rerun.error": {
      let next: RunState = { ...state, rerunError: action.message, rerunning: state.rerunning.filter((id) => !action.affected.includes(id)) };
      // Keep the previous numbers visible; they still match the SQL, just not the new values.
      for (const id of action.affected) next = patchMetric(next, id, { phase: state.metrics[id]?.result ? "done" : "error" });
      return next;
    }
  }
}

/** Metrics whose final SQL binds any of the given assumption keys. */
export function affectedBy(state: RunState, keys: string[]): string[] {
  return state.order.filter((id) => {
    const m = state.metrics[id];
    return m?.finalSql && m.signature && m.uses.some((k) => keys.includes(k));
  });
}

export function changedKeys(a: Assumption[], b: Assumption[]): string[] {
  return a.filter((x) => JSON.stringify(x.value) !== JSON.stringify(b.find((y) => y.key === x.key)?.value)).map((x) => x.key);
}
