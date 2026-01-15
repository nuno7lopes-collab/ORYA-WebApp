export const INTEREST_MAX_SELECTION = 6;

export const INTEREST_OPTIONS = [
  { id: "concertos", label: "Concertos" },
  { id: "festas", label: "Festas" },
  { id: "padel", label: "Padel" },
  { id: "viagens", label: "Viagens" },
  { id: "bem_estar", label: "Bem-estar" },
  { id: "gastronomia", label: "Gastronomia" },
  { id: "aulas", label: "Aulas" },
  { id: "workshops", label: "Workshops" },
] as const;

export type InterestOption = (typeof INTEREST_OPTIONS)[number];
export type InterestId = InterestOption["id"];

const LABEL_TO_ID = new Map<string, InterestId>(
  INTEREST_OPTIONS.map((option) => [option.label.toLowerCase(), option.id]),
);
const ID_TO_LABEL = new Map(INTEREST_OPTIONS.map((option) => [option.id, option.label]));

LABEL_TO_ID.set("bem estar", "bem_estar");

export function resolveInterestId(value: string): InterestId | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ID_TO_LABEL.has(trimmed as InterestId)) return trimmed as InterestId;
  return LABEL_TO_ID.get(trimmed.toLowerCase()) ?? null;
}

export function resolveInterestLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ID_TO_LABEL.has(trimmed as InterestId)) {
    return ID_TO_LABEL.get(trimmed as InterestId) ?? null;
  }
  const id = LABEL_TO_ID.get(trimmed.toLowerCase());
  return id ? ID_TO_LABEL.get(id) ?? null : trimmed;
}

export function normalizeInterestSelection(values: string[], max = INTEREST_MAX_SELECTION) {
  const result: InterestId[] = [];
  const seen = new Set<InterestId>();
  for (const raw of values) {
    const id = resolveInterestId(raw);
    if (!id || seen.has(id)) continue;
    result.push(id);
    seen.add(id);
    if (result.length >= max) break;
  }
  return result;
}
