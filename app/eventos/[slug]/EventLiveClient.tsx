"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LiveHubModule, LiveHubViewerRole } from "@/lib/liveHubConfig";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const LOCALE = "pt-PT";

type PairingMeta = {
  id: number;
  label: string;
  subLabel?: string | null;
  avatarUrl?: string | null;
};

type EventPayload = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: string;
  locationName: string;
  locationCity: string | null;
  coverImageUrl: string | null;
  liveStreamUrl: string | null;
  liveHubMode: "DEFAULT" | "PREMIUM";
};

type MatchPayload = {
  id: number;
  stageId: number;
  groupId?: number | null;
  pairing1Id?: number | null;
  pairing2Id?: number | null;
  round?: number | null;
  roundLabel?: string | null;
  startAt?: string | null;
  status: string;
  statusLabel: string;
  score?: { sets?: Array<{ a: number; b: number }> } | null;
  updatedAt?: string | null;
};

function formatDateRange(start?: string, end?: string) {
  if (!start) return "";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const day = startDate.toLocaleDateString(LOCALE, { day: "2-digit", month: "long" });
  const time = startDate.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  if (!endDate) return `${day} · ${time}`;
  const endTime = endDate.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time} - ${endTime}`;
}

function formatScore(score?: MatchPayload["score"]) {
  if (!score?.sets?.length) return "—";
  return score.sets.map((s) => `${s.a}-${s.b}`).join(" · ");
}

function getEmbedUrl(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return url;
  } catch {
    return null;
  }
}

function pairingLabel(id: number | null | undefined, pairings: Record<number, PairingMeta>) {
  if (!id) return "TBD";
  return pairings[id]?.label ?? `#${id}`;
}

function pairingMeta(id: number | null | undefined, pairings: Record<number, PairingMeta>) {
  if (!id) return null;
  return pairings[id] ?? null;
}

function RoleBadge({ role }: { role: LiveHubViewerRole }) {
  const style =
    role === "ORGANIZER"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : role === "PARTICIPANT"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
        : "border-white/15 bg-white/5 text-white/70";
  const label = role === "ORGANIZER" ? "Organizador" : role === "PARTICIPANT" ? "Participante" : "Público";
  return <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${style}`}>{label}</span>;
}

function MatchCard({ match, pairings, highlight }: { match: MatchPayload; pairings: Record<number, PairingMeta>; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm transition ${
        highlight ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-white font-medium">
            {pairingLabel(match.pairing1Id, pairings)} <span className="text-white/40">vs</span>{" "}
            {pairingLabel(match.pairing2Id, pairings)}
          </p>
          <p className="text-[11px] text-white/60">
            Jogo #{match.id} {match.round ? `· R${match.round}` : ""}{" "}
            {match.startAt ? `· ${new Date(match.startAt).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{match.statusLabel}</p>
          <p className="text-white/80 text-xs">{formatScore(match.score)}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      <p className="text-white font-semibold">{title}</p>
      <p className="mt-2 text-white/60">{children}</p>
    </div>
  );
}

