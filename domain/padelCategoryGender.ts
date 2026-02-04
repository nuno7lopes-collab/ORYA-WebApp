import { Gender } from "@prisma/client";

export type PadelCategoryGenderResult =
  | { ok: true }
  | { ok: false; code: "GENDER_REQUIRED_FOR_CATEGORY" | "CATEGORY_GENDER_MISMATCH" };

const normalizeRestriction = (value?: string | null) => (value ?? "").trim().toUpperCase();

export function validatePadelCategoryGender(
  genderRestriction: string | null | undefined,
  player1Gender: Gender | null | undefined,
  player2Gender?: Gender | null,
): PadelCategoryGenderResult {
  const restriction = normalizeRestriction(genderRestriction);
  if (!restriction) return { ok: true };

  if (!player1Gender) {
    return { ok: false, code: "GENDER_REQUIRED_FOR_CATEGORY" };
  }

  const p1 = player1Gender;
  const p2 = player2Gender ?? null;

  if (restriction === "MALE") {
    if (p1 !== "MALE") return { ok: false, code: "CATEGORY_GENDER_MISMATCH" };
    if (p2 && p2 !== "MALE") return { ok: false, code: "CATEGORY_GENDER_MISMATCH" };
    return { ok: true };
  }

  if (restriction === "FEMALE") {
    if (p1 !== "FEMALE") return { ok: false, code: "CATEGORY_GENDER_MISMATCH" };
    if (p2 && p2 !== "FEMALE") return { ok: false, code: "CATEGORY_GENDER_MISMATCH" };
    return { ok: true };
  }

  if (restriction === "MIXED") {
    if (!p2) return { ok: true };
    if (p1 === p2) return { ok: false, code: "CATEGORY_GENDER_MISMATCH" };
    return { ok: true };
  }

  if (restriction === "MIXED_FREE") {
    return { ok: true };
  }

  return { ok: true };
}
