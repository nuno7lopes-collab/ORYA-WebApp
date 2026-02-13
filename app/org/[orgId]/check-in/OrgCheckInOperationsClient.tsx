"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

type CheckInOperationsMode = "sessions" | "logs" | "devices";

type OrgCheckInOperationsClientProps = {
  orgId: number;
  mode: CheckInOperationsMode;
};

type OrgEventItem = {
  id: number;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  locationFormattedAddress: string | null;
  status: string | null;
  ticketsSold?: number | null;
  capacity?: number | null;
};

type CheckInLogItem = {
  entitlementId: string;
  status: string;
  holder: {
    name: string | null;
    email: string | null;
    type: string | null;
  };
  checkedInAt: string | null;
  snapshot: {
    title: string | null;
    startAt: string | null;
    timezone: string | null;
  };
};

const DEVICE_STORAGE_KEY = "oryaCheckinDeviceId";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseEventId(raw: string | null | undefined) {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildLocalDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `device-${Math.random().toString(36).slice(2, 12)}`;
}

export default function OrgCheckInOperationsClient({ orgId, mode }: OrgCheckInOperationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<OrgEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(mode !== "devices");
  const [eventsError, setEventsError] = useState<string | null>(null);
  const queryEventId = parseEventId(searchParams?.get("eventId"));
  const [selectedEventId, setSelectedEventId] = useState<number | null>(queryEventId);
  const [searchText, setSearchText] = useState("");

  const syncEventQuery = useCallback(
    (nextEventId: number | null) => {
      const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
      if (nextEventId && Number.isFinite(nextEventId)) {
        nextParams.set("eventId", String(nextEventId));
      } else {
        nextParams.delete("eventId");
      }
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (queryEventId && queryEventId !== selectedEventId) {
      setSelectedEventId(queryEventId);
    }
  }, [queryEventId, selectedEventId]);

  const loadEvents = useCallback(async () => {
    if (mode === "devices") {
      setEvents([]);
      setEventsLoading(false);
      setEventsError(null);
      return;
    }
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/events/list?limit=120`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Nao foi possivel carregar eventos.");
      }
      const nextEvents = json.items as OrgEventItem[];
      setEvents(nextEvents);
      setSelectedEventId((prev) => {
        if (prev && nextEvents.some((event) => event.id === prev)) return prev;
        if (queryEventId && nextEvents.some((event) => event.id === queryEventId)) return queryEventId;
        return nextEvents[0]?.id ?? null;
      });
    } catch (err) {
      setEvents([]);
      setEventsError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setEventsLoading(false);
    }
  }, [mode, orgId, queryEventId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const eventsFiltered = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();
    if (!trimmed) return events;
    return events.filter((event) => {
      const title = event.title?.toLowerCase() ?? "";
      const location = event.locationFormattedAddress?.toLowerCase() ?? "";
      return title.includes(trimmed) || location.includes(trimmed);
    });
  }, [events, searchText]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const sessionsView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Check-in Tool</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Sessions</h1>
          <p className="mt-1 text-sm text-white/65">
            Escolhe o evento e arranca scanner/lista sem sair do fluxo operacional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={eventsLoading}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
        >
          {eventsLoading ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/70">
          {eventsLoading ? "A carregar eventos..." : `${events.length} eventos disponiveis`}
        </p>
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Pesquisar evento..."
          className="w-full rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF] sm:w-72"
        />
      </div>

      {eventsError ? (
        <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {eventsError}
        </div>
      ) : null}

      {!eventsLoading && !eventsError && eventsFiltered.length === 0 ? (
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
          Nenhum evento encontrado.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {eventsFiltered.map((event) => {
          const eventIdQuery = { eventId: String(event.id) };
          const selected = selectedEventId === event.id;
          return (
            <article
              key={event.id}
              className={`rounded-2xl border px-4 py-4 transition ${
                selected ? "border-[#6BFFFF]/45 bg-[#6BFFFF]/10" : "border-white/12 bg-white/5 hover:border-white/30"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedEventId(event.id);
                  syncEventQuery(event.id);
                }}
                className="w-full text-left"
              >
                <p className="text-sm font-semibold text-white">{event.title || `Evento #${event.id}`}</p>
                <p className="mt-1 text-[12px] text-white/60">
                  {formatDateTime(event.startsAt)}
                  {event.locationFormattedAddress ? ` · ${event.locationFormattedAddress}` : ""}
                </p>
                <p className="mt-1 text-[12px] text-white/60">
                  Bilhetes: {event.ticketsSold ?? 0}
                  {typeof event.capacity === "number" && event.capacity > 0 ? ` / ${event.capacity}` : ""}
                </p>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={buildOrgHref(orgId, "/check-in/scanner", eventIdQuery)}
                  className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-400/20"
                >
                  Abrir scanner
                </Link>
                <Link
                  href={buildOrgHref(orgId, "/check-in/list", eventIdQuery)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
                >
                  Abrir lista
                </Link>
                <Link
                  href={buildOrgHref(orgId, "/check-in/logs", eventIdQuery)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
                >
                  Ver logs
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const [logItems, setLogItems] = useState<CheckInLogItem[]>([]);
  const [logCursor, setLogCursor] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(mode === "logs");
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (eventId: number, cursor?: string | null) => {
      if (!Number.isFinite(eventId) || eventId <= 0) return;
      if (cursor) {
        setLogsLoadingMore(true);
      } else {
        setLogsLoading(true);
        setLogsError(null);
      }
      try {
        const params = new URLSearchParams({ status: "CHECKED_IN", pageSize: "40" });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/org/${orgId}/events/${eventId}/attendees?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || !Array.isArray(json.items)) {
          throw new Error((json as { error?: string } | null)?.error || "Nao foi possivel carregar logs.");
        }
        const nextItems = json.items as CheckInLogItem[];
        const nextCursor = typeof json.nextCursor === "string" ? json.nextCursor : null;
        setLogItems((prev) => (cursor ? [...prev, ...nextItems] : nextItems));
        setLogCursor(nextCursor);
      } catch (err) {
        if (!cursor) setLogItems([]);
        setLogsError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setLogsLoading(false);
        setLogsLoadingMore(false);
      }
    },
    [orgId],
  );

  useEffect(() => {
    if (mode !== "logs") return;
    if (!selectedEventId) {
      setLogItems([]);
      setLogCursor(null);
      setLogsLoading(false);
      return;
    }
    void loadLogs(selectedEventId, null);
  }, [loadLogs, mode, selectedEventId]);

  const logsView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Check-in Tool</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Logs</h1>
          <p className="mt-1 text-sm text-white/65">Auditoria de entradas com filtro por evento e paginação.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (selectedEventId) void loadLogs(selectedEventId, null);
          }}
          disabled={logsLoading || !selectedEventId}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
        >
          {logsLoading ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <select
          value={selectedEventId ?? ""}
          onChange={(event) => {
            const next = parseEventId(event.target.value);
            setSelectedEventId(next);
            syncEventQuery(next);
          }}
          className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
        >
          <option value="">Seleciona um evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title || `Evento #${event.id}`}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {selectedEventId ? (
            <>
              <Link
                href={buildOrgHref(orgId, "/check-in/scanner", { eventId: String(selectedEventId) })}
                className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-2 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-400/20"
              >
                Scanner
              </Link>
              <Link
                href={buildOrgHref(orgId, "/check-in/list", { eventId: String(selectedEventId) })}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/15"
              >
                Lista
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {selectedEvent ? (
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-[12px] text-white/70">
          {selectedEvent.title || `Evento #${selectedEvent.id}`} · {formatDateTime(selectedEvent.startsAt)}
          {selectedEvent.locationFormattedAddress ? ` · ${selectedEvent.locationFormattedAddress}` : ""}
        </div>
      ) : null}

      {eventsError ? (
        <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {eventsError}
        </div>
      ) : null}

      {logsError ? (
        <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {logsError}
        </div>
      ) : null}

      {logsLoading ? (
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
          A carregar logs...
        </div>
      ) : null}

      {!logsLoading && !logsError && selectedEventId && logItems.length === 0 ? (
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
          Sem check-ins para este evento.
        </div>
      ) : null}

      <div className="space-y-3">
        {logItems.map((item) => (
          <article
            key={item.entitlementId}
            className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{item.holder.name || "Participante"}</p>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                {item.status}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-white/60">
              {item.holder.email || "Sem email"} · {formatDateTime(item.checkedInAt)}
            </p>
            <p className="mt-1 text-[12px] text-white/55">
              {item.snapshot.title || "Sem titulo"} · {formatDateTime(item.snapshot.startAt)}
            </p>
          </article>
        ))}
      </div>

      {logCursor ? (
        <button
          type="button"
          onClick={() => {
            if (selectedEventId) void loadLogs(selectedEventId, logCursor);
          }}
          disabled={logsLoadingMore}
          className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
        >
          {logsLoadingMore ? "A carregar..." : "Carregar mais"}
        </button>
      ) : null}
    </section>
  );

  const [deviceId, setDeviceId] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (mode !== "devices") return;
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) {
      setDeviceId(existing);
    } else {
      const next = buildLocalDeviceId();
      window.localStorage.setItem(DEVICE_STORAGE_KEY, next);
      setDeviceId(next);
    }
    const syncOnlineState = () => setIsOnline(window.navigator.onLine);
    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, [mode]);

  const deviceMeta = useMemo(() => {
    if (mode !== "devices" || typeof navigator === "undefined") {
      return null;
    }
    return {
      userAgent: navigator.userAgent || "Desconhecido",
      language: navigator.language || "Desconhecido",
      platform: navigator.platform || "Desconhecido",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Desconhecido",
    };
  }, [mode]);

  const regenerateDeviceId = useCallback(() => {
    const next = buildLocalDeviceId();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, next);
    setDeviceId(next);
    setCopyState("idle");
  }, []);

  const copyDeviceId = useCallback(async () => {
    if (!deviceId) return;
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopyState("ok");
    } catch {
      setCopyState("error");
    }
  }, [deviceId]);

  const devicesView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Check-in Tool</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Devices</h1>
          <p className="mt-1 text-sm text-white/65">
            Identidade local do posto de check-in e diagnostico operacional basico.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
            isOnline
              ? "border-emerald-300/45 bg-emerald-400/15 text-emerald-100"
              : "border-amber-300/45 bg-amber-400/15 text-amber-100"
          }`}
        >
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Device ID</p>
        <p className="mt-2 break-all rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm text-white/90">
          {deviceId || "A carregar..."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyDeviceId()}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
          >
            Copiar ID
          </button>
          <button
            type="button"
            onClick={regenerateDeviceId}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
          >
            Regenerar ID
          </button>
          {copyState === "ok" ? <span className="text-[12px] text-emerald-200">Copiado.</span> : null}
          {copyState === "error" ? <span className="text-[12px] text-rose-200">Falha ao copiar.</span> : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Timezone</p>
          <p className="mt-1 text-sm text-white/85">{deviceMeta?.timezone ?? "Desconhecido"}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Idioma</p>
          <p className="mt-1 text-sm text-white/85">{deviceMeta?.language ?? "Desconhecido"}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Plataforma</p>
          <p className="mt-1 text-sm text-white/85">{deviceMeta?.platform ?? "Desconhecido"}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Estado de rede</p>
          <p className="mt-1 text-sm text-white/85">{isOnline ? "Ligado" : "Sem ligacao"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">User agent</p>
        <p className="mt-1 break-words text-xs text-white/70">{deviceMeta?.userAgent ?? "Desconhecido"}</p>
      </div>
    </section>
  );

  if (mode === "sessions") {
    return <div className="space-y-5 text-white">{sessionsView}</div>;
  }
  if (mode === "logs") {
    return <div className="space-y-5 text-white">{logsView}</div>;
  }
  return <div className="space-y-5 text-white">{devicesView}</div>;
}
