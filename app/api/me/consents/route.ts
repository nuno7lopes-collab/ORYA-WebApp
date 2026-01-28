import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { ConsentStatus, ConsentType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const CONSENT_TYPES: ConsentType[] = [
  ConsentType.MARKETING,
  ConsentType.CONTACT_EMAIL,
  ConsentType.CONTACT_SMS,
];

function isValidConsentType(value: unknown): value is ConsentType {
  return typeof value === "string" && CONSENT_TYPES.includes(value as ConsentType);
}

async function _GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const [crmCustomers, consentRows] = await Promise.all([
      prisma.crmCustomer.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      }),
      prisma.userConsent.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      }),
    ]);

    const orgIds = Array.from(
      new Set([
        ...crmCustomers.map((row) => row.organizationId),
        ...consentRows.map((row) => row.organizationId),
      ]),
    );

    if (orgIds.length === 0) {
      return jsonWrap({ ok: true, items: [] });
    }

    const organizations = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: {
        id: true,
        publicName: true,
        businessName: true,
        username: true,
        brandingAvatarUrl: true,
      },
      orderBy: { publicName: "asc" },
    });

    const consents = await prisma.userConsent.findMany({
      where: { userId: user.id, organizationId: { in: orgIds }, type: { in: CONSENT_TYPES } },
      select: { organizationId: true, type: true, status: true, grantedAt: true, revokedAt: true },
    });

    const consentMap = new Map<number, Map<ConsentType, ConsentStatus>>();
    for (const consent of consents) {
      if (!consentMap.has(consent.organizationId)) {
        consentMap.set(consent.organizationId, new Map());
      }
      consentMap.get(consent.organizationId)?.set(consent.type, consent.status);
    }

    const items = organizations.map((org) => {
      const orgConsents = consentMap.get(org.id);
      return {
        organization: org,
        consents: {
          MARKETING: orgConsents?.get(ConsentType.MARKETING) === ConsentStatus.GRANTED,
          CONTACT_EMAIL: orgConsents?.get(ConsentType.CONTACT_EMAIL) === ConsentStatus.GRANTED,
          CONTACT_SMS: orgConsents?.get(ConsentType.CONTACT_SMS) === ConsentStatus.GRANTED,
        },
      };
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/me/consents error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar consentimentos." }, { status: 500 });
  }
}

async function _PUT(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = (await req.json().catch(() => null)) as {
      organizationId?: unknown;
      type?: unknown;
      granted?: unknown;
    } | null;

    const organizationId =
      typeof payload?.organizationId === "number" && Number.isFinite(payload.organizationId)
        ? payload.organizationId
        : null;
    const consentType = isValidConsentType(payload?.type) ? (payload?.type as ConsentType) : null;
    const granted = typeof payload?.granted === "boolean" ? payload.granted : null;

    if (!organizationId || !consentType || granted === null) {
      return jsonWrap({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const [crmCustomer, existingConsent] = await Promise.all([
      prisma.crmCustomer.findFirst({
        where: { organizationId, userId: user.id },
        select: { id: true },
      }),
      prisma.userConsent.findFirst({
        where: { organizationId, userId: user.id },
        select: { id: true },
      }),
    ]);

    if (!crmCustomer && !existingConsent) {
      return jsonWrap({ ok: false, error: "Organização não autorizada." }, { status: 403 });
    }

    const status = granted ? ConsentStatus.GRANTED : ConsentStatus.REVOKED;
    const now = new Date();

    const consent = await prisma.userConsent.upsert({
      where: {
        organizationId_userId_type: {
          organizationId,
          userId: user.id,
          type: consentType,
        },
      },
      update: {
        status,
        source: "USER_SETTINGS",
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      },
      create: {
        organizationId,
        userId: user.id,
        type: consentType,
        status,
        source: "USER_SETTINGS",
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      },
      select: { organizationId: true, type: true, status: true },
    });

    if (consentType === ConsentType.MARKETING) {
      await prisma.crmCustomer.updateMany({
        where: { organizationId, userId: user.id },
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
          where: { id: user.id },
          select: { email: true },
        });
        email = authUser?.email ?? null;
      }
      await prisma.crmCustomer.updateMany({
        where: { organizationId, userId: user.id },
        data: { contactEmail: email },
      });
    }

    if (consentType === ConsentType.CONTACT_SMS) {
      let phone: string | null = null;
      if (granted) {
        const profile = await prisma.profile.findUnique({
          where: { id: user.id },
          select: { contactPhone: true },
        });
        phone = profile?.contactPhone ?? null;
      }
      await prisma.crmCustomer.updateMany({
        where: { organizationId, userId: user.id },
        data: { contactPhone: phone },
      });
    }

    return jsonWrap({ ok: true, consent });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("PUT /api/me/consents error:", err);
    return jsonWrap({ ok: false, error: "Erro ao guardar consentimento." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
