import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState, PadelCompetitionState } from "@/domain/padelCompetitionState";
import { pickCanonicalField } from "@/lib/location/eventLocation";

type CourtLite = { name: string; clubName: string | null; indoor?: boolean | null };
type PartnerClubLite = { id: number; name: string | null; city: string | null };

export type PadelEventSnapshot = {
  eventId: number;
  title: string;
  status: string;
  competitionState: PadelCompetitionState;
  startsAt: string | null;
  endsAt: string | null;
  clubName: string | null;
  clubCity: string | null;
  partnerClubs: PartnerClubLite[];
  courts: CourtLite[];
  timeline: Array<{ key: string; label: string; state: "done" | "active" | "pending"; cancelled?: boolean; date: string | null }>;
};

function buildTimeline(params: {
  status: string;
  competitionState: PadelCompetitionState;
  startsAt: Date | null;
  endsAt: Date | null;
  registrationStartsAt?: Date | null;
  registrationEndsAt?: Date | null;
}) {
  const { status, competitionState, startsAt, endsAt, registrationStartsAt, registrationEndsAt } = params;
  const now = new Date();
  const started = startsAt ? startsAt.getTime() <= now.getTime() : false;
  const finished = status === "FINISHED" || (endsAt ? endsAt.getTime() < now.getTime() : false);
  const cancelled = status === "CANCELLED" || competitionState === "CANCELLED";
  const registrationUpcoming =
    registrationStartsAt ? now.getTime() < registrationStartsAt.getTime() : false;
  const registrationClosed =
    registrationEndsAt ? now.getTime() > registrationEndsAt.getTime() : false;

  let signupState: "done" | "active" | "pending" = "pending";
  if (cancelled) {
    signupState = "done";
  } else if (competitionState === "HIDDEN" || status === "DRAFT") {
    signupState = "pending";
  } else if (competitionState === "PUBLIC") {
    signupState = "done";
  } else if (registrationUpcoming) {
    signupState = "pending";
  } else if (registrationClosed || started) {
    signupState = "done";
  } else {
    signupState = "active";
  }

  const timeline: PadelEventSnapshot["timeline"] = [
    {
      key: "signup",
      label: "Inscrições",
      state: signupState,
      date: registrationStartsAt?.toISOString() ?? startsAt?.toISOString() ?? null,
    },
    {
      key: "games",
      label: "Jogos",
      state: cancelled ? "pending" : started ? (finished ? "done" : "active") : "pending",
      date: startsAt ? startsAt.toISOString() : null,
    },
    {
      key: "finish",
      label: cancelled ? "Cancelado" : "Terminado",
      state: finished || cancelled ? "done" : "pending",
      cancelled,
      date: endsAt ? endsAt.toISOString() : null,
    },
  ];
  return timeline;
}

export async function buildPadelEventSnapshot(eventId: number): Promise<PadelEventSnapshot | null> {
  if (!Number.isFinite(eventId)) return null;

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      templateType: true,
      addressRef: { select: { formattedAddress: true, canonical: true } },
      padelTournamentConfig: {
        select: {
          numberOfCourts: true,
          partnerClubIds: true,
          advancedSettings: true,
          club: { select: { id: true, name: true, addressRef: { select: { canonical: true } } } },
        },
      },
    },
  });

  if (!event || event.templateType !== "PADEL") return null;

  const config = event.padelTournamentConfig;
  const advanced = (config?.advancedSettings || {}) as {
    courtsFromClubs?: Array<{ name?: string | null; clubName?: string | null; indoor?: boolean | null }>;
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    competitionState?: string | null;
  };

  const registrationStartsAt =
    advanced.registrationStartsAt && !Number.isNaN(new Date(advanced.registrationStartsAt).getTime())
      ? new Date(advanced.registrationStartsAt)
      : null;
  const registrationEndsAt =
    advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
      ? new Date(advanced.registrationEndsAt)
      : null;

  const partnerIds = config?.partnerClubIds ?? [];
  const partnerClubRows =
    partnerIds.length > 0
      ? await prisma.padelClub.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, addressRef: { select: { canonical: true } } },
        })
      : [];
  const partnerClubs: PartnerClubLite[] = partnerClubRows.map((club) => ({
    id: club.id,
    name: club.name,
    city:
      pickCanonicalField(
        (club.addressRef?.canonical as Record<string, unknown> | null) ?? null,
        "city",
        "locality",
        "addressLine2",
        "region",
        "state",
      ) ?? null,
  }));

  const courtsFromClubs = Array.isArray(advanced?.courtsFromClubs)
    ? (advanced.courtsFromClubs || []).map((c, idx) => ({
        name: c.name || `Court ${idx + 1}`,
        clubName: c.clubName || config?.club?.name || null,
        indoor: c.indoor ?? null,
      }))
    : [];

  const courts: CourtLite[] =
    courtsFromClubs.length > 0
      ? courtsFromClubs
      : Array.from({ length: Math.max(1, config?.numberOfCourts || 1) }).map((_, idx) => ({
          name: `Court ${idx + 1}`,
          clubName: config?.club?.name || event.addressRef?.formattedAddress || null,
          indoor: null,
        }));

  const clubCanonical = (config?.club?.addressRef?.canonical as Record<string, unknown> | null) ?? null;
  const eventCanonical = (event.addressRef?.canonical as Record<string, unknown> | null) ?? null;
  const clubCity =
    pickCanonicalField(clubCanonical, "city", "locality", "addressLine2", "region", "state") ??
    pickCanonicalField(eventCanonical, "city", "locality", "addressLine2", "region", "state") ??
    null;

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: advanced.competitionState ?? null,
  });

  return {
    eventId: event.id,
    title: event.title,
    status: event.status,
    competitionState,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    clubName: config?.club?.name || event.addressRef?.formattedAddress || null,
    clubCity: clubCity,
    partnerClubs,
    courts,
    timeline: buildTimeline({
      status: event.status,
      competitionState,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? event.startsAt,
      registrationStartsAt,
      registrationEndsAt,
    }),
  };
}
