"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type LiveResponse = {
  ok: boolean;
  event?: { id: number; slug: string; title: string; timezone: string };
  kpis?: { matchesTotal: number; liveNow: number; officialResults: number; pendingReview: number };
  live_now_by_court?: Array<{
    courtId: number | null;
    courtLabel: string;
    matches: Array<{
      id: number;
      status: string;
      pairingA: string;
      pairingB: string;
      scoreLabel: string;
      roundLabel: string | null;
      startAt: string | null;
    }>;
  }>;
  latest_results_feed?: Array<{
    id: number;
    status: string;
    pairingA: string;
    pairingB: string;
    scoreLabel: string;
    roundLabel: string | null;
    courtLabel: string;
    startAt: string | null;
  }>;
  calendar_days?: Array<{
    date: string;
    courts: Array<{
      courtLabel: string;
      matches: Array<{
        id: number;
        status: string;
        pairingA: string;
        pairingB: string;
        scoreLabel: string;
        startAt: string;
      }>;
    }>;
  }>;
  error?: string;
};

function stateLabel(status: string | null | undefined) {
  if (status === "IN_PROGRESS") return "EM JOGO";
  if (status === "OFFICIAL" || status === "WALKOVER" || status === "RETIRED") return "PÓS-JOGO";
  return "PRÉ-JOGO";
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

function formatMatchTime(startAt: string | null | undefined, timezone?: string) {
  if (!startAt) return "—";
  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || "Europe/Lisbon",
  });
}

export default function MonitorClient({ slug }: { slug: string }) {
  const { data } = useSWR<LiveResponse>(`/api/padel/public/live?slug=${encodeURIComponent(slug)}`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const liveCourts = data?.live_now_by_court ?? [];
  const latest = data?.latest_results_feed ?? [];
  const featuredLiveMatch = liveCourts[0]?.matches?.[0] ?? null;
  const featuredResult = latest[0] ?? null;
  const featured = featuredLiveMatch
    ? {
        courtLabel: liveCourts[0]?.courtLabel ?? "Campo",
        status: featuredLiveMatch.status,
        pairingA: featuredLiveMatch.pairingA,
        pairingB: featuredLiveMatch.pairingB,
        scoreLabel: featuredLiveMatch.scoreLabel,
        roundLabel: featuredLiveMatch.roundLabel,
      }
    : featuredResult
      ? {
          courtLabel: featuredResult.courtLabel,
          status: featuredResult.status,
          pairingA: featuredResult.pairingA,
          pairingB: featuredResult.pairingB,
          scoreLabel: featuredResult.scoreLabel,
          roundLabel: featuredResult.roundLabel,
        }
      : null;

  const upcoming = (data?.calendar_days ?? [])
    .flatMap((day) => day.courts.flatMap((court) => court.matches.map((match) => ({ ...match, courtLabel: court.courtLabel }))))
    .filter((match) => ["PENDING", "IN_PROGRESS", "RESULT_SUBMITTED", "PENDING_CONFIRMATION"].includes(match.status))
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 8);
  const operationalAlerts = (data?.calendar_days ?? [])
    .flatMap((day) =>
      day.courts.flatMap((court) =>
        court.matches.map((match) => ({
          ...match,
          day: day.date,
          courtLabel: court.courtLabel,
        })),
      ),
    )
    .filter((match) =>
      ["PENDING_REVIEW_EXPIRED", "DISPUTED", "PENDING_CONFIRMATION", "RESULT_SUBMITTED"].includes(match.status),
    )
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0f1f3a_0%,#050915_55%,#03050b_100%)] text-white px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-cyan-300/30 bg-black/45 px-6 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">TV MODE</p>
              <h1 className="text-3xl font-semibold">{data?.event?.title ?? "Padel Live"}</h1>
            </div>
            <div className="text-right text-sm text-white/80">
              <p>{stateLabel(featured?.status)}</p>
              <p className="text-[12px] text-cyan-100/80">Atualização automática 5s</p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Jogos</p>
            <p className="mt-1 text-2xl font-semibold">{data?.kpis?.matchesTotal ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/85">Ao vivo</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-50">{data?.kpis?.liveNow ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-sky-100/85">Oficiais</p>
            <p className="mt-1 text-2xl font-semibold text-sky-50">{data?.kpis?.officialResults ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-rose-100/85">Pendentes exp.</p>
            <p className="mt-1 text-2xl font-semibold text-rose-50">{data?.kpis?.pendingReview ?? 0}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-3xl border border-white/15 bg-black/45 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] space-y-5">
            {!featured && <p className="text-white/70">Sem jogo destacado no momento.</p>}
            {featured && (
              <>
                <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">{featured.courtLabel} · {featured.roundLabel || "Jogo"}</p>
                <div className="space-y-3">
                  <p className="text-4xl md:text-5xl font-semibold leading-tight">{featured.pairingA}</p>
                  <p className="text-xl text-white/70">vs</p>
                  <p className="text-4xl md:text-5xl font-semibold leading-tight">{featured.pairingB}</p>
                </div>
                <p className="text-5xl md:text-6xl font-black text-cyan-200">{featured.scoreLabel}</p>
              </>
            )}
          </article>

          <aside className="rounded-3xl border border-white/15 bg-black/45 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] space-y-4">
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Alertas operacionais</p>
            <div className="space-y-2">
              {operationalAlerts.length === 0 && <p className="text-sm text-white/70">Sem alertas ativos.</p>}
              {operationalAlerts.map((match) => (
                <div key={`alert-${match.id}`} className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2">
                  <p className="text-sm font-semibold text-amber-50">
                    {match.pairingA} vs {match.pairingB}
                  </p>
                  <p className="text-[12px] text-amber-100/85">
                    {match.day} · {formatMatchTime(match.startAt, data?.event?.timezone)} · {match.courtLabel}
                  </p>
                  <p className="text-[12px] text-amber-100/90">{formatStatus(match.status)}</p>
                </div>
              ))}
            </div>

            <p className="pt-2 text-[12px] uppercase tracking-[0.2em] text-white/60">Próximos Jogos</p>
            <div className="space-y-2">
              {upcoming.length === 0 && <p className="text-sm text-white/70">Sem jogos previstos.</p>}
              {upcoming.map((match) => (
                <div key={`up-${match.id}`} className="rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold">{match.pairingA} vs {match.pairingB}</p>
                  <p className="text-[12px] text-white/70">
                    {formatMatchTime(match.startAt, data?.event?.timezone)} · {match.courtLabel} · {formatStatus(match.status)}
                  </p>
                  <p className="text-[12px] text-white/60">{match.scoreLabel}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
