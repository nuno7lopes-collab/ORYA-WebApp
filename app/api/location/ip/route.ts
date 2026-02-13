import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { resolveRequestGeoContext } from "@/lib/geo/ipBias";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.split(",")[0]?.trim() ?? null;
    const context = await resolveRequestGeoContext({ req, lang });
    const city = context.city ?? null;
    const region = context.region ?? null;
    const country = context.countryCode ?? null;
    const approxLat = context.lat ?? null;
    const approxLon = context.lng ?? null;

    const hasAny = Boolean(city || region || country || (approxLat != null && approxLon != null));
    return jsonWrap(
      {
        ok: true,
        city,
        region,
        country,
        countryCode: country,
        approxLat,
        approxLon,
        accuracyMeters: hasAny ? 10_000 : null,
        source: hasAny ? context.source : "UNAVAILABLE",
        granularity: hasAny ? "COARSE" : "UNKNOWN",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[location/ip] error", err);
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
