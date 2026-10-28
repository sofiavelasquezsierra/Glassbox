"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { formatDelta, formatValue, type Unit } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import type { Cell } from "@/lib/schemas";
import { Sparkline } from "../charts/Sparkline";

/**
 * A headline number. Value in the UI sans at hero size, change vs the
 * comparison period in neutral ink: the agent can't know whether "up" is
 * good for an arbitrary metric, so the delta never claims it with color.
 */
export function MetricCard({
  value,
  previous,
  unit = "count",
  trend,
  size = "lg",
  comparisonLabel = "vs prior period",
  label,
}: {
  value: Cell | undefined;
  previous?: Cell;
  unit?: Unit;
  trend?: number[];
  size?: "md" | "lg";
  comparisonLabel?: string;
  label: string;
}) {
  const reduce = useReducedMotion();
  const delta = formatDelta(value, previous, unit);
  const text = formatValue(value, unit);
  return (
    <div className="flex flex-col gap-1">
      <div className={cn("relative overflow-hidden font-semibold tracking-tight text-ink", size === "lg" ? "h-[3.1rem] text-4xl" : "h-9 text-2xl")}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className="block"
            initial={reduce ? { opacity: 0 } : { y: "60%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: "-60%", opacity: 0 }}
            transition={{ duration: duration.slow, ease: ease.standard }}
            aria-label={`${label}: ${text}`}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      {delta && (
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="font-mono font-medium text-ink tabular">
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "■"} {delta.text}
          </span>
          <span>
            {comparisonLabel} ({formatValue(previous, unit)})
          </span>
        </p>
      )}
      {trend && trend.length > 1 && (
        <div className="mt-2">
          <Sparkline values={trend} label={`${label} trend`} />
        </div>
      )}
    </div>
  );
}
