"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime, resolveLocale, t } from "@/lib/i18n";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

type PairingSlot = {
  playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
};

type Pairing = {
  slots?: PairingSlot[] | null;
};

type LiveMatch = {
  id: number;
  status: string;
  plannedStartAt?: string | null;
  startTime?: string | null;
  courtName?: string | null;
  courtNumber?: number | null;
  courtId?: number | null;
  pairingA?: Pairing | null;
  pairingB?: Pairing | null;
};

type NextItem = {
  id: number;
  startAt: string | null;
  court: string | null;
  teamA: string;
  teamB: string;
  status: string;
};

type NextMatchesWidgetClientProps = {
  eventId: number;
  eventSlug?: string | null;
  timezone?: string | null;
  locale?: string;
  title: string;
  initialItems: NextItem[];
};

const pairingLabel = (pairing?: Pairing | null) => {
  const names =
    pairing?.slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : "";
};

const buildNextItems = (matches: LiveMatch[]) => {
  const items = matches
    .map((m) => {
      const startAt = m.plannedStartAt ?? m.startTime ?? null;
      if (!startAt) return null;
      const court =
        m.courtName ||
        (typeof m.courtNumber === "number" && Number.isFinite(m.courtNumber)
          ? `Quadra ${m.courtNumber}`
          : typeof m.courtId === "number" && Number.isFinite(m.courtId)
            ? `Quadra ${m.courtId}`
            : null);
      return {
        id: m.id,
        startAt,
        court,
        teamA: pairingLabel(m.pairingA),
        teamB: pairingLabel(m.pairingB),
        status: m.status,
      };
    })
    .filter(Boolean) as NextItem[];

  items.sort((a, b) => {
    const at = a.startAt ? new Date(a.startAt).getTime() : 0;
    const bt = b.startAt ? new Date(b.startAt).getTime() : 0;
    return at - bt;
  });
  return items.slice(0, 8);
};

const fetchMatches = async (eventId: number) => {
  const res = await fetch(`/api/padel/matches?eventId=${encodeURIComponent(String(eventId))}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(sanitizeUiErrorMessage(data?.error, "Não foi possível carregar próximos jogos."));
  }
  return (Array.isArray(data?.items) ? data.items : []) as LiveMatch[];
};

export default function NextMatchesWidgetClient({
  eventId,
  eventSlug,
  timezone,
  locale,
  title,
  initialItems,
}: NextMatchesWidgetClientProps) {
  const resolvedLocale = resolveLocale(locale);
  const [items, setItems] = useState<NextItem[]>(initialItems);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!eventId || !eventSlug) return;
    let closed = false;
    const source = new EventSource(
      `/api/live/events/${encodeURIComponent(eventSlug)}/stream?eventId=${encodeURIComponent(String(eventId))}`,
    );

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
          const nextItems = buildNextItems(
            matches.filter((m) => ["PENDING", "IN_PROGRESS"].includes(m.status)),
          );
          setItems(nextItems);
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
          const nextItems = buildNextItems(
            (payload.matches as LiveMatch[]).filter((m) => ["PENDING", "IN_PROGRESS"].includes(m.status)),
          );
          setItems(nextItems);
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
  }, [eventId, eventSlug]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] px-4 py-4 text-white">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{t("nextMatches", resolvedLocale)}</p>
            <h1 className="text-base font-semibold">{title || t("tournament", resolvedLocale)}</h1>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {realtimeActive ? "Live" : "Sync"}
          </span>
        </div>
        {!hasItems && <p className="text-[12px] text-white/70">{t("noMatches", resolvedLocale)}</p>}
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {m.teamA || t("pairing", resolvedLocale)} vs {m.teamB || t("pairing", resolvedLocale)}
                </span>
                <span className="text-white/60">{m.status}</span>
              </div>
              <p className="text-white/60">
                {m.startAt ? formatDateTime(new Date(m.startAt), resolvedLocale, timezone ?? null) : "—"} ·{" "}
                {m.court ?? t("court", resolvedLocale)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
