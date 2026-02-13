import type { GeoAutocompleteItem } from "./provider";
import { detectCountryCodeFromText } from "./countryIntent";

type SuggestionsPartition = {
  local: GeoAutocompleteItem[];
  foreign: GeoAutocompleteItem[];
  unknown: GeoAutocompleteItem[];
};

const normalizeCountryCode = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
};

const resolveItemCountryCode = (item: GeoAutocompleteItem) =>
  normalizeCountryCode(item.countryCode) ||
  detectCountryCodeFromText(
    [item.secondaryLabel, item.address, item.locality, item.city, item.label].filter(Boolean).join(" "),
  );

export const partitionSuggestionsByCountry = (
  items: GeoAutocompleteItem[],
  effectiveCountryCode: string | null | undefined,
): SuggestionsPartition => {
  const normalizedCountry = normalizeCountryCode(effectiveCountryCode);

  if (!normalizedCountry) {
    return {
      local: [],
      foreign: [],
      unknown: [...items],
    };
  }

  return items.reduce<SuggestionsPartition>(
    (acc, item) => {
      const itemCountryCode = resolveItemCountryCode(item);
      if (!itemCountryCode) {
        acc.unknown.push(item);
      } else if (itemCountryCode === normalizedCountry) {
        acc.local.push(item);
      } else {
        acc.foreign.push(item);
      }
      return acc;
    },
    { local: [], foreign: [], unknown: [] },
  );
};
