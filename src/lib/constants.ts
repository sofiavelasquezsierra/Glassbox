/**
 * The demo is pinned to a fixed "today" so that relative ranges like
 * "this quarter" resolve identically on every run, and golden-set answers
 * stay stable. Seed data runs from 2025-11-01 through 2026-10-27.
 */
export const DEMO_AS_OF = "2026-10-28";
export const DATA_START = "2025-11-01";

/** Schema the agent is allowed to read. Everything else is rejected. */
export const DATA_SCHEMA = "northwind";

export const DATA_TABLES = [
  "plans",
  "organizations",
  "users",
  "subscriptions",
  "invoices",
  "events",
  "support_tickets",
] as const;

/** Timezones offered as assumption values; they also appear in the seed. */
export const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const DATE_RANGE_PRESETS = [
  "this_quarter",
  "last_quarter",
  "last_30_days",
  "last_90_days",
  "last_6_months",
  "last_12_months",
  "year_to_date",
  "custom",
] as const;

export const EXECUTION_LIMITS = {
  statementTimeoutMs: 5_000,
  maxRows: 1_000,
  /** Planner cost ceiling from EXPLAIN; queries above it are rejected before running. */
  maxPlanCost: 2_000_000,
  maxSqlLength: 20_000,
} as const;
