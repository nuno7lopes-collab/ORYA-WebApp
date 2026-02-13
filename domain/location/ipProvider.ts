export type IpCoarseLocation = {
  countryCode: string | null;
  countryName: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  approxLat: number | null;
  approxLon: number | null;
  accuracyMeters: number;
  source: "IP";
  granularity: "COARSE";
};

const DEFAULT_ACCURACY_METERS = 10_000;
const IP_LOOKUP_TIMEOUT_MS = 900;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function resolveIpCoarseLocation(ip: string): Promise<IpCoarseLocation | null> {
  if (!ip || ip === "unknown") return null;
  const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ORYA/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;

    const countryCodeRaw = (data.country_code ?? data.country) as string | undefined;
    const countryCode =
      typeof countryCodeRaw === "string" && /^[a-z]{2}$/i.test(countryCodeRaw.trim())
        ? countryCodeRaw.trim().toUpperCase()
        : null;
    const countryName = (data.country_name ?? null) as string | null;
    const country = countryName ?? countryCode;
    const region = (data.region ?? data.region_code) as string | undefined;
    const city = data.city as string | undefined;
    const lat = parseNumber(data.latitude ?? data.lat);
    const lon = parseNumber(data.longitude ?? data.lon);

    return {
      countryCode,
      countryName,
      country: country ?? null,
      region: region ?? null,
      city: city ?? null,
      approxLat: lat,
      approxLon: lon,
      accuracyMeters: DEFAULT_ACCURACY_METERS,
      source: "IP",
      granularity: "COARSE",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
