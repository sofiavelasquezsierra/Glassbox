"use client";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CATALOG } from "@/lib/schema-catalog";
import { useDictionary, type Proposals } from "@/lib/use-dictionary";
import { Button } from "../system/Button";
import { DictionaryRow } from "../system/DictionaryRow";
import { EmptyState } from "../system/EmptyState";
import { ErrorState } from "../system/ErrorState";
import { ChevronLeft, RefreshIcon, Spinner } from "../system/icons";
import { SkeletonText } from "../system/Skeleton";

type Filter = "all" | "proposed" | "accepted" | "rejected";
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function DictionaryView() {
  const d = useDictionary();
  const [filter, setFilter] = useState<Filter>("all");
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counts = {
    all: d.rows.length,
    proposed: d.rows.filter((r) => r.status === "proposed").length,
    accepted: d.rows.filter((r) => r.status === "accepted").length,
    rejected: d.rows.filter((r) => r.status === "rejected").length,
  };

  const repropose = async () => {
    setProposing(true);
    setError(null);
    try {
      const res = await fetch("/api/dictionary/propose", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't generate proposals right now.");
      d.replaceProposals(body as Proposals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate proposals right now.");
    } finally {
      setProposing(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ChevronLeft size={14} /> Back to the demo
      </Link>
      <header className="mt-4 mb-6 max-w-3xl">
        <p className="eyebrow">Data Dictionary · northwind schema</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-ink">Teach the agent what your data means</h1>
        <p className="mt-2 text-ink-2">
          The agent profiled every column (null rates, common values, ranges) and proposed a plain-English description. Review them: only <strong className="font-medium text-ink">accepted</strong> entries are sent to the agent with your questions. Your decisions stay in this browser.
        </p>
        <p className="mt-2 font-mono text-2xs text-ink-3">
          Proposals by {d.proposals.model} on {day.format(new Date(d.proposals.proposed_at))}
        </p>
      </header>

      <div className="sticky top-14 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-rule bg-paper/90 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-md sm:border">
        <div role="tablist" aria-label="Filter entries" className="flex rounded-sm bg-sunk p-0.5 text-xs">
          {(["all", "proposed", "accepted", "rejected"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn("rounded-xs px-2.5 py-1", filter === f ? "bg-surface font-medium text-ink shadow-1" : "text-ink-2 hover:text-ink")}>
              {f === "all" ? "All" : f === "proposed" ? "Needs review" : f === "accepted" ? "In agent context" : "Rejected"} <span className="font-mono text-ink-3 tabular">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {counts.proposed > 0 && (
            <Button size="sm" variant="primary" onClick={d.acceptAll}>
              Accept all {counts.proposed}
            </Button>
          )}
          <Button size="sm" onClick={repropose} disabled={proposing}>
            {proposing ? <Spinner size={14} /> : <RefreshIcon size={14} />} {proposing ? "Profiling and proposing…" : "Re-propose live"}
          </Button>
          <Button size="sm" variant="ghost" onClick={d.reset}>
            Reset
          </Button>
        </div>
      </div>

      {error && <ErrorState layout="inline" className="mb-4" title={error} onRetry={repropose} />}

      {!d.loaded ? (
        <SkeletonText lines={8} />
      ) : (
        <div className="space-y-6">
          {CATALOG.map(({ table }) => {
            const rows = d.rows.filter((r) => r.table === table && (filter === "all" || r.status === filter));
            if (rows.length === 0) return null;
            return (
              <section key={table} aria-labelledby={`t-${table}`} className="overflow-hidden rounded-lg border border-rule bg-surface shadow-1">
                <h2 id={`t-${table}`} className="border-b border-rule bg-sunk px-4 py-2 font-mono text-sm text-ink">
                  northwind.{table}
                </h2>
                {rows.map((r) => (
                  <DictionaryRow
                    key={r.key}
                    row={r}
                    onAccept={() => d.decide(r.key, { status: "accepted" }, r)}
                    onReject={() => d.decide(r.key, { status: "rejected" }, r)}
                    onRestore={() => d.decide(r.key, { status: "proposed" }, r)}
                    onSave={(description) => d.decide(r.key, { description, status: "accepted", source: "you" }, r)}
                  />
                ))}
              </section>
            );
          })}
          {d.rows.every((r) => filter !== "all" && r.status !== filter) && (
            <EmptyState title={filter === "proposed" ? "Nothing left to review" : "No entries here"}>{filter === "proposed" ? "Every proposal has been accepted or rejected." : "Change the filter to see other entries."}</EmptyState>
          )}
        </div>
      )}
    </main>
  );
}
