"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type Player = {
  id: number;
  fullName: string;
  level: string | null;
};

type Team = {
  id: number;
  player1?: Player | null;
  player2?: Player | null;
};

type Match = {
  id: number;
  status: string;
  teamA?: Team | null;
  teamB?: Team | null;
  score: any;
};

type Props = {
  eventId: number;
  organizerId: number | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PadelFormat =
  | "TODOS_CONTRA_TODOS"
  | "QUADRO_ELIMINATORIO"
  | "GRUPOS_ELIMINATORIAS"
  | "CAMPEONATO_LIGA"
  | "QUADRO_AB"
  | "NON_STOP";

const formatOptions: Array<{ value: PadelFormat; label: string }> = [
  { value: "TODOS_CONTRA_TODOS", label: "Todos contra todos" },
  { value: "QUADRO_ELIMINATORIO", label: "Quadro eliminatório" },
  { value: "GRUPOS_ELIMINATORIAS", label: "Grupos + eliminatórias" },
  { value: "CAMPEONATO_LIGA", label: "Campeonato/Liga" },
  { value: "QUADRO_AB", label: "Quadro A/B" },
  { value: "NON_STOP", label: "Non-stop" },
];

export default function PadelTournamentSection({ eventId, organizerId }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [rankings, setRankings] = useState<{ position: number; points: number; player: Player }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamForm, setTeamForm] = useState({ p1: "", p2: "", p1Id: "", p2Id: "" });
  const [format, setFormat] = useState<PadelFormat>("TODOS_CONTRA_TODOS");
  const formatLabelMap = useMemo(() => Object.fromEntries(formatOptions.map((f) => [f.value, f.label])), []);
  const { data: configRes } = useSWR(eventId ? `/api/padel/tournaments/config?eventId=${eventId}` : null, fetcher);
  const formatRequested = (configRes?.config?.advancedSettings as any)?.formatRequested as PadelFormat | undefined;
  const formatEffective = (configRes?.config?.advancedSettings as any)?.formatEffective as PadelFormat | undefined;

  async function fetchTeams() {
    const res = await fetch(`/api/padel/teams?eventId=${eventId}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar equipas");
    setTeams(json.items);
  }

  async function fetchPlayers() {
    if (!organizerId) return;
    const res = await fetch(`/api/padel/players?organizerId=${organizerId}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar jogadores");
    setPlayers(json.items);
  }
  async function fetchMatches() {
    const res = await fetch(`/api/padel/matches?eventId=${eventId}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar jogos");
    setMatches(json.items);
  }

  async function fetchRankings() {
    const res = await fetch(`/api/padel/rankings?eventId=${eventId}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar ranking");
    setRankings(json.items);
  }

  async function generateKnockout() {
    setError(null);
    if (matches.some((m) => m.roundType === "KNOCKOUT")) {
      setError("Eliminatórias já foram geradas.");
      return;
    }
    const totalGroupMatches = matches.filter((m) => m.roundType === "GROUPS").length;
    const finishedGroupMatches = matches.filter((m) => m.roundType === "GROUPS" && m.status === "DONE").length;
    const missing = totalGroupMatches - finishedGroupMatches;
    let allowIncomplete = false;
    if (totalGroupMatches > 0 && missing > 0) {
      const confirmed = window.confirm(
        `Faltam ${missing} jogos de grupos para fechar classificação. Gerar eliminatórias mesmo assim? (apenas admins)`
      );
      if (!confirmed) return;
      allowIncomplete = true;
    }
    const res = await fetch("/api/padel/matches/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, format, phase: "KNOCKOUT", allowIncomplete }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao gerar eliminatórias");
      return;
    }
    await fetchMatches();
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchTeams(), fetchMatches(), fetchPlayers(), fetchRankings()]);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar torneio.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, organizerId]);

  const addTeam = async () => {
    if (!teamForm.p1.trim() && !teamForm.p1Id) return setError("Indica o jogador 1.");
    if (!teamForm.p2.trim() && !teamForm.p2Id) return setError("Indica o jogador 2.");
    setError(null);
    const res = await fetch("/api/padel/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        player1Name: teamForm.p1,
        player2Name: teamForm.p2,
        player1Id: teamForm.p1Id || undefined,
        player2Id: teamForm.p2Id || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao criar equipa");
      return;
    }
    setTeams((prev) => [json.team, ...prev]);
    setTeamForm({ p1: "", p2: "", p1Id: "", p2Id: "" });
  };

  const generateMatches = async () => {
    setError(null);
    if (matches.some((m) => m.roundType === "GROUPS")) {
      setError("Jogos de grupos já foram gerados.");
      return;
    }
    const res = await fetch("/api/padel/matches/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, format }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao gerar jogos");
      return;
    }
    setMatches(json.matches);
  };

  const updateMatchStatus = async (matchId: number, status: string) => {
    const res = await fetch("/api/padel/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: matchId, status }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao atualizar jogo");
      return;
    }
    setMatches((prev) => prev.map((m) => (m.id === matchId ? json.match : m)));
  };

  const generateRanking = async () => {
    setError(null);
    const res = await fetch("/api/padel/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao gerar ranking");
      return;
    }
    await fetchRankings();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Torneio (MVP)</p>
          <h3 className="text-lg font-semibold text-white">Equipas & Jogos</h3>
        </div>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as any)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-white/80"
        >
          {formatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {["CAMPEONATO_LIGA", "NON_STOP", "QUADRO_AB"].includes(opt.value) ? " (Beta)" : ""}
            </option>
          ))}
        </select>
      </div>
      {formatRequested && formatEffective && formatRequested !== formatEffective && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-50">
          Formato pedido: {formatLabelMap[formatRequested] ?? formatRequested}. Este torneio está a usar:{" "}
          {formatLabelMap[formatEffective] ?? formatEffective} (modo Beta).
        </div>
      )}

      {error && <p className="text-[12px] text-red-300">{error}</p>}
      {loading && <p className="text-sm text-white/70">A carregar torneio…</p>}

      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5/20 p-3">
          <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Criar equipa</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={teamForm.p1}
              onChange={(e) => setTeamForm((p) => ({ ...p, p1: e.target.value }))}
              placeholder="Jogador 1 (novo)"
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <select
              value={teamForm.p1Id}
              onChange={(e) => setTeamForm((p) => ({ ...p, p1Id: e.target.value }))}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
            >
              <option value="">Selecionar jogador existente</option>
              {players.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.fullName} {pl.level ? `(${pl.level})` : ""}
                </option>
              ))}
            </select>
            <input
              value={teamForm.p2}
              onChange={(e) => setTeamForm((p) => ({ ...p, p2: e.target.value }))}
              placeholder="Jogador 2 (novo)"
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <select
              value={teamForm.p2Id}
              onChange={(e) => setTeamForm((p) => ({ ...p, p2Id: e.target.value }))}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
            >
              <option value="">Selecionar jogador existente</option>
              {players.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.fullName} {pl.level ? `(${pl.level})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addTeam}
            className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Guardar equipa
          </button>
          <div className="space-y-2 max-h-56 overflow-auto text-sm">
            {teams.length === 0 && <p className="text-white/60">Sem equipas ainda.</p>}
            {teams.map((t) => (
              <div key={t.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <p className="font-semibold text-white">
                  {(t.player1?.fullName ?? "Jogador 1")} & {t.player2?.fullName ?? "Jogador 2"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Jogos</p>
            <button
              onClick={generateMatches}
              className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={matches.some((m) => m.roundType === "GROUPS")}
              title={matches.some((m) => m.roundType === "GROUPS") ? "Jogos de grupos já existem." : undefined}
            >
              Gerar jogos
            </button>
            <button
              onClick={generateKnockout}
              className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={matches.some((m) => m.roundType === "KNOCKOUT")}
              title={
                matches.some((m) => m.roundType === "KNOCKOUT")
                  ? "Eliminatórias já foram geradas."
                  : undefined
              }
            >
              Gerar eliminatórias
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-auto text-sm">
            {matches.length === 0 && <p className="text-white/60">Sem jogos ainda.</p>}
            {matches.map((m) => (
              <div key={m.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-white">
                      {(m.teamA?.player1?.fullName ?? "Equipa A")} vs {m.teamB?.player1?.fullName ?? "Equipa B"}
                    </p>
                    <p className="text-[11px] text-white/60">Estado: {m.status}</p>
                  </div>
                  <select
                    value={m.status}
                    onChange={(e) => updateMatchStatus(m.id, e.target.value)}
                    className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80"
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="IN_PROGRESS">Em jogo</option>
                    <option value="DONE">Concluído</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={generateRanking}
              className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10"
            >
              Gerar ranking deste torneio
            </button>
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Ranking do torneio</p>
            {rankings.length === 0 && <p className="text-white/60 text-sm">Sem ranking gerado.</p>}
            {rankings.map((r) => (
              <div key={r.player.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-white/60">#{r.position}</span>
                  <div>
                    <p className="font-semibold text-white">{r.player.fullName}</p>
                    <p className="text-[11px] text-white/60">{r.player.level || "Nível?"}</p>
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-[#6BFFFF]">{r.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
