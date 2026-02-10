import type { PublicEventCard } from "@orya/shared";

const TEMPLATE_FALLBACK: Record<string, string[]> = {
  PADEL: ["padel"],
  PARTY: ["festas"],
  TALK: ["workshops"],
  VOLUNTEERING: ["bem_estar"],
  OTHER: ["bem_estar"],
};

const TAG_LABELS: Record<string, string> = {
  padel: "Padel",
  concertos: "Concertos",
  festas: "Festas",
  viagens: "Viagens",
  bem_estar: "Bem-estar",
  gastronomia: "Gastronomia",
  aulas: "Aulas",
  workshops: "Workshops",
};

export const normalizeInterestTag = (value: string) => value.trim().toLowerCase();

export const resolveEventInterestTags = (
  event: Pick<PublicEventCard, "interestTags" | "templateType"> | null | undefined,
): string[] => {
  if (!event) return [];
  const directTags = Array.isArray(event.interestTags)
    ? event.interestTags.map(normalizeInterestTag).filter(Boolean)
    : [];
  if (directTags.length > 0) return directTags;
  const templateType = event.templateType?.toUpperCase() ?? "";
  const fallback = TEMPLATE_FALLBACK[templateType] ?? [];
  return fallback.map(normalizeInterestTag);
};

export const resolvePrimaryInterestTag = (
  event: Pick<PublicEventCard, "interestTags" | "templateType"> | null | undefined,
): string | null => {
  const tags = resolveEventInterestTags(event);
  return tags.length > 0 ? tags[0] : null;
};

export const formatInterestTagLabel = (tag: string | null | undefined): string | null => {
  if (!tag) return null;
  const normalized = normalizeInterestTag(tag);
  if (TAG_LABELS[normalized]) return TAG_LABELS[normalized];
  const cleaned = normalized.replace(/_/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};
