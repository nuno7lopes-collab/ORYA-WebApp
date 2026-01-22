import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";

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
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true },
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

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "4");
    const limit = Number.isFinite(limitRaw) ? Math.min(12, Math.max(1, limitRaw)) : 4;
    const exclude = parseExcludeIds(req.nextUrl.searchParams.get("exclude"));

    const items = await prisma.storeProduct.findMany({
      where: {
        storeId: store.id,
        status: "ACTIVE",
        isVisible: true,
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

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/store/recommendations error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar recomendacoes." }, { status: 500 });
  }
}
