import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Signs agent-generated SQL. /api/rerun only executes queries carrying a
 * valid signature, so it can't be used as a general-purpose SQL endpoint.
 */
export function signSql(metricId: string, sql: string): string {
  return createHmac("sha256", env.signingSecret()).update(`${metricId}\n${sql}`).digest("base64url");
}

export function verifySql(metricId: string, sql: string, signature: string): boolean {
  const expected = Buffer.from(signSql(metricId, sql));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
