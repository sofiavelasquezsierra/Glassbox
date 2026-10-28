import type { Assumption, DateRangeValue } from "./assumptions";

const PRESET_LABEL: Record<string, string> = {
  this_quarter: "This quarter",
  last_quarter: "Last quarter",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  last_6_months: "Last 6 months",
  last_12_months: "Last 12 months",
  year_to_date: "Year to date",
};

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatRange(v: DateRangeValue): string {
  if (v.preset !== "custom") return PRESET_LABEL[v.preset] ?? v.preset;
  return `${day.format(new Date(`${v.start}T00:00:00Z`))} – ${day.format(new Date(`${v.end}T00:00:00Z`))}`;
}

export const presetLabel = (p: string) => PRESET_LABEL[p] ?? p;

/** Human-readable value of an assumption, as shown on its chip. */
export function formatAssumption(a: Assumption): string {
  switch (a.type) {
    case "int":
      return `${a.value}${a.unit ? ` ${a.unit}` : ""}`;
    case "bool":
      return a.value ? "Yes" : "No";
    case "enum":
      return a.value.replace(/_/g, " ");
    case "timezone":
      return a.value === "UTC" ? "UTC" : a.value.split("/").pop()!.replace(/_/g, " ");
    case "date_range":
      return formatRange(a.value);
  }
}

export function sameValue(a: Assumption, b: Assumption): boolean {
  return JSON.stringify(a.value) === JSON.stringify(b.value);
}
