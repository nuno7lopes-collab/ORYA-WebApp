import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/auth/requestValidation";
import { resolveIpCoarseLocation } from "@/domain/location/ipProvider";

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const location = await resolveIpCoarseLocation(ip);
    if (!location) {
      return NextResponse.json({ ok: false, error: "Location unavailable" }, { status: 502 });
    }

    return NextResponse.json({
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
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
