"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Assumption } from "./assumptions";
import { affectedBy, changedKeys, initialRun, runReducer } from "./run-state";
import type { DictionaryEntry, RunEvent } from "./schemas";

export interface CachedRun {
  slug: string;
  question: string;
  recorded_at: string;
  events: (RunEvent & { t: number })[];
}

/** Reads server-sent events from a fetch response body. */
async function* readSse(res: Response, signal: AbortSignal): AsyncGenerator<RunEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (data) yield JSON.parse(data.slice(6)) as RunEvent;
    }
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * Owns one agent run on the client: live (SSE from /api/run) or cached
 * (a recorded event log replayed with compressed timing), and assumption
 * edits, which re-execute only the affected signed queries via /api/rerun.
 */
export function useAgentRun() {
  const [state, dispatch] = useReducer(runReducer, initialRun);
  const runAbort = useRef<AbortController | null>(null);
  const rerunAbort = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => () => (runAbort.current?.abort(), rerunAbort.current?.abort()), []);

  const replay = useCallback(async (run: CachedRun, signal: AbortSignal, speed = 1) => {
    let prevT = 0;
    for (const { t, ...event } of run.events) {
      // Compress long model waits so a full run plays in ~10–15 s, keeping order and rhythm.
      const gap = Math.min(t - prevT, event.type === "step" ? 1100 : 450) / speed;
      prevT = t;
      if (gap > 16) await sleep(gap, signal);
      if (signal.aborted) return;
      dispatch({ type: "event", event: event as RunEvent, at: Date.now() });
    }
  }, []);

  const start = useCallback(
    async (opts: { question: string; mode: "live" | "cached"; dictionary: DictionaryEntry[]; cached?: CachedRun; fallback?: (reason: string) => CachedRun | undefined }) => {
      runAbort.current?.abort();
      rerunAbort.current?.abort();
      const ctrl = new AbortController();
      runAbort.current = ctrl;
      dispatch({ type: "start", question: opts.question, mode: opts.mode, at: Date.now() });

      if (opts.mode === "cached" && opts.cached) {
        await replay(opts.cached, ctrl.signal);
        return;
      }

      const fallBack = async (reason: string) => {
        const cached = opts.fallback?.(reason);
        if (cached && !ctrl.signal.aborted) {
          dispatch({ type: "start", question: cached.question, mode: "cached", at: Date.now() });
          dispatch({ type: "notice", message: reason });
          await replay(cached, ctrl.signal, 1.5);
        } else {
          dispatch({ type: "fail", message: reason, retryable: true });
        }
      };

      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: opts.question, dictionary: opts.dictionary }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          await fallBack(body.error ?? (res.status === 429 ? "Live runs are rate limited right now." : "The live agent is unavailable right now."));
          return;
        }
        let sawPlan = false;
        for await (const event of readSse(res, ctrl.signal)) {
          if (event.type === "plan") sawPlan = true;
          if (event.type === "run.error" && !sawPlan && event.retryable && opts.fallback) {
            await fallBack(`${event.message} Showing a recorded run instead.`);
            return;
          }
          dispatch({ type: "event", event, at: Date.now() });
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        await fallBack("Lost the connection to the live agent.");
      }
    },
    [replay],
  );

  const cancel = useCallback(() => {
    runAbort.current?.abort();
    dispatch({ type: "event", event: { type: "run.error", message: "You stopped the run.", retryable: true }, at: Date.now() });
    dispatch({ type: "event", event: { type: "run.done", usage: stateRef.current.usage ?? { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cost_usd: 0 }, elapsed_ms: Date.now() - stateRef.current.startedAt }, at: Date.now() });
  }, []);

  const rerun = useCallback(async (assumptions: Assumption[], affected: string[]) => {
    if (affected.length === 0) return;
    rerunAbort.current?.abort();
    const ctrl = new AbortController();
    rerunAbort.current = ctrl;
    const s = stateRef.current;
    // Re-run every metric still waiting on a superseded request, plus the new ones.
    const ids = [...new Set([...s.rerunning, ...affected])];
    const metrics = ids.flatMap((id) => {
      const m = s.metrics[id];
      return m?.finalSql && m.signature ? [{ metric_id: id, sql: m.finalSql, signature: m.signature }] : [];
    });
    try {
      const res = await fetch("/api/rerun", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assumptions, metrics }),
        signal: ctrl.signal,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't re-run the queries.");
      if (!ctrl.signal.aborted) dispatch({ type: "rerun.result", results: body.results });
    } catch (e) {
      if (!ctrl.signal.aborted) dispatch({ type: "rerun.error", message: e instanceof Error ? e.message : "Couldn't re-run the queries.", affected: ids });
    }
  }, []);

  const editAssumption = useCallback(
    (next: Assumption) => {
      const s = stateRef.current;
      const assumptions = s.assumptions.map((a) => (a.key === next.key ? next : a));
      const affected = affectedBy(s, [next.key]);
      dispatch({ type: "edit", assumptions, affected });
      void rerun(assumptions, affected);
    },
    [rerun],
  );

  const undo = useCallback(() => {
    const s = stateRef.current;
    const prev = s.history.at(-1);
    if (!prev) return;
    const affected = affectedBy(s, changedKeys(s.assumptions, prev));
    dispatch({ type: "undo", affected });
    void rerun(prev, affected);
  }, [rerun]);

  const resetAssumption = useCallback(
    (key: string) => {
      const original = stateRef.current.original.find((a) => a.key === key);
      if (original) editAssumption(original);
    },
    [editAssumption],
  );

  return { state, start, cancel, editAssumption, resetAssumption, undo };
}
