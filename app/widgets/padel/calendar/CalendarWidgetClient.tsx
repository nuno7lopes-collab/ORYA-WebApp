"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatTime, resolveLocale, t } from "@/lib/i18n";

type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
};

type Pairing = {
  slots?: PairingSlot[] | null;
};

type LiveMatch = {
  id: number;
  status: string;
  roundLabel?: string | null;
  groupLabel?: string | null;
  plannedStartAt?: string | null;
  startTime?: string | null;
  plannedEndAt?: string | null;
  plannedDurationMinutes?: number | null;
  courtId?: number | null;
  courtName?: string | null;
  courtNumber?: number | null;
  score?: Record<string, unknown> | null;
  pairingA?: Pairing | null;
  pairingB?: Pairing | null;
};

type CalendarMatch = {
  id: number;
  startAt: string;
  endAt: string | null;
  status: string;
  roundLabel: string | null;
  groupLabel: string | null;
  courtId: number | null;
  courtLabel: string;
  teamA: string;
  teamB: string;
  delayStatus: string | null;
  dayKey: string;
};

type CalendarDay = {
  date: string;
  courts: Array<{ courtId: number | null; courtLabel: string; matches: CalendarMatch[] }>;
};

type CalendarWidgetClientProps = {
  eventId: number;
  timezone: string;
  locale?: string;
  initialDays: CalendarDay[];
  containerClassName?: string;
  showHeader?: boolean;
};

const formatDayKey = (date: Date, timezone: string) =>
  date.toLocaleDateString("en-CA", { timeZone: timezone });

const pairingLabel = (pairing?: Pairing | null) => {
  const names =
    pairing?.slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : "";
};

const buildDays = (matches: LiveMatch[], timezone: string) => {
  const matchItems = matches
    .map((m) => {
      const startAt = m.plannedStartAt ?? m.startTime;
      if (!startAt) return null;
      const startDate = new Date(startAt);
      if (Number.isNaN(startDate.getTime())) return null;
      const endAt =
        m.plannedEndAt ??
        (m.plannedDurationMinutes
          ? new Date(startDate.getTime() + m.plannedDurationMinutes * 60 * 1000).toISOString()
          : null);
      const score = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : {};
      const delayStatus = typeof score.delayStatus === "string" ? score.delayStatus : null;
      const dayKey = formatDayKey(startDate, timezone);
      const courtLabel =
        m.courtName || (m.courtNumber ? `Quadra ${m.courtNumber}` : null) || "Quadra";
      return {
        id: m.id,
        startAt: startDate.toISOString(),
        endAt,
        status: m.status,
        roundLabel: m.roundLabel ?? null,
        groupLabel: m.groupLabel ?? null,
        courtId: m.courtId ?? null,
        courtLabel,
        teamA: pairingLabel(m.pairingA),
        teamB: pairingLabel(m.pairingB),
        delayStatus,
        dayKey,
      } as CalendarMatch;
    })
    .filter(Boolean) as CalendarMatch[];

  const daysMap = new Map<
    string,
    Map<string, { courtId: number | null; courtLabel: string; matches: CalendarMatch[] }>
  >();

  matchItems.forEach((match) => {
    const courtKey = match.courtId ? `id:${match.courtId}` : `label:${match.courtLabel}`;
    if (!daysMap.has(match.dayKey)) daysMap.set(match.dayKey, new Map());
    const courtsMap = daysMap.get(match.dayKey)!;
    if (!courtsMap.has(courtKey)) {
      courtsMap.set(courtKey, {
        courtId: match.courtId,
        courtLabel: match.courtLabel,
        matches: [],
      });
    }
    courtsMap.get(courtKey)!.matches.push(match);
  });

  return Array.from(daysMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, courtsMap]) => ({
      date,
      courts: Array.from(courtsMap.values()).map((court) => ({
        courtId: court.courtId,
        courtLabel: court.courtLabel,
        matches: court.matches,
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

export default function CalendarWidgetClient({
  eventId,
  timezone,
  locale,
  initialDays,
  containerClassName,
  showHeader = true,
}: CalendarWidgetClientProps) {
  const resolvedLocale = resolveLocale(locale);
  const [days, setDays] = useState<CalendarDay[]>(initialDays);
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
          setDays(buildDays(matches, timezone));
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
          setDays(buildDays(payload.matches as LiveMatch[], timezone));
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
  }, [eventId, timezone]);

  const hasDays = useMemo(() => days.length > 0, [days]);

  const rootClass = containerClassName ?? "min-h-screen bg-[#0b0f1d] px-4 py-4 text-white";

  return (
    <div className={rootClass}>
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{t("calendarTitle", resolvedLocale)}</p>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              {realtimeActive ? "Live" : "Sync"}
            </span>
          </div>
        )}
        {!hasDays && <p className="text-[12px] text-white/70">{t("noMatches", resolvedLocale)}</p>}
        {days.map((day) => (
          <section key={day.date} className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/50">
              {formatDate(new Date(`${day.date}T00:00:00`), resolvedLocale, timezone)}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {day.courts.map((court) => (
                <div key={`${day.date}-${court.courtLabel}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                    {t("courtLabel", resolvedLocale)} {court.courtLabel}
                  </p>
                  <div className="mt-2 space-y-2 text-[12px] text-white/80">
                    {court.matches.map((match) => {
                      const start = new Date(match.startAt);
                      return (
                        <div key={match.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {match.teamA || t("pairing", resolvedLocale)}{" "}
                              <span className="text-white/40">vs</span>{" "}
                              {match.teamB || t("pairing", resolvedLocale)}
                            </p>
                            <p className="text-[11px] text-white/60">
                              {match.roundLabel || match.groupLabel || "—"} · {match.status}
                              {match.delayStatus === "DELAYED" ? " · Atrasado" : ""}
                            </p>
                          </div>
                          <span className="text-[11px] text-white/60">
                            {formatTime(start, resolvedLocale, timezone)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
