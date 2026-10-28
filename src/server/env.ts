import "server-only";

/** Server-only configuration. Read lazily so builds don't require secrets. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export const env = {
  anthropicKey: () => required("ANTHROPIC_API_KEY"),
  readonlyUrl: () => required("DATABASE_URL_READONLY"),
  appUrl: () => process.env.DATABASE_URL_APP,
  signingSecret: () => required("GLASSBOX_SIGNING_SECRET"),
  models: () => ({
    intent: process.env.GLASSBOX_MODEL_INTENT ?? "claude-haiku-5-5",
    plan: process.env.GLASSBOX_MODEL_PLAN ?? "claude-sonnet-5-5",
    sql: process.env.GLASSBOX_MODEL_SQL ?? "claude-sonnet-5-5",
    review: process.env.GLASSBOX_MODEL_REVIEW ?? "claude-opus-5-5",
  }),
};
