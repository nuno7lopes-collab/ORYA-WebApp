import { prisma } from "@/lib/prisma";

type CourtLite = { name: string; clubName: string | null; indoor?: boolean | null };
type PartnerClubLite = { id: number; name: string | null; city: string | null };

export type PadelEventSnapshot = {
  eventId: number;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  clubName: string | null;
  clubCity: string | null;
  partnerClubs: PartnerClubLite[];
  courts: CourtLite[];
  timeline: Array<{ key: string; label: string; state: "done" | "active" | "pending"; cancelled?: boolean; date: string | null }>;
};

function buildTimeline(params: { status: string; startsAt: Date | null; endsAt: Date | null }) {
  const { status, startsAt, endsAt } = params;
  const now = new Date();
  const started = startsAt ? startsAt.getTime() <= now.getTime() : false;
  const finished = status === "FINISHED" || (endsAt ? endsAt.getTime() < now.getTime() : false);
  const cancelled = status === "CANCELLED";

  return [
    {
      key: "signup",
      label: "Inscrições",
      state: status === "PUBLISHED" && !started ? "active" : status === "DRAFT" ? "pending" : "done",
      date: startsAt ? startsAt.toISOString() : null,
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
      locationCity: true,
      locationName: true,
      padelTournamentConfig: {
        select: {
          numberOfCourts: true,
          partnerClubIds: true,
          advancedSettings: true,
          club: { select: { id: true, name: true, city: true, address: true } },
        },
      },
    },
  });

  if (!event || event.templateType !== "PADEL") return null;

  const config = event.padelTournamentConfig;
  const advanced = (config?.advancedSettings || {}) as {
    courtsFromClubs?: Array<{ name?: string | null; clubName?: string | null; indoor?: boolean | null }>;
  };

  const partnerIds = config?.partnerClubIds ?? [];
  const partnerClubs: PartnerClubLite[] =
    partnerIds.length > 0
      ? await prisma.padelClub.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, city: true },
        })
      : [];

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
          clubName: config?.club?.name || event.locationName || null,
          indoor: null,
        }));

  return {
    eventId: event.id,
    title: event.title,
    status: event.status,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    clubName: config?.club?.name || event.locationName || null,
    clubCity: config?.club?.city || event.locationCity || null,
    partnerClubs,
    courts,
    timeline: buildTimeline({ status: event.status, startsAt: event.startsAt, endsAt: event.endsAt ?? event.startsAt }),
  };
}
