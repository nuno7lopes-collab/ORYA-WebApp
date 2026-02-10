import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { UserEventSignalType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const SIGNAL_TYPES = new Set<string>(Object.values(UserEventSignalType));

const parseSignalType = (value: unknown): UserEventSignalType | null => {
  if (typeof value !== "string") return null;
  if (!SIGNAL_TYPES.has(value)) return null;
  return value as UserEventSignalType;
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const payload = (await req.json().catch(() => null)) as {
      eventId?: unknown;
      organizationId?: unknown;
      signalType?: unknown;
      signalValue?: unknown;
      metadata?: unknown;
    } | null;

    const signalType = parseSignalType(payload?.signalType);
    if (!signalType) {
      return jsonWrap({ ok: false, error: "SIGNAL_INVALID" }, { status: 400 });
    }

    const eventIdRaw = parseOptionalNumber(payload?.eventId);
    let eventId = eventIdRaw !== null ? Math.floor(eventIdRaw) : null;
    const orgIdRaw = parseOptionalNumber(payload?.organizationId);
    let organizationId = orgIdRaw !== null ? Math.floor(orgIdRaw) : null;
    const signalValueRaw = parseOptionalNumber(payload?.signalValue);
    const signalValue = signalValueRaw !== null ? Math.round(signalValueRaw) : null;
    const metadata =
      payload?.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? (payload.metadata as Record<string, unknown>)
        : null;

    const eventRequired = ["CLICK", "VIEW", "DWELL", "FAVORITE", "PURCHASE", "HIDE_EVENT"].includes(signalType);
    if (eventRequired && !eventId) {
      return jsonWrap({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
    }

    if (signalType === "HIDE_CATEGORY") {
      const tag = typeof metadata?.tag === "string" ? metadata.tag.trim() : "";
      if (!tag) {
        return jsonWrap({ ok: false, error: "CATEGORY_REQUIRED" }, { status: 400 });
      }
    }

    if (signalType === "HIDE_ORG" && !organizationId && !eventId) {
      return jsonWrap({ ok: false, error: "ORG_REQUIRED" }, { status: 400 });
    }

    let eventMissing = false;
    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, organizationId: true },
      });
      if (!event) {
        eventMissing = true;
        if (eventRequired) {
          console.warn("[api/me/events/signals] event not found", { eventId, signalType, userId: user.id });
          return jsonWrap({ ok: true, ignored: "EVENT_NOT_FOUND" }, { status: 200 });
        }
        console.warn("[api/me/events/signals] event not found, dropping eventId", {
          eventId,
          signalType,
          userId: user.id,
        });
        eventId = null;
      } else if (!organizationId) {
        organizationId = event.organizationId ?? null;
      }
    }

    if (signalType === "HIDE_ORG" && !organizationId) {
      if (eventMissing) {
        return jsonWrap({ ok: true, ignored: "EVENT_NOT_FOUND" }, { status: 200 });
      }
      return jsonWrap({ ok: false, error: "ORG_REQUIRED" }, { status: 400 });
    }

    await prisma.userEventSignal.create({
      data: {
        userId: user.id,
        eventId: eventId ?? null,
        organizationId: organizationId ?? null,
        signalType,
        signalValue,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/me/events/signals error:", err);
    return jsonWrap({ ok: false, error: "Erro ao registar sinal." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
