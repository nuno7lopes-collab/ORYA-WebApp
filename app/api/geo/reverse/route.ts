import { NextRequest, NextResponse } from "next/server";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getGeoProvider } from "@/lib/geo/provider";
import { checkRateLimit } from "@/lib/geo/rateLimit";

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

export async function GET(req: NextRequest) {
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const lat = latParam ? Number(latParam) : NaN;
  const lng = lngParam ? Number(lngParam) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "lat/lng inválidos." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rateKey = `geo:reverse:${ip}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.round((rate.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { ok: false, error: "Limite de pedidos excedido." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const lang = resolveLang(req);
  const cacheKey = buildCacheKey(["geo-reverse", lat.toFixed(6), lng.toFixed(6), lang]);
  const cached = getCache(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, item: cached }, { headers: { "Cache-Control": "public, max-age=600" } });
  }

  const provider = getGeoProvider();
  try {
    const item = await provider.reverse({ lat, lng, lang });
    if (!item) {
      return NextResponse.json({ ok: false, error: "Localização não encontrada." }, { status: 404 });
    }
    setCache(cacheKey, item, CACHE_TTL_MS);
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (err) {
    console.error("[geo/reverse] erro", err);
    return NextResponse.json({ ok: false, error: "Falha no reverse geocode." }, { status: 502 });
  }
}
