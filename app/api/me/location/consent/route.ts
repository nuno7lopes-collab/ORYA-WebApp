import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { LocationConsent, LocationGranularity } from "@prisma/client";

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return jsonWrap({ error: "Not authenticated" }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
      consent?: string;
      preferredGranularity?: string | null;
    } | null;
    if (!body || typeof body !== "object") {
      return jsonWrap({ error: "Body inválido" }, { status: 400 });
    }
    const consentRaw = typeof body.consent === "string" ? body.consent.trim().toUpperCase() : "";
    if (!["PENDING", "GRANTED", "DENIED"].includes(consentRaw)) {
      return jsonWrap({ error: "Consent inválido" }, { status: 400 });
    }
    const granularityRaw =
      typeof body.preferredGranularity === "string"
        ? body.preferredGranularity.trim().toUpperCase()
        : null;
    if (granularityRaw && !["PRECISE", "COARSE"].includes(granularityRaw)) {
      return jsonWrap({ error: "Granularidade inválida" }, { status: 400 });
    }

    const now = new Date();
    await prisma.profile.upsert({
      where: { id: data.user.id },
      update: {
        locationConsent: consentRaw as LocationConsent,
        ...(granularityRaw ? { locationGranularity: granularityRaw as LocationGranularity } : {}),
        locationUpdatedAt: now,
      },
      create: {
        id: data.user.id,
        locationConsent: consentRaw as LocationConsent,
        locationGranularity: (granularityRaw as LocationGranularity) ?? LocationGranularity.COARSE,
        locationUpdatedAt: now,
        roles: ["user"],
      },
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[me/location/consent] error", err);
    return jsonWrap({ error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
