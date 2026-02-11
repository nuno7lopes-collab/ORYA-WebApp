export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ALLOWED_TYPES = new Set<CrmInteractionType>([
  CrmInteractionType.PROFILE_VIEWED,
  CrmInteractionType.EVENT_VIEWED,
]);

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return null;
}

function buildDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = (await req.json().catch(() => null)) as {
      type?: unknown;
      organizationId?: unknown;
      eventId?: unknown;
    } | null;

    const typeRaw = typeof payload?.type === "string" ? payload.type.trim().toUpperCase() : "";
    const type = ALLOWED_TYPES.has(typeRaw as CrmInteractionType) ? (typeRaw as CrmInteractionType) : null;
    if (!type) {
      return jsonWrap({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
    }

    const dayKey = buildDayKey();
    let organizationId: number | null = null;
    let sourceId: string | null = null;
    let externalId: string | null = null;
    let metadata: Record<string, unknown> | null = null;
    let sourceType: CrmInteractionSource | null = null;

    if (type === CrmInteractionType.EVENT_VIEWED) {
      const eventId = parseNumber(payload?.eventId);
      if (!eventId) {
        return jsonWrap({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
      }
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, organizationId: true },
      });
      if (!event?.organizationId) {
        return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
      }
      organizationId = event.organizationId;
      sourceId = String(event.id);
      externalId = `event_view:${event.id}:${user.id}:${dayKey}`;
      metadata = { eventId: event.id, organizationId: event.organizationId };
      sourceType = CrmInteractionSource.EVENT;
    } else {
      const orgId = parseNumber(payload?.organizationId);
      if (!orgId) {
        return jsonWrap({ ok: false, error: "ORG_REQUIRED" }, { status: 400 });
      }
      const organization = await prisma.organization.findFirst({
        where: { id: orgId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!organization) {
        return jsonWrap({ ok: false, error: "ORG_NOT_FOUND" }, { status: 404 });
      }
      organizationId = organization.id;
      sourceId = String(organization.id);
      externalId = `profile_view:${organization.id}:${user.id}:${dayKey}`;
      metadata = { organizationId: organization.id };
      sourceType = CrmInteractionSource.PROFILE;
    }

    await ingestCrmInteraction({
      organizationId,
      userId: user.id,
      type,
      sourceType: sourceType ?? CrmInteractionSource.PROFILE,
      sourceId,
      externalId,
      metadata,
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/crm/engagement error:", err);
    return jsonWrap({ ok: false, error: "Erro ao registar engagement." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
