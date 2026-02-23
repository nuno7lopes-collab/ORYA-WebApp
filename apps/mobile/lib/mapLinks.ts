export type MapTargets = {
  apple: string;
  android: string;
  web: string;
};

type BuildMapTargetsInput = {
  label?: string | null;
  query?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export const buildMapTargets = ({
  label,
  query,
  lat,
  lng,
}: BuildMapTargetsInput): MapTargets | null => {
  const safeLabel = String(label ?? "").trim() || "ORYA";
  const safeQuery = String(query ?? "").trim();
  const hasCoords =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180;

  if (hasCoords) {
    const coords = `${lat},${lng}`;
    const encodedLabel = encodeURIComponent(safeLabel);
    return {
      apple: `https://maps.apple.com/?ll=${coords}&q=${encodedLabel}`,
      android: `geo:${coords}?q=${coords}(${encodedLabel})`,
      web: `https://www.google.com/maps/search/?api=1&query=${coords}`,
    };
  }

  if (safeQuery) {
    const encodedQuery = encodeURIComponent(safeQuery);
    return {
      apple: `https://maps.apple.com/?q=${encodedQuery}`,
      android: `geo:0,0?q=${encodedQuery}`,
      web: `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`,
    };
  }

  return null;
};
