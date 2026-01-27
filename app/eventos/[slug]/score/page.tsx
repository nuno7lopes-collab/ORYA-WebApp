import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { EventAccessMode } from "@prisma/client";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolveLocale } from "@/lib/i18n";
import PadelScoreboardClient from "./PadelScoreboardClient";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PadelScorePage({ params, searchParams }: PageProps) {
  const resolved = await params;
  const slug = resolved.slug;
  if (!slug) notFound();
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const lang = typeof resolvedSearch?.lang === "string" ? resolvedSearch.lang : undefined;
  const locale = resolveLocale(lang);

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      status: true,
      timezone: true,
      liveStreamUrl: true,
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
      padelTournamentConfig: { select: { advancedSettings: true } },
    },
  });
  if (!event) notFound();

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0], EventAccessMode.INVITE_ONLY);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) notFound();

  const matches = await prisma.padelMatch.findMany({
    where: { eventId: event.id },
    include: {
      court: { select: { name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const initialMatches = matches.map((m) => ({
    id: m.id,
    status: m.status,
    plannedStartAt: m.plannedStartAt?.toISOString() ?? null,
    startTime: m.startTime?.toISOString() ?? null,
    plannedEndAt: m.plannedEndAt?.toISOString() ?? null,
    plannedDurationMinutes: m.plannedDurationMinutes ?? null,
    courtId: m.courtId ?? null,
    courtName: m.court?.name ?? m.courtName ?? null,
    courtNumber: m.courtNumber ?? null,
    scoreSets: Array.isArray(m.scoreSets) ? (m.scoreSets as Array<{ teamA: number; teamB: number }>) : null,
    score: m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : {},
    pairingA: m.pairingA ?? null,
    pairingB: m.pairingB ?? null,
  }));

  return (
    <PadelScoreboardClient
      event={{
        id: event.id,
        title: event.title,
        timezone: event.timezone ?? "Europe/Lisbon",
        liveStreamUrl: event.liveStreamUrl ?? null,
      }}
      initialMatches={initialMatches}
      lang={locale}
    />
  );
}
