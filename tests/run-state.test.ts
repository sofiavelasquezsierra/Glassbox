import { describe, expect, it } from "vitest";
import type { Assumption } from "@/lib/assumptions";
import { affectedBy, changedKeys, initialRun, keysForParams, runReducer, type RunState } from "@/lib/run-state";
import type { PlanOutput, RunEvent } from "@/lib/schemas";

const assumptions: Assumption[] = [
  { key: "date_range", label: "Period", type: "date_range", value: { preset: "this_quarter" }, rationale: "" },
  { key: "active_window_days", label: "Active window", type: "int", value: 30, min: 1, max: 365, rationale: "" },
];
const plan: PlanOutput = {
  status: "Planned",
  headline: "h",
  assumptions,
  metrics: [
    { id: "a", title: "A", description: "d", chart: "kpi", unit: "count", assumptions: ["date_range"] },
    { id: "b", title: "B", description: "d", chart: "line", unit: "count", assumptions: ["active_window_days"] },
  ],
};

function run(...events: RunEvent[]): RunState {
  let s = runReducer(initialRun, { type: "start", question: "q", mode: "live", at: 0 });
  for (const e of events) s = runReducer(s, { type: "event", event: e, at: 1 });
  return s;
}

const review = (id: string, sql: string): RunEvent => ({
  type: "review",
  review: { metric_id: id, verdict: "pass", summary: "ok", issues: [], rewritten_sql: null },
  final_sql: sql,
  signature: "sig",
});

describe("run state", () => {
  it("maps date_range sub-parameters back to their assumption", () => {
    expect(keysForParams(["date_range_start", "date_range_prev_end", "as_of", "active_window_days"], assumptions)).toEqual(["date_range", "active_window_days"]);
  });

  it("tracks which metrics an assumption drives, from the SQL that actually ran", () => {
    const s = run({ type: "plan", plan }, review("a", "select :date_range_start::date"), review("b", "select :active_window_days::int, :date_range_end::date"));
    expect(s.metrics.a!.uses).toEqual(["date_range"]);
    expect(s.metrics.b!.uses).toEqual(["active_window_days", "date_range"]);
    expect(affectedBy(s, ["active_window_days"])).toEqual(["b"]);
    expect(affectedBy(s, ["date_range"])).toEqual(["a", "b"]);
  });

  it("edits mark only affected metrics as re-running, and undo restores the previous values", () => {
    let s = run({ type: "plan", plan }, review("a", "select :date_range_start::date"), review("b", "select :active_window_days::int"));
    const edited = assumptions.map((a) => (a.type === "int" ? { ...a, value: 7 } : a));
    s = runReducer(s, { type: "edit", assumptions: edited, affected: ["b"] });
    expect(s.metrics.b!.phase).toBe("rerunning");
    expect(s.metrics.a!.phase).not.toBe("rerunning");
    expect(changedKeys(s.assumptions, s.original)).toEqual(["active_window_days"]);
    s = runReducer(s, { type: "undo", affected: ["b"] });
    expect(changedKeys(s.assumptions, s.original)).toEqual([]);
    expect(s.history).toHaveLength(0);
  });

  it("a failed re-run keeps the previous numbers on screen", () => {
    let s = run({ type: "plan", plan }, review("b", "select :active_window_days::int"));
    s = runReducer(s, { type: "event", event: { type: "result", metric_id: "b", result: { columns: [], rows: [], row_count: 0, truncated: false, runtime_ms: 1, executed_at: "x", plan_cost: 1, params: {} } }, at: 2 });
    s = runReducer(s, { type: "edit", assumptions, affected: ["b"] });
    s = runReducer(s, { type: "rerun.error", message: "network", affected: ["b"] });
    expect(s.metrics.b!.phase).toBe("done");
    expect(s.rerunError).toBe("network");
  });

  it("metrics still in flight when the run ends are marked as errors, not left loading", () => {
    const s = run({ type: "plan", plan }, { type: "run.done", usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cost_usd: 0 }, elapsed_ms: 1 });
    expect(s.metrics.a!.phase).toBe("error");
    expect(s.status).toBe("done");
  });
});
