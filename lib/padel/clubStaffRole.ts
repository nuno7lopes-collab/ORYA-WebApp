const PADEL_CLUB_STAFF_ROLE_VALUES = ["ADMIN_CLUBE", "DIRETOR_PROVA", "STAFF"] as const;

export const PADEL_CLUB_STAFF_ROLES = PADEL_CLUB_STAFF_ROLE_VALUES;
export type PadelClubStaffRoleValue = (typeof PADEL_CLUB_STAFF_ROLE_VALUES)[number];

const PADEL_CLUB_STAFF_ROLE_SET = new Set<PadelClubStaffRoleValue>(PADEL_CLUB_STAFF_ROLE_VALUES);

const PADEL_CLUB_STAFF_ROLE_ALIASES: Record<string, PadelClubStaffRoleValue> = {
  ADMIN: "ADMIN_CLUBE",
  ADMIN_CLUB: "ADMIN_CLUBE",
  CLUB_ADMIN: "ADMIN_CLUBE",
  DIRETOR: "DIRETOR_PROVA",
  ARBITRO: "DIRETOR_PROVA",
  ARBITRO_PROVA: "DIRETOR_PROVA",
  REFEREE: "DIRETOR_PROVA",
};

export function normalizePadelClubStaffRole(value: unknown): PadelClubStaffRoleValue | null {
  if (typeof value !== "string") return null;
  const compact = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (PADEL_CLUB_STAFF_ROLE_SET.has(compact as PadelClubStaffRoleValue)) {
    return compact as PadelClubStaffRoleValue;
  }
  return PADEL_CLUB_STAFF_ROLE_ALIASES[compact] ?? null;
}
