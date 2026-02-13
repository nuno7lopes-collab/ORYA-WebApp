"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime, resolveLocale, t } from "@/lib/i18n";

type PlayerSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
} | null;

type ScoreboardMatch = {
  id: number;
  status: string;
  plannedStartAt?: string | null;
  startTime?: string | null;
  plannedEndAt?: string | null;
  plannedDurationMinutes?: number | null;
  courtId?: number | null;
  courtName?: string | null;
  courtNumber?: number | null;
  scoreSets?: Array<{ teamA: number; teamB: number }> | null;
  score?: Record<string, unknown> | null;
  pairingA?: { slots?: PlayerSlot[] } | null;
  pairingB?: { slots?: PlayerSlot[] } | null;
};

type ScoreboardEvent = {
  id: number;
  slug: string;
  title: string;
  timezone: string | null;
  liveStreamUrl: string | null;
};

const pairingLabel = (slots?: PlayerSlot[], fallback?: string) => {
  const names =
    slots
      ?.map((slot) => slot?.playerProfile?.displayName || slot?.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : fallback || "Dupla";
};

const formatSets = (sets?: Array<{ teamA: number; teamB: number }>) => {
  if (!sets || sets.length === 0) return "—";
  return sets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
};

const parseStartAt = (match: ScoreboardMatch) => {
  const raw = match.plannedStartAt ?? match.startTime ?? null;
  return raw ? new Date(raw) : null;
};

export default function PadelScoreboardClient({
  event,
  initialMatches,
  lang,
}: {
  event: ScoreboardEvent;
  initialMatches: ScoreboardMatch[];
  lang?: string | null;
}) {
  const locale = resolveLocale(lang);
  const [matches, setMatches] = useState<ScoreboardMatch[]>(initialMatches);
  const timeZone = event.timezone ?? "Europe/Lisbon";

  useEffect(() => {
    const url = new URL(`/api/live/events/${encodeURIComponent(event.slug)}/stream`, window.location.origin);
    url.searchParams.set("eventId", String(event.id));
    const source = new EventSource(url.toString());
    const handleUpdate = (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.matches) setMatches(payload.matches);
      } catch {
        // ignore parse errors
      }
    };
    source.addEventListener("update", handleUpdate);
    return () => {
      source.removeEventListener("update", handleUpdate);
      source.close();
    };
  }, [event.id, event.slug]);

  const liveMatches = useMemo(
    () => matches.filter((m) => m.status === "IN_PROGRESS" || m.status === "LIVE"),
    [matches],
  );
  const upcoming = useMemo(
    () => {
      const now = new Date();
      return matches
        .filter((m) => {
          const startAt = parseStartAt(m);
          return Boolean(startAt && startAt > now);
        })
        .slice(0, 6);
    },
    [matches],
  );

  return (
    <div className="min-h-screen px-4 py-8 text-white">
      <div className="orya-page-width space-y-6">
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("liveScoreTitle", locale)}</p>
          <h1 className="text-2xl font-semibold">{event.title}</h1>
          <p className="text-sm text-white/70">{t("liveScoreSubtitle", locale)}</p>
        </header>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("liveMatches", locale)}</h2>
            <span className="text-white/60 text-sm">
              {liveMatches.length} {t("matches", locale)}
            </span>
          </div>
          {liveMatches.length === 0 && <p className="text-white/60 text-sm">{t("noLiveMatches", locale)}</p>}
          {liveMatches.map((m) => {
            const score = (m.score || {}) as Record<string, unknown>;
            const liveStreamUrl =
              typeof score.liveStreamUrl === "string" ? score.liveStreamUrl : event.liveStreamUrl;
            const sets = Array.isArray(m.scoreSets)
              ? (m.scoreSets as Array<{ teamA: number; teamB: number }>)
              : Array.isArray((score.sets as any))
                ? (score.sets as Array<{ teamA: number; teamB: number }>)
                : [];
            const startAt = parseStartAt(m);
            return (
              <div key={m.id} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {pairingLabel(m.pairingA?.slots, t("pairing", locale))} vs{" "}
                    {pairingLabel(m.pairingB?.slots, t("pairing", locale))}
                  </span>
                  <span className="text-white/60">{formatSets(sets)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px] text-white/70">
                  <span>
                    {m.courtName || m.courtNumber || m.courtId || t("court", locale)} ·{" "}
                    {startAt ? formatDateTime(startAt, locale, timeZone) : "—"}
                  </span>
                  {liveStreamUrl && (
                    <a href={liveStreamUrl} target="_blank" rel="noreferrer" className="underline">
                      {t("watchStream", locale)}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("upcomingMatches", locale)}</h2>
            <span className="text-white/60 text-sm">{upcoming.length}</span>
          </div>
          {upcoming.length === 0 && <p className="text-white/60 text-sm">{t("noUpcomingMatches", locale)}</p>}
          {upcoming.map((m) => {
            const startAt = parseStartAt(m);
            return (
              <div key={`up-${m.id}`} className="rounded-xl border border-white/15 bg-black/40 px-4 py-3">
                <p className="text-sm font-semibold">
                  {pairingLabel(m.pairingA?.slots, t("pairing", locale))} vs{" "}
                  {pairingLabel(m.pairingB?.slots, t("pairing", locale))}
                </p>
                <p className="text-[12px] text-white/70">
                  {m.courtName || m.courtNumber || m.courtId || t("court", locale)} ·{" "}
                  {startAt ? formatDateTime(startAt, locale, timeZone) : "—"}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
