"use client";
import { scaleLinear } from "@visx/scale";
import { motion, useReducedMotion } from "motion/react";
import { duration, ease } from "@/lib/motion";
import { useMeasure } from "./useMeasure";

/** Trend for a stat tile: de-emphasized line, current value as an accent dot. */
export function Sparkline({ values, height = 32, label }: { values: number[]; height?: number; label: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const reduce = useReducedMotion();
  if (values.length < 2) return <div ref={ref} style={{ height }} />;
  const x = scaleLinear({ domain: [0, values.length - 1], range: [3, Math.max(4, width - 5)] });
  const y = scaleLinear({ domain: [Math.min(...values), Math.max(...values) || 1], range: [height - 4, 4] });
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const t = reduce ? { duration: 0 } : { duration: duration.chart, ease: ease.standard };
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <motion.path key={values.length} initial={reduce ? false : { pathLength: 0, d }} animate={{ pathLength: 1, d }} transition={t} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeLinejoin="round" />
          <motion.circle initial={false} animate={{ cx: x(values.length - 1), cy: y(values.at(-1)!) }} transition={t} r={3.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
