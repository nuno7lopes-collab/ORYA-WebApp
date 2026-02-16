import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sendOfficialEmailVerificationEmail } from "@/lib/emailSender";
import { parseOrganizationId } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import {
  isValidOfficialEmail,
  maskEmailForLog,
  normalizeOfficialEmail,
} from "@/lib/organizationOfficialEmailUtils";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24; // 24h
const STATUS_PENDING = "PENDING";
const STATUS_CANCELLED = "CANCELLED";

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

type OrganizationEmailState = {
  activeEmail: string | null;
  activeVerifiedAt: Date | null;
  pending:
    | {
        requestId: number;
        email: string;
        expiresAt: Date | null;
        createdAt: Date;
      }
    | null;
  legacyMismatch: boolean;
};

function buildOrganizationEmailState(params: {
  organization: { officialEmail: string | null; officialEmailVerifiedAt: Date | null };
  pendingRequest: {
    id: number;
    newEmail: string;
    expiresAt: Date | null;
    createdAt: Date;
  } | null;
}): OrganizationEmailState {
  const activeEmail = normalizeOfficialEmail(params.organization.officialEmail ?? null);
  const pendingEmail = normalizeOfficialEmail(params.pendingRequest?.newEmail ?? null);
  const pending =
    params.pendingRequest && pendingEmail
      ? {
          requestId: params.pendingRequest.id,
          email: pendingEmail,
          expiresAt: params.pendingRequest.expiresAt ?? null,
          createdAt: params.pendingRequest.createdAt,
        }
      : null;
  const legacyMismatch = Boolean(
    pending &&
      !params.organization.officialEmailVerifiedAt &&
      activeEmail &&
      activeEmail === pending.email,
  );
  return {
    activeEmail,
    activeVerifiedAt: params.organization.officialEmailVerifiedAt ?? null,
    pending,
    legacyMismatch,
  };
}

async function resolvePendingRequest(organizationId: number) {
  return prisma.organizationOfficialEmailRequest.findFirst({
    where: { organizationId, status: STATUS_PENDING },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      newEmail: true,
      expiresAt: true,
      createdAt: true,
      token: true,
    },
  });
}

async function resolveActorForOrganization(params: { organizationId: number; userId: string }) {
  const { organizationId, userId } = params;
  const membership = await resolveGroupMemberForOrg({ organizationId, userId });
  if (
    !membership ||
    (membership.role !== OrganizationMemberRole.OWNER &&
      membership.role !== OrganizationMemberRole.CO_OWNER)
  ) {
    return null;
  }
  return membership;
}

