import crypto from "crypto";
import { z } from "zod";
import { paymentScenarioSchema, type PaymentScenario } from "./paymentScenario";

export const checkoutItemSchema = z.object({
  ticketTypeId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  currency: z.string().trim().min(1),
});

export type NormalizedCheckoutItem = z.infer<typeof checkoutItemSchema>;

const legacyOwnerShape = z.object({
  userId: z.string().uuid().nullish(),
  guestEmail: z.string().email().trim().toLowerCase().nullish(),
  guestName: z.string().trim().min(1).nullish(),
  guestPhone: z.string().trim().nullish(),
});

const newOwnerShape = z.object({
  ownerUserId: z.string().uuid().nullish(),
  ownerIdentityId: z.string().uuid().nullish(),
  emailNormalized: z.string().email().trim().toLowerCase().nullish(),
});

export const checkoutOwnerSchema = newOwnerShape
  .merge(legacyOwnerShape.partial())
  .refine(
    (value) =>
      Boolean(
        value.ownerUserId ||
          value.ownerIdentityId ||
          value.userId ||
          value.guestEmail,
      ),
    {
      message:
        "Owner inválido: requer ownerUserId/ownerIdentityId ou userId/guestEmail.",
    },
  );

export type CheckoutOwner = z.infer<typeof checkoutOwnerSchema>;

export const checkoutMetadataSchema = z.object({
  paymentScenario: paymentScenarioSchema,
  purchaseId: z.string().uuid(),
  items: z.array(checkoutItemSchema).min(1),
  eventId: z.number().int().positive().optional(),
  eventSlug: z.string().trim().min(1).optional(),
  pairingId: z.number().int().positive().optional(),
  owner: checkoutOwnerSchema.optional(),
});

export type CheckoutMetadata = z.infer<typeof checkoutMetadataSchema>;

export function createPurchaseId() {
  return crypto.randomUUID();
}

export function parseCheckoutItems(raw: unknown): NormalizedCheckoutItem[] {
  const parsed = z.array(checkoutItemSchema).safeParse(raw);
  if (parsed.success) return parsed.data;
  return [];
}

export function normalizeItemsForMetadata(items: NormalizedCheckoutItem[]): NormalizedCheckoutItem[] {
  return items.map((item) => ({
    ticketTypeId: Number(item.ticketTypeId),
    quantity: Number(item.quantity),
    unitPriceCents: Number(item.unitPriceCents),
    currency: (item.currency || "EUR").toUpperCase(),
  }));
}

export function normalizePaymentScenarioSafe(raw: unknown): PaymentScenario {
  const parsed = paymentScenarioSchema.safeParse(
    typeof raw === "string" ? raw.toUpperCase() : raw,
  );
  if (parsed.success) return parsed.data;
  return "SINGLE";
}
