"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type StandingsRow = {
  pairingId: number;
  points: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
};


type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
};

type Pairing = {
  id: number;
  slots?: PairingSlot[];
};

type Match = {
  id: number;
  status: string;
  roundType?: string | null;
  roundLabel?: string | null;
  groupLabel?: string | null;
  startTime?: string | Date | null;
  plannedStartAt?: string | Date | null;
  courtName?: string | null;
  courtNumber?: number | null;
  pairingA?: Pairing | null;
  pairingB?: Pairing | null;
  scoreSets?: Array<{ teamA: number; teamB: number }> | null;
  score?: Record<string, unknown> | null;
};

type StandingsResponse = { ok?: boolean; standings?: Record<string, StandingsRow[]> };
type MatchesResponse = { ok?: boolean; items?: Match[] };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pairingName = (pairing?: Pairing | null) => {
  if (!pairing) return "—";
  const names = (pairing.slots || [])
    .map((s) => s.playerProfile?.displayName || s.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : "Dupla incompleta";
};

const formatScoreLabel = (match: Match) => {
  const score = (match.score || {}) as Record<string, unknown>;
  if (score.disputeStatus === "OPEN") return "Em disputa";
  if (score.delayStatus === "DELAYED") return "Atrasado";
  if (match.scoreSets?.length) {
    return match.scoreSets.map((s) => `${s.teamA}-${s.teamB}`).join(", ");
  }
  const resultType =
    score.resultType === "WALKOVER" || score.walkover === true
      ? "WALKOVER"
      : score.resultType === "RETIREMENT"
        ? "RETIREMENT"
        : score.resultType === "INJURY"
          ? "INJURY"
          : null;
  if (resultType === "WALKOVER") return "WO";
  if (resultType === "RETIREMENT") return "Desistência";
  if (resultType === "INJURY") return "Lesão";
  return "—";
};

const toDateKey = (value: string | Date) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

const toTimeLabel = (value: string | Date) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
};

