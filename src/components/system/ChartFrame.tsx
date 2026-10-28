"use client";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMs, type Unit } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import type { MetricView } from "@/lib/run-types";
import { BarChart } from "../charts/BarChart";
import { DataTable } from "../charts/DataTable";
import { LineChart } from "../charts/LineChart";
import { toBars, toSeries } from "../charts/series";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { CodeIcon, TableIcon, WarnIcon } from "./icons";
import { MetricCard } from "./MetricCard";
import { ReviewerBadge, type Verdict } from "./ReviewerBadge";
import { SkeletonChart, Skeleton } from "./Skeleton";
import { SqlDiff } from "./SQLBlock";

const phaseCaption: Partial<Record<MetricView["phase"], string>> = {
  planned: "Waiting for SQL",
  writing: "Writing SQL",
  reviewing: "Reviewer is checking the query",
  running: "Running read-only",
};

function verdictOf(v: MetricView): Verdict {
  if (v.review) return v.review.verdict;
  return v.phase === "reviewing" ? "reviewing" : "pending";
}

function Body({ view, height }: { view: MetricView; height: number }) {
  const { metric, result } = view;
  const unit = metric.unit as Unit;
  if (!result) return null;
  if (result.rows.length === 0) {
    return (
      <EmptyState compact icon={<TableIcon />} title="No rows for these assumptions">
        Try a wider date range or relax a filter above.
      </EmptyState>
    );
  }
  switch (metric.chart) {
    case "kpi": {
      const vi = result.columns.findIndex((c) => c.name === "value");
      const pi = result.columns.findIndex((c) => c.name === "previous_value");
      const row = result.rows[0]!;
      return <MetricCard label={metric.title} unit={unit} value={row[vi >= 0 ? vi : 0]} previous={pi >= 0 ? row[pi] : undefined} />;
    }
    case "line": {
      const series = toSeries(result);
      return series.length ? <LineChart series={series} unit={unit} height={height} label={`${metric.title}, line chart`} /> : <DataTable result={result} pageSize={6} dense />;
    }
    case "bar": {
      const bars = toBars(result);
      return bars.length ? <BarChart bars={bars} unit={unit} label={`${metric.title}, bar chart`} /> : <DataTable result={result} pageSize={6} dense />;
    }
    default:
      return <DataTable result={result} pageSize={6} dense caption={metric.title} />;
  }
}

/**
 * The frame every metric renders in. Owns all of a metric's states:
 * skeleton while the agent works, the chart, reviewer warnings inline with
 * a before/after diff when the reviewer rewrote the query, blocked and
 * failed states, and a quiet provenance footer.
 */
export const ChartFrame = forwardRef<
  HTMLElement,
  {
    view: MetricView;
    footnote: number;
    selected?: boolean;
    onOpenProvenance?: () => void;
    onRetry?: () => void;
    className?: string;
  }
