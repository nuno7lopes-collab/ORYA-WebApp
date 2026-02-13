import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { mapGeoError } from "@/lib/geo/errors";
import { rankLocationSuggestions } from "@/lib/geo/locationUx";
import { detectCountryCodeFromText, normalizeGeoText } from "@/lib/geo/countryIntent";
import { getGeoResolver, type GeoAutocompleteItem, type GeoDetailsItem } from "@/lib/geo/provider";
import { checkRateLimit } from "@/lib/geo/rateLimit";
import { getClientIp, resolveRequestGeoContext } from "@/lib/geo/ipBias";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AUTOCOMPLETE_CACHE_VERSION = "v2";
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;
const ENRICHMENT_MAX_ITEMS = 3;
const ENRICHMENT_TOTAL_BUDGET_MS = 220;
const ENRICHMENT_CALL_TIMEOUT_MS = 140;
const roundCacheCoord = (value: number | null) => (Number.isFinite(value ?? NaN) ? (value as number).toFixed(3) : null);
const COUNTRY_QUERY_HINTS: Record<string, string> = {
  PT: "Portugal",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  US: "United States",
  BR: "Brazil",
};

const pickString = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const inferCountryCode = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
    const detected = detectCountryCodeFromText(trimmed);
    if (detected) return detected;
  }
  return null;
};

