import { parse } from "libpg-query";
import { DATA_SCHEMA, DATA_TABLES, EXECUTION_LIMITS } from "@/lib/constants";
import { lexPlaceholders, ParamError } from "./params";

/**
 * SELECT-only validation against the real Postgres grammar (libpg_query).
 *
 * This is one layer of several: the query also runs inside a READ ONLY
 * transaction, under a statement timeout, as a role that can only SELECT
 * from the northwind schema. The validator fails closed: anything it does
 * not explicitly understand is rejected.
 */

export type ValidationCode =
  | "empty"
  | "too_long"
  | "parse_error"
  | "positional_params"
  | "multiple_statements"
  | "not_select"
  | "forbidden_statement"
  | "select_into"
  | "locking_clause"
  | "function_not_allowed"
  | "table_not_allowed"
  | "nondeterministic_time";

export type ValidationResult =
  | { ok: true; tables: string[]; params: string[] }
  | { ok: false; code: ValidationCode; message: string };

/** Functions analytics queries legitimately need. Everything else is rejected. */
export const ALLOWED_FUNCTIONS = new Set([
  // aggregates
  "count", "sum", "avg", "min", "max", "stddev", "stddev_samp", "stddev_pop", "variance",
  "percentile_cont", "percentile_disc", "mode", "bool_and", "bool_or", "every",
  "string_agg", "array_agg", "json_agg", "jsonb_agg", "json_build_object", "jsonb_build_object",
  // window
  "row_number", "rank", "dense_rank", "percent_rank", "cume_dist", "ntile",
  "lag", "lead", "first_value", "last_value", "nth_value",
  // date/time (AT TIME ZONE parses as timezone(), EXTRACT as extract())
  "date_trunc", "date_part", "extract", "date_bin", "age", "timezone", "overlaps",
  "make_date", "make_interval", "make_timestamp", "make_timestamptz",
  "to_char", "to_date", "to_timestamp", "generate_series",
  // math
  "round", "trunc", "ceil", "ceiling", "floor", "abs", "power", "sqrt", "ln", "exp", "log",
  "mod", "div", "sign", "width_bucket", "to_number",
  // text
  "lower", "upper", "initcap", "length", "char_length", "substr", "substring", "split_part",
  "left", "right", "btrim", "ltrim", "rtrim", "replace", "concat", "concat_ws",
  "position", "strpos", "starts_with",
  // arrays
  "cardinality", "array_length", "unnest",
]);

const ALLOWED_TABLES = new Set<string>(DATA_TABLES);

type Node = Record<string, unknown>;

class Rejection extends Error {
  constructor(public code: ValidationCode, message: string) {
    super(message);
  }
}

function funcName(node: Node): string[] {
  const parts = (node.funcname as Node[] | undefined) ?? [];
  return parts.map((p) => String((p.String as Node | undefined)?.sval ?? "")).map((s) => s.toLowerCase());
}

function collectCteNames(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectCteNames(v, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Node)) {
      if (k === "CommonTableExpr") into.add(String((v as Node).ctename).toLowerCase());
      collectCteNames(v, into);
    }
  }
}

