import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getGeoProvider } from "@/lib/geo/provider";
import { checkRateLimit } from "@/lib/geo/rateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

const getClientIp = (req: NextRequest) => {
  const raw = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  if (!raw) return "unknown";
  return raw.split(",")[0]?.trim() || "unknown";
};

const resolveLang = (req: NextRequest) => {
  const langParam = req.nextUrl.searchParams.get("lang");
  if (langParam) return langParam;
  const header = req.headers.get("accept-language");
  if (!header) return "pt-PT";
  return header.split(",")[0]?.trim() || "pt-PT";
};

async function _GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return jsonWrap({ ok: true, items: [] });
  }

  const ip = getClientIp(req);
  const rateKey = `geo:autocomplete:${ip}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.round((rate.resetAt - Date.now()) / 1000));
    return jsonWrap(
      { ok: false, error: "Limite de pedidos excedido." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const lat = latParam ? Number(latParam) : null;
  const lng = lngParam ? Number(lngParam) : null;
  const lang = resolveLang(req);

  const cacheKey = buildCacheKey(["geo-autocomplete", query.toLowerCase(), lat, lng, lang]);
  const cached = getCache(cacheKey);
  if (cached) {
    return jsonWrap({ ok: true, items: cached }, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  const provider = getGeoProvider();
  try {
    const items = await provider.autocomplete({
      query,
      lat: Number.isFinite(lat ?? NaN) ? lat : undefined,
      lng: Number.isFinite(lng ?? NaN) ? lng : undefined,
      lang,
    });
    setCache(cacheKey, items, CACHE_TTL_MS);
    return jsonWrap({ ok: true, items }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("[geo/autocomplete] erro", err);
    return jsonWrap({ ok: false, error: "Falha ao obter sugestões." }, { status: 502 });
  }
}
export const GET = withApiEnvelope(_GET);