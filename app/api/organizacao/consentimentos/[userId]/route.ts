import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ConsentStatus, ConsentType, OrganizationMemberRole } from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

const CONSENT_TYPES: ConsentType[] = [
  ConsentType.MARKETING,
  ConsentType.CONTACT_EMAIL,
  ConsentType.CONTACT_SMS,
];

function isValidConsentType(value: unknown): value is ConsentType {
  return typeof value === "string" && CONSENT_TYPES.includes(value as ConsentType);
}

function sanitizeSource(value: unknown) {
  if (typeof value !== "string") return "ORG_CRM";
  const trimmed = value.trim();
  if (!trimmed) return "ORG_CRM";
  return trimmed.slice(0, 80);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const supabase = await createSupabaseServer();
    const actor = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(actor.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "CRM_CONSENTS" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return fail(403, crmAccess.error);
    }

    const resolvedParams = await context.params;
    const userId = resolvedParams.userId;
    if (!userId) {
      return fail(400, "Utilizador inválido.");
    }

    const payload = (await req.json().catch(() => null)) as {
      type?: unknown;
      granted?: unknown;
      source?: unknown;
    } | null;

    const consentType = isValidConsentType(payload?.type) ? (payload?.type as ConsentType) : null;
    const granted = typeof payload?.granted === "boolean" ? payload.granted : null;
    const source = sanitizeSource(payload?.source);

    if (!consentType || granted === null) {
      return fail(400, "Payload inválido.");
    }

    const [crmCustomer, existingConsent] = await Promise.all([
      prisma.crmCustomer.findFirst({
        where: { organizationId: organization.id, userId },
        select: { id: true },
      }),
      prisma.userConsent.findFirst({
        where: { organizationId: organization.id, userId },
        select: { id: true },
      }),
    ]);

    if (!crmCustomer && !existingConsent) {
      return fail(404, "Cliente não encontrado.");
    }

    const status = granted ? ConsentStatus.GRANTED : ConsentStatus.REVOKED;
    const now = new Date();

    const consent = await prisma.userConsent.upsert({
      where: {
        organizationId_userId_type: {
          organizationId: organization.id,
          userId,
          type: consentType,
        },
      },
      update: {
        status,
        source,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      },
      create: {
        organizationId: organization.id,
        userId,
        type: consentType,
        status,
        source,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      },
      select: {
        organizationId: true,
        userId: true,
        type: true,
        status: true,
        source: true,
        grantedAt: true,
        revokedAt: true,
        updatedAt: true,
      },
    });

    if (consentType === ConsentType.MARKETING) {
      await prisma.crmCustomer.updateMany({
        where: { organizationId: organization.id, userId },
        data: {
          marketingOptIn: granted,
          marketingOptInAt: granted ? now : null,
        },
      });
    }

    if (consentType === ConsentType.CONTACT_EMAIL) {
      let email: string | null = null;
      if (granted) {
        const authUser = await prisma.users.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        email = authUser?.email ?? null;
      }
      await prisma.crmCustomer.updateMany({
        where: { organizationId: organization.id, userId },
        data: { contactEmail: email },
      });
    }

    if (consentType === ConsentType.CONTACT_SMS) {
      let phone: string | null = null;
      if (granted) {
        const profile = await prisma.profile.findUnique({
          where: { id: userId },
          select: { contactPhone: true },
        });
        phone = profile?.contactPhone ?? null;
      }
      await prisma.crmCustomer.updateMany({
        where: { organizationId: organization.id, userId },
        data: { contactPhone: phone },
      });
    }

    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: actor.id,
      action: "CRM_CONSENT_UPDATE",
      toUserId: userId,
      metadata: {
        type: consentType,
        status,
        source,
      },
    });

    return respondOk(ctx, { consent });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("PUT /api/organizacao/consentimentos/[userId] error:", err);
    return fail(500, "Erro ao atualizar consentimento.");
  }
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
