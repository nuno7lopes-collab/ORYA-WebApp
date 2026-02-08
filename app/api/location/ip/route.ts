import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const pickHeader = (req: NextRequest, names: string[]) => {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
};

async function _GET(req: NextRequest) {
  try {
    const city =
      pickHeader(req, ["cf-ipcity", "x-geo-city", "x-country-city"]) ?? null;
    const region =
      pickHeader(req, [
        "cf-region",
        "x-geo-region",
        "x-country-region",
      ]) ?? null;
    const country =
      pickHeader(req, ["cf-ipcountry", "cloudfront-viewer-country", "x-geo-country"]) ??
      null;

    const hasAny = Boolean(city || region || country);
    return jsonWrap(
      {
        ok: true,
        city,
        region,
        country,
        source: hasAny ? "EDGE_HEADERS" : "UNAVAILABLE",
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
