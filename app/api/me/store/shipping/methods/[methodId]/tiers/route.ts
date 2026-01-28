import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const createTierSchema = z.object({
  minSubtotalCents: z.number().int().nonnegative(),
  maxSubtotalCents: z.number().int().nonnegative().optional().nullable(),
  rateCents: z.number().int().nonnegative(),
});

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

function rangesOverlap(minA: number, maxA: number | null, minB: number, maxB: number | null) {
  const aMax = maxA ?? Number.POSITIVE_INFINITY;
  const bMax = maxB ?? Number.POSITIVE_INFINITY;
  return minA <= bMax && minB <= aMax;
}

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return jsonWrap({ ok: false, error: methodId.error }, { status: 400 });
    }

    const method = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!method) {
      return jsonWrap({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    const items = await prisma.storeShippingTier.findMany({
      where: { methodId: methodId.id },
      orderBy: [{ minSubtotalCents: "asc" }],
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/methods/[methodId]/tiers error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar tiers." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return jsonWrap({ ok: false, error: methodId.error }, { status: 400 });
    }

    const method = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!method) {
      return jsonWrap({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createTierSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    if (payload.maxSubtotalCents !== null && payload.maxSubtotalCents !== undefined) {
      if (payload.maxSubtotalCents < payload.minSubtotalCents) {
        return jsonWrap({ ok: false, error: "Intervalo invalido." }, { status: 400 });
      }
    }

    const existingTiers = await prisma.storeShippingTier.findMany({
      where: { methodId: methodId.id },
      select: { id: true, minSubtotalCents: true, maxSubtotalCents: true },
    });
    const overlap = existingTiers.some((tier) =>
      rangesOverlap(
        payload.minSubtotalCents,
        payload.maxSubtotalCents ?? null,
        tier.minSubtotalCents,
        tier.maxSubtotalCents,
      ),
    );
    if (overlap) {
      return jsonWrap({ ok: false, error: "Tier sobrepoe-se a outro intervalo." }, { status: 409 });
    }

    const created = await prisma.storeShippingTier.create({
      data: {
        methodId: methodId.id,
        minSubtotalCents: payload.minSubtotalCents,
        maxSubtotalCents: payload.maxSubtotalCents ?? null,
        rateCents: payload.rateCents,
      },
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    return jsonWrap({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/shipping/methods/[methodId]/tiers error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar tier." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);