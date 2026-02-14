"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTime, resolveLocale, t } from "@/lib/i18n";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
} | null;

type MonitorMatch = {
  id: number;
  status: string;
  plannedStartAt?: string | null;
  startTime?: string | null;
  actualStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedDurationMinutes?: number | null;
  courtId?: number | null;
  courtNumber?: number | null;
  courtName?: string | null;
  score?: Record<string, unknown> | null;
  scoreSets?: Array<{ teamA?: number; teamB?: number; a?: number; b?: number }> | null;
  pairingA?: { slots?: PairingSlot[] } | null;
  pairingB?: { slots?: PairingSlot[] } | null;
};

type MonitorEvent = {
  id: number;
  slug: string;
  title: string;
  timezone: string | null;
};

type TvMonitorConfig = {
  footerText?: string | null;
  sponsors?: string[] | null;
};

type MonitorCourtOption = {
  id: number;
  name: string;
  displayOrder?: number | null;
};

const pairingLabel = (slots?: PairingSlot[], fallback?: string) => {
  const names =
    slots
      ?.map((slot) => slot?.playerProfile?.displayName || slot?.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : fallback || "—";
};

const resolveMatchStart = (match: MonitorMatch) => {
  const raw = match.actualStartAt ?? match.plannedStartAt ?? match.startTime ?? null;
  return raw ? new Date(raw) : null;
};

const resolveCourtLabel = (match: MonitorMatch, locale: string) => {
  if (match.courtName) return match.courtName;
  if (match.courtNumber) return `${t("court", locale)} ${match.courtNumber}`;
  if (match.courtId) return `${t("court", locale)} ${match.courtId}`;
  return t("court", locale);
};

const resolveScoreSets = (match: MonitorMatch) => {
  if (Array.isArray(match.scoreSets) && match.scoreSets.length > 0) return match.scoreSets;
  const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : null;
  const sets = score?.sets;
  return Array.isArray(sets) ? (sets as Array<Record<string, unknown>>) : null;
};

const formatPadelSetsText = (sets?: Array<Record<string, unknown>> | null) => {
  if (!sets || sets.length === 0) return "";
  const resolved = sets
    .map((set) => {
      const a = Number((set as any).teamA ?? (set as any).a);
      const b = Number((set as any).teamB ?? (set as any).b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return `${a}-${b}`;
    })
    .filter(Boolean) as string[];
  return resolved.join(", ");
};

const parsePadelSetsText = (value: string) => {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((set) => set.split("-").map((entry) => Number(entry.trim())))
    .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([teamA, teamB]) => ({ teamA, teamB }));
};

const formatSets = (sets?: Array<Record<string, unknown>> | null) => {
  if (!sets || sets.length === 0) return "—";
  const resolved = sets
    .map((set) => {
      const a = Number((set as any).a ?? (set as any).teamA);
      const b = Number((set as any).b ?? (set as any).teamB);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return `${a}-${b}`;
    })
    .filter(Boolean) as string[];
  return resolved.length ? resolved.join(" · ") : "—";
};

const resolveResultType = (match: MonitorMatch) => {
  const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
  const resultType = typeof score.resultType === "string" ? score.resultType : null;
  const walkover = score.walkover === true || resultType === "WALKOVER";
  if (walkover) return "WALKOVER";
  if (resultType === "RETIREMENT") return "RETIREMENT";
  if (resultType === "INJURY") return "INJURY";
  return null;
};

const resolveDelayStatus = (match: MonitorMatch) => {
  const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
  return typeof score.delayStatus === "string" ? score.delayStatus : null;
};

function resolveMatchStatus(match: MonitorMatch, locale: string, now: Date) {
  const delayStatus = resolveDelayStatus(match);
  const resultType = resolveResultType(match);
  const startAt = resolveMatchStart(match);
  const isCalled = Boolean(startAt && startAt.getTime() - now.getTime() <= 10 * 60 * 1000);

  if (match.status === "IN_PROGRESS") return { label: t("liveNowLabel", locale), tone: "emerald" };
  if (match.status === "DONE") {
    if (resultType === "WALKOVER") return { label: t("scoreWalkover", locale), tone: "amber" };
    if (resultType === "RETIREMENT") return { label: t("scoreRetirement", locale), tone: "amber" };
    if (resultType === "INJURY") return { label: t("scoreInjury", locale), tone: "amber" };
    return { label: t("scoreFinal", locale), tone: "slate" };
  }
  if (match.status === "CANCELLED") return { label: t("scoreCancelled", locale), tone: "rose" };
  if (delayStatus === "DELAYED") return { label: t("scoreDelayed", locale), tone: "amber" };
  if (isCalled) return { label: t("scoreCalled", locale), tone: "sky" };
  return { label: t("pendingLabel", locale), tone: "slate" };
}

const toneClass = (tone: string) => {
  switch (tone) {
    case "emerald":
      return "border-emerald-400/50 bg-emerald-500/10 text-emerald-100";
    case "amber":
      return "border-amber-400/50 bg-amber-500/10 text-amber-100";
    case "rose":
      return "border-rose-400/50 bg-rose-500/10 text-rose-100";
    case "sky":
      return "border-sky-400/50 bg-sky-500/10 text-sky-100";
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
};

function OpsPanel({
  match,
  courts,
  locale,
  onUpdated,
}: {
  match: MonitorMatch;
  courts: MonitorCourtOption[];
  locale: string;
  onUpdated: () => void;
}) {
  const [setsText, setSetsText] = useState(() => formatPadelSetsText(resolveScoreSets(match)));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState("");
  const [clearSchedule, setClearSchedule] = useState(true);
  const [autoReschedule, setAutoReschedule] = useState(true);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(match.courtId ?? null);
  const [courtNumber, setCourtNumber] = useState(match.courtNumber ? String(match.courtNumber) : "");

  useEffect(() => {
    setSetsText(formatPadelSetsText(resolveScoreSets(match)));
    setSelectedCourtId(match.courtId ?? null);
    setCourtNumber(match.courtNumber ? String(match.courtNumber) : "");
  }, [match.id]);

  const submit = async (url: string, payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(sanitizeUiErrorMessage(json?.error, t("opsRequestFailed", locale)));
        return false;
      }
      return true;
    } catch {
      setError(t("opsRequestFailed", locale));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyScore = async (status: "IN_PROGRESS" | "DONE") => {
    const trimmed = setsText.trim();
    const sets = parsePadelSetsText(trimmed);
    if (trimmed && sets.length === 0) {
      setError(t("scoreInvalidFormat", locale));
      return;
    }
    if (status === "DONE" && sets.length === 0) {
      setError(t("scoreFinalRequired", locale));
      return;
    }
    const score = sets.length > 0 ? { resultType: "NORMAL", sets } : undefined;
    const ok = await submit("/api/padel/matches", {
      id: match.id,
      status,
      ...(score ? { score } : {}),
    });
    if (ok) {
      setMessage(status === "DONE" ? t("matchResultSaved", locale) : t("matchPartialUpdated", locale));
      onUpdated();
    }
  };

  const applySpecialResult = async (resultType: "WALKOVER" | "RETIREMENT" | "INJURY", winnerSide: "A" | "B") => {
    const label =
      resultType === "WALKOVER"
        ? t("scoreWalkover", locale)
        : resultType === "RETIREMENT"
          ? t("scoreRetirement", locale)
          : t("scoreInjury", locale);
    const confirmLabel =
      resultType === "WALKOVER"
        ? t("confirmWalkover", locale)
        : resultType === "RETIREMENT"
          ? t("confirmRetirement", locale)
          : t("confirmInjury", locale);
    if (!window.confirm(`${confirmLabel} ${label}?`)) return;
    const ok = await submit(`/api/padel/matches/${match.id}/walkover`, {
      winner: winnerSide,
      resultType,
      confirmedByRole: "DIRETOR_PROVA",
      confirmationSource: "WEB_ORGANIZATION",
    });
    if (ok) {
      setMessage(t("matchResultSaved", locale));
      onUpdated();
    }
  };

  const applyDelay = async () => {
    const ok = await submit(`/api/padel/matches/${match.id}/delay`, {
      reason: delayReason.trim() || null,
      clearSchedule,
      autoReschedule,
    });
    if (ok) {
      setMessage(t("opsDelayApplied", locale));
      onUpdated();
    }
  };

  const applyCourt = async () => {
    const trimmedNumber = courtNumber.trim();
    const parsedNumber = trimmedNumber ? Number(trimmedNumber) : null;
    if (!selectedCourtId && !(Number.isFinite(parsedNumber) && parsedNumber !== null)) {
      setError(t("opsCourtMissing", locale));
      return;
    }
    const ok = await submit("/api/padel/matches", {
      id: match.id,
      ...(selectedCourtId ? { courtId: selectedCourtId } : { courtNumber: parsedNumber }),
    });
    if (ok) {
      setMessage(t("opsCourtUpdated", locale));
      onUpdated();
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-[12px] text-white/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("opsActionsLabel", locale)}</p>
          <p className="text-[11px] text-white/50">{t("opsActionsHint", locale)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{t("opsScoreLabel", locale)}</p>
        <input
          value={setsText}
          onChange={(e) => setSetsText(e.target.value)}
          placeholder={t("scorePlaceholder", locale)}
          className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
        />
        <p className="text-[11px] text-white/50">{t("scoreFormatHint", locale)}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => applyScore("IN_PROGRESS")}
            className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
          >
            {saving ? t("matchSaving", locale) : t("matchSavePartial", locale)}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => applyScore("DONE")}
            className="rounded-full border border-emerald-400/40 px-3 py-1 text-[11px] text-emerald-100 hover:border-emerald-200/70 disabled:opacity-60"
          >
            {saving ? t("matchSaving", locale) : t("matchFinalize", locale)}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{t("walkoverRulesTitle", locale)}</p>
        <p className="text-[11px] text-white/50">{t("walkoverRulesHint", locale)}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => applySpecialResult("WALKOVER", "A")}
            className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
          >
            {t("scoreWalkover", locale)} A
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => applySpecialResult("WALKOVER", "B")}
            className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
          >
            {t("scoreWalkover", locale)} B
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => applySpecialResult("RETIREMENT", "A")}
            className="rounded-full border border-rose-400/40 px-3 py-1 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
          >
            {t("scoreRetirement", locale)} A
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => applySpecialResult("RETIREMENT", "B")}
            className="rounded-full border border-rose-400/40 px-3 py-1 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
          >
            {t("scoreRetirement", locale)} B
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => applySpecialResult("INJURY", "A")}
            className="rounded-full border border-sky-400/40 px-3 py-1 text-[11px] text-sky-100 hover:border-sky-200/70 disabled:opacity-60"
          >
            {t("scoreInjury", locale)} A
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => applySpecialResult("INJURY", "B")}
            className="rounded-full border border-sky-400/40 px-3 py-1 text-[11px] text-sky-100 hover:border-sky-200/70 disabled:opacity-60"
          >
            {t("scoreInjury", locale)} B
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{t("opsDelayLabel", locale)}</p>
        <input
          value={delayReason}
          onChange={(e) => setDelayReason(e.target.value)}
          placeholder={t("opsDelayReasonPlaceholder", locale)}
          className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
        />
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <input
            type="checkbox"
            checked={clearSchedule}
            onChange={(e) => setClearSchedule(e.target.checked)}
            className="h-4 w-4 rounded border border-white/30 bg-black/40"
          />
          {t("opsDelayClearSchedule", locale)}
        </label>
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <input
            type="checkbox"
            checked={autoReschedule}
            onChange={(e) => setAutoReschedule(e.target.checked)}
            className="h-4 w-4 rounded border border-white/30 bg-black/40"
          />
          {t("opsDelayAutoReschedule", locale)}
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={applyDelay}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
        >
          {saving ? t("matchSaving", locale) : t("opsDelayApply", locale)}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{t("opsCourtLabel", locale)}</p>
        {courts.length > 0 && (
          <select
            value={selectedCourtId ?? ""}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : null;
              setSelectedCourtId(Number.isFinite(value) ? value : null);
            }}
            className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          >
            <option value="">{t("opsCourtSelect", locale)}</option>
            {courts.map((court) => (
              <option key={`court-${court.id}`} value={court.id}>
                {court.name}
              </option>
            ))}
          </select>
        )}
        <input
          value={courtNumber}
          onChange={(e) => setCourtNumber(e.target.value)}
          placeholder={t("opsCourtNumberPlaceholder", locale)}
          className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          disabled={saving}
          onClick={applyCourt}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
        >
          {saving ? t("matchSaving", locale) : t("opsCourtApply", locale)}
        </button>
      </div>

      {message && <p className="text-[11px] text-emerald-200">{message}</p>}
      {error && <p className="text-[11px] text-rose-200">{error}</p>}
    </div>
  );
}

