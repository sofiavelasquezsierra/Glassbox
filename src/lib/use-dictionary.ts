"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DictionaryRowData, DictionaryStatus } from "@/components/system/DictionaryRow";
import { DEFAULT_DICTIONARY } from "@/data/dictionary";
import recorded from "@/data/dictionary-proposals.json";
import { CATALOG, entryKey } from "./schema-catalog";
import type { DictionaryEntry } from "./schemas";

const KEY = "glassbox-dictionary-v1";

interface Stored {
  description: string;
  status: DictionaryStatus;
  source: DictionaryRowData["source"];
}

export interface Proposals {
  model: string;
  proposed_at: string;
  entries: DictionaryEntry[];
}

/**
 * The visitor's Data Dictionary. It starts from the starter entries (accepted)
 * plus the agent's recorded proposals (pending), and keeps the visitor's
 * decisions in localStorage. Each visitor curates their own copy, so one
 * person's edits never change another person's agent context.
 */
export function useDictionary() {
  const [decisions, setDecisions] = useState<Record<string, Stored>>({});
  const [proposals, setProposals] = useState<Proposals>(recorded as Proposals);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { decisions?: Record<string, Stored>; proposals?: Proposals };
        if (parsed.decisions) setDecisions(parsed.decisions);
        if (parsed.proposals?.entries?.length) setProposals(parsed.proposals);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ decisions, proposals: proposals === recorded ? undefined : proposals }));
    } catch {}
  }, [decisions, proposals, loaded]);

  const rows = useMemo(() => {
    const starter = new Map(DEFAULT_DICTIONARY.map((e) => [entryKey(e.table, e.column), e]));
    const proposed = new Map(proposals.entries.map((e) => [entryKey(e.table, e.column), e]));
    const out: (DictionaryRowData & { key: string })[] = [];
    for (const { table, columns } of CATALOG) {
      for (const [column, type] of [[null, `${columns.length} columns`] as const, ...columns]) {
        const key = entryKey(table, column);
        const decided = decisions[key];
        const s = starter.get(key);
        const p = proposed.get(key);
        if (decided) out.push({ key, table, column, type, ...decided });
        else if (s) out.push({ key, table, column, type, description: s.description, status: "accepted", source: "starter" });
        else if (p) out.push({ key, table, column, type, description: p.description, status: "proposed", source: "agent" });
      }
    }
    return out;
  }, [decisions, proposals]);

  const accepted: DictionaryEntry[] = useMemo(
    () => rows.filter((r) => r.status === "accepted").map((r) => ({ table: r.table as DictionaryEntry["table"], column: r.column, description: r.description })),
    [rows],
  );

  const decide = useCallback((key: string, patch: Partial<Stored>, row: Stored) => {
    setDecisions((d) => ({ ...d, [key]: { ...row, ...d[key], ...patch } }));
  }, []);

  const acceptAll = useCallback(() => {
    setDecisions((d) => {
      const next = { ...d };
      for (const r of rows) if (r.status === "proposed") next[r.key] = { description: r.description, status: "accepted", source: r.source };
      return next;
    });
  }, [rows]);

  const reset = useCallback(() => {
    setDecisions({});
    setProposals(recorded as Proposals);
  }, []);

  /** Swaps in fresh proposals; decisions the visitor already made are kept. */
  const replaceProposals = useCallback((p: Proposals) => setProposals(p), []);

  return { rows, accepted, proposals, decide, acceptAll, reset, replaceProposals, loaded };
}
