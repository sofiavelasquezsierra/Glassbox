import { describe, expect, it } from "vitest";
import { diffLines, formatSqlForDisplay, inlineParams, tokenizeSql } from "@/lib/sql-tokens";

describe("display SQL helpers", () => {
  it("tokenizes params, casts, strings and keywords", () => {
    const kinds = tokenizeSql("select :days::int, 'a''b' from t").filter((t) => t.kind !== "space").map((t) => `${t.kind}:${t.text}`);
    expect(kinds).toEqual(["keyword:select", "param::days", "punct:::", "keyword:int", "punct:,", "string:'a''b'", "keyword:from", "ident:t"]);
  });

  it("formats one-line SQL without changing its tokens", () => {
    const sql = "SELECT o.name AS label, count(*) AS value FROM northwind.events e JOIN northwind.organizations o ON o.id = e.org_id WHERE e.type = 'login' AND o.is_test = false GROUP BY o.name ORDER BY value DESC LIMIT 20";
    const out = formatSqlForDisplay(sql);
    expect(out.split("\n").length).toBeGreaterThan(4);
    const strip = (s: string) => tokenizeSql(s).filter((t) => t.kind !== "space").map((t) => t.text).join(" ");
    expect(strip(out)).toBe(strip(sql));
  });

  it("leaves already-structured SQL alone", () => {
    const sql = "select 1\nfrom t\nwhere a = 1\norder by 1";
    expect(formatSqlForDisplay(sql)).toBe(sql);
  });

  it("diffs by line", () => {
    expect(diffLines("a\nb\nc", "a\nx\nc").map((l) => l.op)).toEqual(["same", "del", "add", "same"]);
  });

  it("inlines params as escaped literals, not inside strings", () => {
    expect(inlineParams("select ':days', :days, :name, :flag", { days: 7, name: "o'neil", flag: true })).toBe("select ':days', 7, 'o''neil', true");
  });
});
