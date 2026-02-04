import type { Prisma } from "@prisma/client";

export type AddonSelectionInput = {
  addonId: number;
  quantity: number;
};

export type ResolvedServiceAddon = {
  addonId: number;
  label: string;
  description: string | null;
  deltaMinutes: number;
  deltaPriceCents: number;
  maxQty: number | null;
  category: string | null;
  sortOrder: number;
  quantity: number;
};

export type AddonResolutionResult =
  | {
      ok: true;
      addons: ResolvedServiceAddon[];
      totalDeltaMinutes: number;
      totalDeltaPriceCents: number;
    }
  | { ok: false; error: string };

const clampPositiveInt = (value: unknown) => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

export function normalizeAddonSelection(input: unknown): AddonSelectionInput[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        const addonId = clampPositiveInt((item as any)?.addonId);
        const quantity = clampPositiveInt((item as any)?.quantity ?? 1) ?? 1;
        if (!addonId) return null;
        return { addonId, quantity };
      })
      .filter((item): item is AddonSelectionInput => Boolean(item));
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return normalizeAddonSelection(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

export async function resolveServiceAddonSelection(params: {
  tx: Prisma.TransactionClient;
  serviceId: number;
  selection: AddonSelectionInput[];
  requireActive?: boolean;
}): Promise<AddonResolutionResult> {
  const { tx, serviceId, selection, requireActive = true } = params;
  if (!selection.length) {
    return { ok: true, addons: [], totalDeltaMinutes: 0, totalDeltaPriceCents: 0 };
  }

  const selectionMap = new Map<number, number>();
  selection.forEach((item) => {
    const addonId = clampPositiveInt(item.addonId);
    const qty = clampPositiveInt(item.quantity ?? 1) ?? 1;
    if (!addonId) return;
    selectionMap.set(addonId, (selectionMap.get(addonId) ?? 0) + qty);
  });

  const addonIds = Array.from(selectionMap.keys());
  if (!addonIds.length) {
    return { ok: true, addons: [], totalDeltaMinutes: 0, totalDeltaPriceCents: 0 };
  }

  const addons = await tx.serviceAddon.findMany({
    where: {
      serviceId,
      id: { in: addonIds },
      ...(requireActive ? { isActive: true } : {}),
    },
    select: {
      id: true,
      label: true,
      description: true,
      deltaMinutes: true,
      deltaPriceCents: true,
      maxQty: true,
      category: true,
      sortOrder: true,
    },
  });

  if (addons.length !== addonIds.length) {
    return { ok: false, error: "Add-ons inválidos para este serviço." };
  }

  const resolved = addons
    .map((addon) => {
      const quantity = selectionMap.get(addon.id) ?? 0;
      if (quantity <= 0) return null;
      if (addon.maxQty != null && quantity > addon.maxQty) {
        return { error: `Quantidade inválida para ${addon.label}.` };
      }
      return {
        addonId: addon.id,
        label: addon.label,
        description: addon.description ?? null,
        deltaMinutes: addon.deltaMinutes ?? 0,
        deltaPriceCents: addon.deltaPriceCents ?? 0,
        maxQty: addon.maxQty ?? null,
        category: addon.category ?? null,
        sortOrder: addon.sortOrder ?? 0,
        quantity,
      } satisfies ResolvedServiceAddon;
    })
    .filter((item) => item !== null);

  const error = resolved.find((item) => (item as any)?.error) as { error: string } | undefined;
  if (error) {
    return { ok: false, error: error.error };
  }

  const addonsResolved = resolved as ResolvedServiceAddon[];
  const totalDeltaMinutes = addonsResolved.reduce(
    (sum, addon) => sum + addon.deltaMinutes * addon.quantity,
    0,
  );
  const totalDeltaPriceCents = addonsResolved.reduce(
    (sum, addon) => sum + addon.deltaPriceCents * addon.quantity,
    0,
  );

  return {
    ok: true,
    addons: addonsResolved.sort((a, b) => a.sortOrder - b.sortOrder || a.addonId - b.addonId),
    totalDeltaMinutes,
    totalDeltaPriceCents,
  };
}

export function applyAddonTotals(params: {
  baseDurationMinutes: number;
  basePriceCents: number;
  totalDeltaMinutes: number;
  totalDeltaPriceCents: number;
}) {
  const duration = Math.max(0, params.baseDurationMinutes + params.totalDeltaMinutes);
  const price = Math.max(0, params.basePriceCents + params.totalDeltaPriceCents);
  return { durationMinutes: duration, priceCents: price };
}
