import { RunRequest } from "@/lib/schemas";
import { runAgent } from "@/server/agent/pipeline";
import { sseResponse } from "@/server/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Streams a live agent run as server-sent events. */
export async function POST(req: Request) {
  const parsed = RunRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  // Hard ceiling on a run, on top of per-step token caps.
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(110_000)]);
  return sseResponse(runAgent({ ...parsed.data, signal }), req.signal);
}
