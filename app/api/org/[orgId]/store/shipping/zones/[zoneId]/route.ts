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

const updateZoneSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120).optional(),
  countries: z.array(z.string().trim().min(2).max(3)).min(1, "Pais obrigatorio.").optional(),
  isActive: z.boolean().optional(),
});

function normalizeCountries(countries: string[]) {
  const normalized = countries
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length >= 2 && entry.length <= 3);
  return Array.from(new Set(normalized));
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
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
async function _GET(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return fail(400, zoneId.error);
    }

    const item = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true, name: true, countries: true, isActive: true },
    });

    if (!item) {
      return fail(404, "Zona nao encontrada.");
    }

    return respondOk(ctx, {item });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/shipping/zones/[zoneId] error:", err);
    return fail(500, "Erro ao carregar zona.");
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return fail(400, zoneId.error);
    }

    const existing = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true, countries: true, isActive: true },
    });
    if (!existing) {
      return fail(404, "Zona nao encontrada.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateZoneSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const data: { name?: string; countries?: string[]; isActive?: boolean } = {};

    const nextIsActive = payload.isActive ?? existing.isActive;
    const nextCountries =
      payload.countries !== undefined ? normalizeCountries(payload.countries) : existing.countries;

    if (payload.name !== undefined) {
      data.name = payload.name.trim();
    }

    if (payload.countries !== undefined) {
      if (nextCountries.length === 0) {
        return fail(400, "Paises invalidos.");
      }
      data.countries = nextCountries;
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }

    if (nextIsActive) {
      const overlapping = await prisma.storeShippingZone.findMany({
        where: {
          storeId: context.store.id,
          id: { not: existing.id },
          isActive: true,
          countries: { hasSome: nextCountries },
        },
        select: { id: true },
      });
      if (overlapping.length > 0) {
        return fail(409, "Pais ja associado a outra zona ativa.");
      }
    }

    const updated = await prisma.storeShippingZone.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, countries: true, isActive: true },
    });

    return respondOk(ctx, {item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/organizacao/loja/shipping/zones/[zoneId] error:", err);
    return fail(500, "Erro ao atualizar zona.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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
    const zoneId = parseId(resolvedParams.zoneId);
    if (!zoneId.ok) {
      return fail(400, zoneId.error);
    }

    const existing = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Zona nao encontrada.");
    }

    await prisma.storeShippingZone.delete({ where: { id: existing.id } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/organizacao/loja/shipping/zones/[zoneId] error:", err);
    return fail(500, "Erro ao remover zona.");
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);