const COUNTRY_ALIASES: Record<string, readonly string[]> = {
  PT: ["portugal"],
  ES: ["spain", "espanha", "espana"],
  FR: ["france", "franca"],
  DE: ["germany", "alemanha"],
  IT: ["italy", "italia"],
  NL: ["netherlands", "paises baixos", "holland"],
  CH: ["switzerland", "suica"],
  BE: ["belgium", "belgica"],
  GB: ["united kingdom", "reino unido", "great britain", "britain", "uk", "scotland", "escocia", "england", "inglaterra"],
  US: ["united states", "usa", "estados unidos", "eua"],
  BR: ["brazil", "brasil"],
  ET: ["ethiopia", "etiopia"],
  KZ: ["kazakhstan", "cazaquistao"],
  TG: ["togo"],
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

const hasExplicitIsoCodeToken = (text: string, countryCode: string) => {
  if (!text || !countryCode) return false;
  const normalizedCode = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return false;
  const pattern = new RegExp(`(?:^|[^A-Za-z])${escapeRegex(normalizedCode)}(?:$|[^A-Za-z])`);
  return pattern.test(text);
};

export const getCountryAliases = (countryCode: string | null | undefined): readonly string[] => {
  if (!countryCode) return [];
  const normalized = countryCode.trim().toUpperCase();
  if (!normalized) return [];
  return COUNTRY_ALIASES[normalized] ?? [normalized.toLowerCase()];
};

export const isCountryTokenPresent = (text: string | null | undefined, countryCode: string | null | undefined) => {
  const rawText = (text ?? "").trim();
  if (rawText && countryCode && hasExplicitIsoCodeToken(rawText, countryCode)) {
    return true;
  }
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
    if (isCountryTokenPresent(text, code)) return code;
  }
  return null;
};
