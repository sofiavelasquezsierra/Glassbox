import type { CachedRun } from "@/lib/use-agent-run";
import engaged from "./who-are-our-most-engaged-organizations.json";
import retention from "./how-s-retention-this-quarter.json";
import revenue from "./which-plans-drive-the-most-revenue-growth.json";
import tickets from "./where-are-support-tickets-spiking.json";

/**
 * Recorded agent runs (full event traces + results) replayed for first-time
 * visitors at no API cost. Recorded with `npm run record`.
 */
export const CACHED_RUNS = [retention, revenue, tickets, engaged] as unknown as CachedRun[];

const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function findCached(question: string): CachedRun | undefined {
  return CACHED_RUNS.find((r) => norm(r.question) === norm(question));
}
