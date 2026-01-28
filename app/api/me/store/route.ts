import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOwnerType, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function normalizeStore(store: {
  id: number;
  status: StoreStatus;
  catalogLocked: boolean;
  checkoutEnabled: boolean;
  showOnProfile: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: store.id,
    status: store.status,
    catalogLocked: store.catalogLocked,
    checkoutEnabled: store.checkoutEnabled,
    showOnProfile: store.showOnProfile,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

const updateStoreSchema = z.object({
  status: z.nativeEnum(StoreStatus).optional(),
  catalogLocked: z.boolean().optional(),
  checkoutEnabled: z.boolean().optional(),
  showOnProfile: z.boolean().optional(),
});

async function _GET() {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const store = await prisma.store.findFirst({
      where: { ownerUserId: user.id },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return jsonWrap({ ok: true, store: store ? normalizeStore(store) : null });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar loja." }, { status: 500 });
  }
}

async function _POST() {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const existing = await prisma.store.findFirst({
      where: { ownerUserId: user.id },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existing) {
      return jsonWrap({ ok: true, store: normalizeStore(existing) });
    }

    const created = await prisma.store.create({
      data: {
        ownerType: StoreOwnerType.PROFILE,
        ownerUserId: user.id,
        status: StoreStatus.CLOSED,
        catalogLocked: true,
        checkoutEnabled: false,
        showOnProfile: false,
        currency: "EUR",
      },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return jsonWrap({ ok: true, store: normalizeStore(created) }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar loja." }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const store = await prisma.store.findFirst({
      where: { ownerUserId: user.id },
      select: { id: true },
    });
    if (!store) {
      return jsonWrap({ ok: false, error: "Loja ainda nao criada." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateStoreSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        status: payload.status ?? undefined,
        catalogLocked: payload.catalogLocked ?? undefined,
        checkoutEnabled: payload.checkoutEnabled ?? undefined,
        showOnProfile: payload.showOnProfile ?? undefined,
      },
      select: {
        id: true,
        status: true,
        catalogLocked: true,
        checkoutEnabled: true,
        showOnProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return jsonWrap({ ok: true, store: normalizeStore(updated) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar loja." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);