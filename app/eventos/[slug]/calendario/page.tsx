import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";
import { resolveLocale, t } from "@/lib/i18n";

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

const VIEWS = new Set(["calendario", "grupos", "quadro", "resultados", "participantes"]);

type ViewKey = "calendario" | "grupos" | "quadro" | "resultados" | "participantes";
type StatusFilterKey =
  | "all"
  | "in_progress"
  | "pending_confirmation"
  | "pending_review_expired"
  | "disputed"
  | "official";
type ScheduledMatchView = {
  id: number;
  status: string;
  roundLabel: string | null;
  groupLabel: string | null;
  startAt: string;
  endAt: string | null;
  courtId: number | null;
  courtLabel: string;
  pairingA: string;
  pairingB: string;
  scoreLabel: string;
  day: string;
};

const STATUS_FILTERS = new Set<StatusFilterKey>([
  "all",
  "in_progress",
  "pending_confirmation",
  "pending_review_expired",
  "disputed",
  "official",
]);

function resolveView(input: string | null | undefined): ViewKey {
  if (!input) return "calendario";
  const normalized = input.toLowerCase();
  return VIEWS.has(normalized) ? (normalized as ViewKey) : "calendario";
}

function resolveStatusFilter(input: string | null | undefined): StatusFilterKey {
  if (!input) return "all";
  const normalized = input.toLowerCase() as StatusFilterKey;
  return STATUS_FILTERS.has(normalized) ? normalized : "all";
}

function statusFilterLabel(value: StatusFilterKey) {
  switch (value) {
    case "in_progress":
      return "Em jogo";
    case "pending_confirmation":
      return "Pendente confirmação";
    case "pending_review_expired":
      return "Pendente expirado";
    case "disputed":
      return "Disputa";
    case "official":
      return "Oficiais";
    case "all":
    default:
      return "Todos";
  }
}

function isOfficialStatus(status: string) {
  return status === "OFFICIAL" || status === "WALKOVER" || status === "RETIRED";
}

function matchStatusMatchesFilter(status: string, filter: StatusFilterKey) {
  if (filter === "all") return true;
  if (filter === "in_progress") return status === "IN_PROGRESS";
  if (filter === "pending_confirmation") return status === "PENDING_CONFIRMATION";
  if (filter === "pending_review_expired") return status === "PENDING_REVIEW_EXPIRED";
  if (filter === "disputed") return status === "DISPUTED";
  if (filter === "official") return isOfficialStatus(status);
  return true;
}

function toDayKey(value: string | null | undefined, timezone: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", { timeZone: timezone });
}

function formatStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em curso";
    case "RESULT_SUBMITTED":
      return "Resultado submetido";
    case "PENDING_CONFIRMATION":
      return "Pendente confirmação";
    case "PENDING_REVIEW_EXPIRED":
      return "Pendente expirado";
    case "DISPUTED":
      return "Em disputa";
    case "OFFICIAL":
      return "Oficial";
    case "WALKOVER":
      return "WO";
    case "RETIRED":
      return "Desistência";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

