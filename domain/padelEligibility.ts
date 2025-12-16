import { Gender, PadelEligibilityType } from "@prisma/client";

export type EligibilityResult =
  | { ok: true }
  | { ok: false; code: "GENDER_REQUIRED_FOR_TOURNAMENT" | "INELIGIBLE_FOR_TOURNAMENT" };

export function validateEligibility(
  eligibilityType: PadelEligibilityType,
  player1Gender: Gender | null | undefined,
  player2Gender?: Gender | null,
): EligibilityResult {
  if (eligibilityType === "OPEN") return { ok: true };

  const p1 = player1Gender ?? null;
  const p2 = player2Gender ?? null;

  if (!p1) return { ok: false, code: "GENDER_REQUIRED_FOR_TOURNAMENT" };
  if (eligibilityType === "MALE_ONLY") {
    return p1 === "MALE" && (!p2 || p2 === "MALE")
      ? { ok: true }
      : { ok: false, code: "INELIGIBLE_FOR_TOURNAMENT" };
  }
  if (eligibilityType === "FEMALE_ONLY") {
    return p1 === "FEMALE" && (!p2 || p2 === "FEMALE")
      ? { ok: true }
      : { ok: false, code: "INELIGIBLE_FOR_TOURNAMENT" };
  }

  // MIXED
  if (!p2) return { ok: true }; // pode criar/entrar “à procura”; valida no fecho
  const comboOk =
    (p1 === "MALE" && p2 === "FEMALE") || (p1 === "FEMALE" && p2 === "MALE");
  return comboOk ? { ok: true } : { ok: false, code: "INELIGIBLE_FOR_TOURNAMENT" };
}
