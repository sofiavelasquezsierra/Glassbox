"use client";
import { scaleBand, scaleLinear } from "@visx/scale";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { formatValue, type Unit } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import type { Bar } from "./series";
import { useMeasure } from "./useMeasure";

const ROW = 30;
const BAR = 18;

/** Rounded at the data end, square at the baseline (per the mark spec). */
function barPath(x0: number, x1: number, y: number, h: number, r = 4) {
  const w = x1 - x0;
  const rr = Math.min(r, Math.abs(w) / 2, h / 2);
  if (w <= 0.5) return `M${x0},${y}h0.5v${h}h-0.5Z`;
  return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
}

/**
 * Ranked horizontal bars: labels left, value at the bar tip. Bars grow from
 * a shared baseline and re-sort smoothly when values change.
 */
export function BarChart({ bars, unit = "count", label }: { bars: Bar[]; unit?: Unit; label: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const labelW = Math.min(150, Math.max(80, width * 0.32));
  const valueW = 56;
  const innerW = Math.max(0, width - labelW - valueW);
  const height = bars.length * ROW;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const min = Math.min(0, ...bars.map((b) => b.value));
  const x = scaleLinear({ domain: [min, max || 1], range: [0, innerW] });
  const yb = scaleBand({ domain: bars.map((b) => b.label), range: [0, height], padding: 0 });
  const transition = reduce ? { duration: 0 } : { duration: duration.chart, ease: ease.standard };

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <line x1={labelW + x(0)} x2={labelW + x(0)} y2={height} stroke="var(--chart-axis)" />
          {bars.map((b) => {
            const yTop = (yb(b.label) ?? 0) + (ROW - BAR) / 2;
            const x0 = labelW + x(Math.min(0, b.value));
            const x1 = labelW + x(Math.max(0, b.value));
            const dim = hover !== null && hover !== b.label;
            return (
              <motion.g
                key={b.label}
                initial={false}
                animate={{ y: 0, opacity: dim ? 0.45 : 1 }}
                transition={{ duration: duration.fast }}
                onPointerEnter={() => setHover(b.label)}
                onPointerLeave={() => setHover(null)}
              >
                <rect x={0} y={yb(b.label)} width={width} height={ROW} fill="transparent" />
                <text x={labelW - 10} y={yTop + BAR / 2} dy="0.32em" textAnchor="end" className="fill-ink-2 text-[12px]">
                  {b.label.length > 22 ? `${b.label.slice(0, 21)}…` : b.label}
                </text>
                <motion.path
                  initial={reduce ? false : { d: barPath(labelW + x(0), labelW + x(0) + 0.5, yTop, BAR) }}
                  animate={{ d: barPath(x0, x1, yTop, BAR) }}
                  transition={transition}
                  fill="var(--series-1)"
                />
                <motion.text
                  initial={false}
                  animate={{ x: x1 + 6 }}
                  transition={transition}
                  y={yTop + BAR / 2}
                  dy="0.32em"
                  className="fill-ink font-mono text-[11px] tabular"
                >
                  {formatValue(b.value, unit, { compact: true })}
                </motion.text>
                <title>{`${b.label}: ${formatValue(b.value, unit)}`}</title>
              </motion.g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
