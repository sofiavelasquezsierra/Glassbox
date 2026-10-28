"use client";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef } from "react";
import type { Assumption } from "@/lib/assumptions";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";
import { changedKeys, type RunState } from "@/lib/run-state";
import { AssumptionChip } from "../system/AssumptionChip";
import { Button } from "../system/Button";
import { ChartFrame } from "../system/ChartFrame";
import { ErrorState } from "../system/ErrorState";
import { UndoIcon } from "../system/icons";
import { Kbd } from "../system/Kbd";
import { Skeleton } from "../system/Skeleton";

/** Display order: headline numbers first, then charts, tables last (full width). */
export function displayOrder(state: RunState): string[] {
  const rank = { kpi: 0, line: 1, bar: 1, table: 2 } as const;
  return [...state.order].sort((a, b) => rank[state.metrics[a]!.metric.chart] - rank[state.metrics[b]!.metric.chart]);
}

export const Dashboard = forwardRef<
  HTMLDivElement,
  {
    state: RunState;
    selected: number | null;
    onSelect: (i: number) => void;
    onOpen: (id: string) => void;
    onEdit: (a: Assumption) => void;
    onReset: (key: string) => void;
    onUndo: () => void;
    onRetry: () => void;
    cardRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  }
>(function Dashboard({ state, selected, onSelect, onOpen, onEdit, onReset, onUndo, onRetry, cardRefs }, ref) {
  const order = displayOrder(state);
  const footnote = (id: string) => state.order.indexOf(id) + 1;
  const changed = changedKeys(state.assumptions, state.original);
  const used = new Set(Object.values(state.metrics).flatMap((m) => m.uses));
  const affects = (key: string) => Object.values(state.metrics).filter((m) => m.uses.includes(key)).length;
  const failed = order.filter((id) => ["error", "blocked"].includes(state.metrics[id]!.phase));
  const settled = state.status === "done";

  return (
    <div ref={ref} className="min-w-0">
      <header className="mb-5">
        <p className="eyebrow">Dashboard · as of Oct 28, 2026</p>
        <h2 className="mt-1.5 text-2xl font-medium tracking-tight text-ink">{state.question}</h2>
        <AnimatePresence mode="wait" initial={false}>
          {state.plan ? (
            <motion.p key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-ink-2">
              {state.plan.headline}
            </motion.p>
          ) : (
            state.status === "running" && <Skeleton key="s" className="mt-2.5 h-4 w-2/3" />
          )}
        </AnimatePresence>
      </header>

      {state.notice && <ErrorState layout="inline" tone="partial" title={state.notice} className="mb-4" />}

      {state.plan && (
        <section aria-labelledby="assumptions-h" className="mb-6 rounded-lg border border-rule bg-accent-wash-2/60 p-3.5">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="assumptions-h" className="eyebrow">
              Assumptions the agent made · click to change
            </h3>
            {changed.length > 0 && (
              <span className="flex items-center gap-2">
                <span className="hidden items-center gap-1 text-2xs text-ink-3 sm:flex">
                  <Kbd>⌘</Kbd>
                  <Kbd>Z</Kbd> undo
                </span>
                <Button size="sm" variant="ghost" onClick={onUndo}>
                  <UndoIcon size={13} /> Undo last change
                </Button>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {state.assumptions.map((a) => {
              const isUsed = used.has(a.key);
              return (
                <AssumptionChip
                  key={a.key}
                  assumption={a}
                  original={state.original.find((o) => o.key === a.key)}
                  affects={affects(a.key)}
                  unused={settled && !isUsed}
                  busy={state.metrics && Object.entries(state.metrics).some(([id, m]) => m.uses.includes(a.key) && state.rerunning.includes(id))}
                  disabled={!settled || !isUsed}
                  onChange={onEdit}
                  onUndo={() => onReset(a.key)}
                />
              );
            })}
          </div>
          {changed.length > 0 && (
            <p className="mt-2.5 text-xs text-ink-3">
              Changed values re-run the same reviewed SQL with new parameters; no model is called. The reviewer checked these queries with the agent&apos;s original values.
            </p>
          )}
          {state.rerunError && <ErrorState layout="inline" title="Couldn't re-run with the new values" className="mt-3" detail={state.rerunError}>The charts still show the previous values.</ErrorState>}
        </section>
      )}

      {settled && failed.length > 0 && failed.length < order.length && (
        <ErrorState layout="inline" tone="partial" className="mb-4" title={`${order.length - failed.length} of ${order.length} metrics ran`}>
          {failed.length === 1 ? "One metric" : `${failed.length} metrics`} didn&apos;t produce a result; the others are unaffected.
        </ErrorState>
      )}

      {state.error && (
        <ErrorState layout={state.plan ? "inline" : "block"} className={cn(state.plan ? "mb-4" : "rounded-lg border border-rule bg-surface")} title={state.plan ? "The run didn't finish" : "The agent couldn't answer this"} onRetry={state.error.retryable ? onRetry : undefined}>
          {state.error.message}
        </ErrorState>
      )}

      {order.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {order.map((id, i) => {
            const v = state.metrics[id]!;
            const wide = v.metric.chart === "table" || (v.metric.chart !== "kpi" && order.filter((x) => state.metrics[x]!.metric.chart !== "kpi").length === 1);
            return (
              <motion.div key={id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease: ease.standard, delay: i * 0.04 }} className={cn(wide && "md:col-span-2")}>
                <ChartFrame
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  view={v}
                  footnote={footnote(id)}
                  selected={selected === i}
                  onOpenProvenance={() => {
                    onSelect(i);
                    onOpen(id);
                  }}
                  onRetry={onRetry}
                />
              </motion.div>
            );
          })}
        </div>
      )}

      {state.plan && order.length > 0 && (
        <ol className="mt-6 space-y-1 border-t border-rule pt-4 text-xs text-ink-3">
          {state.order.map((id, i) => {
            const v = state.metrics[id]!;
            return (
              <li key={id} className="flex gap-2">
                <span className="font-mono">[{i + 1}]</span>
                <span>
                  <span className="text-ink-2">{v.metric.title}.</span> {v.explanation ?? v.metric.description}{" "}
                  {v.sql && (
                    <button type="button" className="underline decoration-rule-strong underline-offset-2 hover:text-ink" onClick={() => onOpen(id)}>
                      View SQL and rows
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
});
