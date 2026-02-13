import type { NextRequest } from "next/server";
import { resolveIpCoarseLocation } from "@/domain/location/ipProvider";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";

const IP_GEO_CACHE_TTL_MS = 30 * 60 * 1000;

type RequestGeoSource = "EDGE_HEADERS" | "IP_API" | "LANG" | "MIXED" | "NONE";

type RequestGeoContext = {
  ip: string;
  lat: number | null;
  lng: number | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  source: RequestGeoSource;
};

type CachedIpGeo = {
  found: boolean;
  lat: number | null;
  lng: number | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
};

const pickHeader = (req: NextRequest, names: string[]) => {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
};

const normalizeIp = (raw: string | null | undefined) => {
  if (!raw) return "unknown";
  const first = raw.split(",")[0]?.trim() ?? "";
  if (!first) return "unknown";
  if (first.startsWith("::ffff:")) return first.slice(7);
  return first;
};

const parseCoordinate = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCountryCode = (value: string | null) => {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate) return null;
  return /^[a-z]{2}$/i.test(candidate) ? candidate.toUpperCase() : null;
};

const resolveCountryFromLanguage = (lang: string | null | undefined) => {
  if (!lang) return null;
  const candidate = lang.split(",")[0]?.trim() ?? "";
  if (!candidate) return null;
  const match = candidate.match(/^[a-z]{2,3}[-_](?<country>[a-z]{2})\b/i);
  const code = match?.groups?.country;
  return code ? code.toUpperCase() : null;
};

const isPublicIp = (ip: string) => {
  if (!ip || ip === "unknown") return false;
  const value = ip.trim().toLowerCase();
  if (!value || value === "localhost" || value === "::1") return false;

  if (value.includes(":")) {
    if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")) return false;
    return true;
  }

  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
};

const resolveIpGeo = async (ip: string) => {
  const cacheKey = buildCacheKey(["geo-ip", ip]);
  const cached = getCache<CachedIpGeo>(cacheKey);
  if (cached) {
    return cached.found ? cached : null;
  }

  const resolved = await resolveIpCoarseLocation(ip);
  if (!resolved) {
    setCache(
      cacheKey,
      {
        found: false,
        lat: null,
        lng: null,
        countryCode: null,
        city: null,
        region: null,
      },
      IP_GEO_CACHE_TTL_MS,
    );
    return null;
  }

  const payload: CachedIpGeo = {
    found: true,
    lat: resolved.approxLat ?? null,
    lng: resolved.approxLon ?? null,
    countryCode: parseCountryCode(resolved.countryCode ?? resolved.country),
    city: resolved.city ?? null,
    region: resolved.region ?? null,
  };
  setCache(cacheKey, payload, IP_GEO_CACHE_TTL_MS);
  return payload;
};

export const getClientIp = (req: NextRequest) =>
  normalizeIp(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"));

export async function resolveRequestGeoContext(params: {
  req: NextRequest;
  lang?: string | null;
  ip?: string | null;
}): Promise<RequestGeoContext> {
  const { req, lang } = params;
  const ip = normalizeIp(params.ip ?? getClientIp(req));
  const headerCountryCode = parseCountryCode(
    pickHeader(req, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "cloudfront-viewer-country",
      "x-geo-country",
      "x-country-code",
    ]),
  );
  const headerCity = pickHeader(req, [
    "x-vercel-ip-city",
    "cf-ipcity",
    "x-geo-city",
    "x-country-city",
  ]);
  const headerRegion = pickHeader(req, [
    "x-vercel-ip-country-region",
    "cf-region",
    "x-geo-region",
    "x-country-region",
  ]);
  const headerLat = parseCoordinate(
    pickHeader(req, [
      "x-vercel-ip-latitude",
      "cloudfront-viewer-latitude",
      "x-geo-latitude",
      "cf-iplatitude",
    ]),
  );
  const headerLng = parseCoordinate(
    pickHeader(req, [
      "x-vercel-ip-longitude",
      "cloudfront-viewer-longitude",
      "x-geo-longitude",
      "cf-iplongitude",
    ]),
  );

  let lat = headerLat;
  let lng = headerLng;
  let countryCode = headerCountryCode;
  let city = headerCity;
  let region = headerRegion;
  const sources = new Set<RequestGeoSource>();
  if (headerCountryCode || headerCity || headerRegion || (headerLat != null && headerLng != null)) {
    sources.add("EDGE_HEADERS");
  }

  const needsIpLookup = (lat == null || lng == null || !countryCode) && isPublicIp(ip);
  if (needsIpLookup) {
    const fromIp = await resolveIpGeo(ip);
    if (fromIp) {
      lat ??= fromIp.lat;
      lng ??= fromIp.lng;
      countryCode ??= fromIp.countryCode;
      city ??= fromIp.city;
      region ??= fromIp.region;
      sources.add("IP_API");
    }
  }

  if (!countryCode) {
    const fromLang = resolveCountryFromLanguage(lang);
    if (fromLang) {
      countryCode = fromLang;
      sources.add("LANG");
    }
  }

  let source: RequestGeoSource = "NONE";
  if (sources.size === 1) {
    source = Array.from(sources)[0] ?? "NONE";
  } else if (sources.size > 1) {
    source = "MIXED";
  }

  return {
    ip,
    lat,
    lng,
    countryCode,
    city,
    region,
    source,
  };
}

export type { RequestGeoContext, RequestGeoSource };
