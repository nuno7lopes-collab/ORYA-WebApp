import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseParams(req: NextRequest) {
  const usernameRaw = req.nextUrl.searchParams.get("username");
  const slugRaw = req.nextUrl.searchParams.get("slug");
  const username = usernameRaw ? normalizeUsernameInput(usernameRaw) : null;
  const slug = slugRaw?.trim() ?? "";
  if (!username || isReservedUsername(username) || !slug) {
    return { ok: false as const, error: "Parametros invalidos." };
  }
  return { ok: true as const, username, slug };
}

async function _GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const parsed = parseParams(req);
    if (!parsed.ok) {
      return jsonWrap({ ok: false, error: parsed.error }, { status: 400 });
    }

    const organization = await prisma.organization.findFirst({
      where: { username: parsed.username, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        publicName: true,
        businessName: true,
        orgType: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });
    if (!organization) {
      return jsonWrap({ ok: false, error: "Organizacao nao encontrada." }, { status: 404 });
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: {
        id: true,
        status: true,
        showOnProfile: true,
        catalogLocked: true,
        checkoutEnabled: true,
        currency: true,
      },
    });
    if (!store) {
      return jsonWrap({ ok: false, error: "Loja nao encontrada." }, { status: 404 });
    }

    const paymentsGate = getPublicStorePaymentsGate({
      orgType: organization.orgType,
      officialEmail: organization.officialEmail,
      officialEmailVerifiedAt: organization.officialEmailVerifiedAt,
      stripeAccountId: organization.stripeAccountId,
      stripeChargesEnabled: organization.stripeChargesEnabled,
      stripePayoutsEnabled: organization.stripePayoutsEnabled,
    });
    if (!paymentsGate.ok) {
      return jsonWrap({ ok: false, error: "PAYMENTS_NOT_READY" }, { status: 403 });
    }

    const resolvedState = resolveStoreState(store);
    if (resolvedState !== "ACTIVE" || store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo indisponivel." }, { status: 403 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { storeId: store.id, slug: parsed.slug, visibility: "PUBLIC" },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        priceCents: true,
        compareAtPriceCents: true,
        currency: true,
        requiresShipping: true,
        stockPolicy: true,
        stockQty: true,
        category: { select: { id: true, name: true, slug: true } },
        images: {
          select: { url: true, altText: true, isPrimary: true, sortOrder: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }],
          select: { id: true, label: true, priceCents: true, stockQty: true, isActive: true },
        },
        options: {
          orderBy: [{ sortOrder: "asc" }],
          select: {
            id: true,
            label: true,
            optionType: true,
            required: true,
            maxLength: true,
            minValue: true,
            maxValue: true,
            priceDeltaCents: true,
            values: {
              orderBy: [{ sortOrder: "asc" }],
              select: { id: true, value: true, label: true, priceDeltaCents: true },
            },
          },
        },
      },
    });

    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const defaultShipping = await prisma.storeShippingMethod.findFirst({
      where: { zone: { storeId: store.id, isActive: true } },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      select: { etaMinDays: true, etaMaxDays: true },
    });

    const displayName =
      organization.publicName || organization.businessName || organization.username || `Loja ${store.id}`;

    return jsonWrap({
      ok: true,
      store: {
        id: store.id,
        username: organization.username ?? parsed.username,
        displayName,
        resolvedState,
        currency: store.currency,
      },
      product: {
        ...product,
        shippingEta: defaultShipping
          ? { minDays: defaultShipping.etaMinDays, maxDays: defaultShipping.etaMaxDays }
          : null,
      },
    });
  } catch (err) {
    console.error("GET /api/public/store/product error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar produto." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
