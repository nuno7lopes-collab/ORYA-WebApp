import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getClientIp } from "@/lib/auth/requestValidation";
import { resolveIpCoarseLocation } from "@/domain/location/ipProvider";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const location = await resolveIpCoarseLocation(ip);
    if (!location) {
      return jsonWrap({ ok: false, error: "Location unavailable" }, { status: 502 });
    }

    return jsonWrap({
      ok: true,
      country: location.country,
      region: location.region,
      city: location.city,
      approxLatLon:
        location.approxLat != null && location.approxLon != null
          ? { lat: location.approxLat, lon: location.approxLon }
          : null,
      accuracyMeters: location.accuracyMeters,
      source: location.source,
      granularity: location.granularity,
    });
  } catch (err) {
    console.error("[location/ip] error", err);
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);