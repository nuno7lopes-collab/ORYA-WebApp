type PadelCategorySeed = {
  label: string;
  genderRestriction: string | null;
  minLevel: string | null;
  maxLevel: string | null;
};

const DEFAULT_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const DEFAULT_GENDERS = [
  { value: "MALE", prefix: "M" },
  { value: "FEMALE", prefix: "F" },
  { value: "MIXED", prefix: "MX" },
] as const;

const normalizeValue = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const normalizeLabelCode = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

const RESERVED_CATEGORY_CODE = /^(M|F|MX)([1-6])$/;
const LEGACY_CATEGORY_CODE = /^(MASCULINO|FEMININO|MISTO|MISTA|MALE|FEMALE|MIXED)([1-6])$/;

export const buildPadelDefaultCategories = (): PadelCategorySeed[] => {
  const categories: PadelCategorySeed[] = [];
  DEFAULT_GENDERS.forEach((gender) => {
    DEFAULT_LEVELS.forEach((level) => {
      const levelLabel = String(level);
      categories.push({
        label: `${gender.prefix}${levelLabel}`,
        genderRestriction: gender.value,
        minLevel: levelLabel,
        maxLevel: levelLabel,
      });
    });
  });
  return categories;
};

export const parsePadelMandatoryCategoryCode = (label: string | null | undefined): string | null => {
  const normalized = normalizeLabelCode(label);
  if (!normalized) return null;

  const direct = normalized.match(RESERVED_CATEGORY_CODE);
  if (direct) {
    return `${direct[1]}${direct[2]}`;
  }

  const legacy = normalized.match(LEGACY_CATEGORY_CODE);
  if (!legacy) return null;

  const level = legacy[2];
  const base = legacy[1];
  if (base === "MASCULINO" || base === "MALE") return `M${level}`;
  if (base === "FEMININO" || base === "FEMALE") return `F${level}`;
  return `MX${level}`;
};

export const inferPadelMandatoryCategoryCodeFromFields = (category: {
  genderRestriction?: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
}) => {
  const gender = (category.genderRestriction ?? "").trim().toUpperCase();
  if (gender !== "MALE" && gender !== "FEMALE" && gender !== "MIXED") return null;

  const min = (category.minLevel ?? "").trim();
  const max = (category.maxLevel ?? "").trim();
  if (!min || !max || min !== max) return null;

  const level = Number(min);
  if (!Number.isFinite(level) || level < 1 || level > 6) return null;

  const prefix = gender === "MALE" ? "M" : gender === "FEMALE" ? "F" : "MX";
  return `${prefix}${Math.floor(level)}`;
};

export const isReservedPadelMandatoryLabel = (label: string | null | undefined) =>
  Boolean(parsePadelMandatoryCategoryCode(label));

export const buildPadelCategoryKey = (category: {
  label?: string | null;
  genderRestriction?: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
}) => {
  const code = parsePadelMandatoryCategoryCode(category.label);
  if (code) return `mandatory:${code}`;
  return [normalizeValue(category.label), normalizeValue(category.genderRestriction)].join("|");
};

export const sortPadelCategories = <T extends { label: string; genderRestriction: string | null; minLevel: string | null }>(
  categories: T[],
) => {
  const genderOrder: Record<string, number> = {
    MALE: 1,
    FEMALE: 2,
    MIXED: 3,
    MIXED_FREE: 4,
  };
  return [...categories].sort((a, b) => {
    const orderA = genderOrder[a.genderRestriction ?? ""] ?? 99;
    const orderB = genderOrder[b.genderRestriction ?? ""] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const codeA = parsePadelMandatoryCategoryCode(a.label);
    const codeB = parsePadelMandatoryCategoryCode(b.label);
    const levelFromCodeA = codeA ? Number(codeA.match(/\d+/)?.[0]) : Number.NaN;
    const levelFromCodeB = codeB ? Number(codeB.match(/\d+/)?.[0]) : Number.NaN;
    const levelA = Number.isFinite(levelFromCodeA) ? levelFromCodeA : Number(a.minLevel);
    const levelB = Number.isFinite(levelFromCodeB) ? levelFromCodeB : Number(b.minLevel);
    const levelAValue = Number.isFinite(levelA) ? levelA : Number.POSITIVE_INFINITY;
    const levelBValue = Number.isFinite(levelB) ? levelB : Number.POSITIVE_INFINITY;
    if (levelAValue !== levelBValue) return levelAValue - levelBValue;

    return a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" });
  });
};
