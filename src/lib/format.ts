import type { Cell } from "./schemas";

export type Unit = "count" | "percent" | "usd" | "hours" | "ratio";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** Formats a metric value for display. Hero numbers stay exact under 10K, compact above. */
export function formatValue(v: Cell | undefined, unit: Unit = "count", opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  const useCompact = opts.compact ?? Math.abs(n) >= 10_000;
  switch (unit) {
    case "usd":
      return `${n < 0 ? "−" : ""}$${useCompact ? compact.format(Math.abs(n)) : whole.format(Math.abs(n))}`;
    case "percent":
      return `${oneDp.format(n)}%`;
    case "hours":
      return `${oneDp.format(n)}h`;
    case "ratio":
      return oneDp.format(n);
    default:
      return useCompact ? compact.format(n) : whole.format(n);
  }
}

export interface Delta {
  text: string;
  direction: "up" | "down" | "flat";
}

/** Change vs the comparison period; percent units compare in points. */
export function formatDelta(current: Cell | undefined, previous: Cell | undefined, unit: Unit): Delta | null {
  const c = Number(current);
  const p = Number(previous);
  if (current === null || previous === null || !Number.isFinite(c) || !Number.isFinite(p)) return null;
  const diff = unit === "percent" ? c - p : p === 0 ? null : ((c - p) / Math.abs(p)) * 100;
  if (diff === null) return null;
  const direction = Math.abs(diff) < 0.05 ? "flat" : diff > 0 ? "up" : "down";
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "±";
  return { text: `${sign}${oneDp.format(Math.abs(diff))}${unit === "percent" ? " pts" : "%"}`, direction };
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} UTC`;
}

export function formatCell(v: Cell): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return Number.isInteger(v) ? whole.format(v) : oneDp.format(v);
  return String(v);
}
