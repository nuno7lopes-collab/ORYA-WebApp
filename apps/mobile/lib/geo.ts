export const getDistanceKm = (
  lat?: number | null,
  lng?: number | null,
  userLat?: number | null,
  userLng?: number | null,
): number | null => {
  if (lat == null || lng == null || userLat == null || userLng == null) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat - userLat);
  const dLng = toRad(lng - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = 6371 * c;
  if (!Number.isFinite(distance)) return null;
  return distance;
};

export const formatDistanceKm = (
  lat?: number | null,
  lng?: number | null,
  userLat?: number | null,
  userLng?: number | null,
) => {
  const distance = getDistanceKm(lat, lng, userLat, userLng);
  if (distance == null) return null;
  if (distance < 1) return "<1 km";
  if (distance < 10) return `${distance.toFixed(1)} km`;
  return `${Math.round(distance)} km`;
};
