import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { mapGeoError } from "@/lib/geo/errors";
import { getGeoResolver } from "@/lib/geo/provider";
import { checkRateLimit } from "@/lib/geo/rateLimit";
import { upsertAddressFromGeoDetails } from "@/lib/address/service";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { AddressSourceProvider } from "@prisma/client";

export const runtime = "nodejs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT = 30;
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

const parseSourceProvider = (raw: string | null) => {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === AddressSourceProvider.APPLE_MAPS) {
    return AddressSourceProvider.APPLE_MAPS;
  }
  return null;
};

async function _GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("providerId")?.trim() ?? "";
  if (!providerId) {
    return jsonWrap({ ok: false, error: "providerId obrigatório." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rateKey = `address:details:${ip}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.round((rate.resetAt - Date.now()) / 1000));
    return jsonWrap(
      { ok: false, error: "Limite de pedidos excedido." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const lang = resolveLang(req);
  const sourceProvider = parseSourceProvider(req.nextUrl.searchParams.get("sourceProvider"));
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const lat = latParam ? Number(latParam) : null;
  const lng = lngParam ? Number(lngParam) : null;
  const cacheKey = buildCacheKey(["address-details", providerId, lang, sourceProvider ?? "", lat, lng]);
  const cached = getCache<Record<string, unknown>>(cacheKey);
  if (cached) {
    return jsonWrap({ ok: true, item: cached }, { headers: { "Cache-Control": "public, max-age=600" } });
  }

  const resolver = getGeoResolver();
  try {
    const resolvedDetails = await resolver.details({ providerId, lang, sourceProvider, lat, lng });
    let item = resolvedDetails.data;
    let providerSource = resolvedDetails.sourceProvider;
    if (!item && Number.isFinite(lat ?? NaN) && Number.isFinite(lng ?? NaN)) {
      const reverseResolved = await resolver.reverse({
        lat: lat as number,
        lng: lng as number,
        lang,
        sourceProvider: sourceProvider ?? providerSource,
      });
      item = reverseResolved.data;
      providerSource = reverseResolved.sourceProvider;
    }
    if (!item) {
      return jsonWrap({ ok: false, error: "Localização não encontrada." }, { status: 404 });
    }
    const resolved = await upsertAddressFromGeoDetails({ details: item, provider: providerSource });
    if (!resolved.ok) {
      return jsonWrap({ ok: false, error: "Falha ao normalizar localização." }, { status: 502 });
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
      sourceProvider: providerSource,
    };
    setCache(cacheKey, payload, CACHE_TTL_MS);
    return jsonWrap({ ok: true, item: payload }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (err) {
    console.error("[address/details] erro", err);
    const { status, message } = mapGeoError(err, "Falha ao normalizar localização.");
    return jsonWrap({ ok: false, error: message }, { status });
  }
}
export const GET = withApiEnvelope(_GET);
