import crypto from "crypto";
import { z } from "zod";
import { paymentScenarioSchema, type PaymentScenario } from "./paymentScenario";

const checkoutItemOutputSchema = z.object({
  ticketTypeId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  // FE não é pricing engine: unitPriceCents/currency são ignorados pelo BE e ficam opcionais.
  unitPriceCents: z.number().int().nonnegative().optional().default(0),
  currency: z.string().trim().min(1).optional().default("EUR"),
});

export const checkoutItemSchema = checkoutItemOutputSchema;

export type NormalizedCheckoutItem = z.infer<typeof checkoutItemSchema>;

const newOwnerShape = z.object({
  ownerUserId: z.string().uuid().nullish(),
  ownerIdentityId: z.string().uuid().nullish(),
  emailNormalized: z.string().email().trim().toLowerCase().nullish(),
});

export const checkoutOwnerSchema = newOwnerShape.refine(
  (value) =>
    Boolean(value.ownerUserId || value.ownerIdentityId || value.emailNormalized),
  {
    message:
      "Owner inválido: requer ownerUserId/ownerIdentityId ou emailNormalized.",
  },
);

export type CheckoutOwner = z.infer<typeof checkoutOwnerSchema>;

export const purchaseIdSchema = z.union([
  z.string().uuid(),
  z
    .string()
    .trim()
    .regex(/^pur_[a-f0-9]{32}$/i, "Invalid purchaseId"),
]);

const checkoutMetadataOutputSchema = z.object({
  paymentScenario: paymentScenarioSchema,
  purchaseId: purchaseIdSchema,
  items: z.array(checkoutItemSchema).min(1),
  eventId: z.number().int().positive().optional(),
  eventSlug: z.string().trim().min(1).optional(),
  pairingId: z.number().int().positive().optional(),
  slotId: z.number().int().positive().optional(),
  ticketTypeId: z.number().int().positive().optional(),
  owner: checkoutOwnerSchema.optional(),
});

export const checkoutMetadataSchema = checkoutMetadataOutputSchema;

export type CheckoutMetadata = z.infer<typeof checkoutMetadataSchema>;

export function createPurchaseId() {
  // Default to the canonical purchaseId format used across the checkout core.
  // 16 random bytes => 32 hex chars.
  return `pur_${crypto.randomBytes(16).toString("hex")}`;
}

export function parseCheckoutItems(raw: unknown): NormalizedCheckoutItem[] {
  const parsed = z.array(checkoutItemSchema).safeParse(raw);
  if (parsed.success) return parsed.data;
  return [];
}

export function normalizeItemsForMetadata(items: NormalizedCheckoutItem[]): NormalizedCheckoutItem[] {
  return items.map((item) => ({
    ticketTypeId: Number((item as any).ticketTypeId),
    quantity: Number(item.quantity),
    unitPriceCents: Number(item.unitPriceCents ?? 0),
    currency: String(item.currency || "EUR").toUpperCase(),
  }));
}

export function normalizePaymentScenarioSafe(raw: unknown): PaymentScenario {
  const parsed = paymentScenarioSchema.safeParse(
    typeof raw === "string" ? raw.toUpperCase() : raw,
  );
  if (parsed.success) return parsed.data;
  return "SINGLE";
}
