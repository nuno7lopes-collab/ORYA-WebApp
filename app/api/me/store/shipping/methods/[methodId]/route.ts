import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreShippingMode } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const updateMethodSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  baseRateCents: z.number().int().nonnegative().optional(),
  mode: z.nativeEnum(StoreShippingMode).optional(),
  freeOverCents: z.number().int().nonnegative().optional().nullable(),
  isDefault: z.boolean().optional(),
  etaMinDays: z.number().int().nonnegative().optional().nullable(),
  etaMaxDays: z.number().int().nonnegative().optional().nullable(),
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
      select: {
        id: true,
        zoneId: true,
        name: true,
        description: true,
        baseRateCents: true,
        mode: true,
        freeOverCents: true,
        isDefault: true,
        etaMinDays: true,
        etaMaxDays: true,
      },
    });
    if (!method) {
      return jsonWrap({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    return jsonWrap({ ok: true, item: method });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/shipping/methods/[methodId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar metodo." }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
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

    const existing = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: {
        id: true,
        zoneId: true,
        etaMinDays: true,
        etaMaxDays: true,
      },
    });

    if (!existing) {
      return jsonWrap({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateMethodSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const nextEtaMin = payload.etaMinDays === undefined ? existing.etaMinDays : payload.etaMinDays;
    const nextEtaMax = payload.etaMaxDays === undefined ? existing.etaMaxDays : payload.etaMaxDays;
    if (nextEtaMin !== null && nextEtaMax !== null && nextEtaMin > nextEtaMax) {
      return jsonWrap({ ok: false, error: "ETA invalida." }, { status: 400 });
    }

    const data: {
      name?: string;
      description?: string | null;
      baseRateCents?: number;
      mode?: StoreShippingMode;
      freeOverCents?: number | null;
      isDefault?: boolean;
      etaMinDays?: number | null;
      etaMaxDays?: number | null;
    } = {};

    if (payload.name !== undefined) {
      data.name = payload.name.trim();
    }
    if (payload.description !== undefined) {
      data.description = payload.description;
    }
    if (payload.baseRateCents !== undefined) {
      data.baseRateCents = payload.baseRateCents;
    }
    if (payload.mode !== undefined) {
      data.mode = payload.mode;
    }
    if (payload.freeOverCents !== undefined) {
      data.freeOverCents = payload.freeOverCents;
    }
    if (payload.isDefault !== undefined) {
      data.isDefault = payload.isDefault;
    }
    if (payload.etaMinDays !== undefined) {
      data.etaMinDays = payload.etaMinDays;
    }
    if (payload.etaMaxDays !== undefined) {
      data.etaMaxDays = payload.etaMaxDays;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.storeShippingMethod.updateMany({
          where: { zoneId: existing.zoneId, id: { not: existing.id } },
          data: { isDefault: false },
        });
      }

      return tx.storeShippingMethod.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          zoneId: true,
          name: true,
          description: true,
          baseRateCents: true,
          mode: true,
          freeOverCents: true,
          isDefault: true,
          etaMinDays: true,
          etaMaxDays: true,
        },
      });
    });

    return jsonWrap({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/shipping/methods/[methodId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar metodo." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
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

    const existing = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Metodo nao encontrado." }, { status: 404 });
    }

    await prisma.storeShippingMethod.delete({ where: { id: existing.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/shipping/methods/[methodId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover metodo." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);