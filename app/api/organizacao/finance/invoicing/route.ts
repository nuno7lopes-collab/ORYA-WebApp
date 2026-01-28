export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { normalizeEmail } from "@/lib/utils/email";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { InvoicingMode, OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function requireOrgAccess(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { ok: false as const, status: 401, error: "UNAUTHENTICATED" };

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
  });
  if (!organization || !membership) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true as const, user, organization, membership };
}

async function _GET(req: NextRequest) {
  const access = await requireOrgAccess(req);
  if (!access.ok) return jsonWrap({ ok: false, error: access.error }, { status: access.status });

  const permission = await ensureMemberModuleAccess({
    organizationId: access.organization.id,
    userId: access.user.id,
    role: access.membership.role,
    rolePack: access.membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "VIEW",
  });

  if (!permission.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: access.organization.id },
  });

  return jsonWrap(
    {
      ok: true,
      settings: settings
        ? {
            invoicingMode: settings.invoicingMode,
            invoicingSoftwareName: settings.invoicingSoftwareName,
            invoicingNotes: settings.invoicingNotes,
            invoicingAcknowledgedAt: settings.invoicingAcknowledgedAt?.toISOString() ?? null,
          }
        : null,
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const access = await requireOrgAccess(req);
  if (!access.ok) return jsonWrap({ ok: false, error: access.error }, { status: access.status });

  const permission = await ensureMemberModuleAccess({
    organizationId: access.organization.id,
    userId: access.user.id,
    role: access.membership.role,
    rolePack: access.membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "EDIT",
  });
  if (!permission.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const invoicingMode = body?.invoicingMode as InvoicingMode | undefined;
  const acknowledged = body?.acknowledged === true;

  if (!invoicingMode || !(invoicingMode in InvoicingMode)) {
    return jsonWrap({ ok: false, error: "INVOICING_MODE_REQUIRED" }, { status: 400 });
  }

  if (!acknowledged) {
    return jsonWrap({ ok: false, error: "INVOICING_ACK_REQUIRED" }, { status: 400 });
  }

  const emailNormalized = normalizeEmail(access.user.email);
  if (!emailNormalized) {
    return jsonWrap({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400 });
  }

  const now = new Date();
  const correlationId = crypto.randomUUID();

  const result = await prisma.$transaction(async (tx) => {
    const identity = await tx.emailIdentity.upsert({
      where: { emailNormalized },
      update: { userId: access.user.id },
      create: { emailNormalized, userId: access.user.id },
      select: { id: true },
    });

    const settings = await tx.organizationSettings.upsert({
      where: { organizationId: access.organization.id },
      update: {
        invoicingMode,
        invoicingSoftwareName:
          invoicingMode === InvoicingMode.EXTERNAL_SOFTWARE ? body?.invoicingSoftwareName ?? null : null,
        invoicingNotes: body?.invoicingNotes ?? null,
        invoicingAcknowledgedAt: now,
        invoicingAcknowledgedByIdentityId: identity.id,
      },
      create: {
        organizationId: access.organization.id,
        invoicingMode,
        invoicingSoftwareName:
          invoicingMode === InvoicingMode.EXTERNAL_SOFTWARE ? body?.invoicingSoftwareName ?? null : null,
        invoicingNotes: body?.invoicingNotes ?? null,
        invoicingAcknowledgedAt: now,
        invoicingAcknowledgedByIdentityId: identity.id,
      },
    });

    const outbox = await recordOutboxEvent(
      {
        eventType: "org.invoicing_config.updated",
        payload: {
          organizationId: access.organization.id,
          invoicingMode,
        },
        correlationId,
      },
      tx,
    );

    await appendEventLog(
      {
        eventId: outbox.eventId,
        organizationId: access.organization.id,
        eventType: "org.invoicing_config.updated",
        idempotencyKey: outbox.eventId,
        payload: { invoicingMode },
        actorUserId: access.user.id,
        correlationId,
      },
      tx,
    );

    return settings;
  });

  return jsonWrap(
    {
      ok: true,
      settings: {
        invoicingMode: result.invoicingMode,
        invoicingSoftwareName: result.invoicingSoftwareName,
        invoicingNotes: result.invoicingNotes,
        invoicingAcknowledgedAt: result.invoicingAcknowledgedAt?.toISOString() ?? null,
      },
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);