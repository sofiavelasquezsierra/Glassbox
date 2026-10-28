import { proposeDictionary } from "@/server/agent/dictionary";
import { env } from "@/server/env";
import { StepError } from "@/server/agent/claude";
import { checkLimit, LIMITS } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** The agent proposes descriptions for every table and column, from a live profile of the data. */
export async function POST(req: Request) {
  const limit = await checkLimit(req, LIMITS.propose);
  if (!limit.ok) return Response.json({ error: limit.reason }, { status: limit.status });
  try {
    const { entries, usage, model } = await proposeDictionary(env.models().plan);
    return Response.json({ entries, model, proposed_at: new Date().toISOString(), cost_usd: usage.cost_usd });
  } catch (e) {
    const message = e instanceof StepError ? e.message : "Couldn't generate proposals right now.";
    if (!(e instanceof StepError)) console.error("[glassbox] dictionary proposal failed", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
