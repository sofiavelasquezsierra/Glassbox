import type { DictionaryEntry } from "@/lib/schemas";

/**
 * Starter dictionary entries a visitor's session begins with, written by the
 * demo author to represent what a small team typically has documented.
 * It is deliberately incomplete (nothing about internal users, refunds or
 * grandfathered plans) so gaps exist for the reviewer and the Data
 * Dictionary page to fill. Visitors can edit or remove these.
 */
export const DEFAULT_DICTIONARY: DictionaryEntry[] = [
  { table: "organizations", column: null, description: "One row per customer account (workspace). Revenue and engagement roll up to organizations." },
  { table: "organizations", column: "is_test", description: "True for QA, demo and load-test tenants. Exclude from business metrics." },
  { table: "organizations", column: "timezone", description: "The customer's home timezone, used for their billing schedule." },
  { table: "subscriptions", column: "cancel_reason", description: "Why the subscription row ended. Plan changes close the old row and open a new one." },
  { table: "subscriptions", column: "mrr_cents", description: "Monthly recurring revenue for this subscription, in cents." },
  { table: "invoices", column: "amount_cents", description: "Invoice amount in cents." },
  { table: "events", column: null, description: "Product activity. A login event is recorded once per session." },
  { table: "support_tickets", column: "category", description: "Assigned by the support team on triage." },
];