export default function PadelPublicTablesClient({
  eventId,
  initialStandings,
}: {
  eventId: number;
  initialStandings: Record<string, StandingsRow[]>;
}) {
  const [realtimeActive, setRealtimeActive] = useState(false);
  const refreshInterval = realtimeActive ? 0 : 30000;

  const { data: standingsRes, mutate: mutateStandings } = useSWR<StandingsResponse>(
    eventId ? `/api/padel/standings?eventId=${eventId}` : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      fallbackData: { ok: true, standings: initialStandings },
    },
  );
  const { data: matchesRes, mutate: mutateMatches } = useSWR<MatchesResponse>(
    eventId ? `/api/padel/matches?eventId=${eventId}` : null,
    fetcher,
    { refreshInterval, revalidateOnFocus: false },
  );

  const standings = standingsRes?.standings ?? initialStandings;
  const matches = Array.isArray(matchesRes?.items) ? matchesRes?.items ?? [] : [];

  useEffect(() => {
    if (!eventId || typeof window === "undefined") return;
    const url = new URL("/api/padel/live", window.location.origin);
    url.searchParams.set("eventId", String(eventId));
    const es = new EventSource(url.toString());

    const handleUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.standings) {
          mutateStandings({ ok: true, standings: payload.standings }, { revalidate: false });
        }
        if (payload?.matches) {
          mutateMatches({ ok: true, items: payload.matches }, { revalidate: false });
        }
      } catch {
        // ignore malformed payload
      }
    };

    es.addEventListener("update", handleUpdate as EventListener);
    es.onopen = () => setRealtimeActive(true);
    es.onerror = () => {
      setRealtimeActive(false);
      es.close();
    };

    return () => {
      es.removeEventListener("update", handleUpdate as EventListener);
      es.close();
      setRealtimeActive(false);
    };
  }, [eventId, mutateMatches, mutateStandings]);

  const standingsGroups = useMemo(
    () => Object.entries(standings).sort((a, b) => a[0].localeCompare(b[0])),
    [standings],
  );

  const pairingNameMap = useMemo(() => {
    const map = new Map<number, string>();
    matches.forEach((match) => {
      if (match.pairingA?.id) map.set(match.pairingA.id, pairingName(match.pairingA));
      if (match.pairingB?.id) map.set(match.pairingB.id, pairingName(match.pairingB));
    });
    return map;
  }, [matches]);

  const koRounds = useMemo(() => {
    const koMatches = matches.filter((m) => m.roundType === "KNOCKOUT");
    const roundCounts = koMatches.reduce<Record<string, number>>((acc, m) => {
      const key = m.roundLabel || "KO";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const roundOrder = Object.entries(roundCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label);
    const rounds = new Map<string, Match[]>();
    roundOrder.forEach((label) => {
      rounds.set(
        label,
        koMatches.filter((m) => (m.roundLabel || "KO") === label),
      );
    });
    return Array.from(rounds.entries());
  }, [matches]);

  const scheduleRows = useMemo(() => {
    const rows = matches
      .map((m) => {
        const start = m.startTime ?? m.plannedStartAt;
        if (!start) return null;
        const date = new Date(start);
        if (Number.isNaN(date.getTime())) return null;
        return {
          id: m.id,
          start: date,
          label: `${pairingName(m.pairingA)} vs ${pairingName(m.pairingB)}`,
          court: m.courtName || (m.courtNumber ? `Quadra ${m.courtNumber}` : ""),
          status: m.status,
          score: formatScoreLabel(m),
        };
      })
      .filter(Boolean) as Array<{
      id: number;
      start: Date;
      label: string;
      court: string;
      status: string;
      score: string;
    }>;

    rows.sort((a, b) => a.start.getTime() - b.start.getTime());
    const grouped = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const key = toDateKey(row.start);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });
    return Array.from(grouped.entries());
  }, [matches]);

  return (
    <div className="mt-6 space-y-6">
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Grupos</p>
        {standingsGroups.length === 0 && (
          <p className="text-[12px] text-white/60">Classificações ainda não disponíveis.</p>
        )}
        <div className="grid gap-4">
          {standingsGroups.map(([label, rows]) => (
            <div key={label} className="rounded-2xl border border-white/12 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white/90">{label || "Grupo"}</span>
                <span className="text-[11px] text-white/60">{rows.length} duplas</span>
              </div>
              <div className="mt-3 space-y-2">
                {rows.map((row, idx) => (
                  <div
                    key={`${label}-${row.pairingId}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[11px] text-white/50">{idx + 1}</span>
                      <span className="text-sm text-white/90">
                        {pairingNameMap.get(row.pairingId) ?? `Dupla #${row.pairingId}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/70">
                      <span className="rounded-full border border-white/15 px-2 py-1">{row.points} pts</span>
                      <span>
                        {row.wins}-{row.losses}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Eliminatórias</p>
        {koRounds.length === 0 && <p className="text-[12px] text-white/60">Quadro ainda não publicado.</p>}
        {koRounds.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {koRounds.map(([roundLabel, games]) => (
              <div
                key={roundLabel}
                className="min-w-[240px] rounded-2xl border border-white/12 bg-black/40 p-3"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{roundLabel}</p>
                <div className="mt-2 space-y-2">
                  {games.map((game) => (
                    <div key={game.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                      <p className="font-semibold text-white/90">{pairingName(game.pairingA)}</p>
                      <p className="font-semibold text-white/90">{pairingName(game.pairingB)}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
                        <span>{formatScoreLabel(game)}</span>
                        <span>{game.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Calendário</p>
        {scheduleRows.length === 0 && <p className="text-[12px] text-white/60">Sem horários publicados.</p>}
        {scheduleRows.map(([day, rows]) => (
          <div key={day} className="rounded-2xl border border-white/12 bg-black/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-white/90">{day}</p>
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/75">
                <div>
                  <p className="text-white/90">{row.label}</p>
                  <p className="text-[11px] text-white/60">
                    {row.court ? `${row.court} · ` : ""}
                    {row.score !== "—" ? `Resultado: ${row.score}` : "Por jogar"}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white/70">
                  {toTimeLabel(row.start)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
