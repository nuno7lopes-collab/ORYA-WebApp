import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ConsentStatus, ConsentType, OrganizationMemberRole } from "@prisma/client";

const ALLOWED_ROLES = Object.values(OrganizationMemberRole);

const CONSENT_TYPES = [
  ConsentType.MARKETING,
  ConsentType.CONTACT_EMAIL,
  ConsentType.CONTACT_SMS,
] as const;

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
  try {
    const supabase = await createSupabaseServer();
    const actor = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(actor.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return NextResponse.json({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const userId = resolvedParams.userId;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Utilizador inválido." }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
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

    return NextResponse.json({ ok: true, consent });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("PUT /api/organizacao/consentimentos/[userId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar consentimento." }, { status: 500 });
  }
}
