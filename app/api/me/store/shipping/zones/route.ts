import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const createZoneSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
  countries: z.array(z.string().trim().min(2).max(3)).min(1, "Pais obrigatorio."),
  isActive: z.boolean().optional(),
});

function normalizeCountries(countries: string[]) {
  const normalized = countries
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length >= 2 && entry.length <= 3);
  return Array.from(new Set(normalized));
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
async function _GET(req: NextRequest) {
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

    const items = await prisma.storeShippingZone.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        countries: true,
        isActive: true,
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/shipping/zones error:", err);
    return fail(500, "Erro ao carregar zonas.");
  }
}

async function _POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    const parsed = createZoneSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const countries = normalizeCountries(payload.countries);
    if (countries.length === 0) {
      return fail(400, "Paises invalidos.");
    }

    if (payload.isActive ?? true) {
      const overlapping = await prisma.storeShippingZone.findMany({
        where: {
          storeId: context.store.id,
          isActive: true,
          countries: { hasSome: countries },
        },
        select: { id: true },
      });
      if (overlapping.length > 0) {
        return fail(409, "Pais ja associado a outra zona ativa.");
      }
    }

    const created = await prisma.storeShippingZone.create({
      data: {
        storeId: context.store.id,
        name: payload.name.trim(),
        countries,
        isActive: payload.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        countries: true,
        isActive: true,
      },
    });

    return respondOk(ctx, { item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/me/store/shipping/zones error:", err);
    return fail(500, "Erro ao criar zona.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);