"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EventLiveClientProps = {
  slug: string;
};

export default function EventLiveClient({ slug }: EventLiveClientProps) {
  const searchParams = useSearchParams();
  const url = useMemo(() => {
    const base = `/api/tournaments/${slug}/live`;
    return base;
  }, [slug, searchParams]);

  const { data, error } = useSWR(url, fetcher, { refreshInterval: 10000 });

  if (error) {
    return <div className="p-4 text-white/70">Erro a carregar live.</div>;
  }
  if (!data) {
    return <div className="p-4 text-white/70">A carregar…</div>;
  }
  if (!data?.ok) {
    return (
      <div className="p-4 text-white/70">
        Live indisponivel para este evento.
      </div>
    );
  }

  const tour = data.tournament;
  const stages = tour.stages || [];
  const nextMatch = tour.nextMatch || null;
  const lastMatch = tour.lastMatch || null;
  const pairingIdFromQuery = searchParams?.get("pairingId");

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Live</p>
          <h1 className="text-xl font-semibold text-white">{data.event?.title ?? "Evento"}</h1>
          <p className="text-white/70 text-sm">Formato: {tour.format}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
          <p>Proximo jogo: {nextMatch ? `#${nextMatch.id}` : "—"}</p>
          <p>Ultimo: {lastMatch ? `#${lastMatch.id}` : "—"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stages.map((s: any) => (
          <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">{s.name || s.stageType}</p>
              <span className="text-[11px] text-white/60">{s.stageType}</span>
            </div>
            {s.groups.map((g: any) => (
              <div key={g.id} className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1">
                <p className="text-white text-sm">{g.name}</p>
                {g.standings?.length ? (
                  <div className="space-y-1 text-[12px] text-white/80">
                    {g.standings.map((st: any, idx: number) => (
                      <div
                        key={st.pairingId}
                        className={`flex items-center justify-between rounded border px-2 py-1 ${
                          pairingIdFromQuery && `${st.pairingId}` === pairingIdFromQuery
                            ? "border-emerald-400/60 bg-emerald-500/10"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <span className="text-white">{idx + 1}o · Dupla #{st.pairingId}</span>
                        <span className="text-white/60">V {st.wins} · Sets {st.setDiff}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/60">Sem standings.</p>
                )}
                <div className="text-[12px] text-white/70 space-y-1">
                  {g.matches.map((m: any) => (
                    <div
                      key={m.id}
                      className={`rounded border px-2 py-1 flex items-center justify-between ${
                        pairingIdFromQuery &&
                        (`${m.pairing1Id}` === pairingIdFromQuery || `${m.pairing2Id}` === pairingIdFromQuery)
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                      <span className="text-white/60">{m.statusLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {s.matches.length > 0 && (
              <div className="space-y-1 text-[12px] text-white/80">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Playoffs</p>
                {s.matches.map((m: any) => (
                  <div
                    key={m.id}
                    className={`rounded border px-2 py-1 flex items-center justify-between ${
                      pairingIdFromQuery &&
                      (`${m.pairing1Id}` === pairingIdFromQuery || `${m.pairing2Id}` === pairingIdFromQuery)
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                    <span className="text-white/60">{m.statusLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
