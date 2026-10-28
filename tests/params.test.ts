import { describe, expect, it } from "vitest";
import {
  assumptionParams,
  assumptionsUsedBy,
  compileNamed,
  lexPlaceholders,
  ParamError,
  paramsUsedBy,
  resolveDateRange,
} from "@/server/sql/params";
import type { Assumption } from "@/lib/assumptions";

describe("lexPlaceholders", () => {
  it("finds :name placeholders but not ::casts", () => {
    const sql = "select :a::int, x::text from t where y = :b and z = :a";
    expect(paramsUsedBy(sql)).toEqual(["a", "b"]);
  });

  it("ignores placeholders in strings, identifiers, comments and dollar quotes", () => {
    const sql = `select ':not_a', "col:nope", $$ :also_not $$, $tag$ :x $tag$ -- :comment
      /* :block /* :nested */ */ from t where a = :real and b = E'it\\'s :quoted'`;
    expect(paramsUsedBy(sql)).toEqual(["real"]);
  });

  it("reports positional parameters", () => {
    expect(lexPlaceholders("select $1, $2 from t").positional).toEqual([1, 2]);
  });

  it("throws on unterminated constructs", () => {
    expect(() => lexPlaceholders("select '")).toThrow(ParamError);
    expect(() => lexPlaceholders("select /* ")).toThrow(ParamError);
    expect(() => lexPlaceholders("select $$ ")).toThrow(ParamError);
  });
});

describe("compileNamed", () => {
  it("rewrites to positional params, reusing indexes for repeated names", () => {
    const out = compileNamed("select * from t where a > :days and b < :days and c = :tz", { days: 30, tz: "UTC" });
    expect(out.text).toBe("select * from t where a > $1 and b < $1 and c = $2");
    expect(out.values).toEqual([30, "UTC"]);
    expect(out.used).toEqual(["days", "tz"]);
  });

  it("never interpolates values into the SQL text", () => {
    const evil = "'; drop table northwind.users; --";
    const out = compileNamed("select * from t where name = :name", { name: evil });
    expect(out.text).not.toContain("drop");
    expect(out.values).toEqual([evil]);
  });

  it("rejects unknown parameters and positional params", () => {
    expect(() => compileNamed("select :missing", {})).toThrow(/unknown parameter :missing/);
    expect(() => compileNamed("select $1", {})).toThrow(/positional/);
  });

  it("does not resolve inherited object keys as parameters", () => {
    expect(() => compileNamed("select :constructor", {})).toThrow(/unknown parameter/);
  });
});

describe("resolveDateRange (as of 2026-10-28)", () => {
  const asOf = "2026-10-28";
  it("this_quarter is quarter-to-date with an equal-length comparison window", () => {
    expect(resolveDateRange({ preset: "this_quarter" }, asOf)).toEqual({
      start: "2026-10-01",
      end: "2026-10-29",
      prevStart: "2026-07-01",
      prevEnd: "2026-07-29",
    });
  });
  it("last_quarter is the previous full calendar quarter", () => {
    expect(resolveDateRange({ preset: "last_quarter" }, asOf)).toEqual({
      start: "2026-07-01",
      end: "2026-10-01",
      prevStart: "2026-04-01",
      prevEnd: "2026-07-01",
    });
  });
  it("rolling windows end tomorrow (exclusive) and compare to the window before", () => {
    expect(resolveDateRange({ preset: "last_30_days" }, asOf)).toEqual({
      start: "2026-09-29",
      end: "2026-10-29",
      prevStart: "2026-08-30",
      prevEnd: "2026-09-29",
    });
  });
  it("year_to_date compares to the same span last year", () => {
    expect(resolveDateRange({ preset: "year_to_date" }, asOf)).toEqual({
      start: "2026-01-01",
      end: "2026-10-29",
      prevStart: "2025-01-01",
      prevEnd: "2025-10-29",
    });
  });
  it("custom ranges are inclusive of their end date", () => {
    expect(resolveDateRange({ preset: "custom", start: "2026-08-10", end: "2026-08-16" }, asOf)).toEqual({
      start: "2026-08-10",
      end: "2026-08-17",
      prevStart: "2026-08-03",
      prevEnd: "2026-08-10",
    });
  });
  it("rejects inverted or invalid custom ranges", () => {
    expect(() => resolveDateRange({ preset: "custom", start: "2026-08-10", end: "2026-08-01" }, asOf)).toThrow();
    expect(() => resolveDateRange({ preset: "custom", start: "2026-02-30", end: "2026-03-01" }, asOf)).toThrow();
  });
});

describe("assumptionParams", () => {
  const assumptions: Assumption[] = [
    { key: "active_window_days", label: "Active window", type: "int", value: 30, min: 1, max: 365, unit: "days", rationale: "" },
    { key: "exclude_test_accounts", label: "Exclude test accounts", type: "bool", value: true, rationale: "" },
    { key: "timezone", label: "Timezone", type: "timezone", value: "UTC", rationale: "" },
    { key: "date_range", label: "Period", type: "date_range", value: { preset: "this_quarter" }, rationale: "" },
  ];

  it("flattens typed assumptions into bound parameters", () => {
    expect(assumptionParams(assumptions, "2026-10-28")).toEqual({
      as_of: "2026-10-28",
      active_window_days: 30,
      exclude_test_accounts: true,
      timezone: "UTC",
      date_range_start: "2026-10-01",
      date_range_end: "2026-10-29",
      date_range_prev_start: "2026-07-01",
      date_range_prev_end: "2026-07-29",
    });
  });

  it("enforces bounds on edited values", () => {
    const tooBig = assumptions.map((a) => (a.type === "int" ? { ...a, value: 9999 } : a));
    expect(() => assumptionParams(tooBig)).toThrow(/between 1 and 365/);
  });

  it("maps query parameters back to the assumptions that drive them", () => {
    const sql = "select * from events where occurred_at >= :date_range_start and ts > :as_of::date - :active_window_days";
    expect(assumptionsUsedBy(sql, assumptions)).toEqual(["date_range", "active_window_days"]);
  });

  it("substitutes end to end: only the changed value differs", () => {
    const sql = "select count(*) from users where last_seen_at >= :as_of::date - :active_window_days";
    const a = compileNamed(sql, assumptionParams(assumptions));
    const edited = assumptions.map((x) => (x.key === "active_window_days" ? { ...x, value: 7 } : x)) as Assumption[];
    const b = compileNamed(sql, assumptionParams(edited));
    expect(a.text).toBe(b.text);
    expect(a.values).toEqual(["2026-10-28", 30]);
    expect(b.values).toEqual(["2026-10-28", 7]);
  });
});
