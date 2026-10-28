import { z } from "zod";
import { DATE_RANGE_PRESETS, TIMEZONES } from "./constants";

const key = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "assumption keys are snake_case identifiers");

const base = {
  key,
  label: z.string().min(1).max(60),
  rationale: z.string().max(240),
};

export const DateRangeValue = z.union([
  z.object({ preset: z.enum(DATE_RANGE_PRESETS).exclude(["custom"]) }),
  z.object({
    preset: z.literal("custom"),
    start: z.iso.date(),
    end: z.iso.date(),
  }),
]);
export type DateRangeValue = z.infer<typeof DateRangeValue>;

export const Assumption = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("int"),
    value: z.number().int(),
    min: z.number().int(),
    max: z.number().int(),
    unit: z.string().max(12).optional(),
  }),
  z.object({ ...base, type: z.literal("bool"), value: z.boolean() }),
  z.object({
    ...base,
    type: z.literal("enum"),
    value: z.string(),
    options: z.array(z.string().min(1).max(40)).min(2).max(8),
  }),
  z.object({ ...base, type: z.literal("timezone"), value: z.enum(TIMEZONES) }),
  z.object({ ...base, type: z.literal("date_range"), value: DateRangeValue }),
]);
export type Assumption = z.infer<typeof Assumption>;
