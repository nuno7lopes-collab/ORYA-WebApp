\"use client\";

import { useMemo, useState } from "react";
import { notFound, redirect, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { summarizeMatchStatus } from "@/domain/tournaments/structure";
import { computeStandingsForGroup } from "@/domain/tournaments/structure";
import { computeLiveWarnings } from "@/domain/tournaments/liveWarnings";

type PageProps = { params: Promise<{ id: string }> };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Filters({ stages, setFilters }: { stages: any[]; setFilters: (f: any) => void }) {
  const [status, setStatus] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [court, setCourt] = useState<string>("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setFilters((prev: any) => ({ ...prev, status: e.target.value || null }));
        }}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80"
      >
        <option value="">Todos os estados</option>
        <option value="PENDING">Pendente</option>
        <option value="IN_PROGRESS">Em jogo</option>
        <option value="DONE">Terminado</option>
      </select>
      <select
        value={stageId}
        onChange={(e) => {
          setStageId(e.target.value);
          setFilters((prev: any) => ({ ...prev, stageId: e.target.value ? Number(e.target.value) : null }));
        }}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80"
      >
        <option value="">Todas as fases</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name || s.stageType}
          </option>
        ))}
      </select>
      <input
        value={court}
        onChange={(e) => {
          setCourt(e.target.value);
          setFilters((prev: any) => ({ ...prev, court: e.target.value || null }));
        }}
        placeholder="Court #"
        className="w-24 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80"
      />
      <label className="flex items-center gap-1 text-white/75">
        <input
          type="checkbox"
          checked={todayOnly}
          onChange={(e) => {
            setTodayOnly(e.target.checked);
            setFilters((prev: any) => ({ ...prev, todayOnly: e.target.checked }));
          }}
        />
        Só hoje
      </label>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setFilters((prev: any) => ({ ...prev, search: e.target.value }));
        }}
        placeholder="Pesquisar dupla #"
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/80"
      />
    </div>
  );
}

