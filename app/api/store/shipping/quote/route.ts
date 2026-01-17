import { NextRequest, NextResponse } from "next/server";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { prisma } from "@/lib/prisma";
import { computeStoreShippingQuote } from "@/lib/store/shipping";

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
      select: { id: true, status: true, catalogLocked: true },
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

    const country = req.nextUrl.searchParams.get("country") ?? "";
    const subtotalCents = Number(req.nextUrl.searchParams.get("subtotalCents") ?? "0");
    const methodIdRaw = req.nextUrl.searchParams.get("methodId");
    const methodId = methodIdRaw ? Number(methodIdRaw) : null;
    if (!Number.isFinite(subtotalCents) || subtotalCents < 0) {
      return NextResponse.json({ ok: false, error: "Subtotal invalido." }, { status: 400 });
    }

    const quote = await computeStoreShippingQuote({
      storeId: storeParsed.storeId,
      country,
      subtotalCents,
      methodId: methodId && Number.isFinite(methodId) ? methodId : null,
    });

    if (!quote.ok) {
      return NextResponse.json({ ok: false, error: quote.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, quote: quote.quote });
  } catch (err) {
    console.error("GET /api/store/shipping/quote error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao calcular portes." }, { status: 500 });
  }
}
