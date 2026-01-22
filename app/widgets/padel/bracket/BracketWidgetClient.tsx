"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveLocale, t } from "@/lib/i18n";

type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
};

type Pairing = {
  slots?: PairingSlot[] | null;
};

type LiveMatch = {
  id: number;
  status: string;
  roundType?: string | null;
  roundLabel?: string | null;
  scoreSets?: Array<{ teamA: number; teamB: number }> | null;
  score?: Record<string, unknown> | null;
  pairingA?: Pairing | null;
  pairingB?: Pairing | null;
};

type RoundItem = {
  label: string;
  matches: Array<{ id: number; status: string; score: string; teamA: string; teamB: string }>;
};

type BracketWidgetClientProps = {
  eventId: number;
  title: string;
  initialRounds: RoundItem[];
  locale?: string;
};

const pairingLabel = (slots?: PairingSlot[] | null) => {
  const names =
    slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : "";
};

const formatScore = (scoreSets?: unknown, scoreRaw?: Record<string, unknown> | null) => {
  const sets = Array.isArray(scoreSets) ? (scoreSets as Array<{ teamA: number; teamB: number }>) : [];
  if (sets.length > 0) {
    return sets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  const rawSets = Array.isArray(scoreRaw?.sets) ? (scoreRaw?.sets as Array<{ teamA: number; teamB: number }>) : [];
  if (rawSets.length > 0) {
    return rawSets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  return "—";
};

const parseRoundMeta = (label: string) => {
  const prefix = label.startsWith("A ") ? "A " : label.startsWith("B ") ? "B " : "";
  const base = prefix ? label.slice(2) : label;
  let size: number | null = null;
  let order: number | null = null;
  if (/^L\\d+$/i.test(base)) {
    const parsed = Number(base.slice(1));
    order = Number.isFinite(parsed) ? parsed : null;
  } else if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) {
    order = Number.MAX_SAFE_INTEGER;
  } else if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) {
    order = Number.MAX_SAFE_INTEGER - 1;
  } else if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  }
  if (size === null) {
    if (base === "QUARTERFINAL") size = 8;
    if (base === "SEMIFINAL") size = 4;
    if (base === "FINAL") size = 2;
  }
  return { prefix, size, order };
};

const formatRoundLabel = (label: string) => {
  const trimmed = label.trim();
  const prefix = trimmed.startsWith("A ") ? "A " : trimmed.startsWith("B ") ? "B " : "";
  const base = prefix ? trimmed.slice(2).trim() : trimmed;
  if (/^L\\d+$/i.test(base)) return `${prefix}Ronda ${base.slice(1)}`;
  if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) return `${prefix}Grande Final 2`;
  if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) return `${prefix}Grande Final`;
  return label;
};

const buildRounds = (matches: LiveMatch[]) => {
  const roundsMap = new Map<string, LiveMatch[]>();
  matches.forEach((m) => {
    const label = m.roundLabel || "Bracket";
    if (!roundsMap.has(label)) roundsMap.set(label, []);
    roundsMap.get(label)!.push(m);
  });

  return Array.from(roundsMap.entries())
    .sort((a, b) => {
      const aMeta = parseRoundMeta(a[0]);
      const bMeta = parseRoundMeta(b[0]);
      if (aMeta.prefix !== bMeta.prefix) return aMeta.prefix.localeCompare(bMeta.prefix);
      const aOrder = aMeta.order ?? (aMeta.size !== null ? -aMeta.size : Number.MAX_SAFE_INTEGER - 1);
      const bOrder = bMeta.order ?? (bMeta.size !== null ? -bMeta.size : Number.MAX_SAFE_INTEGER - 1);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a[0].localeCompare(b[0]);
    })
    .map(([label, items]) => ({
      label,
      matches: items.map((m) => ({
        id: m.id,
        status: m.status,
        score: formatScore(m.scoreSets, m.score ?? null),
        teamA: pairingLabel(m.pairingA?.slots),
        teamB: pairingLabel(m.pairingB?.slots),
      })),
    }));
};

const fetchMatches = async (eventId: number) => {
  const res = await fetch(`/api/padel/matches?eventId=${encodeURIComponent(String(eventId))}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "MATCHES_ERROR");
  }
  return (Array.isArray(data?.items) ? data.items : []) as LiveMatch[];
};

export default function BracketWidgetClient({
  eventId,
  title,
  initialRounds,
  locale,
}: BracketWidgetClientProps) {
  const resolvedLocale = resolveLocale(locale);
  const [rounds, setRounds] = useState<RoundItem[]>(initialRounds);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let closed = false;
    const source = new EventSource(`/api/padel/live?eventId=${encodeURIComponent(String(eventId))}`);

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPoll = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const matches = await fetchMatches(eventId);
          const knockout = matches.filter((m) => m.roundType === "KNOCKOUT");
          setRounds(buildRounds(knockout));
        } catch {
          // ignore polling failures
        }
      }, 30000);
    };

    source.addEventListener("update", (event) => {
      if (closed) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(payload?.matches)) {
          const knockout = (payload.matches as LiveMatch[]).filter((m) => m.roundType === "KNOCKOUT");
          setRounds(buildRounds(knockout));
        }
      } catch {
        // ignore malformed payload
      }
    });
    source.onopen = () => {
      if (closed) return;
      setRealtimeActive(true);
      stopPoll();
    };
    source.onerror = () => {
      if (closed) return;
      setRealtimeActive(false);
      source.close();
      startPoll();
    };

    return () => {
      closed = true;
      source.close();
      stopPoll();
    };
  }, [eventId]);

  const hasRounds = useMemo(() => rounds.length > 0, [rounds]);

  return (
    <div className="min-h-screen bg-[#0b0f1d] px-4 py-4 text-white">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{t("bracket", resolvedLocale)}</p>
            <h1 className="text-base font-semibold">{title || t("tournament", resolvedLocale)}</h1>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {realtimeActive ? "Live" : "Sync"}
          </span>
        </div>
        {!hasRounds && <p className="text-[12px] text-white/70">{t("noBracket", resolvedLocale)}</p>}
        <div className="space-y-3">
          {rounds.map((round) => (
            <div key={round.label} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                {round.label === "Bracket" ? t("bracket", resolvedLocale) : formatRoundLabel(round.label)}
              </p>
              <div className="space-y-2">
                {round.matches.map((match) => (
                  <div key={match.id} className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {match.teamA || t("pairing", resolvedLocale)} vs {match.teamB || t("pairing", resolvedLocale)}
                      </span>
                      <span className="text-white/60">{match.status}</span>
                    </div>
                    <div className="text-white/60">{match.score}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
