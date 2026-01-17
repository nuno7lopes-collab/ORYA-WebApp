type PadelCategorySeed = {
  label: string;
  genderRestriction: string | null;
  minLevel: string | null;
  maxLevel: string | null;
};

const DEFAULT_LEVELS = [1, 2, 3, 4, 5, 6];
const DEFAULT_GENDERS = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Feminino" },
  { value: "MIXED", label: "Misto" },
];

const normalizeValue = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export const buildPadelDefaultCategories = (): PadelCategorySeed[] => {
  const categories: PadelCategorySeed[] = [];
  DEFAULT_GENDERS.forEach((gender) => {
    DEFAULT_LEVELS.forEach((level) => {
      const levelLabel = String(level);
      categories.push({
        label: `${gender.label} ${levelLabel}`,
        genderRestriction: gender.value,
        minLevel: levelLabel,
        maxLevel: levelLabel,
      });
    });
  });
  return categories;
};

export const buildPadelCategoryKey = (category: {
  label?: string | null;
  genderRestriction?: string | null;
}) => {
  return [normalizeValue(category.label), normalizeValue(category.genderRestriction)].join("|");
};

export const sortPadelCategories = <T extends { label: string; genderRestriction: string | null; minLevel: string | null }>(
  categories: T[],
) => {
  const genderOrder: Record<string, number> = {
    MALE: 1,
    FEMALE: 2,
    MIXED: 3,
  };
  return [...categories].sort((a, b) => {
    const orderA = genderOrder[a.genderRestriction ?? ""] ?? 99;
    const orderB = genderOrder[b.genderRestriction ?? ""] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const levelA = Number(a.minLevel);
    const levelB = Number(b.minLevel);
    const levelAValue = Number.isFinite(levelA) ? levelA : Number.POSITIVE_INFINITY;
    const levelBValue = Number.isFinite(levelB) ? levelB : Number.POSITIVE_INFINITY;
    if (levelAValue !== levelBValue) return levelAValue - levelBValue;

    return a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" });
  });
};
