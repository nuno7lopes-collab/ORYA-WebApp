import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getClientIp } from "@/lib/auth/requestValidation";
import { resolveIpCoarseLocation } from "@/domain/location/ipProvider";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";

const CACHE_TTL_MS = 30 * 60 * 1000;

async function _GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const cacheKey = buildCacheKey(["ip-location", ip ?? "unknown"]);
    const cached = getCache<Record<string, unknown>>(cacheKey);
    if (cached) {
      return jsonWrap({ ok: true, ...cached }, { status: 200 });
    }
    const location = await resolveIpCoarseLocation(ip);
    if (!location) {
      return jsonWrap({ ok: false, error: "Location unavailable" }, { status: 502 });
    }

    const payload = {
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
    };
    setCache(cacheKey, payload, CACHE_TTL_MS);
    return jsonWrap(payload);
  } catch (err) {
    console.error("[location/ip] error", err);
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
