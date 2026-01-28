import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getGeoProvider } from "@/lib/geo/provider";
import { checkRateLimit } from "@/lib/geo/rateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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

async function _GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("providerId")?.trim() ?? "";
  if (!providerId) {
    return jsonWrap({ ok: false, error: "providerId obrigatório." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rateKey = `geo:details:${ip}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.round((rate.resetAt - Date.now()) / 1000));
    return jsonWrap(
      { ok: false, error: "Limite de pedidos excedido." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const lang = resolveLang(req);
  const cacheKey = buildCacheKey(["geo-details", providerId, lang]);
  const cached = getCache(cacheKey);
  if (cached) {
    return jsonWrap({ ok: true, item: cached }, { headers: { "Cache-Control": "public, max-age=600" } });
  }

  const provider = getGeoProvider();
  try {
    const item = await provider.details({ providerId, lang });
    if (!item) {
      return jsonWrap({ ok: false, error: "Localização não encontrada." }, { status: 404 });
    }
    setCache(cacheKey, item, CACHE_TTL_MS);
    return jsonWrap({ ok: true, item }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (err) {
    console.error("[geo/details] erro", err);
    return jsonWrap({ ok: false, error: "Falha ao normalizar localização." }, { status: 502 });
  }
}
export const GET = withApiEnvelope(_GET);