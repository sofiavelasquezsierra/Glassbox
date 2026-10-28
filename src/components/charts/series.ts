import type { Cell, QueryResult } from "@/lib/schemas";

export const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
/** More series than validated slots fold into "Other" rather than inventing a hue. */
export const MAX_SERIES = 4;

export interface Point {
  x: Date;
  y: number;
}
export interface Series {
  name: string;
  color: string;
  points: Point[];
}

const col = (r: QueryResult, name: string, fallback: (c: QueryResult["columns"][number]) => boolean) => {
  const i = r.columns.findIndex((c) => c.name === name);
  return i >= 0 ? i : r.columns.findIndex(fallback);
};
const toDate = (v: Cell) => new Date(typeof v === "string" && v.length === 10 ? `${v}T00:00:00Z` : String(v));

/** Reads the agent's line contract (x, y, optional series) into plottable series. */
export function toSeries(r: QueryResult): Series[] {
  const xi = col(r, "x", (c) => c.type === "date" || c.type === "timestamp");
  const yi = col(r, "y", (c) => c.type === "number");
  const si = r.columns.findIndex((c) => c.name === "series");
  if (xi < 0 || yi < 0) return [];
  const groups = new Map<string, Point[]>();
  for (const row of r.rows) {
    const y = Number(row[yi]);
    if (row[xi] === null || !Number.isFinite(y)) continue;
    const key = si >= 0 ? String(row[si] ?? "Unknown") : "value";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ x: toDate(row[xi]!), y });
  }
  let entries = [...groups.entries()];
  if (entries.length > MAX_SERIES) {
    // Keep the largest series; sum the rest into Other, per x.
    entries.sort((a, b) => b[1].reduce((s, p) => s + p.y, 0) - a[1].reduce((s, p) => s + p.y, 0));
    const other = new Map<number, number>();
    for (const [, pts] of entries.slice(MAX_SERIES - 1)) for (const p of pts) other.set(p.x.getTime(), (other.get(p.x.getTime()) ?? 0) + p.y);
    entries = [...entries.slice(0, MAX_SERIES - 1), ["Other", [...other].map(([t, y]) => ({ x: new Date(t), y }))]];
  }
  return entries.map(([name, points], i) => ({
    name,
    color: SERIES_COLORS[i]!,
    points: points.sort((a, b) => a.x.getTime() - b.x.getTime()),
  }));
}

export interface Bar {
  label: string;
  value: number;
}
/** Reads the bar contract (label, value). */
export function toBars(r: QueryResult): Bar[] {
  const li = col(r, "label", (c) => c.type === "text");
  const vi = col(r, "value", (c) => c.type === "number");
  if (li < 0 || vi < 0) return [];
  return r.rows
    .map((row) => ({ label: String(row[li] ?? "NULL"), value: Number(row[vi]) }))
    .filter((b) => Number.isFinite(b.value))
    .slice(0, 20);
}
