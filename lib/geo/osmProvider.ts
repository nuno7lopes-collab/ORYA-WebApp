import { GeoAutocompleteItem, GeoDetailsItem, GeoProvider } from "./types";

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org";

const resolveEmail = (raw?: string | null) => {
  if (!raw) return null;
  const match = raw.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match ? match[1] : raw.trim();
};

const getUserAgent = () => {
  const explicit = process.env.GEO_USER_AGENT?.trim();
  if (explicit) return explicit;
  const domain = process.env.SES_IDENTITY_DOMAIN?.trim();
  const defaultContact = domain ? `support@${domain}` : "support@orya.pt";
  const contact =
    resolveEmail(process.env.GEO_CONTACT_EMAIL) ||
    resolveEmail(process.env.EMAIL_FROM) ||
    resolveEmail(process.env.SES_FROM_EMAIL) ||
    defaultContact;
  return `ORYA/1.0 (${contact})`;
};

const normalizePhotonLang = (raw?: string | null) => {
  if (!raw) return null;
  const primary = raw.split(",")[0]?.trim().toLowerCase();
  if (!primary) return null;
  const base = primary.split("-")[0]?.trim();
  if (!base || !/^[a-z]{2}$/.test(base)) return null;
  return base;
};

const mapOsmType = (raw?: string | null) => {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === "N" || normalized === "NODE") return "N";
  if (normalized === "W" || normalized === "WAY") return "W";
  if (normalized === "R" || normalized === "RELATION") return "R";
  return null;
};

const toProviderId = (osmType?: string | null, osmId?: string | number | null) => {
  const typeCode = mapOsmType(osmType);
  if (!typeCode) return null;
  if (osmId === null || osmId === undefined) return null;
  const id = String(osmId).trim();
  if (!id) return null;
  return `${typeCode}${id}`;
};

const normalizeCity = (address: Record<string, unknown>) => {
  const city =
    (address.city as string | undefined) ||
    (address.town as string | undefined) ||
    (address.village as string | undefined) ||
    (address.municipality as string | undefined) ||
    (address.county as string | undefined) ||
    (address.state as string | undefined) ||
    null;
  return city || null;
};

