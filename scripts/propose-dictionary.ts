/**
 * Records the agent's dictionary proposals so first-time visitors see them
 * without an API call. Writes src/data/dictionary-proposals.json.
 */
import { writeFileSync } from "node:fs";
import { loadEnv } from "./env";

loadEnv();
const { proposeDictionary } = await import("../src/server/agent/dictionary");
const { env } = await import("../src/server/env");
const out = await proposeDictionary(env.models().plan);
writeFileSync(
  "src/data/dictionary-proposals.json",
  JSON.stringify({ model: out.model, proposed_at: new Date().toISOString(), entries: out.entries }, null, 2) + "\n",
);
console.log(`${out.entries.length} entries, $${out.usage.cost_usd.toFixed(3)}`);
process.exit(0);