async function loadOrganizationState(organizationId: number) {
  const [organization, pendingRequest] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        publicName: true,
        username: true,
      },
    }),
    resolvePendingRequest(organizationId),
  ]);
  if (!organization) return null;
  return {
    organization,
    state: buildOrganizationEmailState({
      organization: {
        officialEmail: organization.officialEmail ?? null,
        officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
      },
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            newEmail: pendingRequest.newEmail,
            expiresAt: pendingRequest.expiresAt ?? null,
            createdAt: pendingRequest.createdAt,
          }
        : null,
    }),
    pendingRequest,
  };
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
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
    if (!organizationId) {
      return fail(400, "INVALID_ORGANIZATION_ID");
    }

    const membership = await resolveActorForOrganization({ organizationId, userId: user.id });
    if (!membership) {
      return fail(403, "ONLY_OWNER_OR_CO_OWNER_CAN_VIEW_OFFICIAL_EMAIL_STATE");
    }

    const loaded = await loadOrganizationState(organizationId);
    if (!loaded) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }

    return respondOk(
      ctx,
      {
        status: loaded.state.activeVerifiedAt ? "VERIFIED" : loaded.state.pending ? "PENDING" : "UNVERIFIED",
        organizationId,
        activeEmail: loaded.state.activeEmail,
        activeVerifiedAt: loaded.state.activeVerifiedAt,
        pending: loaded.state.pending,
        legacyMismatch: loaded.state.legacyMismatch,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/official-email][GET]", { requestId: ctx.requestId, err });
    return fail(500, "INTERNAL_ERROR");
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
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const emailNormalized = normalizeOfficialEmail(typeof body?.email === "string" ? body.email : null);
    if (!organizationId || !emailNormalized) {
      return fail(400, "INVALID_PAYLOAD");
    }
    if (!isValidOfficialEmail(emailNormalized)) {
      return fail(400, "INVALID_EMAIL");
    }

    const membership = await resolveActorForOrganization({ organizationId, userId: user.id });
    if (!membership) {
      return fail(403, "ONLY_OWNER_OR_CO_OWNER_CAN_UPDATE_OFFICIAL_EMAIL");
    }

    const loaded = await loadOrganizationState(organizationId);
    if (!loaded) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    const { organization, state } = loaded;

    const currentNormalized = normalizeOfficialEmail(organization.officialEmail ?? null);
    if (state.activeVerifiedAt && currentNormalized === emailNormalized) {
      return respondOk(
        ctx,
        {
          status: "VERIFIED",
          organizationId,
          activeEmail: state.activeEmail,
          activeVerifiedAt: state.activeVerifiedAt,
          pending: state.pending,
          legacyMismatch: state.legacyMismatch,
          email: currentNormalized,
        },
        { status: 200 },
      );
    }

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    const request = await prisma.$transaction(async (tx) => {
      await tx.organizationOfficialEmailRequest.updateMany({
        where: { organizationId, status: STATUS_PENDING },
        data: { status: STATUS_CANCELLED, cancelledAt: new Date(now) },
      });

      const created = await tx.organizationOfficialEmailRequest.create({
        data: {
          organizationId,
          requestedByUserId: user.id,
          newEmail: emailNormalized,
          token,
          status: STATUS_PENDING,
          expiresAt,
        },
      });

      const requestedDomain = emailNormalized.split("@")[1] ?? null;
      await recordOrganizationAudit(tx, {
        organizationId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CHANGE_REQUESTED",
        correlationId: ctx.correlationId,
        metadata: {
          email: maskEmailForLog(emailNormalized),
          previousActiveEmail: maskEmailForLog(state.activeEmail),
          previousActiveVerifiedAt: state.activeVerifiedAt,
          requestId: created.id,
          verificationMethod: "EMAIL_TOKEN",
          verifiedDomain: requestedDomain,
          requestIdExternal: ctx.requestId,
        },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      return created;
    });

    // Envia email de verificação (best-effort)
    try {
      const organizationName =
        organization.publicName || organization.username || "Organização ORYA";
      await sendOfficialEmailVerificationEmail({
        to: emailNormalized,
        organizationName,
        token: request.token,
        pendingEmail: emailNormalized,
        expiresAt: request.expiresAt,
        organizationId,
      });
    } catch (emailErr) {
      console.error("[organization/official-email] Falha ao enviar email de verificação", emailErr);
    }

    const refreshed = await loadOrganizationState(organizationId);
    if (!refreshed) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }

    return respondOk(
      ctx,
      {
        status: refreshed.state.activeVerifiedAt ? "VERIFIED" : "PENDING",
        organizationId,
        activeEmail: refreshed.state.activeEmail,
        activeVerifiedAt: refreshed.state.activeVerifiedAt,
        pending: refreshed.state.pending,
        legacyMismatch: refreshed.state.legacyMismatch,
        expiresAt: request.expiresAt,
        pendingEmail: refreshed.state.pending?.email ?? emailNormalized,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/official-email][POST]", { requestId: ctx.requestId, err });
    return fail(500, "INTERNAL_ERROR");
  }
}

async function _DELETE(req: NextRequest) {
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
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const organizationId =
      parseOrganizationId(body?.organizationId) ??
      parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
    if (!organizationId) {
      return fail(400, "INVALID_ORGANIZATION_ID");
    }

    const membership = await resolveActorForOrganization({ organizationId, userId: user.id });
    if (!membership) {
      return fail(403, "ONLY_OWNER_OR_CO_OWNER_CAN_CANCEL_OFFICIAL_EMAIL_CHANGE");
    }

    const loaded = await loadOrganizationState(organizationId);
    if (!loaded) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    if (!loaded.pendingRequest) {
      return respondOk(
        ctx,
        {
          status: loaded.state.activeVerifiedAt ? "VERIFIED" : "UNVERIFIED",
          organizationId,
          activeEmail: loaded.state.activeEmail,
          activeVerifiedAt: loaded.state.activeVerifiedAt,
          pending: null,
          legacyMismatch: loaded.state.legacyMismatch,
          cancelled: false,
        },
        { status: 200 },
      );
    }
    const pendingRequest = loaded.pendingRequest;

    const now = new Date();
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    const legacyRecovery = await prisma.$transaction(async (tx) => {
      await tx.organizationOfficialEmailRequest.updateMany({
        where: { organizationId, status: STATUS_PENDING },
        data: { status: STATUS_CANCELLED, cancelledAt: now },
      });

      let restored = false;
      let restoredEmail: string | null = null;
      let restoredVerifiedAt: Date | null = null;
      let recoverySource: "LAST_CONFIRMED_REQUEST" | "NONE" = "NONE";

      const activeEmail = normalizeOfficialEmail(loaded.organization.officialEmail ?? null);
      const pendingEmail = normalizeOfficialEmail(loaded.pendingRequest?.newEmail ?? null);
      const legacyMismatch =
        Boolean(activeEmail && pendingEmail && activeEmail === pendingEmail) &&
        !loaded.organization.officialEmailVerifiedAt;

      if (legacyMismatch) {
        const previousConfirmed = await tx.organizationOfficialEmailRequest.findFirst({
          where: {
            organizationId,
            status: "CONFIRMED",
            confirmedAt: { lt: pendingRequest.createdAt },
          },
          orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
          select: {
            newEmail: true,
            confirmedAt: true,
          },
        });
        const previousConfirmedEmail = normalizeOfficialEmail(previousConfirmed?.newEmail ?? null);
        if (previousConfirmed && previousConfirmedEmail && previousConfirmed.confirmedAt) {
          await tx.organization.update({
            where: { id: organizationId },
            data: {
              officialEmail: previousConfirmedEmail,
              officialEmailVerifiedAt: previousConfirmed.confirmedAt,
            },
          });
          restored = true;
          restoredEmail = previousConfirmedEmail;
          restoredVerifiedAt = previousConfirmed.confirmedAt;
          recoverySource = "LAST_CONFIRMED_REQUEST";
        }
      }

      await recordOrganizationAudit(tx, {
        organizationId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CHANGE_CANCELLED",
        correlationId: ctx.correlationId,
        metadata: {
          requestId: pendingRequest.id,
          pendingEmail: maskEmailForLog(pendingRequest.newEmail),
          legacyRecovery: {
            restored,
            restoredEmail: restoredEmail ? maskEmailForLog(restoredEmail) : null,
            restoredVerifiedAt,
            source: recoverySource,
          },
          requestIdExternal: ctx.requestId,
        },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      return {
        restored,
        restoredEmail,
        restoredVerifiedAt,
        recoverySource,
      };
    });

    const refreshed = await loadOrganizationState(organizationId);
    if (!refreshed) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }

    return respondOk(
      ctx,
      {
        status: refreshed.state.activeVerifiedAt ? "VERIFIED" : "UNVERIFIED",
        organizationId,
        activeEmail: refreshed.state.activeEmail,
        activeVerifiedAt: refreshed.state.activeVerifiedAt,
        pending: refreshed.state.pending,
        legacyMismatch: refreshed.state.legacyMismatch,
        cancelled: true,
        legacyRecovery,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/official-email][DELETE]", { requestId: ctx.requestId, err });
    return fail(500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
