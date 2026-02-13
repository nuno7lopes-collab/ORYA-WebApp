import { OrganizationMemberRole, PadelTournamentRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type IncidentConfirmedByRole = "DIRETOR_PROVA" | "REFEREE";
export type IncidentConfirmationSource =
  | "WEB_ORGANIZATION"
  | "WEB_PUBLIC"
  | "MOBILE_APP"
  | "API"
  | "SYSTEM";

const ALLOWED_CONFIRM_ROLES = new Set<IncidentConfirmedByRole>(["DIRETOR_PROVA", "REFEREE"]);
const ALLOWED_CONFIRM_SOURCES = new Set<IncidentConfirmationSource>([
  "WEB_ORGANIZATION",
  "WEB_PUBLIC",
  "MOBILE_APP",
  "API",
  "SYSTEM",
]);
const ADMIN_ROLES = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);

function normalizeConfirmedByRole(value: unknown): IncidentConfirmedByRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ALLOWED_CONFIRM_ROLES.has(normalized as IncidentConfirmedByRole)
    ? (normalized as IncidentConfirmedByRole)
    : null;
}

export function normalizeConfirmationSource(value: unknown): IncidentConfirmationSource | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ALLOWED_CONFIRM_SOURCES.has(normalized as IncidentConfirmationSource)
    ? (normalized as IncidentConfirmationSource)
    : null;
}

function normalizeRoundBase(roundLabel?: string | null) {
  const raw = typeof roundLabel === "string" ? roundLabel.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("A ") || raw.startsWith("B ")) {
    return raw.slice(2).trim().toUpperCase();
  }
  return raw.toUpperCase();
}

export function isCriticalKnockoutRound(params: { roundType?: string | null; roundLabel?: string | null }) {
  const { roundType, roundLabel } = params;
  if (roundType !== "KNOCKOUT") return false;
  const base = normalizeRoundBase(roundLabel);
  if (!base) return false;
  if (base === "SEMIFINAL" || base === "FINAL") return true;
  if (base === "GF" || base === "GF2" || base === "GRAND_FINAL" || base === "GRAND FINAL") return true;
  if (base === "GRAND_FINAL_RESET" || base === "GRAND FINAL 2") return true;
  if (/^R(2|4)$/i.test(base)) return true;
  return false;
}

export type IncidentAuthorityResult =
  | {
      ok: true;
      confirmedByRole: IncidentConfirmedByRole;
      confirmationSource: IncidentConfirmationSource;
      isCriticalRound: boolean;
      actorTournamentRoles: IncidentConfirmedByRole[];
    }
  | {
      ok: false;
      status: number;
      error:
        | "INVALID_CONFIRMED_BY_ROLE"
        | "INVALID_CONFIRMATION_SOURCE"
        | "MISSING_TOURNAMENT_DIRECTOR"
        | "OPERATIONAL_ROLE_REQUIRED"
        | "CRITICAL_ROUND_REQUIRES_DIRETOR_PROVA"
        | "FORBIDDEN";
    };

export async function resolveIncidentAuthority(params: {
  eventId: number;
  organizationId: number;
  actorUserId: string;
  membershipRole: OrganizationMemberRole;
  roundType?: string | null;
  roundLabel?: string | null;
  requestedConfirmedByRole?: unknown;
  requestedConfirmationSource?: unknown;
  defaultConfirmationSource?: IncidentConfirmationSource;
  db?: DbClient;
}): Promise<IncidentAuthorityResult> {
  const {
    eventId,
    organizationId,
    actorUserId,
    membershipRole,
    roundType,
    roundLabel,
    requestedConfirmedByRole,
    requestedConfirmationSource,
    defaultConfirmationSource = "WEB_ORGANIZATION",
    db: client,
  } = params;
  const db = client ?? prisma;
  const isAdmin = ADMIN_ROLES.has(membershipRole);
  const isCriticalRound = isCriticalKnockoutRound({ roundType, roundLabel });

  const parsedRequestedRole =
    requestedConfirmedByRole === undefined || requestedConfirmedByRole === null
      ? null
      : normalizeConfirmedByRole(requestedConfirmedByRole);
  if (requestedConfirmedByRole !== undefined && requestedConfirmedByRole !== null && !parsedRequestedRole) {
    return { ok: false, status: 400, error: "INVALID_CONFIRMED_BY_ROLE" };
  }

  const parsedConfirmationSource =
    requestedConfirmationSource === undefined || requestedConfirmationSource === null
      ? null
      : normalizeConfirmationSource(requestedConfirmationSource);
  if (requestedConfirmationSource !== undefined && requestedConfirmationSource !== null && !parsedConfirmationSource) {
    return { ok: false, status: 400, error: "INVALID_CONFIRMATION_SOURCE" };
  }

  const [directorCount, actorAssignments] = await Promise.all([
    db.padelTournamentRoleAssignment.count({
      where: {
        eventId,
        organizationId,
        role: PadelTournamentRole.DIRETOR_PROVA,
      },
    }),
    db.padelTournamentRoleAssignment.findMany({
      where: {
        eventId,
        organizationId,
        userId: actorUserId,
        role: { in: [PadelTournamentRole.DIRETOR_PROVA, PadelTournamentRole.REFEREE] },
      },
      select: { role: true },
    }),
  ]);
  if (directorCount < 1) {
    return { ok: false, status: 409, error: "MISSING_TOURNAMENT_DIRECTOR" };
  }

  const actorTournamentRoles = Array.from(
    new Set(
      actorAssignments
        .map((row) => row.role)
        .filter((role): role is IncidentConfirmedByRole => role === "DIRETOR_PROVA" || role === "REFEREE"),
    ),
  );

  let confirmedByRole: IncidentConfirmedByRole | null = null;
  if (isCriticalRound) {
    if (isAdmin || actorTournamentRoles.includes("DIRETOR_PROVA")) {
      confirmedByRole = "DIRETOR_PROVA";
    } else {
      return { ok: false, status: 403, error: "CRITICAL_ROUND_REQUIRES_DIRETOR_PROVA" };
    }
  } else if (parsedRequestedRole) {
    confirmedByRole = parsedRequestedRole;
  } else if (isAdmin) {
    confirmedByRole = "DIRETOR_PROVA";
  } else if (actorTournamentRoles.includes("DIRETOR_PROVA")) {
    confirmedByRole = "DIRETOR_PROVA";
  } else if (actorTournamentRoles.includes("REFEREE")) {
    confirmedByRole = "REFEREE";
  }

  if (!confirmedByRole) {
    return { ok: false, status: 403, error: "OPERATIONAL_ROLE_REQUIRED" };
  }
  if (!isAdmin && !actorTournamentRoles.includes(confirmedByRole)) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return {
    ok: true,
    confirmedByRole,
    confirmationSource: parsedConfirmationSource ?? defaultConfirmationSource,
    isCriticalRound,
    actorTournamentRoles,
  };
}

export async function listTournamentDirectorUserIds(params: {
  eventId: number;
  organizationId: number;
  excludeUserId?: string | null;
  db?: DbClient;
}) {
  const { eventId, organizationId, excludeUserId, db: client } = params;
  const db = client ?? prisma;
  const assignments = await db.padelTournamentRoleAssignment.findMany({
    where: {
      eventId,
      organizationId,
      role: PadelTournamentRole.DIRETOR_PROVA,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
  });
  return Array.from(new Set(assignments.map((item) => item.userId).filter(Boolean)));
}
