import { EventTemplateType } from "@prisma/client";
import type { InterestId } from "@orya/shared";

export const INTEREST_IDS: InterestId[] = [
  "padel",
  "concertos",
  "festas",
  "viagens",
  "bem_estar",
  "gastronomia",
  "aulas",
  "workshops",
];

export function normalizeInterestIds(input: string[] | null | undefined): InterestId[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(INTEREST_IDS);
  return input.filter((item): item is InterestId => allowed.has(item as InterestId));
}

export function fallbackInterestTags(templateType?: string | null): InterestId[] {
  const type = templateType?.toUpperCase() ?? null;
  if (type === EventTemplateType.PADEL) return ["padel"];
  if (type === EventTemplateType.PARTY) return ["festas"];
  if (type === EventTemplateType.TALK) return ["workshops"];
  if (type === EventTemplateType.VOLUNTEERING) return ["bem_estar"];
  if (type === EventTemplateType.OTHER) return ["bem_estar"];
  return [];
}
