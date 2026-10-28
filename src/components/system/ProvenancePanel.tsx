"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMs, formatTimestamp } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import type { MetricView } from "@/lib/run-types";
import { inlineParams } from "@/lib/sql-tokens";
import { DataTable } from "../charts/DataTable";
import { Button } from "./Button";
import { CopyButton } from "./CopyButton";
import { EmptyState } from "./EmptyState";
import { CloseIcon, ShieldIcon } from "./icons";
import { Kbd } from "./Kbd";
import { ReviewerBadge } from "./ReviewerBadge";
import { SQLBlock, SqlDiff } from "./SQLBlock";

type Tab = "final" | "diff" | "original";

/**
 * Where a number came from: the exact SQL that ran, the reviewer's verdict,
 * the bound parameter values, the returned rows, and when and how fast it
 * ran. Everything needed to re-check the number yourself.
 */
export function ProvenancePanel({
  view,
  footnote,
  reviewerModel,
  onClose,
}: {
  view: MetricView | null;
  footnote?: number;
  reviewerModel?: string;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("final");

  useEffect(() => {
    if (!view) return;
    setTab("final");
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        // Keep focus inside the dialog.
        const f = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"]), input, select, textarea');
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [view?.metric.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalSql = view?.finalSql ?? view?.sql;
  const rewritten = Boolean(view?.review?.rewritten_sql && view?.sql);
  const params = view?.result?.params ?? {};

  return (
    <AnimatePresence>
      {view && (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-40 bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.base }} onClick={onClose} aria-hidden />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="provenance-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[min(640px,92vw)] flex-col bg-raised shadow-panel"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%", transition: { duration: duration.base, ease: ease.exit } }}
            transition={{ duration: duration.slow, ease: ease.standard }}
          >
            <header className="flex items-start gap-3 border-b border-rule px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Provenance {footnote !== undefined && `[${footnote}]`}</p>
                <h2 id="provenance-title" className="mt-1 text-lg font-medium text-ink">
                  {view.metric.title}
                </h2>
                <p className="mt-0.5 text-sm text-ink-2">{view.metric.description}</p>
              </div>
              <Button ref={closeRef} size="sm" variant="ghost" onClick={onClose} aria-label="Close provenance panel">
                <Kbd className="hidden sm:inline-flex">Esc</Kbd>
                <CloseIcon size={14} />
              </Button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section aria-labelledby="pv-review">
                <h3 id="pv-review" className="eyebrow mb-2">
                  Reviewer verdict
                </h3>
                {view.review ? (
                  <div className="rounded-md border border-rule bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <ReviewerBadge verdict={view.review.verdict} size="md" rewritten={rewritten} />
                      {reviewerModel && <span className="font-mono text-2xs text-ink-3">{reviewerModel}</span>}
                    </div>
                    <p className="mt-2 text-sm text-ink">{view.review.summary}</p>
                    {view.review.issues.length > 0 && (
                      <ul className="mt-2 space-y-1.5 border-t border-rule pt-2 text-sm">
                        {view.review.issues.map((i, k) => (
                          <li key={k} className="grid grid-cols-[7.5rem_1fr] gap-2">
                            <span className={cn("font-mono text-2xs uppercase", i.severity === "block" ? "text-block" : "text-warn")}>{i.code.replace("_", " ")}</span>
                            <span className="text-ink-2">{i.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-3">Not reviewed yet.</p>
                )}
              </section>

              <section aria-labelledby="pv-sql">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 id="pv-sql" className="eyebrow">
                    {rewritten ? "SQL" : "SQL that ran"}
                  </h3>
                  {rewritten && (
                    <div role="tablist" aria-label="SQL version" className="flex rounded-sm bg-sunk p-0.5 text-xs">
                      {(["final", "diff", "original"] as Tab[]).map((t) => (
                        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-xs px-2 py-1", tab === t ? "bg-surface font-medium text-ink shadow-1" : "text-ink-2 hover:text-ink")}>
                          {t === "final" ? "What ran" : t === "diff" ? "Reviewer fix" : "Agent's draft"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {finalSql ? (
                  tab === "diff" && rewritten ? (
                    <SqlDiff before={view.sql!} after={view.review!.rewritten_sql!} />
                  ) : (
                    <SQLBlock sql={tab === "original" ? view.sql! : finalSql} title={tab === "original" ? "Agent's draft (not run)" : "Executed as glassbox_reader"} maxHeight={360} />
                  )
                ) : (
                  <p className="text-sm text-ink-3">No SQL yet.</p>
                )}
                {finalSql && Object.keys(params).length > 0 && (
                  <div className="mt-1.5 flex justify-end">
                    <CopyButton text={inlineParams(finalSql, params)} label="Copy with values (for psql)" />
                  </div>
                )}
              </section>

              {Object.keys(params).length > 0 && (
                <section aria-labelledby="pv-params">
                  <h3 id="pv-params" className="eyebrow mb-2">
                    Bound parameters
                  </h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-rule bg-surface px-3 py-2 font-mono text-xs">
                    {Object.entries(params).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-[var(--syn-param)]">:{k}</dt>
                        <dd className="text-ink">{JSON.stringify(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <section aria-labelledby="pv-rows">
                <h3 id="pv-rows" className="eyebrow mb-2">
                  Rows returned
                </h3>
                {view.result ? (
                  <DataTable result={view.result} pageSize={10} caption={`Rows returned for ${view.metric.title}`} />
                ) : (
                  <EmptyState compact title={view.phase === "blocked" ? "Not executed: blocked by the reviewer" : view.phase === "error" ? "The query didn't return rows" : "Not executed yet"}>
                    {view.error?.message}
                  </EmptyState>
                )}
              </section>

              {view.result && (
                <section aria-labelledby="pv-run">
                  <h3 id="pv-run" className="eyebrow mb-2">
                    Execution
                  </h3>
                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule text-xs sm:grid-cols-4">
                    {[
                      ["Runtime", formatMs(view.result.runtime_ms)],
                      ["Rows", view.result.row_count.toLocaleString() + (view.result.truncated ? "+" : "")],
                      ["Planner cost", view.result.plan_cost.toLocaleString()],
                      ["Ran at", formatTimestamp(view.result.executed_at)],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-surface px-3 py-2">
                        <dt className="text-ink-3">{k}</dt>
                        <dd className="mt-0.5 font-mono text-ink tabular">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
                    <ShieldIcon size={14} className="mt-px shrink-0" />
                    Validated as a single SELECT, checked with EXPLAIN, then run in a READ ONLY transaction as a role that can only read the demo schema, with a 5 s timeout and a 1,000-row cap.
                  </p>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
