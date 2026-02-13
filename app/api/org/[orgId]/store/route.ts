import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

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

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return fail(403, emailGate.errorCode);
    }
    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return fail(403, lojaAccess.error);
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
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

    return respondOk(ctx, {store: store ? normalizeStore(store) : null });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/store error:", err);
    return fail(500, "Erro ao carregar loja.");
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

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return fail(403, emailGate.errorCode);
    }
    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return fail(403, lojaAccess.error);
    }

    const existing = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
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
      return respondOk(ctx, {store: normalizeStore(existing) });
    }

    const created = await prisma.store.create({
      data: {
        ownerOrganizationId: organization.id,
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

    return respondOk(ctx, {store: normalizeStore(created) }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/store error:", err);
    return fail(500, "Erro ao criar loja.");
  }
}

async function _PATCH(req: NextRequest) {
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

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return fail(403, emailGate.errorCode);
    }
    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return fail(403, lojaAccess.error);
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: { id: true },
    });
    if (!store) {
      return fail(404, "Loja ainda nao criada.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateStoreSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
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

    return respondOk(ctx, {store: normalizeStore(updated) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("PATCH /api/org/[orgId]/store error:", err);
    return fail(500, "Erro ao atualizar loja.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
