import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { EventAccessMode } from "@prisma/client";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { formatTime, resolveLocale, t } from "@/lib/i18n";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
};

type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
};

const pairingLabel = (slots: PairingSlot[] | undefined, fallback: string) => {
  const names =
    slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  if (names.length === 0) return fallback;
  return names.slice(0, 2).join(" / ");
};

export default async function PadelMonitorPage({ params, searchParams }: PageProps) {
  const resolved = await params;
  const slug = resolved.slug;
  if (!slug) notFound();
  const lang = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  const locale = resolveLocale(lang);

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      status: true,
      timezone: true,
      padelTournamentConfig: { select: { advancedSettings: true } },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
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

  const tvMonitor = ((event.padelTournamentConfig?.advancedSettings as any)?.tvMonitor ?? {}) as {
    footerText?: string | null;
    sponsors?: string[];
  };

  const matches = await prisma.padelMatch.findMany({
    where: {
      eventId: event.id,
      OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
    },
    include: {
      court: { select: { name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const now = new Date();
  const withTime = matches
    .map((m) => ({
      ...m,
      matchStart: m.plannedStartAt ?? m.startTime,
    }))
    .filter((m) => m.matchStart);

  const live = withTime
    .filter((m) => m.status === "IN_PROGRESS")
    .slice(0, 6);
  const upcoming = withTime
    .filter((m) => m.status !== "DONE" && m.status !== "CANCELLED" && m.matchStart && m.matchStart > now)
    .slice(0, 10);

  return (
    <div className="min-h-screen text-white px-4 py-6">
      <div className="orya-page-width space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("monitorTitle", locale)}</p>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-white/60 text-sm">{t("monitorSubtitle", locale)}</p>
          </div>
          <div className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] text-white/70">
            {t("padel", locale)}
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("liveMatches", locale)}</h2>
              <span className="text-white/60 text-sm">
                {live.length} {t("matches", locale)}
              </span>
            </div>
            {live.length === 0 && <p className="text-white/60 text-sm">{t("noLiveMatches", locale)}</p>}
            {live.map((m) => (
              <div
                key={`live-${m.id}`}
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 space-y-1"
              >
                <p className="text-sm font-semibold">
                  {pairingLabel(m.pairingA?.slots, `${t("pairing", locale)} #${m.pairingAId ?? "?"}`)} vs{" "}
                  {pairingLabel(m.pairingB?.slots, `${t("pairing", locale)} #${m.pairingBId ?? "?"}`)}
                </p>
                <p className="text-[12px] text-white/70">
                  {m.court?.name || m.courtName || m.courtNumber || m.courtId || t("court", locale)} ·{" "}
                  {m.matchStart ? formatTime(m.matchStart, locale, event.timezone) : "—"}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("upcomingMatches", locale)}</h2>
              <span className="text-white/60 text-sm">{upcoming.length}</span>
            </div>
            {upcoming.length === 0 && <p className="text-white/60 text-sm">{t("noUpcomingMatches", locale)}</p>}
            {upcoming.map((m) => (
              <div
                key={`up-${m.id}`}
                className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 space-y-1"
              >
                <p className="text-sm font-semibold">
                  {pairingLabel(m.pairingA?.slots, `${t("pairing", locale)} #${m.pairingAId ?? "?"}`)} vs{" "}
                  {pairingLabel(m.pairingB?.slots, `${t("pairing", locale)} #${m.pairingBId ?? "?"}`)}
                </p>
                <p className="text-[12px] text-white/70">
                  {m.court?.name || m.courtName || m.courtNumber || m.courtId || t("court", locale)} ·{" "}
                  {m.matchStart ? formatTime(m.matchStart, locale, event.timezone) : "—"}
                </p>
              </div>
            ))}
          </section>
        </div>

        {(tvMonitor?.sponsors?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("sponsors", locale)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(tvMonitor.sponsors ?? []).map((sponsor) => (
                <span
                  key={sponsor}
                  className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[12px] text-white/80"
                >
                  {sponsor}
                </span>
              ))}
            </div>
          </section>
        )}

        {tvMonitor?.footerText && (
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
            {tvMonitor.footerText}
          </div>
        )}
      </div>
    </div>
  );
}
