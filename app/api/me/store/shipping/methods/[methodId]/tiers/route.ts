import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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
      select: { id: true },
    });
    if (!method) {
      return fail(404, "Metodo nao encontrado.");
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

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/shipping/methods/[methodId]/tiers error:", err);
    return fail(500, "Erro ao carregar tiers.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ methodId: string }> }) {
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
      select: { id: true },
    });
    if (!method) {
      return fail(404, "Metodo nao encontrado.");
    }

    const body = await req.json().catch(() => null);
    const parsed = createTierSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    if (payload.maxSubtotalCents !== null && payload.maxSubtotalCents !== undefined) {
      if (payload.maxSubtotalCents < payload.minSubtotalCents) {
        return fail(400, "Intervalo invalido.");
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
      return fail(409, "Tier sobrepoe-se a outro intervalo.");
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

    return respondOk(ctx, { item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/me/store/shipping/methods/[methodId]/tiers error:", err);
    return fail(500, "Erro ao criar tier.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);