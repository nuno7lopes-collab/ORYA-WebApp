import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const updateTierSchema = z.object({
  minSubtotalCents: z.number().int().nonnegative().optional(),
  maxSubtotalCents: z.number().int().nonnegative().optional().nullable(),
  rateCents: z.number().int().nonnegative().optional(),
});

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
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

export async function GET(req: NextRequest, { params }: { params: { tierId: string } }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const tierId = parseId(params.tierId);
    if (!tierId.ok) {
      return NextResponse.json({ ok: false, error: tierId.error }, { status: 400 });
    }

    const item = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "Tier nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/tiers/[tierId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar tier." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { tierId: string } }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const tierId = parseId(params.tierId);
    if (!tierId.ok) {
      return NextResponse.json({ ok: false, error: tierId.error }, { status: 400 });
    }

    const existing = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: {
        id: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Tier nao encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateTierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const nextMin = payload.minSubtotalCents ?? existing.minSubtotalCents;
    const nextMax = payload.maxSubtotalCents === undefined ? existing.maxSubtotalCents : payload.maxSubtotalCents;
    if (nextMax !== null && nextMax < nextMin) {
      return NextResponse.json({ ok: false, error: "Intervalo invalido." }, { status: 400 });
    }

    const data: {
      minSubtotalCents?: number;
      maxSubtotalCents?: number | null;
      rateCents?: number;
    } = {};

    if (payload.minSubtotalCents !== undefined) {
      data.minSubtotalCents = payload.minSubtotalCents;
    }
    if (payload.maxSubtotalCents !== undefined) {
      data.maxSubtotalCents = payload.maxSubtotalCents;
    }
    if (payload.rateCents !== undefined) {
      data.rateCents = payload.rateCents;
    }

    const updated = await prisma.storeShippingTier.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
        rateCents: true,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/shipping/tiers/[tierId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar tier." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { tierId: string } }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const tierId = parseId(params.tierId);
    if (!tierId.ok) {
      return NextResponse.json({ ok: false, error: tierId.error }, { status: 400 });
    }

    const existing = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Tier nao encontrado." }, { status: 404 });
    }

    await prisma.storeShippingTier.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/shipping/tiers/[tierId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover tier." }, { status: 500 });
  }
}
