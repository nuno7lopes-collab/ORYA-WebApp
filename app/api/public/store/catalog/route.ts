import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import { computeBundleTotals } from "@/lib/store/bundles";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseUsername(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("username");
  if (!raw) return { ok: false as const, error: "Username invalido." };
  const username = normalizeUsernameInput(raw);
  if (!username || isReservedUsername(username)) {
    return { ok: false as const, error: "Username invalido." };
  }
  return { ok: true as const, username };
}

async function _GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const parsed = parseUsername(req);
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
        brandingAvatarUrl: true,
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
        freeShippingThresholdCents: true,
        supportEmail: true,
        supportPhone: true,
        returnPolicy: true,
        privacyPolicy: true,
        termsUrl: true,
      },
    });

    if (!store) {
      return jsonWrap({ ok: false, error: "Loja nao encontrada." }, { status: 404 });
    }

    const resolvedState = resolveStoreState(store);
    const catalogAvailable = resolvedState === "ACTIVE" && !store.catalogLocked;

    const categories = catalogAvailable
      ? await prisma.storeCategory.findMany({
          where: { storeId: store.id, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, slug: true },
        })
      : [];

    const products = catalogAvailable
      ? await prisma.storeProduct.findMany({
          where: { storeId: store.id, visibility: "PUBLIC" },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            priceCents: true,
            compareAtPriceCents: true,
            currency: true,
            category: { select: { id: true, name: true, slug: true } },
            images: {
              select: { url: true, altText: true, isPrimary: true, sortOrder: true },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1,
            },
          },
        })
      : [];

    const bundlesRaw = catalogAvailable
      ? await prisma.storeBundle.findMany({
          where: { storeId: store.id, visibility: "PUBLIC" },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            pricingMode: true,
            priceCents: true,
            percentOff: true,
            items: {
              orderBy: [{ id: "asc" }],
              select: {
                id: true,
                quantity: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    priceCents: true,
                    currency: true,
                    visibility: true,
                    images: {
                      select: { url: true, altText: true, isPrimary: true, sortOrder: true },
                      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                      take: 1,
                    },
                  },
                },
                variant: { select: { id: true, label: true, priceCents: true, isActive: true } },
              },
            },
          },
        })
      : [];

    const bundles = bundlesRaw
      .map((bundle) => {
        if (!bundle.items.length) return null;
        const hasInvalid = bundle.items.some(
          (item) =>
            item.product.visibility !== "PUBLIC" ||
            item.product.currency !== store.currency ||
            (item.variant && !item.variant.isActive),
        );
        if (hasInvalid) return null;

        const baseCents = bundle.items.reduce((sum, item) => {
          const unitPrice = item.variant?.priceCents ?? item.product.priceCents;
          return sum + unitPrice * item.quantity;
        }, 0);
        const totals = computeBundleTotals({
          pricingMode: bundle.pricingMode,
          priceCents: bundle.priceCents,
          percentOff: bundle.percentOff,
          baseCents,
        });
        if (bundle.items.length < 2 || baseCents <= 0 || totals.totalCents >= baseCents) {
          return null;
        }

        return {
          id: bundle.id,
          name: bundle.name,
          slug: bundle.slug,
          description: bundle.description,
          pricingMode: bundle.pricingMode,
          priceCents: bundle.priceCents,
          percentOff: bundle.percentOff,
          baseCents,
          totalCents: totals.totalCents,
          discountCents: totals.discountCents,
          currency: store.currency,
          items: bundle.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            product: {
              id: item.product.id,
              name: item.product.name,
              slug: item.product.slug,
              image: item.product.images[0] ?? null,
            },
            variant: item.variant ? { id: item.variant.id, label: item.variant.label } : null,
          })),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const displayName =
      organization.publicName || organization.businessName || organization.username || `Loja ${store.id}`;

    return jsonWrap({
      ok: true,
      store: {
        id: store.id,
        username: organization.username ?? parsed.username,
        displayName,
        avatarUrl: organization.brandingAvatarUrl ?? null,
        resolvedState,
        catalogAvailable,
        checkoutAvailable: resolvedState === "ACTIVE",
        currency: store.currency,
        freeShippingThresholdCents: store.freeShippingThresholdCents,
        supportEmail: store.supportEmail,
        supportPhone: store.supportPhone,
        returnPolicy: store.returnPolicy,
        privacyPolicy: store.privacyPolicy,
        termsUrl: store.termsUrl,
      },
      categories,
      products,
      bundles,
    });
  } catch (err) {
    console.error("GET /api/public/store/catalog error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar catalogo." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
