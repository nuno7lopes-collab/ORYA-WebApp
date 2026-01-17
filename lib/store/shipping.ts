import { prisma } from "@/lib/prisma";
import { StoreShippingMode } from "@prisma/client";

export type ShippingQuote = {
  shippingCents: number;
  zoneId: number;
  methodId: number;
  methodName: string;
  freeOverRemainingCents: number | null;
  methodFreeOverRemainingCents: number | null;
};

type ShippingMethodWithTiers = {
  id: number;
  name: string;
  baseRateCents: number;
  mode: StoreShippingMode;
  freeOverCents: number | null;
  tiers: {
    minSubtotalCents: number;
    maxSubtotalCents: number | null;
    rateCents: number;
  }[];
};

type QuoteInput = {
  storeId: number;
  country: string;
  subtotalCents: number;
  methodId?: number | null;
};

export function computeMethodShipping(params: {
  method: ShippingMethodWithTiers;
  subtotalCents: number;
  storeFreeThresholdCents: number | null | undefined;
}) {
  const storeFreeRemaining =
    params.storeFreeThresholdCents !== null && params.storeFreeThresholdCents !== undefined
      ? Math.max(0, params.storeFreeThresholdCents - params.subtotalCents)
      : null;

  if (storeFreeRemaining !== null && storeFreeRemaining <= 0) {
    return {
      ok: true as const,
      shippingCents: 0,
      freeOverRemainingCents: 0,
      methodFreeOverRemainingCents:
        params.method.freeOverCents !== null && params.method.freeOverCents !== undefined
          ? Math.max(0, params.method.freeOverCents - params.subtotalCents)
          : null,
    };
  }

  const methodFreeRemaining =
    params.method.freeOverCents !== null && params.method.freeOverCents !== undefined
      ? Math.max(0, params.method.freeOverCents - params.subtotalCents)
      : null;

  if (methodFreeRemaining !== null && methodFreeRemaining <= 0) {
    return {
      ok: true as const,
      shippingCents: 0,
      freeOverRemainingCents: storeFreeRemaining,
      methodFreeOverRemainingCents: 0,
    };
  }

  let shippingCents = params.method.baseRateCents;

  if (params.method.mode === StoreShippingMode.VALUE_TIERS) {
    const tiers = [...params.method.tiers].sort((a, b) => a.minSubtotalCents - b.minSubtotalCents);
    const matched = tiers.find(
      (tier) =>
        params.subtotalCents >= tier.minSubtotalCents &&
        (tier.maxSubtotalCents === null || params.subtotalCents <= tier.maxSubtotalCents),
    );
    if (!matched) {
      return { ok: false as const, error: "Sem tier valido." };
    }
    shippingCents = matched.rateCents;
  }

  return {
    ok: true as const,
    shippingCents,
    freeOverRemainingCents: storeFreeRemaining,
    methodFreeOverRemainingCents: methodFreeRemaining,
  };
}

export async function computeStoreShippingQuote(input: QuoteInput) {
  const store = await prisma.store.findFirst({
    where: { id: input.storeId },
    select: { id: true, freeShippingThresholdCents: true },
  });

  if (!store) {
    return { ok: false as const, error: "Store nao encontrada." };
  }

  const country = input.country.trim().toUpperCase();
  if (!country) {
    return { ok: false as const, error: "Pais invalido." };
  }

  const zone = await prisma.storeShippingZone.findFirst({
    where: { storeId: input.storeId, isActive: true, countries: { has: country } },
    include: {
      methods: {
        include: { tiers: true },
      },
    },
  });

  if (!zone) {
    return { ok: false as const, error: "Zona de envio nao encontrada." };
  }

  let method = null as (typeof zone.methods)[number] | null;
  if (input.methodId) {
    method = zone.methods.find((candidate) => candidate.id === input.methodId) ?? null;
  } else {
    method =
      zone.methods.find((candidate) => candidate.isDefault) ??
      zone.methods.sort((a, b) => a.id - b.id)[0] ??
      null;
  }

  if (!method) {
    return { ok: false as const, error: "Metodo de envio nao encontrado." };
  }

  const computed = computeMethodShipping({
    method,
    subtotalCents: input.subtotalCents,
    storeFreeThresholdCents: store.freeShippingThresholdCents,
  });
  if (!computed.ok) {
    return { ok: false as const, error: computed.error };
  }

  return {
    ok: true as const,
    quote: {
      shippingCents: computed.shippingCents,
      zoneId: zone.id,
      methodId: method.id,
      methodName: method.name,
      freeOverRemainingCents: computed.freeOverRemainingCents,
      methodFreeOverRemainingCents: computed.methodFreeOverRemainingCents,
    },
  };
}
