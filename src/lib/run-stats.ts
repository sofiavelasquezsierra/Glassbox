import { CACHED_RUNS } from "@/data/runs";
import type { StepId } from "./schemas";

/**
 * Numbers quoted on /stack and /case-study, computed from the recorded runs
 * at build time so the prose can't drift from the data.
 */
export function recordedRunStats() {
  const runs = CACHED_RUNS.map((r) => {
    const steps: Partial<Record<StepId, { start: number; end: number }>> = {};
    for (const e of r.events) {
      if (e.type !== "step") continue;
      const s = (steps[e.step] ??= { start: e.t, end: e.t });
      if (e.status !== "running") s.end = e.t;
    }
    const done = r.events.find((e) => e.type === "run.done");
    const reviews = r.events.filter((e) => e.type === "review");
    return {
      question: r.question,
      steps,
      elapsedMs: done?.type === "run.done" ? done.elapsed_ms : 0,
      usage: done?.type === "run.done" ? done.usage : undefined,
      queries: reviews.length,
      flagged: reviews.filter((e) => e.type === "review" && e.review.verdict !== "pass").length,
      rewritten: reviews.filter((e) => e.type === "review" && e.review.rewritten_sql).length,
      blocked: reviews.filter((e) => e.type === "review" && e.review.verdict === "block").length,
      recordedAt: r.recorded_at,
    };
  });
  const sum = (f: (r: (typeof runs)[number]) => number) => runs.reduce((s, r) => s + f(r), 0);
  const input = sum((r) => r.usage?.input_tokens ?? 0);
  const cached = sum((r) => r.usage?.cache_read_input_tokens ?? 0);
  return {
    runs,
    queries: sum((r) => r.queries),
    flagged: sum((r) => r.flagged),
    rewritten: sum((r) => r.rewritten),
    blocked: sum((r) => r.blocked),
    cacheShare: input ? cached / input : 0,
    minMs: Math.min(...runs.map((r) => r.elapsedMs)),
    maxMs: Math.max(...runs.map((r) => r.elapsedMs)),
    minCost: Math.min(...runs.map((r) => r.usage?.cost_usd ?? 0)),
    maxCost: Math.max(...runs.map((r) => r.usage?.cost_usd ?? 0)),
  };
}
