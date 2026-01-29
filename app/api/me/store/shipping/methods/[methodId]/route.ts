import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreShippingMode } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _GET(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return fail(400, methodId.error);
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
      return fail(404, "Metodo nao encontrado.");
    }

    return respondOk(ctx, { item: method });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/shipping/methods/[methodId] error:", err);
    return fail(500, "Erro ao carregar metodo.");
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return fail(400, methodId.error);
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
      return fail(404, "Metodo nao encontrado.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateMethodSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const nextEtaMin = payload.etaMinDays === undefined ? existing.etaMinDays : payload.etaMinDays;
    const nextEtaMax = payload.etaMaxDays === undefined ? existing.etaMaxDays : payload.etaMaxDays;
    if (nextEtaMin !== null && nextEtaMax !== null && nextEtaMin > nextEtaMax) {
      return fail(400, "ETA invalida.");
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

    return respondOk(ctx, { item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/me/store/shipping/methods/[methodId] error:", err);
    return fail(500, "Erro ao atualizar metodo.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const methodId = parseId(resolvedParams.methodId);
    if (!methodId.ok) {
      return fail(400, methodId.error);
    }

    const existing = await prisma.storeShippingMethod.findFirst({
      where: { id: methodId.id, zone: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Metodo nao encontrado.");
    }

    await prisma.storeShippingMethod.delete({ where: { id: existing.id } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/me/store/shipping/methods/[methodId] error:", err);
    return fail(500, "Erro ao remover metodo.");
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);