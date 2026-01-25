import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { appendEventLog } from "@/domain/eventLog/append";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import crypto from "crypto";

const CONSENT_VALUES = new Set(["PENDING", "GRANTED", "DENIED"]);
const GRANULARITY_VALUES = new Set(["PRECISE", "COARSE"]);

type Body = {
  consent?: string;
  preferredGranularity?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.consent) {
      return NextResponse.json({ error: "Invalid consent" }, { status: 400 });
    }

    const consent = String(body.consent).toUpperCase();
    if (!CONSENT_VALUES.has(consent)) {
      return NextResponse.json({ error: "Invalid consent" }, { status: 400 });
    }

    const preferredRaw = body.preferredGranularity ? String(body.preferredGranularity).toUpperCase() : null;
    if (preferredRaw && !GRANULARITY_VALUES.has(preferredRaw)) {
      return NextResponse.json({ error: "Invalid granularity" }, { status: 400 });
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

    const orgContext = await getActiveOrganizationForUser(userId, { allowFallback: true });
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[me/location/consent] error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
