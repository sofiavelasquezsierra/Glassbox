/**
 * Records full agent traces for the suggested questions so first-time
 * visitors see a complete run instantly with no API cost. Each event keeps
 * its real offset (t, ms) so the replay preserves order and rhythm.
 *   npm run record                 all suggested questions
 *   npm run record -- "question"   one question
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "./env";

loadEnv();
const { runAgent } = await import("../src/server/agent/pipeline");
const { DEFAULT_DICTIONARY } = await import("../src/data/dictionary");
const { SUGGESTED } = await import("../src/data/suggested");

const args = process.argv.slice(2);
const questions = args.length ? [args.join(" ")] : SUGGESTED;
const slug = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

mkdirSync("src/data/runs", { recursive: true });
await Promise.all(
  questions.map(async (question) => {
    const t0 = Date.now();
    const events = [];
    for await (const e of runAgent({ question, dictionary: DEFAULT_DICTIONARY })) events.push({ t: Date.now() - t0, ...e });
    const done = events.find((e) => e.type === "run.done");
    const failed = events.filter((e) => e.type === "metric.error" || e.type === "run.error");
    writeFileSync(`src/data/runs/${slug(question)}.json`, JSON.stringify({ slug: slug(question), question, recorded_at: new Date().toISOString(), events }) + "\n");
    console.log(`${slug(question)}: ${events.length} events, ${((Date.now() - t0) / 1000).toFixed(0)}s, $${done?.type === "run.done" ? done.usage.cost_usd.toFixed(3) : "?"}${failed.length ? `, ${failed.length} errors` : ""}`);
  }),
);
process.exit(0);
