export const INTEREST_IDS = [
  "padel",
  "concertos",
  "festas",
  "viagens",
  "bem_estar",
  "gastronomia",
  "aulas",
  "workshops",
] as const;

export type InterestId = (typeof INTEREST_IDS)[number];
