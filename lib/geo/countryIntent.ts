const COUNTRY_ALIASES: Record<string, readonly string[]> = {
  PT: ["portugal", "pt"],
  ES: ["spain", "espanha", "espana", "es"],
  FR: ["france", "franca", "fr"],
  DE: ["germany", "alemanha", "de"],
  IT: ["italy", "italia", "it"],
  NL: ["netherlands", "paises baixos", "holland", "nl"],
  CH: ["switzerland", "suica", "ch"],
  BE: ["belgium", "belgica", "be"],
  GB: ["united kingdom", "reino unido", "uk", "gb", "scotland", "escocia", "escocia", "inglaterra"],
  US: ["united states", "usa", "estados unidos", "us"],
  BR: ["brazil", "brasil", "br"],
  ET: ["ethiopia", "etiopia", "et"],
  KZ: ["kazakhstan", "cazaquistao", "kz"],
  TG: ["togo", "tg"],
};

export const KNOWN_COUNTRY_CODES = Object.freeze(Object.keys(COUNTRY_ALIASES));

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeGeoText = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const hasToken = (haystack: string, token: string) => {
  if (!token) return false;
  if (token.length <= 2) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(token)}(?:$|[^a-z0-9])`);
    return pattern.test(haystack);
  }
  return haystack.includes(token);
};

export const getCountryAliases = (countryCode: string | null | undefined): readonly string[] => {
  if (!countryCode) return [];
  const normalized = countryCode.trim().toUpperCase();
  if (!normalized) return [];
  return COUNTRY_ALIASES[normalized] ?? [normalized.toLowerCase()];
};

export const isCountryTokenPresent = (text: string | null | undefined, countryCode: string | null | undefined) => {
  const haystack = normalizeGeoText(text);
  if (!haystack) return false;
  const aliases = getCountryAliases(countryCode);
  if (aliases.length === 0) return false;
  return aliases.some((alias) => hasToken(haystack, alias));
};

export const detectCountryCodeFromText = (text: string | null | undefined) => {
  const normalized = normalizeGeoText(text);
  if (!normalized) return null;

  if (/^[a-z]{2}$/i.test(normalized)) {
    const asCode = normalized.toUpperCase();
    return KNOWN_COUNTRY_CODES.includes(asCode) ? asCode : null;
  }

  for (const code of KNOWN_COUNTRY_CODES) {
    if (isCountryTokenPresent(normalized, code)) return code;
  }
  return null;
};
