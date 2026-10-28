import "server-only";
import postgres from "postgres";
import { EXECUTION_LIMITS } from "@/lib/constants";
import type { Cell, QueryResult } from "@/lib/schemas";
import { env } from "../env";
import { compileNamed, type ParamValue } from "./params";
import { validateSelect } from "./validate";

let client: postgres.Sql | undefined;

/** Pooled connection as glassbox_reader. `prepare: false` for the Supabase transaction pooler. */
function reader(): postgres.Sql {
  client ??= postgres(env.readonlyUrl(), {
    prepare: false,
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    types: { bigint: postgres.BigInt },
  });
  return client;
}

export class ExecutionError extends Error {
  constructor(
    message: string,
    public stage: "validate" | "explain" | "execute",
  ) {
    super(message);
  }
}

const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700]);
const DATE_OID = 1082;
const TIMESTAMP_OIDS = new Set([1114, 1184]);
const BOOL_OID = 16;

function columnType(oid: number): QueryResult["columns"][number]["type"] {
  if (NUMERIC_OIDS.has(oid)) return "number";
  if (oid === DATE_OID) return "date";
  if (TIMESTAMP_OIDS.has(oid)) return "timestamp";
  if (oid === BOOL_OID) return "boolean";
  return "text";
}

function toCell(v: unknown, type: QueryResult["columns"][number]["type"]): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return type === "date" ? v.toISOString().slice(0, 10) : v.toISOString();
  if (type === "number" && typeof v === "string") return Number(v);
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  return JSON.stringify(v);
}

/**
 * Validates, EXPLAINs and runs one agent query as the read-only role, inside
 * a READ ONLY transaction with a statement timeout, with a row cap applied
 * by wrapping the query.
 */
export async function executeQuery(sqlText: string, params: Record<string, ParamValue>): Promise<QueryResult> {
  const check = await validateSelect(sqlText);
  if (!check.ok) throw new ExecutionError(check.message, "validate");

  const body = sqlText.trim().replace(/;\s*$/, "");
  const { text, values, used } = compileNamed(body, params);
  // Newlines guard against a trailing line comment swallowing the wrapper.
  const wrapped = `select * from (\n${text}\n) as glassbox_result limit ${EXECUTION_LIMITS.maxRows + 1}`;
  const bound = values as postgres.ParameterOrJSON<never>[];

  const started = performance.now();
  const executedAt = new Date().toISOString();
  return reader().begin("read only", async (tx) => {
    await tx.unsafe(`set local statement_timeout = ${EXECUTION_LIMITS.statementTimeoutMs}`);

    let planCost: number;
    try {
      const [plan] = await tx.unsafe(`explain (format json) ${wrapped}`, bound);
      const json = (plan as Record<string, unknown>)["QUERY PLAN"] as { Plan: { "Total Cost": number } }[];
      planCost = json[0]!.Plan["Total Cost"];
    } catch (e) {
      throw new ExecutionError((e as Error).message, "explain");
    }
    if (planCost > EXECUTION_LIMITS.maxPlanCost) {
      throw new ExecutionError(`planner cost ${Math.round(planCost)} exceeds the limit of ${EXECUTION_LIMITS.maxPlanCost}`, "explain");
    }

    let rows: postgres.RowList<postgres.Row[]>;
    try {
      rows = await tx.unsafe(wrapped, bound);
    } catch (e) {
      throw new ExecutionError((e as Error).message, "execute");
    }
    const columns = rows.columns.map((c) => ({ name: c.name, type: columnType(c.type) }));
    const truncated = rows.length > EXECUTION_LIMITS.maxRows;
    const data = rows.slice(0, EXECUTION_LIMITS.maxRows).map((r) => columns.map((c) => toCell(r[c.name], c.type)));
    return {
      columns,
      rows: data,
      row_count: data.length,
      truncated,
      runtime_ms: Math.round(performance.now() - started),
      executed_at: executedAt,
      plan_cost: Math.round(planCost),
      params: Object.fromEntries(used.map((k) => [k, params[k]!])),
    };
  });
}
