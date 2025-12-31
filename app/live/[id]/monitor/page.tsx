// app/live/[id]/monitor/page.tsx
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

async function getStructure(id: number) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/tournaments/${id}/monitor`, {
    cache: "force-cache",
    next: { revalidate: 10 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MonitorPage({ params }: PageProps) {
  const resolved = await params;
  const tournamentId = Number(resolved.id);
  if (!Number.isFinite(tournamentId)) notFound();

  const data = await getStructure(tournamentId);
  if (!data?.ok) notFound();

  const tournament = data.tournament;
  const matches = tournament.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)]);
  const now = new Date();

  const upcoming = matches
    .filter((m: any) => m.startAt && new Date(m.startAt) > now && m.status !== "DONE")
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 8);
  const live = matches.filter((m: any) => m.status === "IN_PROGRESS").slice(0, 6);

  return (
    <div className="min-h-screen text-white p-4">
      <div className="orya-page-width space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Monitor</p>
            <h1 className="text-2xl font-semibold">{tournament?.event?.title ?? "Torneio"}</h1>
            <p className="text-white/60 text-sm">Formato: {tournament.format}</p>
          </div>
          <p className="text-white/60 text-sm">Atualiza a cada ~10s</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Em curso</h2>
              <span className="text-white/60 text-sm">{live.length} jogo(s)</span>
            </div>
            {live.length === 0 && <p className="text-white/60 text-sm">Sem jogos em curso.</p>}
            {live.map((m: any) => (
              <div key={m.id} className="rounded-lg border border-green-400/30 bg-green-500/10 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                  <span className="text-[11px] text-white/70">{m.statusLabel}</span>
                </div>
                <p className="text-[11px] text-white/60">Court {m.courtId ?? "—"} · {m.startAt ? new Date(m.startAt).toLocaleTimeString("pt-PT") : "—"}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Próximos</h2>
              <span className="text-white/60 text-sm">{upcoming.length} agendados</span>
            </div>
            {upcoming.length === 0 && <p className="text-white/60 text-sm">Sem jogos agendados.</p>}
            {upcoming.map((m: any) => (
              <div key={m.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                  <span className="text-[11px] text-white/70">{m.statusLabel}</span>
                </div>
                <p className="text-[11px] text-white/60">Court {m.courtId ?? "—"} · {m.startAt ? new Date(m.startAt).toLocaleTimeString("pt-PT") : "—"}</p>
              </div>
            ))}
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Chave / Grupos</h2>
            <span className="text-white/60 text-sm">Resumo</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tournament.stages.map((stage: any) => (
              <div key={stage.id} className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-1">
                <p className="text-white font-semibold">{stage.name || stage.stageType}</p>
                {stage.groups.map((g: any) => (
                  <div key={g.id} className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-1 text-[12px] text-white/80">
                    <p className="text-white text-sm">{g.name}</p>
                    <p className="text-white/60 text-[11px]">Jogos: {g.matches.length}</p>
                    {g.standings?.length ? (
                      <div className="space-y-1">
                        {g.standings.slice(0, 4).map((s: any, idx: number) => (
                          <div key={s.pairingId} className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1">
                            <span className="text-white">{idx + 1}º · Dupla #{s.pairingId}</span>
                            <span className="text-white/60">V {s.wins} · Sets {s.setDiff}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/60">Sem standings.</p>
                    )}
                  </div>
                ))}
                {stage.matches.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80 space-y-1">
                    <p className="text-white text-sm">Playoffs</p>
                    {stage.matches.slice(0, 4).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1">
                        <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                        <span className="text-white/60 text-[11px]">{m.statusLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
