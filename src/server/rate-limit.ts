import "server-only";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { env } from "./env";

let client: postgres.Sql | undefined;
const app = () => {
  const url = env.appUrl();
  if (!url) return undefined;
  client ??= postgres(url, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 5, onnotice: () => {} });
  return client;
};

export interface Limit {
  name: string;
  perIp: number;
  ipWindow: string;
  global?: number;
  globalWindow?: string;
}

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const LIMITS = {
  /** Live agent runs cost real money: a few per visitor, and a daily ceiling. */
  run: { name: "run", perIp: num(process.env.LIVE_RUNS_PER_HOUR, 5), ipWindow: "1 hour", global: num(process.env.LIVE_RUNS_PER_DAY, 150), globalWindow: "1 day" },
  propose: { name: "propose", perIp: 2, ipWindow: "1 hour", global: 30, globalWindow: "1 day" },
  /** Re-runs are SQL only (no model), so the limit is generous. */
  rerun: { name: "rerun", perIp: 120, ipWindow: "1 hour" },
} satisfies Record<string, Limit>;

/** Stable, non-reversible per-visitor key: we never store raw IP addresses. */
function ipKey(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${env.signingSecret()}:${ip}`).digest("hex").slice(0, 32);
}

export type LimitResult = { ok: true } | { ok: false; reason: string; status: 429 | 503 };

/**
 * Counts a hit and decides. Fails closed: if the limiter is unavailable,
 * live (paid) work is refused and the client falls back to a recorded run.
 */
export async function checkLimit(req: Request, limit: Limit): Promise<LimitResult> {
  const sql = app();
  if (!sql) return { ok: false, status: 503, reason: "Live runs aren't configured on this deployment." };
  try {
    const [{ hits }] = await sql<[{ hits: number }]>`select glassbox_meta.hit(${`${limit.name}:ip:${ipKey(req)}`}, ${limit.ipWindow}::interval) as hits`;
    if (hits > limit.perIp) return { ok: false, status: 429, reason: `You've reached the limit of ${limit.perIp} live ${limit.name === "run" ? "runs" : "requests"} per ${limit.ipWindow.replace("1 ", "")}.` };
    if (limit.global && limit.globalWindow) {
      const [{ hits: g }] = await sql<[{ hits: number }]>`select glassbox_meta.hit(${`${limit.name}:global`}, ${limit.globalWindow}::interval) as hits`;
      if (g > limit.global) return { ok: false, status: 429, reason: "The demo has reached today's live-run budget." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[glassbox] rate limiter unavailable", e);
    return { ok: false, status: 503, reason: "Live runs are temporarily unavailable." };
  }
}
