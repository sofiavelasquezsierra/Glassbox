import { RerunRequest } from "@/lib/schemas";
import { rerunMetrics } from "@/server/agent/pipeline";
import { checkLimit, LIMITS } from "@/server/rate-limit";
import { ParamError } from "@/server/sql/params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-executes signed queries with edited assumptions. No model calls. */
export async function POST(req: Request) {
  const parsed = RerunRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const limit = await checkLimit(req, LIMITS.rerun);
  if (!limit.ok) return Response.json({ error: limit.reason }, { status: limit.status });
  try {
    return Response.json({ results: await rerunMetrics(parsed.data.assumptions, parsed.data.metrics) });
  } catch (e) {
    if (e instanceof ParamError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
