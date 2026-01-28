import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { prisma } from "@/lib/prisma";
import { computeMethodShipping } from "@/lib/store/shipping";
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
      select: {
        id: true,
        status: true,
        showOnProfile: true,
        catalogLocked: true,
        freeShippingThresholdCents: true,
      },
    });
    if (!store) {
      return jsonWrap({ ok: false, error: "Store nao encontrada." }, { status: 404 });
    }
    if (!isStorePublic(store)) {
      return jsonWrap({ ok: false, error: "Loja fechada." }, { status: 403 });
    }
    if (store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const country = req.nextUrl.searchParams.get("country") ?? "";
    const subtotalCents = Number(req.nextUrl.searchParams.get("subtotalCents") ?? "0");
    if (!country.trim()) {
      return jsonWrap({ ok: false, error: "Pais invalido." }, { status: 400 });
    }
    if (!Number.isFinite(subtotalCents) || subtotalCents < 0) {
      return jsonWrap({ ok: false, error: "Subtotal invalido." }, { status: 400 });
    }

    const zone = await prisma.storeShippingZone.findFirst({
      where: {
        storeId: store.id,
        isActive: true,
        countries: { has: country.trim().toUpperCase() },
      },
      include: { methods: { include: { tiers: true } } },
    });

    if (!zone) {
      return jsonWrap({ ok: false, error: "Zona de envio nao encontrada." }, { status: 404 });
    }

    const orderedMethods = [...zone.methods].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const methods = orderedMethods.map((method) => {
      const computed = computeMethodShipping({
        method,
        subtotalCents,
        storeFreeThresholdCents: store.freeShippingThresholdCents,
      });

      return {
        id: method.id,
        zoneId: zone.id,
        name: method.name,
        description: method.description,
        baseRateCents: method.baseRateCents,
        mode: method.mode,
        freeOverCents: method.freeOverCents,
        isDefault: method.isDefault,
        etaMinDays: method.etaMinDays,
        etaMaxDays: method.etaMaxDays,
        available: computed.ok,
        shippingCents: computed.ok ? computed.shippingCents : null,
        freeOverRemainingCents: computed.ok ? computed.freeOverRemainingCents : null,
        methodFreeOverRemainingCents: computed.ok ? computed.methodFreeOverRemainingCents : null,
      };
    });

    const available = methods.filter((method) => method.available);
    if (available.length === 0) {
      return jsonWrap({ ok: false, error: "Sem metodos disponiveis." }, { status: 409 });
    }

    return jsonWrap({
      ok: true,
      zone: { id: zone.id, name: zone.name },
      methods,
    });
  } catch (err) {
    console.error("GET /api/store/shipping/methods error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar metodos." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);