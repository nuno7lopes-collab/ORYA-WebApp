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
    .slice(0, 8);

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
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Próximos Jogos</p>
            <div className="space-y-2">
              {upcoming.length === 0 && <p className="text-sm text-white/70">Sem jogos previstos.</p>}
              {upcoming.map((match) => (
                <div key={`up-${match.id}`} className="rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold">{match.pairingA} vs {match.pairingB}</p>
                  <p className="text-[12px] text-white/70">{match.courtLabel} · {match.scoreLabel}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
