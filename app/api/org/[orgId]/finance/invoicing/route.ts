export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
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
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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
  const access = await requireOrgAccess(req);
  if (!access.ok) return fail(access.status, access.error);

  const permission = await ensureMemberModuleAccess({
    organizationId: access.organization.id,
    userId: access.user.id,
    role: access.membership.role,
    rolePack: access.membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "VIEW",
  });

  if (!permission.ok) {
    return fail(403, "FORBIDDEN");
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: access.organization.id },
  });

  return respondOk(ctx, { settings: settings
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
  const access = await requireOrgAccess(req);
  if (!access.ok) return fail(access.status, access.error);

  const permission = await ensureMemberModuleAccess({
    organizationId: access.organization.id,
    userId: access.user.id,
    role: access.membership.role,
    rolePack: access.membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "EDIT",
  });
  if (!permission.ok) {
    return fail(403, "FORBIDDEN");
  }
  const emailGate = ensureOrganizationEmailVerified(access.organization, { reasonCode: "FINANCE_INVOICING" });
  if (!emailGate.ok) {
    return respondError(
      ctx,
      {
        errorCode: emailGate.errorCode ?? "FORBIDDEN",
        message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
        retryable: false,
        details: emailGate,
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const invoicingMode = body?.invoicingMode as InvoicingMode | undefined;
  const acknowledged = body?.acknowledged === true;

  if (!invoicingMode || !(invoicingMode in InvoicingMode)) {
    return fail(400, "INVOICING_MODE_REQUIRED");
  }

  if (!acknowledged) {
    return fail(400, "INVOICING_ACK_REQUIRED");
  }

  const emailNormalized = normalizeEmail(access.user.email);
  if (!emailNormalized) {
    return fail(400, "EMAIL_REQUIRED");
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
        dedupeKey: `org.invoicing_config.updated:${access.organization.id}:${invoicingMode}`,
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

  return respondOk(ctx, { settings: {
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
