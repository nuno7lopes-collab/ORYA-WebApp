import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { appendEventLog } from "@/domain/eventLog/append";
import { getActiveOrganizationForUser, ORG_ACTIVE_ACCESS_OPTIONS } from "@/lib/organizationContext";
import crypto from "crypto";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const SOURCE_VALUES = new Set(["GPS", "WIFI", "IP", "MANUAL"]);

type Body = {
  source?: string;
  city?: string | null;
  region?: string | null;
};

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return jsonWrap({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.source) {
      return jsonWrap({ error: "Invalid source" }, { status: 400 });
    }

    const source = String(body.source).toUpperCase();
    if (!SOURCE_VALUES.has(source)) {
      return jsonWrap({ error: "Invalid source" }, { status: 400 });
    }

    const city = typeof body.city === "string" ? body.city.trim() || null : null;
    const region = typeof body.region === "string" ? body.region.trim() || null : null;
    if (!city && !region) {
      return jsonWrap({ error: "Missing coarse location" }, { status: 400 });
    }

    const userId = data.user.id;
    const now = new Date();
    const correlationId = crypto.randomUUID();

    const orgContext = await getActiveOrganizationForUser(userId, ORG_ACTIVE_ACCESS_OPTIONS);
    const organizationId = orgContext.organization?.id ?? null;
    const hasMembership = Boolean(orgContext.membership);

    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: userId },
        data: {
          locationGranularity: "COARSE",
          locationSource: source as "GPS" | "WIFI" | "IP" | "MANUAL",
          locationCity: city,
          locationRegion: region,
          locationUpdatedAt: now,
        },
      });

      if (organizationId && hasMembership) {
        await appendEventLog(
          {
            organizationId,
            eventType: "user.location.coarse_updated",
            actorUserId: userId,
            idempotencyKey: correlationId,
            correlationId,
            payload: {
              source,
              city,
              region,
              granularity: "COARSE",
            },
          },
          tx,
        );
      }
    });

    return jsonWrap({ ok: true });
  } catch (err) {
    console.error("[me/location/coarse] error", err);
    return jsonWrap({ error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);