export default function PadelMonitorClient({
  event,
  initialMatches,
  lang,
  tvMonitor,
  courtOptions = [],
  canOperate = false,
}: {
  event: MonitorEvent;
  initialMatches: MonitorMatch[];
  lang?: string | null;
  tvMonitor?: TvMonitorConfig | null;
  courtOptions?: MonitorCourtOption[];
  canOperate?: boolean;
}) {
  const locale = resolveLocale(lang);
  const [matches, setMatches] = useState<MonitorMatch[]>(initialMatches);
  const timeZone = event.timezone ?? "Europe/Lisbon";
  const [opsMatchId, setOpsMatchId] = useState<number | null>(null);

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

  const refreshMatches = async () => {
    try {
      const res = await fetch(`/api/padel/matches?eventId=${event.id}`);
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && Array.isArray(json.items)) {
        setMatches(json.items);
      }
    } catch {
      // ignore refresh failures
    }
  };

  const courts = useMemo(() => {
    const groups = new Map<
      string,
      {
        courtId: number | null;
        courtLabel: string;
        matches: MonitorMatch[];
      }
    >();

    matches.forEach((match) => {
      const label = resolveCourtLabel(match, locale);
      const courtKey = match.courtId ? `id:${match.courtId}` : `label:${label}`;
      if (!groups.has(courtKey)) {
        groups.set(courtKey, { courtId: match.courtId ?? null, courtLabel: label, matches: [] });
      }
      groups.get(courtKey)!.matches.push(match);
    });

    const now = new Date();

    return Array.from(groups.values())
      .map((group) => {
        const sorted = [...group.matches].sort((a, b) => {
          const aStart = resolveMatchStart(a)?.getTime() ?? 0;
          const bStart = resolveMatchStart(b)?.getTime() ?? 0;
          if (aStart !== bStart) return aStart - bStart;
          return a.id - b.id;
        });

        const live = sorted.find((m) => m.status === "IN_PROGRESS");
        const pending = sorted.filter((m) => m.status !== "DONE" && m.status !== "CANCELLED");
        const next = live ?? pending.find((m) => {
          const startAt = resolveMatchStart(m);
          return !startAt || startAt.getTime() >= now.getTime() - 15 * 60 * 1000;
        }) ?? null;

        const queue = next
          ? pending.filter((m) => m.id !== next.id).slice(0, 3)
          : pending.slice(0, 3);

        return {
          ...group,
          current: next,
          queue,
        };
      })
      .sort((a, b) => a.courtLabel.localeCompare(b.courtLabel));
  }, [matches, locale]);

  return (
    <div className="min-h-screen px-4 py-6 text-white">
      <div className="orya-page-width space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("monitorTitle", locale)}</p>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-sm text-white/60">{t("monitorSubtitle", locale)}</p>
          </div>
          <div className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] text-white/70">
            {t("padel", locale)}
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">{t("monitorCourtsTitle", locale)}</h2>
            <span className="text-[12px] text-white/60">{courts.length} {t("courtLabel", locale)}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courts.length === 0 && (
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/60">
                {t("monitorNoMatches", locale)}
              </div>
            )}
            {courts.map((court) => {
              const current = court.current;
              const now = new Date();
              const status = current ? resolveMatchStatus(current, locale, now) : null;
              const sets = current ? resolveScoreSets(current) : null;
              const scoreLabel = current ? formatSets(sets as any) : "—";
              const startAt = current ? resolveMatchStart(current) : null;
              const opsMatch = opsMatchId
                ? [current, ...court.queue].find((m) => m && m.id === opsMatchId) ?? null
                : null;
              const isOpsOpen = Boolean(opsMatch);
              return (
                <div
                  key={`${court.courtId ?? "court"}-${court.courtLabel}`}
                  className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{t("courtLabel", locale)}</p>
                      <h3 className="text-lg font-semibold text-white">{court.courtLabel}</h3>
                    </div>
                    {status && (
                      <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${toneClass(status.tone)}`}>
                        {status.label}
                      </span>
                    )}
                  </div>

                  {current ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-white">
                        {pairingLabel(current.pairingA?.slots, t("pairing", locale))} vs {pairingLabel(current.pairingB?.slots, t("pairing", locale))}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/70">
                        <span>
                          {t("monitorNowLabel", locale)} · {startAt ? formatTime(startAt, locale, timeZone) : "—"}
                        </span>
                        <span className="text-white/90">{scoreLabel}</span>
                      </div>
                      {canOperate && (
                        <button
                          type="button"
                          onClick={() => setOpsMatchId(isOpsOpen ? null : current.id)}
                          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                        >
                          {isOpsOpen ? t("opsClose", locale) : t("opsOpen", locale)}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] text-white/60">{t("monitorNoMatches", locale)}</p>
                  )}

                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{t("monitorQueueLabel", locale)}</p>
                    {court.queue.length === 0 && (
                      <p className="text-[12px] text-white/50">{t("monitorQueueEmpty", locale)}</p>
                    )}
                    {court.queue.map((match) => {
                      const nextStart = resolveMatchStart(match);
                      const isQueueOpsOpen = opsMatchId === match.id;
                      return (
                        <div key={`queue-${match.id}`} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                          <p className="text-[12px] text-white/80">
                            {pairingLabel(match.pairingA?.slots, t("pairing", locale))} vs {pairingLabel(match.pairingB?.slots, t("pairing", locale))}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/50">
                            <span>{nextStart ? formatTime(nextStart, locale, timeZone) : "—"}</span>
                            {canOperate && (
                              <button
                                type="button"
                                onClick={() => setOpsMatchId(isQueueOpsOpen ? null : match.id)}
                                className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/60 hover:border-white/40"
                              >
                                {isQueueOpsOpen ? t("opsClose", locale) : t("opsOpen", locale)}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canOperate && opsMatch && isOpsOpen && (
                    <OpsPanel
                      match={opsMatch}
                      courts={courtOptions}
                      locale={locale}
                      onUpdated={refreshMatches}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {(tvMonitor?.sponsors?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("sponsors", locale)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(tvMonitor?.sponsors ?? []).map((sponsor) => (
                <span
                  key={sponsor}
                  className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[12px] text-white/80"
                >
                  {sponsor}
                </span>
              ))}
            </div>
          </section>
        )}

        {tvMonitor?.footerText && (
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
            {tvMonitor.footerText}
          </div>
        )}
      </div>
    </div>
  );
}
