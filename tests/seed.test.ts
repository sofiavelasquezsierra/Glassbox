import { describe, expect, it } from "vitest";
import { generate, manifest } from "../supabase/generate";


describe("seed generator", () => {
  const a = generate();

  it("is deterministic", () => {
    expect(manifest(generate())).toEqual(manifest(a));
  });

  it("plants the traps the reviewer is expected to catch", () => {
    expect(a.organizations.filter((o) => o.is_test)).toHaveLength(12);
    expect(a.users.some((u) => u.is_internal && !a.organizations.find((o) => o.id === u.org_id)!.is_test)).toBe(true);
    expect(a.subscriptions.some((s) => s.plan_id === null)).toBe(true);
    expect(a.subscriptions.some((s) => s.cancel_reason === "upgrade")).toBe(true);
    expect(a.invoices.some((i) => i.amount_cents < 0)).toBe(true);
    expect(a.users.some((u) => u.last_seen_at === null)).toBe(true);
    expect(a.support_tickets.some((t) => t.priority === null)).toBe(true);
  });

  it("keeps all activity inside the data window", () => {
    const start = Date.UTC(2025, 10, 1);
    const end = Date.UTC(2026, 9, 28);
    for (const e of a.events) {
      const t = e.occurred_at.getTime();
      expect(t >= start && t < end).toBe(true);
    }
  });
});
