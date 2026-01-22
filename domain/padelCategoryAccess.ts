import { Gender } from "@prisma/client";
import { validatePadelCategoryGender } from "./padelCategoryGender";
import { validatePadelCategoryLevel } from "./padelCategoryLevel";

export type PadelCategoryAccessResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "GENDER_REQUIRED_FOR_CATEGORY"
        | "CATEGORY_GENDER_MISMATCH"
        | "LEVEL_REQUIRED_FOR_CATEGORY"
        | "CATEGORY_LEVEL_MISMATCH";
      missing?: { gender?: true; level?: true };
    };

export function validatePadelCategoryAccess(params: {
  genderRestriction?: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
  playerGender?: Gender | null;
  partnerGender?: Gender | null;
  playerLevel?: string | null;
}): PadelCategoryAccessResult {
  const genderCheck = validatePadelCategoryGender(
    params.genderRestriction ?? null,
    params.playerGender ?? null,
    params.partnerGender ?? null,
  );
  if (!genderCheck.ok) {
    return {
      ok: false,
      code: genderCheck.code,
      missing: genderCheck.code === "GENDER_REQUIRED_FOR_CATEGORY" ? { gender: true } : undefined,
    };
  }

  const levelCheck = validatePadelCategoryLevel(
    params.minLevel ?? null,
    params.maxLevel ?? null,
    params.playerLevel ?? null,
  );
  if (!levelCheck.ok) {
    return {
      ok: false,
      code: levelCheck.code,
      missing: levelCheck.code === "LEVEL_REQUIRED_FOR_CATEGORY" ? { level: true } : undefined,
    };
  }

  return { ok: true };
}
