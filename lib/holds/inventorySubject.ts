import "server-only";

import {
  StoreStockPolicy,
  type Prisma,
} from "@prisma/client";
import { buildInventoryHoldFingerprint } from "@orya/shared";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

type InventorySubjectBase = {
  orgId: number;
  subjectFingerprint: string;
  subjectType: "TICKET_TYPE" | "STORE_PRODUCT" | "STORE_VARIANT";
  maxStock: number | null;
  limited: boolean;
};

type InventoryTicketSubject = InventorySubjectBase & {
  kind: "TICKET_TYPE";
  eventId: number;
  ticketTypeId: number;
};

type InventoryStoreSubject = InventorySubjectBase & {
  kind: "STORE_ITEM";
  storeId: number;
  productId: number;
  variantId: number | null;
};

export type InventorySubjectResolution =
  | { ok: true; subject: InventoryTicketSubject | InventoryStoreSubject }
  | { ok: false; code: string; message: string; status: number };

type ResolveInventorySubjectInput = {
  orgId?: number | null;
  storeId?: number | null;
  productId?: number | null;
  variantId?: number | null;
  ticketTypeId?: number | null;
  eventId?: number | null;
};

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function resolveFingerprint(input: {
  orgId: number;
  subjectType: "TICKET_TYPE" | "STORE_PRODUCT" | "STORE_VARIANT";
  storeId?: number | null;
  eventId?: number | null;
  productId?: number | null;
  variantId?: number | null;
  ticketTypeId?: number | null;
}) {
  return buildInventoryHoldFingerprint({
    orgId: input.orgId,
    subjectType: input.subjectType,
    storeId: input.storeId ?? null,
    eventId: input.eventId ?? null,
    productId: input.productId ?? null,
    variantId: input.variantId ?? null,
    ticketTypeId: input.ticketTypeId ?? null,
  });
}

export async function resolveInventorySubject(
  input: ResolveInventorySubjectInput,
  tx: DbClient = prisma,
): Promise<InventorySubjectResolution> {
  const explicitOrgId = parsePositiveInt(input.orgId ?? null);
  const ticketTypeId = parsePositiveInt(input.ticketTypeId ?? null);
  const productId = parsePositiveInt(input.productId ?? null);
  const variantId = parsePositiveInt(input.variantId ?? null);
  const explicitStoreId = parsePositiveInt(input.storeId ?? null);
  const explicitEventId = parsePositiveInt(input.eventId ?? null);

  if (ticketTypeId) {
    const ticketType = await tx.ticketType.findUnique({
      where: { id: ticketTypeId },
      select: {
        id: true,
        eventId: true,
        totalQuantity: true,
        event: { select: { id: true, organizationId: true } },
      },
    });
    if (!ticketType || !ticketType.event) {
      return {
        ok: false,
        code: "TICKET_TYPE_NOT_FOUND",
        message: "Tipo de bilhete inválido.",
        status: 404,
      };
    }
    if (explicitEventId && explicitEventId !== ticketType.event.id) {
      return {
        ok: false,
        code: "EVENT_MISMATCH",
        message: "Evento inválido para este bilhete.",
        status: 409,
      };
    }
    if (explicitOrgId && explicitOrgId !== ticketType.event.organizationId) {
      return {
        ok: false,
        code: "ORG_MISMATCH",
        message: "Organização inválida para este bilhete.",
        status: 409,
      };
    }
    const orgId = parsePositiveInt(ticketType.event.organizationId);
    if (!orgId) {
      return {
        ok: false,
        code: "EVENT_ORG_NOT_FOUND",
        message: "Evento sem organização válida para hold.",
        status: 409,
      };
    }
    const maxStock =
      ticketType.totalQuantity !== null && ticketType.totalQuantity !== undefined
        ? Math.max(0, ticketType.totalQuantity)
        : null;
    const subjectType = "TICKET_TYPE" as const;
    return {
      ok: true,
      subject: {
        kind: "TICKET_TYPE",
        orgId,
        eventId: ticketType.event.id,
        ticketTypeId: ticketType.id,
        subjectType,
        subjectFingerprint: resolveFingerprint({
          orgId,
          subjectType,
          eventId: ticketType.event.id,
          ticketTypeId: ticketType.id,
        }),
        maxStock,
        limited: maxStock !== null,
      },
    };
  }

  if (!productId) {
    return {
      ok: false,
      code: "INVALID_SUBJECT",
      message: "Subject de inventory inválido.",
      status: 400,
    };
  }

  const product = await tx.storeProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      storeId: true,
      stockPolicy: true,
      stockQty: true,
      store: { select: { id: true, ownerOrganizationId: true } },
    },
  });
  if (!product || !product.store) {
    return {
      ok: false,
      code: "PRODUCT_NOT_FOUND",
      message: "Produto inválido.",
      status: 404,
    };
  }
  if (explicitStoreId && explicitStoreId !== product.store.id) {
    return {
      ok: false,
      code: "STORE_MISMATCH",
      message: "Store inválida para este produto.",
      status: 409,
    };
  }
  if (explicitOrgId && explicitOrgId !== product.store.ownerOrganizationId) {
    return {
      ok: false,
      code: "ORG_MISMATCH",
      message: "Organização inválida para este produto.",
      status: 409,
    };
  }

  if (variantId) {
    const variant = await tx.storeProductVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true, stockQty: true, isActive: true },
    });
    if (!variant || variant.productId !== product.id || !variant.isActive) {
      return {
        ok: false,
        code: "INVALID_VARIANT",
        message: "Variante inválida.",
        status: 409,
      };
    }
    const limited = product.stockPolicy === StoreStockPolicy.TRACKED;
    const maxStock = limited ? Math.max(0, variant.stockQty ?? 0) : null;
    const orgId = product.store.ownerOrganizationId;
    const subjectType = "STORE_VARIANT" as const;
    return {
      ok: true,
      subject: {
        kind: "STORE_ITEM",
        orgId,
        storeId: product.store.id,
        productId: product.id,
        variantId: variant.id,
        subjectType,
        subjectFingerprint: resolveFingerprint({
          orgId,
          subjectType,
          storeId: product.store.id,
          productId: product.id,
          variantId: variant.id,
        }),
        maxStock,
        limited,
      },
    };
  }

  const limited = product.stockPolicy === StoreStockPolicy.TRACKED;
  const maxStock = limited ? Math.max(0, product.stockQty ?? 0) : null;
  const orgId = product.store.ownerOrganizationId;
  const subjectType = "STORE_PRODUCT" as const;
  return {
    ok: true,
    subject: {
      kind: "STORE_ITEM",
      orgId,
      storeId: product.store.id,
      productId: product.id,
      variantId: null,
      subjectType,
      subjectFingerprint: resolveFingerprint({
        orgId,
        subjectType,
        storeId: product.store.id,
        productId: product.id,
      }),
      maxStock,
      limited,
    },
  };
}
