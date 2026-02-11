import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreShippingMode } from "@prisma/client";
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

const createMethodSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  baseRateCents: z.number().int().nonnegative(),
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

    const zone = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!zone) {
      return fail(404, "Zona nao encontrada.");
    }

    const items = await prisma.storeShippingMethod.findMany({
      where: { zoneId: zoneId.id },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
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

    return respondOk(ctx, {items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/shipping/zones/[zoneId]/methods error:", err);
    return fail(500, "Erro ao carregar metodos.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
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

    const zone = await prisma.storeShippingZone.findFirst({
      where: { id: zoneId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!zone) {
      return fail(404, "Zona nao encontrada.");
    }

    const body = await req.json().catch(() => null);
    const parsed = createMethodSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const etaMinDays = payload.etaMinDays ?? null;
    const etaMaxDays = payload.etaMaxDays ?? null;
    if (etaMinDays !== null && etaMaxDays !== null && etaMinDays > etaMaxDays) {
      return fail(400, "ETA invalida.");
    }

    const created = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.storeShippingMethod.updateMany({
          where: { zoneId: zoneId.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.storeShippingMethod.create({
        data: {
          zoneId: zoneId.id,
          name: payload.name.trim(),
          description: payload.description ?? null,
          baseRateCents: payload.baseRateCents,
          mode: payload.mode ?? StoreShippingMode.FLAT,
          freeOverCents: payload.freeOverCents ?? null,
          isDefault: payload.isDefault ?? false,
          etaMinDays,
          etaMaxDays,
        },
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

    return respondOk(ctx, {item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/organizacao/loja/shipping/zones/[zoneId]/methods error:", err);
    return fail(500, "Erro ao criar metodo.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);