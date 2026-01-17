import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreShippingMode } from "@prisma/client";
import { z } from "zod";

const updateSettingsSchema = z.object({
  freeShippingThresholdCents: z.number().int().nonnegative().optional().nullable(),
  shippingMode: z.nativeEnum(StoreShippingMode).optional(),
});

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, freeShippingThresholdCents: true, shippingMode: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

export async function GET() {
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

    return NextResponse.json({
      ok: true,
      settings: {
        freeShippingThresholdCents: context.store.freeShippingThresholdCents,
        shippingMode: context.store.shippingMode,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/settings error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

    const body = await req.json().catch(() => null);
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const updated = await prisma.store.update({
      where: { id: context.store.id },
      data: {
        freeShippingThresholdCents: payload.freeShippingThresholdCents ?? null,
        shippingMode: payload.shippingMode ?? undefined,
      },
      select: { freeShippingThresholdCents: true, shippingMode: true },
    });

    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/shipping/settings error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar settings." }, { status: 500 });
  }
}
