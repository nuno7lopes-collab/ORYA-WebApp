import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getGeoProvider, resolveGeoSourceProvider } from "@/lib/geo/provider";
import { checkRateLimit } from "@/lib/geo/rateLimit";
import { upsertAddressFromGeoDetails } from "@/lib/address/service";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT = 20;
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
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const lat = latParam ? Number(latParam) : NaN;
  const lng = lngParam ? Number(lngParam) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonWrap({ ok: false, error: "lat/lng inválidos." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rateKey = `geo:reverse:${ip}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.round((rate.resetAt - Date.now()) / 1000));
    return jsonWrap(
      { ok: false, error: "Limite de pedidos excedido." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const lang = resolveLang(req);
  const cacheKey = buildCacheKey(["geo-reverse", lat.toFixed(6), lng.toFixed(6), lang]);
  const cached = getCache(cacheKey);
  if (cached) {
    return jsonWrap({ ok: true, item: cached }, { headers: { "Cache-Control": "public, max-age=600" } });
  }

  const provider = getGeoProvider();
  try {
    const item = await provider.reverse({ lat, lng, lang });
    if (!item) {
      return jsonWrap({ ok: false, error: "Localização não encontrada." }, { status: 404 });
    }
    const providerSource = resolveGeoSourceProvider("reverse");
    const resolved = await upsertAddressFromGeoDetails({ details: item, provider: providerSource });
    if (!resolved.ok) {
      return jsonWrap({ ok: false, error: "Falha no reverse geocode." }, { status: 502 });
    }
    const payload = {
      ...item,
      formattedAddress: resolved.address.formattedAddress,
      lat: resolved.address.latitude,
      lng: resolved.address.longitude,
      addressId: resolved.address.id,
      canonical: resolved.address.canonical as Record<string, unknown>,
      confidenceScore: resolved.address.confidenceScore,
      validationStatus: resolved.address.validationStatus,
    };
    setCache(cacheKey, payload, CACHE_TTL_MS);
    return jsonWrap({ ok: true, item: payload }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (err) {
    console.error("[geo/reverse] erro", err);
    return jsonWrap({ ok: false, error: "Falha no reverse geocode." }, { status: 502 });
  }
}
export const GET = withApiEnvelope(_GET);
