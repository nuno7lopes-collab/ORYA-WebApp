import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, isPublicStore } from "@/lib/storeAccess";
import { computeBundleTotals } from "@/lib/store/bundles";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

async function _GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return jsonWrap({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: { id: storeParsed.storeId },
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
    });
    if (!store) {
      return jsonWrap({ ok: false, error: "Store nao encontrada." }, { status: 404 });
    }
    if (!isPublicStore(store)) {
      return jsonWrap({ ok: false, error: "Loja fechada." }, { status: 403 });
    }
    if (store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const bundles = await prisma.storeBundle.findMany({
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
            variant: {
              select: { id: true, label: true, priceCents: true, isActive: true },
            },
          },
        },
      },
    });

    const items = bundles
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
        const { totalCents, discountCents } = computeBundleTotals({
          pricingMode: bundle.pricingMode,
          priceCents: bundle.priceCents,
          percentOff: bundle.percentOff,
          baseCents,
        });
        if (bundle.items.length < 2 || baseCents <= 0 || totalCents >= baseCents) {
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
          totalCents,
          discountCents,
          currency: store.currency,
          items: bundle.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            product: {
              id: item.product.id,
              name: item.product.name,
              slug: item.product.slug,
              images: item.product.images,
            },
            variant: item.variant ? { id: item.variant.id, label: item.variant.label } : null,
          })),
        };
      })
      .filter(Boolean);

    return jsonWrap({ ok: true, items });
  } catch (err) {
    console.error("GET /api/public/store/bundles error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar bundles." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