const dedupeAutocompleteItems = <T extends GeoAutocompleteItem>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const latBucket = Number.isFinite(item.lat) ? Math.round(item.lat * 1_000) / 1_000 : 0;
    const lngBucket = Number.isFinite(item.lng) ? Math.round(item.lng * 1_000) / 1_000 : 0;
    const key = [
      normalizeGeoText(item.label),
      normalizeGeoText(item.locality ?? item.city ?? item.address ?? item.secondaryLabel ?? ""),
      latBucket,
      lngBucket,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isRealAppleProviderId = (providerId: string | null | undefined) =>
  typeof providerId === "string" && /^I[A-Z0-9]{10,}$/.test(providerId.trim());

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const resolveSecondaryFromDetails = (details: GeoDetailsItem | null) =>
  pickString(
    details?.formattedAddress,
    details?.address,
    details?.city,
    (details?.components as Record<string, unknown> | null)?.["fullThoroughfare"],
    (details?.components as Record<string, unknown> | null)?.["thoroughfare"],
  );

const enrichTopSuggestions = async (params: {
  items: GeoAutocompleteItem[];
  lang: string;
  resolver: ReturnType<typeof getGeoResolver>;
}) => {
  const { items, lang, resolver } = params;
  const targetIndexes = items
    .map((item, idx) => ({ item, idx }))
    .filter((entry) => !pickString(entry.item.secondaryLabel))
    .slice(0, ENRICHMENT_MAX_ITEMS)
    .map((entry) => entry.idx);

  if (targetIndexes.length === 0) return items;

  const startedAt = Date.now();
  let exceededBudget = false;
  const next = [...items];

  for (const idx of targetIndexes) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= ENRICHMENT_TOTAL_BUDGET_MS) {
      exceededBudget = true;
      break;
    }
    const remainingMs = ENRICHMENT_TOTAL_BUDGET_MS - elapsedMs;
    const callTimeoutMs = Math.max(1, Math.min(ENRICHMENT_CALL_TIMEOUT_MS, remainingMs));

    const current = next[idx];
    if (!current) continue;

    let details: GeoDetailsItem | null = null;
    try {
      if (isRealAppleProviderId(current.providerId)) {
        const resolved = await withTimeout(
          resolver.details({
            providerId: current.providerId,
            lang,
            lat: current.lat,
            lng: current.lng,
          }),
          callTimeoutMs,
        );
        details = resolved?.data ?? null;
      } else if (Number.isFinite(current.lat) && Number.isFinite(current.lng)) {
        const resolved = await withTimeout(
          resolver.reverse({
            lat: current.lat,
            lng: current.lng,
            lang,
          }),
          callTimeoutMs,
        );
        details = resolved?.data ?? null;
      }
    } catch {
      details = null;
    }

    if (!details) continue;
    const resolvedSecondary = resolveSecondaryFromDetails(details);
    if (!resolvedSecondary) continue;
    next[idx] = {
      ...current,
      secondaryLabel: resolvedSecondary,
      address: current.address ?? resolvedSecondary,
      locality: current.locality ?? details.city ?? null,
      city: current.city ?? details.city ?? null,
      countryCode: current.countryCode ?? inferCountryCode(resolvedSecondary),
    };
  }

  if (Date.now() - startedAt > ENRICHMENT_TOTAL_BUDGET_MS) {
    exceededBudget = true;
  }
  return exceededBudget ? items : next;
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
  const rateKey = `address:autocomplete:${ip}`;
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
  const lat = latParam ? Number(latParam) : NaN;
  const lng = lngParam ? Number(lngParam) : NaN;
  const explicitLat = Number.isFinite(lat) ? lat : null;
  const explicitLng = Number.isFinite(lng) ? lng : null;
  const hasExplicitCoords = explicitLat != null && explicitLng != null;
  const lang = resolveLang(req);
  const geoContext = await resolveRequestGeoContext({ req, ip, lang });
  const expectedCountryCode = geoContext.countryCode ?? null;
  const queryCountryIntentCode = detectCountryCodeFromText(query);
  const effectiveCountryCode = queryCountryIntentCode ?? expectedCountryCode;
  const effectiveLat = explicitLat ?? geoContext.lat;
  const effectiveLng = explicitLng ?? geoContext.lng;
  const effectiveBias =
    Number.isFinite(effectiveLat ?? NaN) && Number.isFinite(effectiveLng ?? NaN)
      ? { lat: effectiveLat as number, lng: effectiveLng as number }
      : null;

  const cacheKey = buildCacheKey([
    "address-autocomplete",
    AUTOCOMPLETE_CACHE_VERSION,
    query.toLowerCase(),
    roundCacheCoord(effectiveLat),
    roundCacheCoord(effectiveLng),
    expectedCountryCode,
    effectiveCountryCode,
    queryCountryIntentCode,
    lang,
  ]);
  const cached = getCache<{
    items: unknown;
    sourceProvider?: string;
    expectedCountryCode?: string | null;
    effectiveCountryCode?: string | null;
    queryCountryIntentCode?: string | null;
    countryCode?: string | null;
    locationBiasSource?: string | null;
  }>(cacheKey);
  if (cached) {
    return jsonWrap(
      {
        ok: true,
        items: cached.items,
        sourceProvider: cached.sourceProvider ?? null,
        expectedCountryCode: cached.expectedCountryCode ?? cached.countryCode ?? null,
        effectiveCountryCode: cached.effectiveCountryCode ?? cached.countryCode ?? null,
        queryCountryIntentCode: cached.queryCountryIntentCode ?? null,
        countryCode: cached.expectedCountryCode ?? cached.countryCode ?? null,
        locationBiasSource: cached.locationBiasSource ?? null,
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  const resolver = getGeoResolver();
  try {
    let resolved = await resolver.autocomplete({
      query,
      lat: effectiveBias?.lat,
      lng: effectiveBias?.lng,
      limit: 12,
      lang,
    });
    const countryHint = effectiveCountryCode ? COUNTRY_QUERY_HINTS[effectiveCountryCode] ?? null : null;
    if (!hasExplicitCoords && effectiveBias && resolved.data.length === 0) {
      resolved = await resolver.autocomplete({ query, limit: 12, lang });
    } else if (!hasExplicitCoords && !effectiveBias && countryHint && resolved.data.length <= 4) {
      const hintedQuery = `${query} ${countryHint}`.trim();
      const hinted = await resolver.autocomplete({ query: hintedQuery, limit: 12, lang });
      resolved = {
        sourceProvider: resolved.sourceProvider,
        data: dedupeAutocompleteItems([...resolved.data, ...hinted.data]),
      };
    }
    const withProvider = dedupeAutocompleteItems(
      resolved.data.map((item) => ({
        ...item,
        sourceProvider: resolved.sourceProvider,
      })),
    );
    const ranked = rankLocationSuggestions(withProvider, query, effectiveBias, {
      countryCode: effectiveCountryCode,
    });
    const items = await enrichTopSuggestions({
      items: ranked,
      lang,
      resolver,
    });
    setCache(
      cacheKey,
      {
        items,
        sourceProvider: resolved.sourceProvider,
        expectedCountryCode,
        effectiveCountryCode,
        queryCountryIntentCode,
        countryCode: expectedCountryCode,
        locationBiasSource: geoContext.source,
      },
      CACHE_TTL_MS,
    );
    return jsonWrap(
      {
        ok: true,
        items,
        sourceProvider: resolved.sourceProvider,
        expectedCountryCode,
        effectiveCountryCode,
        queryCountryIntentCode,
        countryCode: expectedCountryCode,
        locationBiasSource: geoContext.source,
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    logError("api.address.autocomplete", err, {
      query,
      explicitLat,
      explicitLng,
      effectiveLat: effectiveBias?.lat ?? null,
      effectiveLng: effectiveBias?.lng ?? null,
      expectedCountryCode,
      effectiveCountryCode,
      queryCountryIntentCode,
      locationBiasSource: geoContext.source,
      lang,
    });
    const { status, message } = mapGeoError(err, "Falha ao obter sugestões.");
    return jsonWrap({ ok: false, error: message }, { status });
  }
}
export const GET = withApiEnvelope(_GET);
