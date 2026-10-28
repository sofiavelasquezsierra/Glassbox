"use client";
import { useEffect, useState } from "react";
import { STEP_NAMES, STEP_ORDER, type RunState } from "@/lib/run-state";
import { AgentStep } from "../system/AgentStep";

/** The agent's work, step by step, with live timing. */
export function ActivityRail({ state }: { state: RunState }) {
  const [now, setNow] = useState(() => Date.now());
  const running = state.status === "running" && !state.usage;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  const total = state.elapsedMs ?? (state.startedAt ? now - state.startedAt : 0);
  return (
    <section aria-labelledby="rail-h" className="rounded-lg border border-rule bg-surface p-4 shadow-1">
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h2 id="rail-h" className="eyebrow">
          Agent activity
        </h2>
        {state.status !== "idle" && (
          <span className="font-mono text-2xs text-ink-3 tabular">
            {state.mode === "cached"
              ? state.elapsedMs
                ? `recorded · original run ${(state.elapsedMs / 1000).toFixed(1)}s`
                : "replaying a recorded run"
              : `live · ${(total / 1000).toFixed(1)}s`}
          </span>
        )}
      </header>
      <ol aria-live="polite" aria-relevant="text">
        {STEP_ORDER.map((id, i) => {
          const s = state.steps[id];
          // Replays compress waiting time, so per-step timers would misstate the real run.
          const elapsed = state.mode === "live" && s.startedAt ? (s.endedAt ?? now) - s.startedAt : undefined;
          return <AgentStep key={id} index={i + 1} name={STEP_NAMES[id]} status={s.status} label={s.label} detail={s.detail} model={s.model} elapsedMs={elapsed} last={i === STEP_ORDER.length - 1} />;
        })}
      </ol>
      {state.usage && (
        <p className="mt-4 border-t border-rule pt-3 font-mono text-2xs text-ink-3 tabular">
          {state.mode === "cached" ? "Original run: " : ""}
          {(state.usage.input_tokens / 1000).toFixed(1)}K in · {(state.usage.output_tokens / 1000).toFixed(1)}K out · ${state.usage.cost_usd.toFixed(3)}
          {state.mode === "cached" && " · this replay cost $0"}
        </p>
      )}
    </section>
  );
}
