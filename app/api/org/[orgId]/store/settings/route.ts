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
];

const updateSettingsSchema = z.object({
  supportEmail: z.string().optional().nullable(),
  supportPhone: z.string().optional().nullable(),
  returnPolicy: z.string().optional().nullable(),
  privacyPolicy: z.string().optional().nullable(),
  termsUrl: z.string().optional().nullable(),
});

const MAX_POLICY_CHARS = 2000;
const MAX_SUPPORT_CHARS = 120;

function normalizeText(value: unknown, maxLen: number, field: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${field}_INVALID`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw new Error(`${field}_TOO_LONG`);
  }
  return trimmed;
}

function isValidEmail(value: string) {
  return z.string().email().safeParse(value).success;
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

async function getOrganizationContext(req: NextRequest, userId: string) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });

  if (!organization || !membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }

  const lojaAccess = await ensureLojaModuleAccess(organization);
  if (!lojaAccess.ok) {
    return { ok: false as const, error: lojaAccess.error };
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: {
      id: true,
      supportEmail: true,
      supportPhone: true,
      returnPolicy: true,
      privacyPolicy: true,
      termsUrl: true,
    },
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

    const context = await getOrganizationContext(req, user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    return respondOk(ctx, {
      settings: {
        supportEmail: context.store.supportEmail,
        supportPhone: context.store.supportPhone,
        returnPolicy: context.store.returnPolicy,
        privacyPolicy: context.store.privacyPolicy,
        termsUrl: context.store.termsUrl,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/settings error:", err);
    return fail(500, "Erro ao carregar definicoes.");
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

    const context = await getOrganizationContext(req, user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const body = await req.json().catch(() => null);
    const parsed = updateSettingsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    let supportEmail: string | null = null;
    let supportPhone: string | null = null;
    let returnPolicy: string | null = null;
    let privacyPolicy: string | null = null;
    let termsUrl: string | null = null;

    try {
      supportEmail = normalizeText(parsed.data.supportEmail, MAX_SUPPORT_CHARS, "SUPPORT_EMAIL");
      supportPhone = normalizeText(parsed.data.supportPhone, MAX_SUPPORT_CHARS, "SUPPORT_PHONE");
      returnPolicy = normalizeText(parsed.data.returnPolicy, MAX_POLICY_CHARS, "RETURN_POLICY");
      privacyPolicy = normalizeText(parsed.data.privacyPolicy, MAX_POLICY_CHARS, "PRIVACY_POLICY");
      termsUrl = normalizeText(parsed.data.termsUrl, MAX_POLICY_CHARS, "TERMS_URL");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dados invalidos.";
      return fail(400, message, "VALIDATION_FAILED", false);
    }

    if (supportEmail && !isValidEmail(supportEmail)) {
      return fail(400, "Email de suporte invalido.");
    }
    if (termsUrl && !isValidUrl(termsUrl)) {
      return fail(400, "URL de termos invalida.");
    }

    const updated = await prisma.store.update({
      where: { id: context.store.id },
      data: {
        supportEmail,
        supportPhone,
        returnPolicy,
        privacyPolicy,
        termsUrl,
      },
      select: {
        supportEmail: true,
        supportPhone: true,
        returnPolicy: true,
        privacyPolicy: true,
        termsUrl: true,
      },
    });

    return respondOk(ctx, { settings: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/organizacao/loja/settings error:", err);
    return fail(500, "Erro ao atualizar definicoes.");
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
