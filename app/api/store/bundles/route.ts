import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { computeBundleTotals } from "@/lib/store/bundles";

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

export async function GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return NextResponse.json({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: { id: storeParsed.storeId },
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
    });
    if (!store) {
      return NextResponse.json({ ok: false, error: "Store nao encontrada." }, { status: 404 });
    }
    if (!isStorePublic(store)) {
      return NextResponse.json({ ok: false, error: "Loja fechada." }, { status: 403 });
    }
    if (store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const bundles = await prisma.storeBundle.findMany({
      where: { storeId: store.id, status: "ACTIVE", isVisible: true },
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
                status: true,
                isVisible: true,
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
            item.product.status !== "ACTIVE" ||
            !item.product.isVisible ||
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

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/store/bundles error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar bundles." }, { status: 500 });
  }
}
