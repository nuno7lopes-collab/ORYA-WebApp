export const quantizeGeoKeyValue = (value?: number | null, precision = 3) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};