export default function OrganizerTournamentLivePage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = Number((params as any)?.id || searchParams?.get("id"));
  if (!Number.isFinite(tournamentId)) {
    notFound();
  }

  const { data, error } = useSWR(`/api/organizador/tournaments/${tournamentId}/live`, fetcher);
  if (error) {
    if (error.status === 401) redirect("/login");
    if (error.status === 403) redirect("/organizador");
  }
  if (!data?.ok) {
    if (data?.error === "UNAUTHENTICATED") redirect("/login");
    if (data?.error === "FORBIDDEN") redirect("/organizador");
  }
  if (!data?.tournament) return <div className="p-4 text-white/70">A carregar…</div>;

  const tournament = data.tournament;
  const tieBreakRules = Array.isArray(tournament.tieBreakRules)
    ? (tournament.tieBreakRules as string[])
    : ["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"];

  const stages = useMemo(
    () =>
      tournament.stages.map((s: any) => ({
        ...s,
        groups: s.groups.map((g: any) => ({
          ...g,
          standings: computeStandingsForGroup(g.matches, tieBreakRules, tournament.generationSeed || undefined),
          matches: g.matches.map((m: any) => ({ ...m, statusLabel: summarizeMatchStatus(m.status) })),
        })),
        matches: s.matches.map((m: any) => ({ ...m, statusLabel: summarizeMatchStatus(m.status) })),
      })),
    [tournament, tieBreakRules],
  );

  const flatMatches = stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)]);
  const warnings = computeLiveWarnings({
    matches: flatMatches,
    pairings: data.pairings ?? [],
    startThresholdMinutes: 60,
  });

  const [filters, setFilters] = useState<any>({
    status: null,
    stageId: null,
    court: null,
    todayOnly: false,
    search: "",
  });

  const now = new Date();
  const filteredMatches = flatMatches.filter((m: any) => {
    if (filters.status && m.status !== filters.status) return false;
    if (filters.stageId && m.stageId !== filters.stageId) return false;
    if (filters.court && `${m.courtId ?? ""}` !== filters.court) return false;
    if (filters.todayOnly && m.startAt) {
      const d = new Date(m.startAt);
      if (
        d.getFullYear() !== now.getFullYear() ||
        d.getMonth() !== now.getMonth() ||
        d.getDate() !== now.getDate()
      )
        return false;
    }
    if (filters.search) {
      const term = filters.search.trim();
      if (!term) return true;
      return `${m.pairing1Id ?? ""}`.includes(term) || `${m.pairing2Id ?? ""}`.includes(term);
    }
    return true;
  });

  const summary = {
    pending: flatMatches.filter((m: any) => m.status === "PENDING").length,
    inProgress: flatMatches.filter((m: any) => m.status === "IN_PROGRESS").length,
    done: flatMatches.filter((m: any) => m.status === "DONE").length,
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Live Torneio</p>
          <h1 className="text-xl font-semibold text-white">{tournament?.event?.title ?? "Torneio"}</h1>
          <p className="text-white/70 text-sm">Formato: {tournament.format}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
          <p>Jogos: {flatMatches.length}</p>
          <p>Pendentes {summary.pending} · Em jogo {summary.inProgress} · Terminados {summary.done}</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-semibold">Avisos</p>
          <ul className="list-disc pl-4 space-y-1">
            {warnings.map((w: any, idx: number) => (
              <li key={`${w.type}-${w.matchId ?? w.pairingId}-${idx}`}>
                {w.type === "REQUIRES_ACTION" && <>Dupla #{w.pairingId} exige ação</>}
                {w.type === "MISSING_COURT" && <>Jogo #{w.matchId}: sem court</>}
                {w.type === "MISSING_START" && <>Jogo #{w.matchId}: sem horário definido</>}
                {w.type === "INVALID_SCORE" && <>Jogo #{w.matchId}: score inválido</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Filters stages={stages} setFilters={setFilters} />

      <div className="grid gap-4 md:grid-cols-2">
        {stages.map((stage: any) => (
          <div key={stage.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">{stage.name || stage.stageType}</h2>
              <span className="text-[11px] text-white/60">{stage.stageType}</span>
            </div>

            {stage.groups.map((group: any) => (
              <div key={group.id} className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-2">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>{group.name}</span>
                  <span className="text-[11px] text-white/60">Jogos: {group.matches.length}</span>
                </div>
                {group.standings?.length ? (
                  <div className="space-y-1 text-[12px] text-white/80">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Standings</p>
                    {group.standings.map((s: any, idx: number) => (
                      <div key={s.pairingId} className="flex items-center justify-between rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="text-white">{idx + 1}º · Dupla #{s.pairingId}</span>
                        <span className="text-white/70">V {s.wins} · L {s.losses} · Sets {s.setDiff}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/60">Sem standings ainda.</p>
                )}
                <div className="space-y-1 text-[12px] text-white/80">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Jogos</p>
                  {group.matches
                    .filter((m: any) => filteredMatches.find((fm: any) => fm.id === m.id))
                    .map((m: any) => (
                      <div key={m.id} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                          <span className="text-[11px] text-white/60">{m.statusLabel}</span>
                        </div>
                        <p className="text-white/60 text-[11px]">
                          Court {m.courtId ?? "—"} · {m.startAt ? new Date(m.startAt).toLocaleString("pt-PT") : "sem horário"}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {stage.matches.length > 0 && (
              <div className="space-y-1 text-[12px] text-white/80">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Jogos avulso</p>
                {stage.matches
                  .filter((m: any) => filteredMatches.find((fm: any) => fm.id === m.id))
                  .map((m: any) => (
                    <div key={m.id} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white">#{m.id} · {m.pairing1Id ?? "?"} vs {m.pairing2Id ?? "?"}</span>
                        <span className="text-[11px] text-white/60">{m.statusLabel}</span>
                      </div>
                      <p className="text-white/60 text-[11px]">
                        Court {m.courtId ?? "—"} · {m.startAt ? new Date(m.startAt).toLocaleString("pt-PT") : "sem horário"}
                      </p>
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
