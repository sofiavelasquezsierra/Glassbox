import type { DATA_TABLES } from "./constants";

/** The northwind schema's structure, for the Data Dictionary page. Mirrors supabase/migrations/0001_northwind.sql. */
export const CATALOG: { table: (typeof DATA_TABLES)[number]; columns: [string, string][] }[] = [
  { table: "organizations", columns: [["id", "integer"], ["name", "text"], ["industry", "text"], ["country", "text"], ["timezone", "text"], ["created_at", "timestamptz"], ["is_test", "boolean"]] },
  { table: "users", columns: [["id", "integer"], ["org_id", "integer → organizations"], ["email", "text"], ["role", "text"], ["created_at", "timestamptz"], ["last_seen_at", "timestamptz NULL"], ["is_internal", "boolean"]] },
  { table: "plans", columns: [["id", "smallint"], ["name", "text"], ["tier", "text"], ["monthly_price_cents", "integer"], ["is_legacy", "boolean"]] },
  { table: "subscriptions", columns: [["id", "integer"], ["org_id", "integer → organizations"], ["plan_id", "smallint NULL → plans"], ["status", "text"], ["started_at", "timestamptz"], ["canceled_at", "timestamptz NULL"], ["cancel_reason", "text NULL"], ["mrr_cents", "integer"]] },
  { table: "invoices", columns: [["id", "integer"], ["org_id", "integer → organizations"], ["subscription_id", "integer → subscriptions"], ["amount_cents", "integer"], ["status", "text"], ["issued_at", "timestamptz"], ["paid_at", "timestamptz NULL"]] },
  { table: "events", columns: [["id", "bigint"], ["user_id", "integer → users"], ["org_id", "integer → organizations"], ["type", "text"], ["feature", "text NULL"], ["occurred_at", "timestamptz"]] },
  { table: "support_tickets", columns: [["id", "integer"], ["org_id", "integer → organizations"], ["user_id", "integer NULL → users"], ["category", "text"], ["priority", "text NULL"], ["created_at", "timestamptz"], ["resolved_at", "timestamptz NULL"]] },
];

export const entryKey = (table: string, column: string | null) => `${table}.${column ?? ""}`;
