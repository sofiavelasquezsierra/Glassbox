import type { CachedRun } from "@/lib/use-agent-run";

/**
 * Recorded agent runs (full event traces + results) replayed for first-time
 * visitors at no API cost. Recorded with `npm run record`.
 */
export const CACHED_RUNS: CachedRun[] = [];

const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function findCached(question: string): CachedRun | undefined {
  return CACHED_RUNS.find((r) => norm(r.question) === norm(question));
}
