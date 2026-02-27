import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ingestTelemetryBatch, normalizeTelemetryBatchInput } from "@/domain/telemetry/ingest";
import { type TelemetrySourceType } from "@/domain/telemetry/constants";
import { logWarn } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveDefaultSourceType(req: NextRequest): TelemetrySourceType {
  const clientPlatform = req.headers.get("x-client-platform")?.toLowerCase();
  if (clientPlatform === "mobile") return "MOBILE";
  return "WEB";
}

async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServer({ allowUnverifiedEmail: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const actorUserId = await resolveAuthenticatedUserId();
  if (!actorUserId) {
    return jsonWrap(
      {
        ok: false,
        error: "UNAUTHENTICATED",
        errorCode: "UNAUTHENTICATED",
        message: "Autenticação necessária para ingestão de telemetria de produto.",
      },
      { status: 401, req },
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonWrap(
      { ok: false, error: "INVALID_JSON", errorCode: "INVALID_JSON", message: "JSON inválido." },
      { status: 400, req },
    );
  }

  const events = normalizeTelemetryBatchInput(body);
  if (events.length === 0) {
    return jsonWrap(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        errorCode: "INVALID_PAYLOAD",
        message: "Payload inválido. Envia um evento ou lista de eventos.",
      },
      { status: 400, req },
    );
  }

  const requestedOrganizationId = resolveOrganizationIdFromRequest(req, {
    allowFallback: true,
  });
  const maxBatchSizeRaw = Number(process.env.TELEMETRY_INGEST_MAX_EVENTS_PER_BATCH ?? "50");
  const maxBatchSize =
    Number.isFinite(maxBatchSizeRaw) && maxBatchSizeRaw > 0
      ? Math.min(Math.floor(maxBatchSizeRaw), 200)
      : 50;
  if (events.length > maxBatchSize) {
    return jsonWrap(
      {
        ok: false,
        error: "BATCH_LIMIT_EXCEEDED",
        errorCode: "BATCH_LIMIT_EXCEEDED",
        message: `Batch acima do limite permitido (${maxBatchSize}).`,
      },
      { status: 413, req },
    );
  }

  let defaultOrganizationId: number | null = null;
  if (typeof requestedOrganizationId === "number") {
    const { organization, membership } = await getActiveOrganizationForUser(actorUserId, {
      organizationId: requestedOrganizationId,
    });
    if (!organization || !membership) {
      return jsonWrap(
        {
          ok: false,
          error: "FORBIDDEN_ORGANIZATION",
          errorCode: "FORBIDDEN_ORGANIZATION",
          message: "Sem acesso à organização indicada para telemetria.",
        },
        { status: 403, req },
      );
    }
    defaultOrganizationId = organization.id;
  }

  const rateLimitPerMinuteRaw = Number(process.env.TELEMETRY_INGEST_RATE_LIMIT_PER_MINUTE ?? "1200");
  const rateLimitPerMinute =
    Number.isFinite(rateLimitPerMinuteRaw) && rateLimitPerMinuteRaw > 0
      ? Math.floor(rateLimitPerMinuteRaw)
      : 1200;
  const limiter = await rateLimit(req, {
    windowMs: 60_000,
    max: rateLimitPerMinute,
    keyPrefix: "telemetry:product",
    identifier:
      typeof defaultOrganizationId === "number"
        ? `org:${defaultOrganizationId}`
        : `user:${actorUserId}`,
  });
  if (!limiter.allowed) {
    logWarn("telemetry.public.rate_limited", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      actorUserId,
      organizationId: defaultOrganizationId,
      retryAfter: limiter.retryAfter,
      backend: limiter.backend,
      degraded: limiter.degraded,
    });
    return jsonWrap(
      {
        ok: false,
        error: "RATE_LIMITED",
        errorCode: "RATE_LIMITED",
        message: "Limite de ingestão atingido. Tenta novamente em breve.",
        retryAfter: limiter.retryAfter,
      },
      { status: 429, req },
    );
  }

  const defaultSourceType = resolveDefaultSourceType(req);
  const normalizedEvents = events.map((event) => ({
    ...event,
    organizationId: defaultOrganizationId,
  }));

  const result = await ingestTelemetryBatch(normalizedEvents, {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    defaultOrganizationId,
    defaultSourceType,
    defaultActorType: "USER",
    defaultActorUserId: actorUserId,
  });

  if (result.rejected > 0) {
    logWarn("telemetry.public.batch_rejected", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      rejected: result.rejected,
      accepted: result.accepted,
      actorUserId,
      organizationId: defaultOrganizationId,
    });
  }

  return jsonWrap(
    {
      ok: true,
      accepted: result.accepted,
      duplicates: result.duplicates,
      rejected: result.rejected,
      total: normalizedEvents.length,
    },
    { status: 200, req },
  );
}

export const POST = withApiEnvelope(_POST);
