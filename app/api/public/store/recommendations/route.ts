import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, isPublicStore } from "@/lib/storeAccess";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

function parseExcludeIds(raw: string | null) {
  if (!raw) return [] as number[];
  return raw
    .split(",")
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
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
      select: {
        id: true,
        status: true,
        showOnProfile: true,
        catalogLocked: true,
        organization: {
          select: {
            orgType: true,
            officialEmail: true,
            officialEmailVerifiedAt: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
          },
        },
      },
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

    const paymentsGate = getPublicStorePaymentsGate({
      orgType: store.organization?.orgType,
      officialEmail: store.organization?.officialEmail,
      officialEmailVerifiedAt: store.organization?.officialEmailVerifiedAt,
      stripeAccountId: store.organization?.stripeAccountId,
      stripeChargesEnabled: store.organization?.stripeChargesEnabled,
      stripePayoutsEnabled: store.organization?.stripePayoutsEnabled,
    });
    if (!paymentsGate.ok) {
      return jsonWrap({ ok: false, error: "PAYMENTS_NOT_READY" }, { status: 403 });
    }

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "4");
    const limit = Number.isFinite(limitRaw) ? Math.min(12, Math.max(1, limitRaw)) : 4;
    const exclude = parseExcludeIds(req.nextUrl.searchParams.get("exclude"));

    const items = await prisma.storeProduct.findMany({
      where: {
        storeId: store.id,
        visibility: "PUBLIC",
        id: exclude.length ? { notIn: exclude } : undefined,
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        compareAtPriceCents: true,
        currency: true,
        images: {
          select: { url: true, altText: true, isPrimary: true, sortOrder: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    console.error("GET /api/public/store/recommendations error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar recomendacoes." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
