"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { formatDate, formatTime, t } from "@/lib/i18n";

type StandingsRow = {
  entityId: number;
  pairingId: number | null;
  playerId?: number | null;
  points: number;
  wins: number;
  draws?: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  label?: string | null;
  players?: Array<{ id?: number | null; name?: string | null; username?: string | null }> | null;
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

type StandingsResponse = { ok?: boolean; groups?: Record<string, StandingsRow[]> };
type MatchesResponse = { ok?: boolean; items?: Match[] };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pairingName = (pairing?: Pairing | null, locale?: string | null) => {
  if (!pairing) return "—";
  const names = (pairing.slots || [])
    .map((s) => s.playerProfile?.displayName || s.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : t("pairingIncomplete", locale);
};

const formatScoreLabel = (match: Match, locale?: string | null) => {
  const score = (match.score || {}) as Record<string, unknown>;
  if (score.disputeStatus === "OPEN") return t("scoreDispute", locale);
  if (score.delayStatus === "DELAYED") return t("scoreDelayed", locale);
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
  if (resultType === "WALKOVER") return t("scoreWalkover", locale);
  if (resultType === "RETIREMENT") return t("scoreRetirement", locale);
  if (resultType === "INJURY") return t("scoreInjury", locale);
  return "—";
};

const toDateKey = (value: string | Date, locale?: string | null, timezone?: string | null) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d, locale, timezone);
};

const toTimeLabel = (value: string | Date, locale?: string | null, timezone?: string | null) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatTime(d, locale, timezone);
};

export default function PadelPublicTablesClient({
  eventId,
  eventSlug,
  initialStandings,
  locale,
  timezone,
}: {
  eventId: number;
  eventSlug: string;
  initialStandings: Record<string, StandingsRow[]>;
  locale?: string | null;
  timezone?: string | null;
}) {
  const [realtimeActive, setRealtimeActive] = useState(false);
  const refreshInterval = realtimeActive ? 0 : 30000;

  const { data: standingsRes, mutate: mutateStandings } = useSWR<StandingsResponse>(
    eventId ? `/api/padel/standings?eventId=${eventId}` : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      fallbackData: { ok: true, groups: initialStandings },
    },
  );
  const { data: matchesRes, mutate: mutateMatches } = useSWR<MatchesResponse>(
    eventId ? `/api/padel/matches?eventId=${eventId}` : null,
    fetcher,
    { refreshInterval, revalidateOnFocus: false },
  );

  const standings = standingsRes?.groups ?? initialStandings;
  const matches = Array.isArray(matchesRes?.items) ? matchesRes?.items ?? [] : [];

  useEffect(() => {
    if (!eventId || typeof window === "undefined") return;
    const url = new URL("/api/padel/live", window.location.origin);
    url.searchParams.set("eventId", String(eventId));
    const es = new EventSource(url.toString());

    const handleUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.standings?.groups) {
          mutateStandings({ ok: true, groups: payload.standings.groups }, { revalidate: false });
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

  const standingsGroups = useMemo(() => {
    const entries = Object.entries(standings) as Array<[string, StandingsRow[]]>;
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [standings]);

  const pairingNameMap = useMemo(() => {
    const map = new Map<number, string>();
    matches.forEach((match) => {
      if (match.pairingA?.id) map.set(match.pairingA.id, pairingName(match.pairingA, locale));
      if (match.pairingB?.id) map.set(match.pairingB.id, pairingName(match.pairingB, locale));
    });
    return map;
  }, [matches, locale]);

  const koRounds = useMemo(() => {
    const koMatches = matches.filter((m) => m.roundType === "KNOCKOUT");
    const roundCounts = koMatches.reduce<Record<string, number>>((acc, m) => {
      const key = m.roundLabel || "KO";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const roundOrder = (Object.entries(roundCounts) as Array<[string, number]>)
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
          label: `${pairingName(m.pairingA, locale)} vs ${pairingName(m.pairingB, locale)}`,
          court:
            m.courtName ||
            (m.courtNumber ? `${t("court", locale)} ${m.courtNumber}` : t("court", locale)),
          status: m.status,
          score: formatScoreLabel(m, locale),
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
      const key = toDateKey(row.start, locale, timezone);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });
    return Array.from(grouped.entries());
  }, [matches, locale, timezone]);

  return (
    <div className="mt-6 space-y-6">
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("standings", locale)}</p>
        {standingsGroups.length === 0 && (
          <p className="text-[12px] text-white/60">{t("noStandings", locale)}</p>
        )}
        <div className="grid gap-4">
          {standingsGroups.map(([label, rows]) => (
            <div key={label} className="rounded-2xl border border-white/12 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white/90">{label || t("groupLabel", locale)}</span>
                <span className="text-[11px] text-white/60">{rows.length} {t("pairing", locale)}</span>
              </div>
              <div className="mt-3 space-y-2">
                {rows.map((row, idx) => (
                  <div
                    key={`${label}-${row.entityId}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[11px] text-white/50">{idx + 1}</span>
                      <span className="text-sm text-white/90">
                        {row.label ||
                          (typeof row.pairingId === "number"
                            ? pairingNameMap.get(row.pairingId) ?? `${t("pairing", locale)} #${row.pairingId}`
                            : `Jogador #${row.entityId}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/70">
                      <span className="rounded-full border border-white/15 px-2 py-1">{row.points} {t("pointsShort", locale)}</span>
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
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("bracket", locale)}</p>
        {koRounds.length === 0 && <p className="text-[12px] text-white/60">{t("noBracket", locale)}</p>}
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
                      <p className="font-semibold text-white/90">{pairingName(game.pairingA, locale)}</p>
                      <p className="font-semibold text-white/90">{pairingName(game.pairingB, locale)}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
                        <span>{formatScoreLabel(game, locale)}</span>
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
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("calendarTitle", locale)}</p>
        {scheduleRows.length === 0 && <p className="text-[12px] text-white/60">{t("noMatches", locale)}</p>}
        {scheduleRows.map(([day, rows]) => (
          <div key={day} className="rounded-2xl border border-white/12 bg-black/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-white/90">{day}</p>
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/75">
                <div>
                  {eventSlug ? (
                    <a href={`/eventos/${eventSlug}/jogos/${row.id}`} className="text-white/90 underline">
                      {row.label}
                    </a>
                  ) : (
                    <p className="text-white/90">{row.label}</p>
                  )}
                  <p className="text-[11px] text-white/60">
                    {row.court ? `${row.court} · ` : ""}
                    {row.score !== "—" ? `${t("resultLabel", locale)}: ${row.score}` : t("pendingLabel", locale)}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white/70">
                  {toTimeLabel(row.start, locale, timezone)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