>(function ChartFrame({ view, footnote, selected, onOpenProvenance, onRetry, className }, ref) {
  const [showFix, setShowFix] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const { metric, phase, review, result } = view;
  const kpi = metric.chart === "kpi";
  const height = kpi ? 96 : metric.chart === "table" ? 220 : 200;
  const flagged = review && review.verdict !== "pass";
  const rewritten = Boolean(review?.rewritten_sql && view.sql);
  const loading = phase === "planned" || phase === "writing" || phase === "reviewing" || phase === "running";

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-labelledby={`metric-${metric.id}`}
      data-selected={selected || undefined}
      className={cn(
        "group flex flex-col rounded-lg border bg-surface shadow-1 outline-none",
        "transition-[border-color,box-shadow] duration-[var(--dur-base)]",
        selected ? "border-ink-3 ring-2 ring-focus/50" : "border-rule",
        className,
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <h3 id={`metric-${metric.id}`} className="flex items-baseline gap-1.5 text-sm font-medium text-ink">
            {metric.title}
            <sup className="font-mono text-2xs font-normal text-ink-3">[{footnote}]</sup>
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{metric.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ReviewerBadge verdict={verdictOf(view)} rewritten={rewritten} />
          {onOpenProvenance && (
            <Button size="sm" variant="ghost" onClick={onOpenProvenance} aria-label={`Show SQL and rows for ${metric.title}`} disabled={!view.sql}>
              <CodeIcon size={14} />
              <span className="hidden sm:inline">SQL</span>
            </Button>
          )}
        </div>
      </header>

      <div className={cn("relative flex-1 px-4", kpi ? "pt-3 pb-3" : "pt-4 pb-3")}>
        {phase === "rerunning" && (
          // Re-running keeps the old numbers fully legible; a hairline shows work in progress.
          <span aria-hidden className="absolute inset-x-4 top-0 h-px overflow-hidden bg-accent/30">
            <span className="block h-full w-1/3 bg-accent motion-safe:animate-[indeterminate_1.1s_var(--ease-standard)_infinite]" />
          </span>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div key="loading" exit={{ opacity: 0, transition: { duration: duration.fast } }}>
              {kpi ? (
                <div className="space-y-2">
                  <Skeleton className="h-11 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ) : (
                <SkeletonChart kind={metric.chart === "bar" ? "bar" : metric.chart === "table" ? "table" : "line"} height={height - 16} />
              )}
              <p className="mt-2 flex items-center gap-1.5 font-mono text-2xs text-ink-3" aria-live="polite">
                <span className="size-1.5 rounded-full bg-ink-3 motion-safe:animate-pulse" />
                {phaseCaption[phase]}
              </p>
            </motion.div>
          ) : phase === "blocked" ? (
            <motion.div key="blocked" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorState title="The reviewer blocked this query" detail={review?.summary} onRetry={onOpenProvenance} retryLabel="See why">
                Showing a number the reviewer believes is wrong would be worse than showing nothing.
              </ErrorState>
            </motion.div>
          ) : phase === "error" ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorState title={view.error?.stage === "execute" ? "The query failed to run" : "The agent couldn't produce this metric"} detail={view.error?.message} onRetry={onRetry} />
            </motion.div>
          ) : (
            <motion.div
              key="chart"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, ease: ease.standard }}
              aria-busy={phase === "rerunning"}
            >
              <Body view={view} height={height} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {flagged && result && phase !== "blocked" && (
        <div className="mx-4 mb-3 rounded-md border border-warn/30 bg-warn-wash px-3 py-2.5 text-xs">
          <p className="flex gap-1.5 text-ink">
            <WarnIcon size={14} className="mt-px shrink-0 text-warn" />
            <span>{review!.summary}</span>
          </p>
          <AnimatePresence initial={false}>
            {showIssues && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: ease.standard }} className="mt-1.5 space-y-1 overflow-hidden pl-5 text-ink-2">
                {review!.issues.map((i, k) => (
                  <li key={k}>
                    <span className="mr-1.5 font-mono text-2xs text-warn uppercase">{i.code.replace("_", " ")}</span>
                    {i.message}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          <div className="mt-1 -ml-2 flex gap-0.5 pl-5">
            <Button size="sm" variant="ghost" aria-expanded={showIssues} onClick={() => setShowIssues((s) => !s)}>
              {showIssues ? "Hide issues" : `Show ${review!.issues.length} ${review!.issues.length === 1 ? "issue" : "issues"}`}
            </Button>
            {rewritten && (
              <Button size="sm" variant="ghost" aria-expanded={showFix} onClick={() => setShowFix((s) => !s)}>
                {showFix ? "Hide fix" : "See fix"}
              </Button>
            )}
          </div>
          {rewritten && (
            <>
              <AnimatePresence initial={false}>
                {showFix && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: ease.standard }} className="overflow-hidden">
                    <SqlDiff before={view.sql!} after={review!.rewritten_sql!} className="mt-1.5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      <footer className="flex min-h-9 items-center gap-3 border-t whitespace-nowrap border-rule px-4 py-2 font-mono text-2xs text-ink-3">
        {result ? (
          <>
            <span className="tabular">{result.row_count.toLocaleString()} {result.row_count === 1 ? "row" : "rows"}</span>
            <span className="tabular">{formatMs(result.runtime_ms)}</span>
            {view.uses.length > 0 && <span className="min-w-0 truncate">uses {view.uses.join(", ")}</span>}
            {phase === "rerunning" && <span className="ml-auto text-accent-ink">updating…</span>}
          </>
        ) : (
          <span>{phase === "error" || phase === "blocked" ? "Not executed" : "Not executed yet"}</span>
        )}
      </footer>
    </article>
  );
});
