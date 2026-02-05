export const INTEREST_OPTIONS = [
  { id: "padel", label: "Padel" },
  { id: "concertos", label: "Concertos" },
  { id: "festas", label: "Festas" },
  { id: "viagens", label: "Viagens" },
  { id: "bem_estar", label: "Bem-estar" },
  { id: "gastronomia", label: "Gastronomia" },
  { id: "aulas", label: "Aulas" },
  { id: "workshops", label: "Workshops" },
] as const;

export type InterestOption = (typeof INTEREST_OPTIONS)[number];
export type InterestId = InterestOption["id"];

export type OnboardingStep = "basic" | "interests" | "padel" | "location";

export type OnboardingPayload = {
  fullName: string;
  username: string;
  interests: InterestId[];
  padelGender?: string | null;
  padelPreferredSide?: string | null;
  padelLevel?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
};

export const PADEL_GENDERS = [
  { id: "MALE", label: "Masculino" },
  { id: "FEMALE", label: "Feminino" },
] as const;

export const PADEL_SIDES = [
  { id: "ESQUERDA", label: "Esquerda" },
  { id: "DIREITA", label: "Direita" },
  { id: "QUALQUER", label: "Qualquer" },
] as const;

export const PADEL_LEVELS = ["1", "2", "3", "4", "5", "6"] as const;

export type PadelGender = (typeof PADEL_GENDERS)[number]["id"];
export type PadelPreferredSide = (typeof PADEL_SIDES)[number]["id"];
export type PadelLevel = (typeof PADEL_LEVELS)[number];