const resolveExtratag = (extratags: Record<string, unknown>, key: string) => {
  const value = extratags[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizePostalCode = (address: Record<string, unknown>, extratags: Record<string, unknown>) => {
  const raw =
    (address.postcode as string | undefined) ||
    resolveExtratag(extratags, "addr:postcode") ||
    resolveExtratag(extratags, "postcode") ||
    null;
  return raw ? raw.trim() : null;
};

const normalizeRoad = (address: Record<string, unknown>, extratags: Record<string, unknown>) =>
  (address.road as string | undefined) ||
  (address.pedestrian as string | undefined) ||
  (address.footway as string | undefined) ||
  (address.path as string | undefined) ||
  resolveExtratag(extratags, "addr:street") ||
  resolveExtratag(extratags, "street") ||
  null;

const normalizeHouseNumber = (address: Record<string, unknown>, extratags: Record<string, unknown>) =>
  (address.house_number as string | undefined) ||
  (address.house_name as string | undefined) ||
  resolveExtratag(extratags, "addr:housenumber") ||
  resolveExtratag(extratags, "housenumber") ||
  resolveExtratag(extratags, "addr:house_number") ||
  null;

const normalizeAddressLine = (address: Record<string, unknown>, extratags: Record<string, unknown>) => {
  const road = normalizeRoad(address, extratags);
  const house = normalizeHouseNumber(address, extratags);
  const postcode = normalizePostalCode(address, extratags);
  const line = [road, house].filter(Boolean).join(" ");
  if (line && postcode) return `${line}, ${postcode}`;
  return line || postcode || null;
};

const normalizeNominatim = (raw: Record<string, unknown>): GeoDetailsItem | null => {
  const address = (raw.address as Record<string, unknown> | undefined) ?? {};
  const extratags = (raw.extratags as Record<string, unknown> | undefined) ?? {};
  const namedetails = (raw.namedetails as Record<string, unknown> | undefined) ?? {};
  const lat = Number(raw.lat);
  const lng = Number(raw.lon);
  const providerId = toProviderId(raw.osm_type as string | null, raw.osm_id as string | number | null);
  const name =
    (namedetails.name as string | undefined) ||
    (raw.name as string | undefined) ||
    (address.amenity as string | undefined) ||
    (address.attraction as string | undefined) ||
    (address.shop as string | undefined) ||
    (address.tourism as string | undefined) ||
    (address.building as string | undefined) ||
    (address.place as string | undefined) ||
    null;
  const formattedAddress = typeof raw.display_name === "string" ? raw.display_name : null;
  const city = normalizeCity(address);
  const postalCode = normalizePostalCode(address, extratags);
  const road = normalizeRoad(address, extratags);
  const houseNumber = normalizeHouseNumber(address, extratags);
  const addressLine = normalizeAddressLine(address, extratags);
  const country = (address.country as string | undefined) || null;
  const line1 = [road, houseNumber].filter(Boolean).join(" ").trim();
  const line2 = [postalCode, city].filter(Boolean).join(" ").trim();
  const structured = [line1, line2, country].filter(Boolean).join(", ");
  const formattedWithPostal =
    (road || houseNumber || postalCode) && structured
      ? structured
      : formattedAddress;

  return {
    providerId,
    formattedAddress: formattedWithPostal,
    components: {
      address,
      class: typeof raw.class === "string" ? raw.class : null,
      type: typeof raw.type === "string" ? raw.type : null,
      postalCode,
      houseNumber,
      road,
      suburb: (address.suburb as string | undefined) || (address.neighbourhood as string | undefined) || null,
      extratags: Object.keys(extratags).length ? extratags : null,
    },
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    name,
    city,
    address: addressLine,
  };
};

export class OSMProvider implements GeoProvider {
  async autocomplete(args: {
    query: string;
    lat?: number | null;
    lng?: number | null;
    limit?: number;
    lang?: string;
  }): Promise<GeoAutocompleteItem[]> {
    const url = new URL(PHOTON_ENDPOINT);
    url.searchParams.set("q", args.query);
    url.searchParams.set("limit", String(args.limit ?? 8));
    if (Number.isFinite(args.lat ?? NaN) && Number.isFinite(args.lng ?? NaN)) {
      url.searchParams.set("lat", String(args.lat));
      url.searchParams.set("lon", String(args.lng));
    }
    const photonLang = normalizePhotonLang(args.lang ?? null);
    if (photonLang) url.searchParams.set("lang", photonLang);

    const headers = {
      "User-Agent": getUserAgent(),
      "Accept-Language": args.lang ?? "pt-PT",
      Accept: "application/json",
    };
    let res = await fetch(url.toString(), { headers });
    if (!res.ok && res.status === 400 && photonLang) {
      const retryUrl = new URL(url.toString());
      retryUrl.searchParams.delete("lang");
      res = await fetch(retryUrl.toString(), { headers });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const suffix = body ? `: ${body.slice(0, 180)}` : "";
      throw new Error(`Photon error ${res.status}${suffix}`);
    }
    const json = (await res.json()) as { features?: Array<Record<string, unknown>> };
    const features = Array.isArray(json.features) ? json.features : [];
    const items: GeoAutocompleteItem[] = [];

    for (const feature of features) {
      const props = (feature.properties as Record<string, unknown> | undefined) ?? {};
      const geometry = (feature.geometry as Record<string, unknown> | undefined) ?? {};
      const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const providerId = toProviderId(props.osm_type as string | null, props.osm_id as string | number | null);
      if (!providerId) continue;

      const name = typeof props.name === "string" ? props.name : null;
      const street = typeof props.street === "string" ? props.street : null;
      const house = typeof props.housenumber === "string" ? props.housenumber : null;
      const address = [street, house].filter(Boolean).join(" ") || null;
      const city =
        (typeof props.city === "string" && props.city) ||
        (typeof props.town === "string" && props.town) ||
        (typeof props.village === "string" && props.village) ||
        (typeof props.state === "string" && props.state) ||
        null;
      const country = typeof props.country === "string" ? props.country : null;

      const primary = name || address || city || country || "Local";
      const secondary = [city, country].filter(Boolean).join(" · ");
      const label = secondary && !primary.includes(secondary) ? `${primary} · ${secondary}` : primary;

      items.push({
        providerId,
        label,
        name,
        city,
        address,
        lat,
        lng,
      });
    }

    return items;
  }

  async details(args: { providerId: string; lang?: string }): Promise<GeoDetailsItem | null> {
    const url = new URL(`${NOMINATIM_ENDPOINT}/lookup`);
    url.searchParams.set("osm_ids", args.providerId);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("extratags", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": getUserAgent(),
        "Accept-Language": args.lang ?? "pt-PT",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Nominatim lookup error ${res.status}`);
    }
    const json = (await res.json()) as Array<Record<string, unknown>>;
    const first = Array.isArray(json) ? json[0] : null;
    if (!first) return null;
    return normalizeNominatim(first);
  }

  async reverse(args: { lat: number; lng: number; lang?: string }): Promise<GeoDetailsItem | null> {
    const url = new URL(`${NOMINATIM_ENDPOINT}/reverse`);
    url.searchParams.set("lat", String(args.lat));
    url.searchParams.set("lon", String(args.lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("zoom", "18");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": getUserAgent(),
        "Accept-Language": args.lang ?? "pt-PT",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Nominatim reverse error ${res.status}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return normalizeNominatim(json);
  }
}
