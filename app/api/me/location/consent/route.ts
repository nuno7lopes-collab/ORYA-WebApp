import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { appendEventLog } from "@/domain/eventLog/append";
import { getActiveOrganizationForUser, ORG_ACTIVE_ACCESS_OPTIONS } from "@/lib/organizationContext";
import crypto from "crypto";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const CONSENT_VALUES = new Set(["PENDING", "GRANTED", "DENIED"]);
const GRANULARITY_VALUES = new Set(["PRECISE", "COARSE"]);

type Body = {
  consent?: string;
  preferredGranularity?: string | null;
};

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return jsonWrap({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.consent) {
      return jsonWrap({ error: "Invalid consent" }, { status: 400 });
    }

    const consent = String(body.consent).toUpperCase();
    if (!CONSENT_VALUES.has(consent)) {
      return jsonWrap({ error: "Invalid consent" }, { status: 400 });
    }

    const preferredRaw = body.preferredGranularity ? String(body.preferredGranularity).toUpperCase() : null;
    if (preferredRaw && !GRANULARITY_VALUES.has(preferredRaw)) {
      return jsonWrap({ error: "Invalid granularity" }, { status: 400 });
    }

    const userId = data.user.id;
    const now = new Date();
    const correlationId = crypto.randomUUID();

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { locationGranularity: true },
    });

    const nextGranularity =
      consent === "DENIED"
        ? "COARSE"
        : preferredRaw || profile?.locationGranularity || "COARSE";

    const orgContext = await getActiveOrganizationForUser(userId, ORG_ACTIVE_ACCESS_OPTIONS);
    const organizationId = orgContext.organization?.id ?? null;
    const hasMembership = Boolean(orgContext.membership);

    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: userId },
        data: {
          locationConsent: consent as "PENDING" | "GRANTED" | "DENIED",
          locationGranularity: nextGranularity as "PRECISE" | "COARSE",
          locationUpdatedAt: now,
        },
      });

      if (organizationId && hasMembership) {
        await appendEventLog(
          {
            organizationId,
            eventType: "user.location.consent_changed",
            actorUserId: userId,
            idempotencyKey: correlationId,
            correlationId,
            payload: {
              consent,
              granularity: nextGranularity,
            },
          },
          tx,
        );
      }
    });

    return jsonWrap({ ok: true });
  } catch (err) {
    console.error("[me/location/consent] error", err);
    return jsonWrap({ error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);