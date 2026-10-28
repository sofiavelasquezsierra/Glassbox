"use client";
import { scaleLinear, scaleUtc } from "@visx/scale";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { formatValue, type Unit } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import type { Series } from "./series";
import { useMeasure } from "./useMeasure";

const M = { top: 12, right: 56, bottom: 26, left: 44 };
const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function pathFor(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("");
}

/**
 * Time series. 2px lines, hairline grid, value labelled at the end, a
 * crosshair tooltip on hover. When the data changes shape-compatibly (same
 * number of points), the line morphs to its new position.
 */
export function LineChart({ series, unit = "count", height = 200, label }: { series: Series[]; unit?: Unit; height?: number; label: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;

  const { x, y, xs } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const t = all.map((p) => p.x.getTime());
    const xsAll = [...new Set(t)].sort((a, b) => a - b);
    let max = Math.max(...all.map((p) => p.y));
    let min = Math.min(...all.map((p) => p.y));
    // Lines (unlike bars) needn't start at zero. When values sit in a narrow
    // band far from zero (e.g. retention at 95–100%), fit the band so the
    // change is visible; otherwise anchor at zero.
    const span = max - min;
    if (min > 0 && span < max * 0.35) {
      const pad = Math.max(span * 0.25, Math.abs(max) * 0.01);
      min -= pad;
      max += pad;
    } else {
      min = Math.min(0, min);
      max = Math.max(0, max);
    }
    return {
      x: scaleUtc({ domain: [new Date(Math.min(...t)), new Date(Math.max(...t))], range: [0, innerW] }),
      y: scaleLinear({ domain: [min, max === min ? min + 1 : max], range: [innerH, 0], nice: 4 }),
      xs: xsAll,
    };
  }, [series, innerW, innerH]);

  const transition = reduce ? { duration: 0 } : { duration: duration.chart, ease: ease.standard };
  const ticks = y.ticks(4);
  const xTicks = x.ticks(Math.max(2, Math.min(6, Math.floor(innerW / 90))));
  const single = series.length === 1;
  const hoverT = hover !== null ? xs[hover] : undefined;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = x.invert(e.clientX - box.left).getTime();
    let best = 0;
    xs.forEach((v, i) => Math.abs(v - t) < Math.abs(xs[best]! - t) && (best = i));
    setHover(best);
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <g transform={`translate(${M.left},${M.top})`}>
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} stroke={t === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} />
                <text x={-8} dy="0.32em" textAnchor="end" className="fill-ink-3 font-mono text-[10px] tabular">
                  {formatValue(t, unit, { compact: true })}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t.getTime()} x={x(t)} y={innerH + 18} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
                {fmtDay.format(t)}
              </text>
            ))}
            {series.map((s) => {
              const pts = s.points.map((p) => ({ x: x(p.x), y: y(p.y) }));
              const d = pathFor(pts);
              const last = pts.at(-1);
              const area = single && pts.length > 1 ? `${d}L${last!.x},${y(Math.max(0, y.domain()[0]!))}L${pts[0]!.x},${y(Math.max(0, y.domain()[0]!))}Z` : null;
              return (
                <g key={`${s.name}-${pts.length}`}>
                  {area && (
                    <motion.path
                      initial={{ d: area, opacity: 0 }}
                      animate={{ d: area, opacity: 1 }}
                      transition={transition}
                      fill={s.color}
                      fillOpacity={0.1}
                    />
                  )}
                  <motion.path
                    initial={reduce ? false : { pathLength: 0, d }}
                    animate={{ pathLength: 1, d }}
                    transition={transition}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {last && (
                    <motion.circle animate={{ cx: last.x, cy: last.y }} initial={false} transition={transition} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  )}
                  {last && (single || series.length <= 4) && (
                    <motion.text
                      animate={{ x: last.x + 9, y: last.y }}
                      initial={false}
                      transition={transition}
                      dy="0.32em"
                      className="fill-ink-2 font-mono text-[10px] tabular"
                    >
                      {single ? formatValue(s.points.at(-1)!.y, unit, { compact: true }) : s.name.slice(0, 8)}
                    </motion.text>
                  )}
                </g>
              );
            })}
            {hoverT !== undefined && (
              <g pointerEvents="none">
                <line x1={x(new Date(hoverT))} x2={x(new Date(hoverT))} y2={innerH} stroke="var(--ink-3)" strokeOpacity={0.5} />
                {series.map((s) => {
                  const p = s.points.find((q) => q.x.getTime() === hoverT);
                  return p ? <circle key={s.name} cx={x(p.x)} cy={y(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null;
                })}
              </g>
            )}
            <rect width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
      )}
      {hoverT !== undefined && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 z-10 min-w-28 rounded-sm border border-rule bg-raised px-2.5 py-1.5 text-xs shadow-2"
          style={{ left: Math.min(M.left + x(new Date(hoverT)) + 10, width - 150) }}
        >
          <p className="mb-0.5 font-mono text-2xs text-ink-3">{fmtDay.format(new Date(hoverT))}</p>
          {series.map((s) => {
            const p = s.points.find((q) => q.x.getTime() === hoverT);
            return (
              <p key={s.name} className="flex items-center gap-1.5 text-ink">
                {!single && <span className="size-2 rounded-full" style={{ background: s.color }} />}
                {!single && <span className="text-ink-2">{s.name}</span>}
                <span className="ml-auto font-medium tabular">{p ? formatValue(p.y, unit) : "—"}</span>
              </p>
            );
          })}
        </div>
      )}
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-11 text-xs text-ink-2" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
