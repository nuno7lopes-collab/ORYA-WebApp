import { z } from "zod";

export const paymentScenarioSchema = z.enum([
  "SINGLE",
  "GROUP_SPLIT",
  "GROUP_FULL",
  "RESALE",
  "SUBSCRIPTION",
  "FREE_CHECKOUT",
  "BOOKING_CHANGE",
]);

export type PaymentScenario = z.infer<typeof paymentScenarioSchema>;

export function normalizePaymentScenario(raw: string | null | undefined): PaymentScenario {
  const value = (raw || "").toUpperCase();
  if (value === "GROUP_SPLIT") return "GROUP_SPLIT";
  if (value === "GROUP_FULL") return "GROUP_FULL";
  if (value === "RESALE") return "RESALE";
  if (value === "SUBSCRIPTION") return "SUBSCRIPTION";
  if (value === "FREE_CHECKOUT") return "FREE_CHECKOUT";
  if (value === "BOOKING_CHANGE") return "BOOKING_CHANGE";
  return "SINGLE";
}
