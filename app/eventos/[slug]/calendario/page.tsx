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

function resolveView(input: string | null | undefined): ViewKey {
  if (!input) return "calendario";
  const normalized = input.toLowerCase();
  return VIEWS.has(normalized) ? (normalized as ViewKey) : "calendario";
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
  const view = resolveView(viewParam);

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

  const knockoutCandidates = live.calendar_days
    .flatMap((day) => day.courts.flatMap((court) => court.matches))
    .filter((match) => match.roundLabel && !match.groupLabel)
    .slice(0, 40);

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
                href={`${tabBase}?view=${key}`}
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
        </div>
      </section>

      <section className="orya-page-width px-6 pb-16 md:px-10">
        {view === "calendario" && (
          <div className="space-y-4">
            {live.calendar_days.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem jogos agendados.
              </div>
            )}
            {live.calendar_days.map((day) => (
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
                Quadro ainda sem jogos oficiais publicados.
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
            {live.latest_results_feed.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem resultados oficiais ainda.
              </div>
            )}
            {live.latest_results_feed.map((item) => (
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
            {live.upcoming_matches_by_player.length === 0 && (
              <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
                Sem agenda individual disponível.
              </div>
            )}
            {live.upcoming_matches_by_player.map((player) => (
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
