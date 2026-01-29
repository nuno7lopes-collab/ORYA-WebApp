import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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

function rangesOverlap(minA: number, maxA: number | null, minB: number, maxB: number | null) {
  const aMax = maxA ?? Number.POSITIVE_INFINITY;
  const bMax = maxB ?? Number.POSITIVE_INFINITY;
  return minA <= bMax && minB <= aMax;
}

async function getOrganizationContext(req: NextRequest, userId: string, options?: { requireVerifiedEmail?: boolean }) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });

  if (!organization || !membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }

  const lojaAccess = await ensureLojaModuleAccess(organization, undefined, options);
  if (!lojaAccess.ok) {
    return { ok: false as const, error: lojaAccess.error };
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
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
async function _GET(req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
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

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const tierId = parseId(resolvedParams.tierId);
    if (!tierId.ok) {
      return fail(400, tierId.error);
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
      return fail(404, "Tier nao encontrado.");
    }

    return respondOk(ctx, {item });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/shipping/tiers/[tierId] error:", err);
    return fail(500, "Erro ao carregar tier.");
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
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

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const tierId = parseId(resolvedParams.tierId);
    if (!tierId.ok) {
      return fail(400, tierId.error);
    }

    const existing = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: {
        id: true,
        methodId: true,
        minSubtotalCents: true,
        maxSubtotalCents: true,
      },
    });

    if (!existing) {
      return fail(404, "Tier nao encontrado.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateTierSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const nextMin = payload.minSubtotalCents ?? existing.minSubtotalCents;
    const nextMax = payload.maxSubtotalCents === undefined ? existing.maxSubtotalCents : payload.maxSubtotalCents;
    if (nextMax !== null && nextMax < nextMin) {
      return fail(400, "Intervalo invalido.");
    }

    const otherTiers = await prisma.storeShippingTier.findMany({
      where: { methodId: existing.methodId, id: { not: existing.id } },
      select: { id: true, minSubtotalCents: true, maxSubtotalCents: true },
    });
    const overlap = otherTiers.some((tier) => rangesOverlap(nextMin, nextMax, tier.minSubtotalCents, tier.maxSubtotalCents));
    if (overlap) {
      return fail(409, "Tier sobrepoe-se a outro intervalo.");
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

    return respondOk(ctx, {item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/organizacao/loja/shipping/tiers/[tierId] error:", err);
    return fail(500, "Erro ao atualizar tier.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
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

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const tierId = parseId(resolvedParams.tierId);
    if (!tierId.ok) {
      return fail(400, tierId.error);
    }

    const existing = await prisma.storeShippingTier.findFirst({
      where: { id: tierId.id, method: { zone: { storeId: context.store.id } } },
      select: { id: true },
    });

    if (!existing) {
      return fail(404, "Tier nao encontrado.");
    }

    await prisma.storeShippingTier.delete({ where: { id: existing.id } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/organizacao/loja/shipping/tiers/[tierId] error:", err);
    return fail(500, "Erro ao remover tier.");
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);