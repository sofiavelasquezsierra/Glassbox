import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { Usage } from "@/lib/schemas";
import { env } from "../env";

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic({ apiKey: env.anthropicKey(), maxRetries: 2 }));

/** USD per million tokens: input, output, cache read. */
const PRICING: Record<string, [number, number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5, 0.01],
  "claude-sonnet-5-5": [2, 10, 0.2],
  "claude-opus-5-5": [4, 20, 0.2],
};

export function emptyUsage(): Usage {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cost_usd: 0 };
}

export function addUsage(into: Usage, model: string, u: Anthropic.Beta.BetaUsage): void {
  const [inP, outP, cacheP] = PRICING[model] ?? [4, 20, 0.2];
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  into.input_tokens += u.input_tokens + cacheWrite + cacheRead;
  into.output_tokens += u.output_tokens;
  into.cache_read_input_tokens += cacheRead;
  into.cost_usd += (u.input_tokens * inP + cacheWrite * inP * 1.25 + cacheRead * cacheP + u.output_tokens * outP) / 1e6;
}

export class StepError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export interface StructuredCall<S extends z.ZodType> {
  model: string;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Stable context (schema, rules). Cached across calls. */
  system: string;
  user: string;
  schema: S;
  usage: Usage;
  signal?: AbortSignal;
  /** Receives the growing JSON text as it streams, for live status. */
  onText?: (soFar: string) => void;
  /** Receives the latest sentence of the model's summarized reasoning. */
  onThinking?: (sentence: string) => void;
  /** Semantic checks beyond the schema; returning problems triggers one repair turn. */
  check?: (data: z.infer<S>) => Promise<string[]> | string[];
}

/**
 * The JSON schema the API constrains decoding to, without the SDK's
 * auto-parser: that parser throws on Zod-invalid output, and we want to run
 * our own validation and repair turn instead.
 */
function jsonFormat(schema: z.ZodType): Anthropic.Beta.BetaJSONOutputFormat {
  const { type, schema: json } = zodOutputFormat(schema);
  return { type, schema: json };
}

/** Server-side refusal fallback is available for these models on the Claude API. */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);

/**
 * Streams one structured-output call and validates it with Zod. On invalid
 * output (schema or semantic check), sends one repair turn with the errors;
 * if that also fails, throws a StepError the pipeline surfaces to the UI.
 */
export async function streamStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: call.user }];

  for (let attempt = 0; attempt < 2; attempt++) {
    let text = "";
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = anthropic().beta.messages.stream(
        {
          model: call.model,
          max_tokens: call.maxTokens,
          system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
          messages,
          thinking: { type: "adaptive", display: "summarized" },
          output_config: { effort: call.effort, format: jsonFormat(call.schema) },
          ...(FALLBACK_MODELS.has(call.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal: call.signal },
      );
      let thought = "";
      for await (const event of stream) {
        if (event.type !== "content_block_delta") continue;
        if (event.delta.type === "text_delta") {
          text += event.delta.text;
          call.onText?.(text);
        } else if (event.delta.type === "thinking_delta" && call.onThinking) {
          thought += event.delta.thinking;
          // Surface the most recent complete sentence, trimmed for a status line.
          const sentences = thought.split(/(?<=[.!?])\s+/).filter((x) => /[.!?]$/.test(x.trim()));
          const latest = sentences.at(-1)?.replace(/\*\*/g, "").trim();
          if (latest && latest.length > 12) call.onThinking(latest.length > 110 ? `${latest.slice(0, 107)}…` : latest);
        }
      }
      message = await stream.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new StepError("The model is rate limited right now.", true);
      if (e instanceof Anthropic.APIConnectionError) throw new StepError("Could not reach the model.", true);
      if (e instanceof Anthropic.APIError) throw new StepError(`Model request failed (${e.status ?? "unknown"}).`, (e.status ?? 500) >= 500);
      throw e;
    }
    addUsage(call.usage, call.model, message.usage);

    if (message.stop_reason === "refusal") throw new StepError("The model declined this request.", false);
    if (message.stop_reason === "max_tokens") {
      if (attempt === 0) {
        // Truncated JSON can't be repaired by asking; retry once from scratch.
        continue;
      }
      throw new StepError("The model ran out of output budget for this step.", false);
    }

    const finalText = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let problems: string[];
    try {
      const parsed = call.schema.safeParse(JSON.parse(finalText));
      if (parsed.success) {
        problems = call.check ? await call.check(parsed.data) : [];
        if (problems.length === 0) return parsed.data;
      } else {
        problems = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      }
    } catch {
      problems = ["output was not valid JSON"];
    }

    if (attempt === 1) throw new StepError(`Invalid model output after a repair attempt: ${problems.slice(0, 3).join("; ")}`, false);
    // Keep the full assistant content (including thinking blocks) so the
    // history stays append-only, then ask for a corrected answer.
    messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({
      role: "user",
      content: `Your previous answer failed validation:\n${problems.map((p) => `- ${p}`).join("\n")}\nReturn the complete corrected JSON.`,
    });
  }
  throw new StepError("Unreachable", false);
}
