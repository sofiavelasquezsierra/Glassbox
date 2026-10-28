import { TIMEZONES, DEMO_AS_OF } from "@/lib/constants";
import type { Assumption, DateRangeValue } from "@/lib/assumptions";

/**
 * Named parameters.
 *
 * The model writes SQL with `:name` placeholders. We never interpolate
 * values into SQL text: placeholders are compiled to positional `$n`
 * parameters and bound by the driver. A date_range assumption with key K
 * expands to four DATE parameters: K_start, K_end (exclusive), K_prev_start
 * and K_prev_end (the comparison period).
 */

export type ParamValue = string | number | boolean;

export class ParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}

export interface Placeholder {
  name: string;
  start: number;
  end: number;
}

export interface LexResult {
  placeholders: Placeholder[];
  /** Positional `$1` style parameters found outside strings/comments. */
  positional: number[];
}

/**
 * Finds `:name` placeholders outside of string literals, quoted identifiers,
 * dollar-quoted bodies and comments. `::type` casts are not placeholders.
 * Unterminated strings or comments throw, since the parser would reject them
 * anyway and we don't want to guess where they end.
 */
export function lexPlaceholders(sql: string): LexResult {
  const placeholders: Placeholder[] = [];
  const positional: number[] = [];
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const c = sql[i]!;
    const next = sql[i + 1];

    if (c === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (c === "/" && next === "*") {
      // Postgres block comments nest.
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") (depth++, (i += 2));
        else if (sql[i] === "*" && sql[i + 1] === "/") (depth--, (i += 2));
        else i++;
      }
      if (depth > 0) throw new ParamError("unterminated block comment");
      continue;
    }
    if (c === "'") {
      const escaped = i > 0 && /[eE]/.test(sql[i - 1]!) && !/\w/.test(sql[i - 2] ?? "");
      i++;
      let closed = false;
      while (i < n) {
        if (escaped && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) throw new ParamError("unterminated string literal");
      continue;
    }
    if (c === '"') {
      const close = sql.indexOf('"', i + 1);
      if (close === -1) throw new ParamError("unterminated quoted identifier");
      i = close + 1;
      continue;
    }
    if (c === "$") {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        if (close === -1) throw new ParamError("unterminated dollar-quoted string");
        i = close + tag[0].length;
        continue;
      }
      const pos = /^\$(\d+)/.exec(sql.slice(i));
      if (pos) {
        positional.push(Number(pos[1]));
        i += pos[0].length;
        continue;
      }
    }
    if (c === ":") {
      if (next === ":") {
        i += 2;
        continue;
      }
      const m = /^:([a-z][a-z0-9_]*)/.exec(sql.slice(i));
      if (m && !/[\w:]/.test(sql[i - 1] ?? "")) {
        placeholders.push({ name: m[1]!, start: i, end: i + m[0].length });
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  return { placeholders, positional };
}

/** Names of the parameters a query references, in first-use order. */
export function paramsUsedBy(sql: string): string[] {
  return [...new Set(lexPlaceholders(sql).placeholders.map((p) => p.name))];
}

export interface CompiledQuery {
  text: string;
  values: ParamValue[];
  used: string[];
}

/** Rewrites `:name` to `$n` and returns the bound values in order. */
export function compileNamed(sql: string, params: Record<string, ParamValue>): CompiledQuery {
  const { placeholders, positional } = lexPlaceholders(sql);
  if (positional.length > 0) {
    throw new ParamError("positional parameters ($1) are not allowed; use :named parameters");
  }
  const index = new Map<string, number>();
  const values: ParamValue[] = [];
  let text = "";
  let cursor = 0;
  for (const p of placeholders) {
    if (!Object.hasOwn(params, p.name)) {
      throw new ParamError(`unknown parameter :${p.name}`);
    }
    let n = index.get(p.name);
    if (n === undefined) {
      values.push(params[p.name]!);
      n = values.length;
      index.set(p.name, n);
    }
    text += sql.slice(cursor, p.start) + `$${n}`;
    cursor = p.end;
  }
  text += sql.slice(cursor);
  return { text, values, used: [...index.keys()] };
}

// ── Date ranges ──────────────────────────────────────────────────────────────

export interface ResolvedRange {
  /** Inclusive start, YYYY-MM-DD. */
  start: string;
  /** Exclusive end, YYYY-MM-DD. */
  end: string;
  prevStart: string;
  prevEnd: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || iso(d) !== s) throw new ParamError(`invalid date ${s}`);
  return d;
};
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const addMonths = (d: Date, months: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
const quarterStart = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

/**
 * Resolves a preset to concrete calendar dates relative to `asOf` (inclusive).
 * Ranges are calendar dates; queries apply the timezone assumption when
 * comparing timestamps against them.
 */
export function resolveDateRange(value: DateRangeValue, asOf: string = DEMO_AS_OF): ResolvedRange {
  const today = parse(asOf);
  const endEx = addDays(today, 1);

  const window = (start: Date, end: Date): ResolvedRange => {
    const len = daysBetween(start, end);
    return { start: iso(start), end: iso(end), prevStart: iso(addDays(start, -len)), prevEnd: iso(start) };
  };

  switch (value.preset) {
    case "this_quarter": {
      // Quarter to date, compared with the same number of days into last quarter.
      const qs = quarterStart(today);
      const prevQs = addMonths(qs, -3);
      const elapsed = daysBetween(qs, endEx);
      return { start: iso(qs), end: iso(endEx), prevStart: iso(prevQs), prevEnd: iso(addDays(prevQs, elapsed)) };
    }
    case "last_quarter": {
      const qs = addMonths(quarterStart(today), -3);
      return { start: iso(qs), end: iso(addMonths(qs, 3)), prevStart: iso(addMonths(qs, -3)), prevEnd: iso(qs) };
    }
    case "last_30_days":
      return window(addDays(endEx, -30), endEx);
    case "last_90_days":
      return window(addDays(endEx, -90), endEx);
    case "last_6_months":
      return window(addMonths(endEx, -6), endEx);
    case "last_12_months":
      return window(addMonths(endEx, -12), endEx);
    case "year_to_date": {
      const ys = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      const prevYs = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
      return { start: iso(ys), end: iso(endEx), prevStart: iso(prevYs), prevEnd: iso(addMonths(endEx, -12)) };
    }
    case "custom": {
      const s = parse(value.start);
      const e = addDays(parse(value.end), 1);
      if (e <= s) throw new ParamError("date range end is before its start");
      return window(s, e);
    }
  }
}

// ── Assumptions → bound parameters ───────────────────────────────────────────

function checkAssumption(a: Assumption): void {
  switch (a.type) {
    case "int":
      if (a.value < a.min || a.value > a.max) {
        throw new ParamError(`${a.key} must be between ${a.min} and ${a.max}`);
      }
      return;
    case "enum":
      if (!a.options.includes(a.value)) throw new ParamError(`${a.key} must be one of ${a.options.join(", ")}`);
      return;
    case "timezone":
      if (!(TIMEZONES as readonly string[]).includes(a.value)) throw new ParamError(`unsupported timezone ${a.value}`);
      return;
    default:
      return;
  }
}

/** Expands typed assumptions into the flat parameter map queries bind against. */
export function assumptionParams(assumptions: Assumption[], asOf: string = DEMO_AS_OF): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = { as_of: asOf };
  for (const a of assumptions) {
    checkAssumption(a);
    if (a.type === "date_range") {
      const r = resolveDateRange(a.value, asOf);
      out[`${a.key}_start`] = r.start;
      out[`${a.key}_end`] = r.end;
      out[`${a.key}_prev_start`] = r.prevStart;
      out[`${a.key}_prev_end`] = r.prevEnd;
    } else {
      out[a.key] = a.value;
    }
  }
  return out;
}

/** Maps a parameter name back to the assumption key that produced it. */
export function assumptionKeyFor(param: string, assumptions: Assumption[]): string | undefined {
  for (const a of assumptions) {
    if (a.key === param) return a.key;
    if (a.type === "date_range" && param.startsWith(`${a.key}_`)) {
      const suffix = param.slice(a.key.length + 1);
      if (["start", "end", "prev_start", "prev_end"].includes(suffix)) return a.key;
    }
  }
  return undefined;
}

/** Which assumption keys a query depends on; drives selective re-runs. */
export function assumptionsUsedBy(sql: string, assumptions: Assumption[]): string[] {
  const keys = paramsUsedBy(sql)
    .map((p) => assumptionKeyFor(p, assumptions))
    .filter((k): k is string => k !== undefined);
  return [...new Set(keys)];
}
