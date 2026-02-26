import { PadelRegistrationStatus, Prisma, padel_format } from "@prisma/client";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";

type CapacityCheckResult = { ok: true } | { ok: false; code: "CATEGORY_FULL" | "CATEGORY_PLAYERS_FULL" };

type CapacityCheckParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  categoryId: number | null;
  excludePairingId?: number | null;
};

export async function checkPadelCategoryCapacity(params: CapacityCheckParams): Promise<CapacityCheckResult> {
  const { tx, eventId, categoryId, excludePairingId } = params;
  if (!categoryId) return { ok: true };

  const link = await tx.padelEventCategoryLink.findFirst({
    where: { eventId, padelCategoryId: categoryId, isEnabled: true },
    select: { capacityTeams: true, capacityPlayers: true, format: true },
  });
  if (!link) return { ok: true };

  let capacityTeams =
    typeof link.capacityTeams === "number" && Number.isFinite(link.capacityTeams) && link.capacityTeams > 0
      ? Math.floor(link.capacityTeams)
      : null;
  const capacityPlayers =
    typeof link.capacityPlayers === "number" && Number.isFinite(link.capacityPlayers) && link.capacityPlayers > 0
      ? Math.floor(link.capacityPlayers)
      : null;

  const config = await tx.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { format: true, numberOfCourts: true, advancedSettings: true },
  });
  const advanced = (config?.advancedSettings as Record<string, unknown> | null) ?? {};
  const formatProfilesByCategory =
    advanced.formatProfilesByCategory && typeof advanced.formatProfilesByCategory === "object"
      ? (advanced.formatProfilesByCategory as Record<string, unknown>)
      : null;
  const categoryProfile =
    formatProfilesByCategory &&
    formatProfilesByCategory[String(categoryId)] &&
    typeof formatProfilesByCategory[String(categoryId)] === "object"
      ? (formatProfilesByCategory[String(categoryId)] as Record<string, unknown>)
      : formatProfilesByCategory &&
          formatProfilesByCategory.global &&
          typeof formatProfilesByCategory.global === "object"
        ? (formatProfilesByCategory.global as Record<string, unknown>)
        : null;
  const formatFromProfile =
    categoryProfile && typeof categoryProfile.format === "string" ? parsePadelFormat(categoryProfile.format) : null;
  const effectiveFormat = formatFromProfile ?? link.format ?? config?.format ?? null;
  const nonStopMode =
    categoryProfile?.nonStopMode === "ACTIVE_QUEUE" || categoryProfile?.nonStopMode === "HARD_CAP_WAITLIST"
      ? categoryProfile.nonStopMode
      : "ACTIVE_QUEUE";
  if (effectiveFormat === padel_format.NON_STOP && nonStopMode === "HARD_CAP_WAITLIST") {
    const defaults =
      advanced.courtSelectionDefaults && typeof advanced.courtSelectionDefaults === "object"
        ? (advanced.courtSelectionDefaults as Record<string, unknown>)
        : null;
    const defaultsCount =
      defaults?.useAllCourts === false && Array.isArray(defaults.courtIds)
        ? defaults.courtIds
            .map((value) => (typeof value === "number" ? value : Number(value)))
            .filter((value): value is number => Number.isFinite(value) && value > 0).length
        : 0;
    const advancedCourtCount = Array.isArray(advanced.courtIds)
      ? advanced.courtIds
          .map((value) => (typeof value === "number" ? value : Number(value)))
          .filter((value): value is number => Number.isFinite(value) && value > 0).length
      : 0;
    const courtsCount = Math.max(
      1,
      defaultsCount || advancedCourtCount || (typeof config?.numberOfCourts === "number" ? config.numberOfCourts : 1),
    );
    const hardCapTeams = courtsCount * 2;
    capacityTeams = capacityTeams ? Math.min(capacityTeams, hardCapTeams) : hardCapTeams;
  }

  if (!capacityTeams && !capacityPlayers) return { ok: true };

  const pairingFilter = {
    eventId,
    categoryId,
    pairingStatus: { not: "CANCELLED" as const },
    OR: [{ registration: { is: null } }, { registration: { status: PadelRegistrationStatus.CONFIRMED } }],
    ...(excludePairingId ? { id: { not: excludePairingId } } : {}),
  };

  if (capacityTeams) {
    const teamsCount = await tx.padelPairing.count({ where: pairingFilter });
    if (teamsCount >= capacityTeams) return { ok: false, code: "CATEGORY_FULL" };
  }

  if (capacityPlayers) {
    const playersCount = await tx.padelPairingSlot.count({
      where: {
        slotStatus: "FILLED",
        pairing: pairingFilter,
      },
    });
    if (playersCount >= capacityPlayers) return { ok: false, code: "CATEGORY_PLAYERS_FULL" };
  }

  return { ok: true };
}

type PlayerCapacityResult = { ok: true } | { ok: false; code: "CATEGORY_PLAYERS_FULL" };

type PlayerCapacityParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  categoryId: number | null;
  excludePairingId?: number | null;
};

export async function checkPadelCategoryPlayerCapacity(params: PlayerCapacityParams): Promise<PlayerCapacityResult> {
  const { tx, eventId, categoryId, excludePairingId } = params;
  if (!categoryId) return { ok: true };

  const link = await tx.padelEventCategoryLink.findFirst({
    where: { eventId, padelCategoryId: categoryId, isEnabled: true },
    select: { capacityPlayers: true },
  });
  if (!link) return { ok: true };

  const capacityPlayers =
    typeof link.capacityPlayers === "number" && Number.isFinite(link.capacityPlayers) && link.capacityPlayers > 0
      ? Math.floor(link.capacityPlayers)
      : null;
  if (!capacityPlayers) return { ok: true };

  const playersCount = await tx.padelPairingSlot.count({
    where: {
      slotStatus: "FILLED",
      pairing: {
        eventId,
        categoryId,
        pairingStatus: { not: "CANCELLED" as const },
        OR: [{ registration: { is: null } }, { registration: { status: PadelRegistrationStatus.CONFIRMED } }],
        ...(excludePairingId ? { id: { not: excludePairingId } } : {}),
      },
    },
  });
  if (playersCount >= capacityPlayers) return { ok: false, code: "CATEGORY_PLAYERS_FULL" };

  return { ok: true };
}