function formatDateTime(value: string | null, locale: string, timezone: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale === "pt" ? "pt-PT" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EventCalendarPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await Promise.resolve(searchParams) : {};
  const viewParam =
    typeof resolvedSearch?.view === "string"
      ? resolvedSearch.view
      : Array.isArray(resolvedSearch?.view)
        ? resolvedSearch.view[0]
        : null;
  const statusParam =
    typeof resolvedSearch?.status === "string"
      ? resolvedSearch.status
      : Array.isArray(resolvedSearch?.status)
        ? resolvedSearch.status[0]
        : null;
  const dayParam =
    typeof resolvedSearch?.day === "string"
      ? resolvedSearch.day
      : Array.isArray(resolvedSearch?.day)
        ? resolvedSearch.day[0]
        : null;
  const courtParam =
    typeof resolvedSearch?.court === "string"
      ? resolvedSearch.court
      : Array.isArray(resolvedSearch?.court)
        ? resolvedSearch.court[0]
        : null;
  const view = resolveView(viewParam);
  const statusFilter = resolveStatusFilter(statusParam);

  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(acceptLanguage ? acceptLanguage.split(",")[0] : null);

  const event = await prisma.event.findUnique({
    where: { slug: resolvedParams.slug, isDeleted: false },
    select: { id: true, slug: true, templateType: true },
  });
  if (!event) redirect("/?tab=torneios");
  if (event.templateType !== "PADEL") redirect(`/eventos/${event.slug}`);

  const live = await buildPadelLiveReadModel({
    eventId: event.id,
    visibility: "public",
  });
  if (!live) notFound();
  if (!live.event.isPublicEvent) redirect(`/eventos/${event.slug}`);

  const tabBase = `/eventos/${event.slug}/calendario`;
  const allScheduledMatches: ScheduledMatchView[] = live.calendar_days.flatMap((day) =>
    day.courts.flatMap((court) =>
      court.matches.map((match) => ({
        ...match,
        courtId: court.courtId ?? null,
        courtLabel: court.courtLabel,
        day: day.date,
      })),
    ),
  );
  const availableDays = Array.from(new Set(live.calendar_days.map((day) => day.date))).sort((a, b) =>
    a.localeCompare(b),
  );
  const availableCourts = Array.from(new Set(allScheduledMatches.map((match) => match.courtLabel))).sort((a, b) =>
    a.localeCompare(b),
  );
  const dayFilter = dayParam && availableDays.includes(dayParam) ? dayParam : null;
  const courtFilter = courtParam && availableCourts.includes(courtParam) ? courtParam : null;
  const matchPassesFilters = (match: ScheduledMatchView) => {
    if (!matchStatusMatchesFilter(match.status, statusFilter)) return false;
    if (dayFilter && match.day !== dayFilter) return false;
    if (courtFilter && match.courtLabel !== courtFilter) return false;
    return true;
  };
  const filteredCalendarDays = live.calendar_days
    .map((day) => ({
      date: day.date,
      courts: day.courts
        .map((court) => ({
          courtId: court.courtId,
          courtLabel: court.courtLabel,
          matches: court.matches.filter((match) =>
            matchPassesFilters({
              ...match,
              courtId: court.courtId ?? null,
              courtLabel: court.courtLabel,
              day: day.date,
            }),
          ),
        }))
        .filter((court) => court.matches.length > 0),
    }))
    .filter((day) => day.courts.length > 0);
  const knockoutCandidates = allScheduledMatches
    .filter((match) => match.roundLabel && !match.groupLabel)
    .filter(matchPassesFilters)
    .slice(0, 40);
  const filteredResultsFeed = live.latest_results_feed
    .filter((item) => {
      if (!matchStatusMatchesFilter(item.status, statusFilter)) return false;
      if (courtFilter && item.courtLabel !== courtFilter) return false;
      if (dayFilter) {
        const dayKey = toDayKey(item.startAt, live.event.timezone);
        if (!dayKey || dayKey !== dayFilter) return false;
      }
      return true;
    })
    .slice(0, 30);
  const filteredUpcomingByPlayer = live.upcoming_matches_by_player
    .map((player) => ({
      playerLabel: player.playerLabel,
      matches: player.matches.filter((match) => {
        if (!matchStatusMatchesFilter(match.status, statusFilter)) return false;
        if (courtFilter && match.courtLabel !== courtFilter) return false;
        if (dayFilter) {
          const dayKey = toDayKey(match.startAt, live.event.timezone);
          if (!dayKey || dayKey !== dayFilter) return false;
        }
        return true;
      }),
    }))
    .filter((player) => player.matches.length > 0);
  const liveAlerts = allScheduledMatches
    .filter((match) =>
      ["PENDING_REVIEW_EXPIRED", "DISPUTED", "PENDING_CONFIRMATION", "RESULT_SUBMITTED"].includes(match.status),
    )
    .filter(matchPassesFilters)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 8);
  const liveSummary = {
    inProgress: allScheduledMatches.filter((match) => match.status === "IN_PROGRESS").length,
    pendingConfirmation: allScheduledMatches.filter((match) => match.status === "PENDING_CONFIRMATION").length,
    pendingReviewExpired: allScheduledMatches.filter((match) => match.status === "PENDING_REVIEW_EXPIRED").length,
    disputed: allScheduledMatches.filter((match) => match.status === "DISPUTED").length,
  };
  const buildViewHref = (
    nextView: ViewKey,
    nextStatus: StatusFilterKey = statusFilter,
    nextDay: string | null = dayFilter,
    nextCourt: string | null = courtFilter,
  ) => {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextDay) params.set("day", nextDay);
    if (nextCourt) params.set("court", nextCourt);
    return `${tabBase}?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e1b4b_0%,#0b1024_35%,#050711_100%)] text-white">
      <section className="orya-page-width px-6 pt-10 pb-8 md:px-10">
        <div className="rounded-3xl border border-white/15 bg-black/35 p-6 backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.55)] space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">Padel Live</p>
              <h1 className="text-3xl font-semibold">{live.event.title}</h1>
              <p className="text-sm text-white/70">Agora por campo, calendário completo e estado competitivo em tempo real.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Link href={`/eventos/${event.slug}`} className="rounded-full border border-white/25 bg-white/5 px-3 py-1 hover:bg-white/10">
                Página pública
              </Link>
              <Link href={`/eventos/${event.slug}/monitor`} className="rounded-full border border-cyan-300/45 bg-cyan-400/10 px-3 py-1 hover:bg-cyan-400/20">
                TV Mode
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Jogos</p>
              <p className="mt-1 text-2xl font-semibold">{live.kpis.matchesTotal}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/80">Ao vivo</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-50">{live.kpis.liveNow}</p>
            </div>
            <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-sky-100/80">Oficiais</p>
              <p className="mt-1 text-2xl font-semibold text-sky-50">{live.kpis.officialResults}</p>
            </div>
            <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-rose-100/80">Pendentes exp.</p>
              <p className="mt-1 text-2xl font-semibold text-rose-50">{live.kpis.pendingReview}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Agora por campo</p>
            <div className="grid gap-3 md:grid-cols-2">
              {live.live_now_by_court.length === 0 && (
                <div className="rounded-xl border border-white/12 bg-white/5 px-4 py-4 text-[13px] text-white/70">
                  Sem jogos em curso neste momento.
                </div>
              )}
              {live.live_now_by_court.map((court) => (
                <div key={`live-court-${court.courtLabel}`} className="rounded-xl border border-white/12 bg-black/30 px-4 py-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{court.courtLabel}</p>
                  {court.matches.map((match) => (
                    <div key={`live-match-${match.id}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-sm font-semibold">{match.pairingA} vs {match.pairingB}</p>
                      <p className="text-[12px] text-white/70">{formatStatus(match.status)} · {match.scoreLabel}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 text-[12px]">
            {([
              ["calendario", "Calendário"],
              ["grupos", "Grupos"],
              ["quadro", "Quadro"],
              ["resultados", "Resultados"],
              ["participantes", "Participantes"],
            ] as Array<[ViewKey, string]>).map(([key, label]) => (
              <Link
                key={`tab-${key}`}
                href={buildViewHref(key)}
                className={`rounded-full border px-3 py-1 ${
                  view === key
                    ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                    : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="rounded-2xl border border-white/12 bg-black/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Filtros rápidos</p>
              <span className="text-[11px] text-white/60">
                Estado: {statusFilterLabel(statusFilter)}
                {dayFilter ? ` · Dia ${dayFilter}` : ""}
                {courtFilter ? ` · ${courtFilter}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {(["all", "in_progress", "pending_confirmation", "pending_review_expired", "disputed", "official"] as StatusFilterKey[]).map(
                (status) => (
                  <Link
                    key={`status-filter-${status}`}
                    href={buildViewHref(view, status)}
                    className={`rounded-full border px-3 py-1 ${
                      statusFilter === status
                        ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                        : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {statusFilterLabel(status)}
                  </Link>
                ),
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Link
                href={buildViewHref(view, statusFilter, null)}
                className={`rounded-full border px-3 py-1 ${
                  dayFilter === null
                    ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                    : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                }`}
              >
                Todos os dias
              </Link>
              {availableDays.map((day) => (
                <Link
                  key={`day-filter-${day}`}
                  href={buildViewHref(view, statusFilter, day)}
                  className={`rounded-full border px-3 py-1 ${
                    dayFilter === day
                      ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                      : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  {day}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Link
                href={buildViewHref(view, statusFilter, dayFilter, null)}
                className={`rounded-full border px-3 py-1 ${
                  courtFilter === null
                    ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                    : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                }`}
              >
                Todos os campos
              </Link>
              {availableCourts.map((courtLabel) => (
                <Link
                  key={`court-filter-${courtLabel}`}
                  href={buildViewHref(view, statusFilter, dayFilter, courtLabel)}
                  className={`rounded-full border px-3 py-1 ${
                    courtFilter === courtLabel
                      ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                      : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  {courtLabel}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/80">Em jogo</p>
              <p className="mt-1 text-xl font-semibold text-emerald-50">{liveSummary.inProgress}</p>
            </div>
            <div className="rounded-xl border border-sky-300/30 bg-sky-400/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-sky-100/80">Pend. conf.</p>
              <p className="mt-1 text-xl font-semibold text-sky-50">{liveSummary.pendingConfirmation}</p>
            </div>
            <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-rose-100/80">Pend. exp.</p>
              <p className="mt-1 text-xl font-semibold text-rose-50">{liveSummary.pendingReviewExpired}</p>
            </div>
            <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/80">Disputa</p>
              <p className="mt-1 text-xl font-semibold text-amber-50">{liveSummary.disputed}</p>
            </div>
          </div>

          {liveAlerts.length > 0 && (
            <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-100/90">Alertas live</p>
              <div className="grid gap-2 md:grid-cols-2">
                {liveAlerts.map((match) => (
                  <div key={`alert-${match.id}`} className="rounded-lg border border-amber-200/25 bg-black/25 px-3 py-2">
                    <p className="text-sm font-semibold text-amber-50">
                      {match.pairingA} vs {match.pairingB}
                    </p>
                    <p className="text-[12px] text-amber-100/85">
                      {formatDateTime(match.startAt, locale, live.event.timezone)} · {match.courtLabel} · {formatStatus(match.status)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="orya-page-width px-6 pb-16 md:px-10">
        {view === "calendario" && (
          <div className="space-y-4">
            {filteredCalendarDays.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem jogos agendados para o filtro atual.
              </div>
            )}
            {filteredCalendarDays.map((day) => (
              <div key={`day-${day.date}`} className="rounded-2xl border border-white/12 bg-black/30 p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{day.date}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {day.courts.map((court) => (
                    <div key={`court-${day.date}-${court.courtLabel}`} className="rounded-xl border border-white/12 bg-white/5 p-3 space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">{court.courtLabel}</p>
                      {court.matches.map((match) => (
                        <div key={`schedule-${match.id}`} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                          <p className="font-semibold">{match.pairingA} vs {match.pairingB}</p>
                          <p className="text-[12px] text-white/70">{formatDateTime(match.startAt, locale, live.event.timezone)} · {formatStatus(match.status)}</p>
                          <p className="text-[12px] text-white/70">{match.scoreLabel}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "grupos" && (
          <div className="space-y-4">
            {live.standings_with_tiebreak_explain.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem classificações de grupos disponíveis.
              </div>
            )}
            {live.standings_with_tiebreak_explain.map((group) => (
              <div key={`group-${group.groupLabel}`} className="rounded-2xl border border-white/12 bg-black/30 p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Grupo {group.groupLabel || "?"}</p>
                <div className="space-y-2">
                  {group.rows.map((row) => (
                    <div key={`row-${group.groupLabel}-${row.entityId}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <p className="font-semibold">#{row.rank} · {row.label}</p>
                        <p className="text-white/70">{row.points} pts · {row.wins}V-{row.losses}D</p>
                      </div>
                      <p className="text-[12px] text-white/65">{row.tiebreakExplanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "quadro" && (
          <div className="space-y-4">
            {knockoutCandidates.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Quadro sem jogos para o filtro atual.
              </div>
            )}
            {knockoutCandidates.map((match) => (
              <div key={`ko-${match.id}`} className="rounded-2xl border border-white/12 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{match.roundLabel || "Eliminatória"}</p>
                <p className="text-sm font-semibold mt-1">{match.pairingA} vs {match.pairingB}</p>
                <p className="text-[12px] text-white/70">{formatDateTime(match.startAt, locale, live.event.timezone)} · {formatStatus(match.status)} · {match.scoreLabel}</p>
              </div>
            ))}
          </div>
        )}

        {view === "resultados" && (
          <div className="space-y-3">
            {filteredResultsFeed.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem resultados para o filtro atual.
              </div>
            )}
            {filteredResultsFeed.map((item) => (
              <div key={`result-${item.id}`} className="rounded-2xl border border-white/12 bg-black/30 p-4 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{item.courtLabel} · {item.roundLabel || item.groupLabel || "Jogo"}</p>
                <p className="text-sm font-semibold">{item.pairingA} vs {item.pairingB}</p>
                <p className="text-[12px] text-white/70">{formatDateTime(item.startAt, locale, live.event.timezone)} · {item.scoreLabel}</p>
              </div>
            ))}
          </div>
        )}

        {view === "participantes" && (
          <div className="space-y-3">
            {filteredUpcomingByPlayer.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem agenda individual para o filtro atual.
              </div>
            )}
            {filteredUpcomingByPlayer.map((player) => (
              <div key={`player-${player.playerLabel}`} className="rounded-2xl border border-white/12 bg-black/30 p-4 space-y-2">
                <p className="text-sm font-semibold">{player.playerLabel}</p>
                <div className="space-y-1">
                  {player.matches.slice(0, 3).map((match) => (
                    <p key={`player-match-${player.playerLabel}-${match.id}`} className="text-[12px] text-white/70">
                      {formatDateTime(match.startAt, locale, live.event.timezone)} · {match.courtLabel} · {match.pairingA} vs {match.pairingB}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