function OrganizerMatchEditor({
  match,
  tournamentId,
  onUpdated,
}: {
  match: MatchPayload;
  tournamentId: number;
  onUpdated: () => void;
}) {
  const initialSets = match.score?.sets?.length
    ? match.score.sets.map((s) => ({ a: s.a, b: s.b }))
    : [
        { a: 0, b: 0 },
        { a: 0, b: 0 },
      ];
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(initialSets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!match.updatedAt) {
      setError("Sem versão do jogo.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: { sets },
        expectedUpdatedAt: match.updatedAt,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!json?.ok) {
      setError(json?.error || "Falha ao guardar resultado.");
      return;
    }
    setOpen(false);
    onUpdated();
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm">Editar resultado</span>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
        >
          {open ? "Fechar" : "Abrir"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 text-xs text-white/70">
          {sets.map((set, idx) => (
            <div key={`${match.id}-set-${idx}`} className="flex items-center gap-2">
              <span className="w-10">Set {idx + 1}</span>
              <input
                type="number"
                min={0}
                value={set.a}
                onChange={(e) => {
                  const next = [...sets];
                  next[idx] = { ...next[idx], a: Number(e.target.value) };
                  setSets(next);
                }}
                className="w-14 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-white"
              />
              <span className="text-white/40">-</span>
              <input
                type="number"
                min={0}
                value={set.b}
                onChange={(e) => {
                  const next = [...sets];
                  next[idx] = { ...next[idx], b: Number(e.target.value) };
                  setSets(next);
                }}
                className="w-14 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-white"
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {sets.length < 3 && (
              <button
                type="button"
                onClick={() => setSets((prev) => [...prev, { a: 0, b: 0 }])}
                className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
              >
                Adicionar set
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60"
            >
              {saving ? "A guardar..." : "Guardar resultado"}
            </button>
            {error && <span className="text-rose-300">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveHubTv({
  event,
  tournament,
  pairings,
}: {
  event: EventPayload;
  tournament: any;
  pairings: Record<number, PairingMeta>;
}) {
  const matches = tournament.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)]);
  const now = new Date();

  const upcoming = matches
    .filter((m: MatchPayload) => m.startAt && new Date(m.startAt) > now && m.status !== "DONE")
    .sort((a: MatchPayload, b: MatchPayload) =>
      a.startAt && b.startAt ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime() : 0,
    )
    .slice(0, 6);

  const live = matches.filter((m: MatchPayload) => m.status === "IN_PROGRESS").slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">Modo TV</p>
          <h1 className="text-3xl font-semibold text-white">{event.title}</h1>
          <p className="text-white/60">{formatDateRange(event.startsAt, event.endsAt)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
          Atualiza automaticamente
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Em jogo</h2>
            <span className="text-white/60 text-sm">{live.length} ativos</span>
          </div>
          {live.length === 0 && <p className="text-white/60">Sem jogos em curso.</p>}
          {live.map((m: MatchPayload) => (
            <MatchCard key={`live-${m.id}`} match={m} pairings={pairings} />
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Próximos</h2>
            <span className="text-white/60 text-sm">{upcoming.length} agendados</span>
          </div>
          {upcoming.length === 0 && <p className="text-white/60">Sem jogos agendados.</p>}
          {upcoming.map((m: MatchPayload) => (
            <MatchCard key={`up-${m.id}`} match={m} pairings={pairings} />
          ))}
        </section>
      </div>
    </div>
  );
}

export default function EventLiveClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [showFullBracket, setShowFullBracket] = useState(false);
  const isTv = searchParams?.get("tv") === "1";

  const url = useMemo(() => `/api/livehub/${slug}`, [slug]);
  const { data, error, mutate } = useSWR(url, fetcher, { refreshInterval: 10000 });

  if (error) {
    return <div className="p-4 text-white/70">Erro a carregar live.</div>;
  }
  if (!data) {
    return <div className="p-4 text-white/70">A carregar…</div>;
  }
  if (!data?.ok) {
    return <div className="p-4 text-white/70">Live indisponível para este evento.</div>;
  }

  const event: EventPayload = data.event;
  const organizer = data.organizer;
  const viewerRole: LiveHubViewerRole = data.viewerRole;
  const liveHub = data.liveHub as { modules: LiveHubModule[]; mode: "DEFAULT" | "PREMIUM" };
  const tournament = data.tournament;
  const pairings: Record<number, PairingMeta> = data.pairings || {};
  const pairingIdFromQuery = searchParams?.get("pairingId");

  if (isTv && tournament) {
    return <LiveHubTv event={event} tournament={tournament} pairings={pairings} />;
  }

  const flatMatches: MatchPayload[] = tournament
    ? tournament.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)])
    : [];

  const upcomingMatches = flatMatches
    .filter((m) => m.status !== "DONE")
    .sort((a, b) => {
      const userPairingId = tournament?.userPairingId as number | null;
      if (userPairingId) {
        const aMine = a.pairing1Id === userPairingId || a.pairing2Id === userPairingId;
        const bMine = b.pairing1Id === userPairingId || b.pairing2Id === userPairingId;
        if (aMine !== bMine) return aMine ? -1 : 1;
      }
      if (a.startAt && b.startAt) return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return 0;
    })
    .slice(0, 6);

  const recentResults = flatMatches
    .filter((m) => m.status === "DONE")
    .sort((a, b) =>
      a.updatedAt && b.updatedAt ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : 0,
    )
    .slice(0, 6);

  const modules = liveHub?.modules ?? [];

  const renderModule = (mod: LiveHubModule) => {
    switch (mod) {
      case "HERO": {
        return (
          <section key="hero" className="rounded-3xl border border-white/10 bg-black/40 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">LiveHub</p>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{event.title}</h1>
                <p className="text-white/70 text-sm">{formatDateRange(event.startsAt, event.endsAt)}</p>
                {event.locationName && (
                  <p className="text-white/50 text-sm">
                    {event.locationName}{event.locationCity ? ` · ${event.locationCity}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={viewerRole} />
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
                  {event.liveHubMode === "PREMIUM" ? "Premium" : "Default"}
                </span>
              </div>
            </div>

            {organizer && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/10">
                  {organizer.brandingAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={organizer.brandingAvatarUrl} alt="Organizador" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                      {organizer.publicName?.slice(0, 2) ?? "OR"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Organizado por</p>
                  <p className="text-white font-medium">{organizer.publicName}</p>
                  {organizer.username && <p className="text-white/50 text-xs">@{organizer.username}</p>}
                </div>
              </div>
            )}
          </section>
        );
      }
      case "VIDEO": {
        const embedUrl = getEmbedUrl(event.liveStreamUrl);
        if (!embedUrl) {
          return <EmptyCard key="video" title="Live" children="Nenhum stream disponível para este evento." />;
        }
        return (
          <section key="video" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Live</p>
                <h2 className="text-lg font-semibold text-white">Assistir agora</h2>
              </div>
              <a
                href={event.liveStreamUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
              >
                Abrir no YouTube
              </a>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              <iframe
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                title="Live stream"
              />
            </div>
          </section>
        );
      }
      case "NEXT_MATCHES": {
        if (!tournament) return <EmptyCard key="next" title="Próximos jogos" children="Sem torneio associado." />;
        return (
          <section key="next" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Próximos jogos</h2>
              <span className="text-xs text-white/50">{upcomingMatches.length} previstos</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {upcomingMatches.length === 0 && <p className="text-white/60">Sem jogos agendados.</p>}
              {upcomingMatches.map((match) => {
                const highlight =
                  (pairingIdFromQuery &&
                    (`${match.pairing1Id}` === pairingIdFromQuery || `${match.pairing2Id}` === pairingIdFromQuery)) ||
                  (tournament.userPairingId &&
                    (match.pairing1Id === tournament.userPairingId || match.pairing2Id === tournament.userPairingId));
                return <MatchCard key={`next-${match.id}`} match={match} pairings={pairings} highlight={highlight} />;
              })}
            </div>
          </section>
        );
      }
      case "RESULTS": {
        if (!tournament) return <EmptyCard key="results" title="Resultados" children="Sem torneio associado." />;
        return (
          <section key="results" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Resultados recentes</h2>
              <span className="text-xs text-white/50">{recentResults.length} jogos</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recentResults.length === 0 && <p className="text-white/60">Sem resultados registados.</p>}
              {recentResults.map((match) => (
                <MatchCard key={`res-${match.id}`} match={match} pairings={pairings} />
              ))}
            </div>
          </section>
        );
      }
      case "BRACKET": {
        if (!tournament) return <EmptyCard key="bracket" title="Bracket" children="Sem torneio associado." />;
        return (
          <section key="bracket" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Bracket</p>
                <h2 className="text-lg font-semibold text-white">Chave completa</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFullBracket((prev) => !prev)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
              >
                {showFullBracket ? "Mostrar menos" : "Ver bracket completo"}
              </button>
            </div>
            <div className="space-y-4">
              {tournament.stages.map((stage: any) => {
                if (!stage.matches.length) return null;
                const matchesByRound = stage.matches.reduce((acc: Record<number, MatchPayload[]>, match: MatchPayload) => {
                  const round = match.round ?? 0;
                  if (!acc[round]) acc[round] = [];
                  acc[round].push(match);
                  return acc;
                }, {});
                const rounds = Object.keys(matchesByRound)
                  .map((r) => Number(r))
                  .sort((a, b) => a - b);

                return (
                  <div key={stage.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-semibold">{stage.name || "Playoffs"}</h3>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {rounds.map((round) => {
                        const matches = matchesByRound[round];
                        const visibleMatches = showFullBracket ? matches : matches.slice(0, 4);
                        return (
                          <div key={`${stage.id}-round-${round}`} className="min-w-[220px] space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Ronda {round}</p>
                            {visibleMatches.map((match) => (
                              <MatchCard
                                key={`bracket-${match.id}`}
                                match={match}
                                pairings={pairings}
                                highlight={
                                  (pairingIdFromQuery &&
                                    (`${match.pairing1Id}` === pairingIdFromQuery || `${match.pairing2Id}` === pairingIdFromQuery)) ||
                                  (tournament.userPairingId &&
                                    (match.pairing1Id === tournament.userPairingId || match.pairing2Id === tournament.userPairingId))
                                }
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      }
      case "CHAMPION": {
        if (!tournament) return <EmptyCard key="champ" title="Campeão" children="Sem torneio associado." />;
        const championId = tournament.championPairingId as number | null;
        const meta = pairingMeta(championId, pairings);
        if (!championId || !meta) {
          return <EmptyCard key="champ" title="Campeão" children="Ainda não existe campeão definido." />;
        }
        return (
          <section key="champ" className="rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,rgba(255,215,120,0.12),rgba(20,20,20,0.8))] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-300/10 text-2xl">
                🏆
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/70">Campeão</p>
                <p className="text-xl font-semibold text-white">{meta.label}</p>
                {meta.subLabel && <p className="text-amber-100/60 text-sm">{meta.subLabel}</p>}
              </div>
            </div>
          </section>
        );
      }
      case "SUMMARY": {
        return (
          <section key="summary" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Resumo</p>
            <h2 className="text-lg font-semibold text-white">Sobre este evento</h2>
            <p className="text-white/70 text-sm leading-relaxed">{event.description}</p>
          </section>
        );
      }
      case "CTA": {
        const ctaCopy =
          viewerRole === "PUBLIC"
            ? "Queres aparecer como participante? Garante o teu bilhete."
            : "Já tens acesso como participante. Aproveita o LiveHub.";
        const ctaLabel = viewerRole === "PUBLIC" ? "Garantir lugar" : "Ver o meu bilhete";
        return (
          <section key="cta" className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Participação</p>
                <p className="text-white/80">{ctaCopy}</p>
              </div>
              <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40">
                {ctaLabel}
              </button>
            </div>
          </section>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {modules.map((mod) => renderModule(mod))}

      {viewerRole === "ORGANIZER" && tournament && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Gestão rápida</h2>
            <span className="text-xs text-white/50">Organizador</span>
          </div>
          <div className="space-y-3">
            {flatMatches
              .filter((m) => m.status !== "DONE")
              .slice(0, 6)
              .map((match) => (
                <div key={`edit-${match.id}`} className="space-y-2">
                  <MatchCard match={match} pairings={pairings} />
                  <OrganizerMatchEditor
                    match={match}
                    tournamentId={tournament.id}
                    onUpdated={() => mutate()}
                  />
                </div>
              ))}
            {flatMatches.filter((m) => m.status !== "DONE").length === 0 && (
              <p className="text-white/60">Sem jogos pendentes para editar.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
