"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveLocale, t } from "@/lib/i18n";

type StandingRow = {
  pairingId: number;
  points: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
};

type StandingsMap = Record<string, StandingRow[]>;

type StandingsWidgetClientProps = {
  eventId: number;
  initialStandings: StandingsMap;
  locale?: string;
};

const fetchStandings = async (eventId: number) => {
  const res = await fetch(`/api/padel/standings?eventId=${encodeURIComponent(String(eventId))}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "STANDINGS_ERROR");
  }
  return (data?.standings ?? {}) as StandingsMap;
};

export default function StandingsWidgetClient({
  eventId,
  initialStandings,
  locale,
}: StandingsWidgetClientProps) {
  const resolvedLocale = resolveLocale(locale);
  const [standings, setStandings] = useState<StandingsMap>(initialStandings);
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
          const next = await fetchStandings(eventId);
          setStandings(next);
        } catch {
          // ignore polling failures
        }
      }, 30000);
    };

    source.addEventListener("update", (event) => {
      if (closed) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload?.standings) {
          setStandings(payload.standings as StandingsMap);
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

  const groups = useMemo(() => Object.entries(standings), [standings]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] px-4 py-4 text-white">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{t("standings", resolvedLocale)}</p>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {realtimeActive ? "Live" : "Sync"}
          </span>
        </div>
        {groups.length === 0 && <p className="text-[12px] text-white/70">{t("noStandings", resolvedLocale)}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(([label, rows]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                {t("groupLabel", resolvedLocale)} {label}
              </p>
              <div className="mt-2 space-y-1 text-[12px]">
                {rows.slice(0, 4).map((row, idx) => (
                  <div key={row.pairingId} className="flex items-center justify-between">
                    <span>
                      {idx + 1}º · {t("pairing", resolvedLocale)} {row.pairingId}
                    </span>
                    <span className="text-white/60">
                      {t("pointsShort", resolvedLocale)} {row.points}
                    </span>
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
