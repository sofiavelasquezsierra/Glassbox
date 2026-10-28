"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatCell } from "@/lib/format";
import type { QueryResult } from "@/lib/schemas";
import { Button } from "../system/Button";
import { ChevronLeft, ChevronRight } from "../system/icons";

/**
 * Query rows as a table. Numbers right-aligned in tabular figures; NULL is
 * shown as NULL, never as blank or zero. Paginates long results.
 */
export function DataTable({ result, pageSize = 10, dense, caption }: { result: Pick<QueryResult, "columns" | "rows" | "truncated">; pageSize?: number; dense?: boolean; caption?: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(result.rows.length / pageSize));
  const rows = result.rows.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-rule" tabIndex={0} role="region" aria-label={caption ?? "Query results"}>
        <table className="w-full border-collapse text-left text-xs">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-sunk">
            <tr>
              {result.columns.map((c) => (
                <th key={c.name} scope="col" className={cn("border-b border-rule px-3 py-2 font-mono text-2xs font-medium tracking-wide text-ink-3", c.type === "number" && "text-right")}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-rule last:border-b-0 hover:bg-sunk/60">
                {row.map((v, j) => {
                  const type = result.columns[j]?.type;
                  return (
                    <td key={j} className={cn("px-3 font-mono whitespace-nowrap", dense ? "py-1" : "py-1.5", type === "number" && "text-right tabular", v === null ? "text-ink-3 italic" : "text-ink")}>
                      {formatCell(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length} className="px-3 py-6 text-center text-ink-3">
                  The query returned no rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(pages > 1 || result.truncated) && (
        <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
          <span className="tabular">
            Rows {page * pageSize + 1}–{Math.min((page + 1) * pageSize, result.rows.length)} of {result.rows.length}
            {result.truncated && " (capped at 1,000)"}
          </span>
          {pages > 1 && (
            <span className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="tabular">
                {page + 1} / {pages}
              </span>
              <Button size="sm" variant="ghost" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
