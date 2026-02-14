"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { resolveLocale, t } from "@/lib/i18n";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type RankingItem = {
  position: number;
  points: number;
  player: {
    id: string;
    fullName: string;
    level?: string | null;
  };
};

type RankingResponse = {
  ok?: boolean;
  items?: RankingItem[];
  error?: string;
};

type ScopeMode = "global" | "organization";

type PadelRankingsClientProps = {
  eventId?: number | null;
  scope?: ScopeMode;
  organizationId?: number | null;
  showFilters?: boolean;
  compact?: boolean;
  locale?: string | null;
};

function toneForPosition(position: number) {
  if (position === 1) return "border-[#6BFFFF]/40 bg-[#6BFFFF]/10 text-white";
  if (position === 2) return "border-emerald-400/40 bg-emerald-400/10 text-emerald-50";
  if (position === 3) return "border-amber-400/40 bg-amber-400/10 text-amber-50";
  return "border-white/15 bg-white/5 text-white/80";
}

export default function PadelRankingsClient({
  eventId,
  scope = "global",
  organizationId,
  showFilters = true,
  compact = false,
  locale,
}: PadelRankingsClientProps) {
  const resolvedLocale = resolveLocale(locale);
  const [periodDays, setPeriodDays] = useState<number>(90);
  const [level, setLevel] = useState("");
  const [city, setCity] = useState("");

  const periodOptions = useMemo(
    () => [
      { label: t("period30Days", resolvedLocale), value: 30 },
      { label: t("period90Days", resolvedLocale), value: 90 },
      { label: t("period12Months", resolvedLocale), value: 365 },
    ],
    [resolvedLocale],
  );

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (eventId) {
      params.set("eventId", String(eventId));
    } else {
      params.set("scope", scope);
      if (scope === "organization" && organizationId) {
        params.set("organizationId", String(organizationId));
      }
    }
    if (periodDays) params.set("periodDays", String(periodDays));
    if (level.trim()) params.set("level", level.trim());
    if (city.trim()) params.set("city", city.trim());
    params.set("limit", compact ? "20" : "80");
    return params.toString();
  }, [eventId, scope, organizationId, periodDays, level, city, compact]);

  const { data, isLoading } = useSWR<RankingResponse>(`/api/padel/rankings?${query}`, fetcher, {
    revalidateOnFocus: false,
  });

  const items = Array.isArray(data?.items) ? data?.items : [];
  const errorLabel =
    data?.ok === false ? sanitizeUiErrorMessage(data?.error, t("rankingLoadError", resolvedLocale)) : null;
  const top = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <div className={cn("space-y-6", compact ? "text-sm" : "text-base")}> 
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
              {t("filtersLabel", resolvedLocale)}
            </p>
            <p className="text-xs text-white/70">
              {t("filtersHint", resolvedLocale)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={periodDays}
              onChange={(event) => setPeriodDays(Number(event.target.value))}
              className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("cityPlaceholder", resolvedLocale)}
              className="w-28 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80 placeholder:text-white/40"
            />
            <input
              type="text"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              placeholder={t("levelPlaceholder", resolvedLocale)}
              className="w-24 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80 placeholder:text-white/40"
            />
          </div>
        </div>
      )}

      {errorLabel ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-50">
          {errorLabel}
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
          {t("rankingLoading", resolvedLocale)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
          {t("rankingEmpty", resolvedLocale)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {top.map((entry) => (
              <div
                key={entry.player.id}
                className={cn(
                  "rounded-2xl border px-4 py-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
                  toneForPosition(entry.position),
                )}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">#{entry.position}</p>
                <p className="mt-2 text-lg font-semibold text-white">{entry.player.fullName}</p>
                <p className="text-[12px] text-white/70">
                  {entry.points} {t("pointsShort", resolvedLocale)}
                </p>
                {entry.player.level && (
                  <span className="mt-2 inline-flex rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                    {t("levelLabel", resolvedLocale)} {entry.player.level}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/60">
              <span>{t("fullRankingLabel", resolvedLocale)}</span>
              <span>
                {items.length} {t("playersLabel", resolvedLocale)}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {rest.map((entry) => (
                <div
                  key={entry.player.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-white/60">#{entry.position}</span>
                    <div>
                      <p className="text-sm text-white/90">{entry.player.fullName}</p>
                      {entry.player.level && (
                        <p className="text-[11px] text-white/50">
                          {t("levelLabel", resolvedLocale)} {entry.player.level}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] text-white/70">
                    {entry.points} {t("pointsShort", resolvedLocale)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
