import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { EventAccessMode } from "@prisma/client";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { formatDate, formatTime, resolveLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; matchId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
};

const pairingName = (pairing?: { slots?: PairingSlot[] } | null, locale?: string | null) => {
  if (!pairing) return "—";
  const names =
    pairing.slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length ? names.join(" / ") : t("pairingIncomplete", locale);
};

const formatScoreLabel = (
  match: { scoreSets?: Array<{ teamA: number; teamB: number }> | null; score?: Record<string, unknown> | null },
  locale?: string | null,
) => {
  const score = (match.score || {}) as Record<string, unknown>;
  if (score.disputeStatus === "OPEN") return t("scoreDispute", locale);
  if (score.delayStatus === "DELAYED") return t("scoreDelayed", locale);
  if (match.scoreSets?.length) {
    return match.scoreSets.map((set) => `${set.teamA}-${set.teamB}`).join(", ");
  }
  const resultType =
    score.resultType === "WALKOVER" || score.walkover === true
      ? "WALKOVER"
      : score.resultType === "RETIREMENT"
        ? "RETIREMENT"
        : score.resultType === "INJURY"
          ? "INJURY"
          : null;
  if (resultType === "WALKOVER") return t("scoreWalkover", locale);
  if (resultType === "RETIREMENT") return t("scoreRetirement", locale);
  if (resultType === "INJURY") return t("scoreInjury", locale);
  return "—";
};

async function resolvePageLocale(searchParams?: Record<string, string | string[] | undefined>) {
  const headersList = await headers();
  const langParam =
    typeof searchParams?.lang === "string"
      ? searchParams.lang
      : Array.isArray(searchParams?.lang)
        ? searchParams?.lang?.[0]
        : null;
  const acceptLanguage = headersList.get("accept-language");
  return resolveLocale(langParam ?? (acceptLanguage ? acceptLanguage.split(",")[0] : null));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const locale = await resolvePageLocale(resolvedSearch);
  const matchId = Number(resolvedParams.matchId);
  if (!resolvedParams.slug || !Number.isFinite(matchId)) {
    return { title: `${t("matchLabel", locale)} | ORYA` };
  }

  const event = await prisma.event.findUnique({
    where: { slug: resolvedParams.slug },
    select: { id: true, title: true },
  });
  if (!event) {
    return { title: `${t("matchLabel", locale)} | ORYA` };
  }

  const match = await prisma.eventMatchSlot.findFirst({
    where: { id: matchId, eventId: event.id },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
  });

  const pairingALabel = pairingName(match?.pairingA ?? null, locale);
  const pairingBLabel = pairingName(match?.pairingB ?? null, locale);
  const title = match
    ? `${pairingALabel} vs ${pairingBLabel} | ${event.title}`
    : `${t("matchLabel", locale)} ${matchId} | ${event.title}`;

  return {
    title,
    description: match
      ? `${pairingALabel} vs ${pairingBLabel} · ${event.title}`
      : `${t("matchLabel", locale)} ${matchId} · ${event.title}`,
  };
}

export default async function PadelMatchPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const locale = await resolvePageLocale(resolvedSearch);
  const slug = resolvedParams.slug;
  const matchId = Number(resolvedParams.matchId);
  if (!slug || !Number.isFinite(matchId)) notFound();

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
      padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true } },
    },
  });
  if (!event) notFound();

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0], EventAccessMode.INVITE_ONLY);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) notFound();

  const match = await prisma.eventMatchSlot.findFirst({
    where: { id: matchId, eventId: event.id },
    include: {
      court: { select: { name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
  });
  if (!match) notFound();

  const timezone = event.timezone ?? "Europe/Lisbon";
  const startAt = match.startTime ?? match.plannedStartAt ?? match.actualStartAt ?? null;
  const scoreLabel = formatScoreLabel(
    {
      scoreSets: Array.isArray(match.scoreSets) ? (match.scoreSets as Array<{ teamA: number; teamB: number }>) : null,
      score: match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {},
    },
    locale,
  );
  const streamUrl =
    typeof (match.score as Record<string, unknown> | null)?.liveStreamUrl === "string"
      ? ((match.score as Record<string, unknown>).liveStreamUrl as string)
      : event.liveStreamUrl ?? null;

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="orya-page-width space-y-6">
        <Link href={`/eventos/${slug}`} className="text-[12px] uppercase tracking-[0.2em] text-white/60">
          ← {event.title}
        </Link>

        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("matchLabel", locale)}</p>
          <h1 className="text-2xl font-semibold">
            {pairingName(match.pairingA, locale)} vs {pairingName(match.pairingB, locale)}
          </h1>
          <p className="text-sm text-white/70">
            {t("padel", locale)} · {event.title}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("dateTimeLabel", locale)}</p>
            <p className="mt-2 text-sm text-white/90">
              {startAt ? formatDate(startAt, locale, timezone) : "—"}
            </p>
            <p className="text-[12px] text-white/60">
              {startAt ? formatTime(startAt, locale, timezone) : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("courtLabel", locale)}</p>
            <p className="mt-2 text-sm text-white/90">
              {match.court?.name || match.courtName || match.courtNumber || match.courtId || "—"}
            </p>
            <p className="text-[12px] text-white/60">
              {match.roundLabel || match.groupLabel || t("phaseLabel", locale)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("statusLabel", locale)}</p>
            <p className="mt-2 text-sm text-white/90">{match.status}</p>
            <p className="text-[12px] text-white/60">{t("resultLabel", locale)}: {scoreLabel}</p>
          </div>
        </div>

        {streamUrl && (
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
            <a href={streamUrl} target="_blank" rel="noreferrer" className="underline">
              {t("watchStream", locale)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