function walk(value: unknown, ctes: Set<string>, tables: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) walk(v, ctes, tables);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [k, v] of Object.entries(value as Node)) {
    // Any statement other than SELECT, anywhere in the tree. This catches
    // data-modifying CTEs (WITH x AS (DELETE ...)) and EXPLAIN ANALYZE wrappers.
    if (k.endsWith("Stmt") && k !== "SelectStmt") {
      throw new Rejection("forbidden_statement", `${k.replace(/Stmt$/, "").toUpperCase()} is not allowed`);
    }
    const node = v as Node;

    if (k === "SelectStmt") {
      if (node.intoClause) throw new Rejection("select_into", "SELECT INTO creates a table and is not allowed");
      if (node.lockingClause) throw new Rejection("locking_clause", "FOR UPDATE/SHARE takes row locks and is not allowed");
    }

    if (k === "FuncCall") {
      const name = funcName(node);
      const qualifiedOk = name.length === 1 || (name.length === 2 && name[0] === "pg_catalog");
      const fn = name[name.length - 1] ?? "";
      if (fn === "now" || fn === "clock_timestamp" || fn === "statement_timestamp" || fn === "transaction_timestamp") {
        throw new Rejection("nondeterministic_time", `${fn}() is not allowed; use the :as_of parameter`);
      }
      if (!qualifiedOk || !ALLOWED_FUNCTIONS.has(fn)) {
        throw new Rejection("function_not_allowed", `function ${name.join(".")}() is not allowed`);
      }
    }

    if (k === "SQLValueFunction") {
      const op = String(node.op ?? "");
      if (/CURRENT_(DATE|TIME|TIMESTAMP)|LOCALTIME/.test(op)) {
        throw new Rejection("nondeterministic_time", "CURRENT_DATE/NOW are not allowed; use the :as_of parameter");
      }
    }

    if (k === "RangeVar") {
      const schema = node.schemaname ? String(node.schemaname).toLowerCase() : undefined;
      const rel = String(node.relname).toLowerCase();
      const label = schema ? `${schema}.${rel}` : rel;
      if (node.catalogname) throw new Rejection("table_not_allowed", `${label} is not readable`);
      if (schema === undefined && ctes.has(rel)) {
        // reference to a CTE defined in this query
      } else if ((schema === undefined || schema === DATA_SCHEMA) && ALLOWED_TABLES.has(rel)) {
        tables.add(rel);
      } else {
        throw new Rejection("table_not_allowed", `${label} is not readable; only ${DATA_SCHEMA} tables are`);
      }
    }

    walk(v, ctes, tables);
  }
}

/**
 * Validates SQL that may contain `:named` placeholders (as produced by the
 * agent). Placeholders are swapped for positional parameters before parsing
 * so the real grammar sees exactly what will be executed.
 */
export async function validateSelect(sql: string): Promise<ValidationResult> {
  if (!sql.trim()) return { ok: false, code: "empty", message: "query is empty" };
  if (sql.length > EXECUTION_LIMITS.maxSqlLength) {
    return { ok: false, code: "too_long", message: `query exceeds ${EXECUTION_LIMITS.maxSqlLength} characters` };
  }

  let text: string;
  let params: string[];
  try {
    const lex = lexPlaceholders(sql);
    if (lex.positional.length > 0) {
      return { ok: false, code: "positional_params", message: "use :named parameters, not $1" };
    }
    const order = new Map<string, number>();
    text = "";
    let cursor = 0;
    for (const p of lex.placeholders) {
      if (!order.has(p.name)) order.set(p.name, order.size + 1);
      text += sql.slice(cursor, p.start) + `$${order.get(p.name)}`;
      cursor = p.end;
    }
    text += sql.slice(cursor);
    params = [...order.keys()];
  } catch (e) {
    const message = e instanceof ParamError ? e.message : "could not tokenize query";
    return { ok: false, code: "parse_error", message };
  }

  let ast: { stmts?: Node[] };
  try {
    ast = (await parse(text)) as unknown as { stmts?: Node[] };
  } catch (e) {
    return { ok: false, code: "parse_error", message: e instanceof Error ? e.message : "syntax error" };
  }

  const stmts = ast.stmts ?? [];
  if (stmts.length === 0) return { ok: false, code: "empty", message: "query contains no statements" };
  if (stmts.length > 1) {
    return { ok: false, code: "multiple_statements", message: `expected one statement, found ${stmts.length}` };
  }
  const stmt = stmts[0]!.stmt as Node;
  const kind = Object.keys(stmt)[0] ?? "unknown";
  if (kind !== "SelectStmt") {
    return { ok: false, code: "not_select", message: `only SELECT is allowed, got ${kind.replace(/Stmt$/, "").toUpperCase()}` };
  }

  try {
    const ctes = new Set<string>();
    collectCteNames(stmt, ctes);
    const tables = new Set<string>();
    walk(stmt, ctes, tables);
    return { ok: true, tables: [...tables].sort(), params };
  } catch (e) {
    if (e instanceof Rejection) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}
