"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

type CheckInOperationsMode = "sessions" | "list" | "logs" | "devices";

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

type CheckInAttendeeItem = {
  entitlementId: string;
  status: string;
  holder: {
    name: string | null;
    email: string | null;
    type: string | null;
  };
  checkedInAt: string | null;
  checkinMethod?: string | null;
  checkinManualReason?: string | null;
  checkedInByLabel?: string | null;
  snapshot: {
    title: string | null;
    startAt: string | null;
    timezone: string | null;
  };
};

type CheckinResultPayload = {
  code?: string;
  checkedInAt?: string | null;
};

const DEVICE_STORAGE_KEY = "oryaCheckinDeviceId";
const MANUAL_LIST_ENABLED = process.env.NEXT_PUBLIC_CHECKIN_MANUAL_LIST_ENABLED !== "false";

const LIST_STATUS_FILTERS = [
  { key: "ACTIVE", label: "Ativos" },
  { key: "CHECKED_IN", label: "Check-in feito" },
  { key: "SUSPENDED", label: "Suspensos" },
  { key: "REVOKED", label: "Revogados" },
  { key: "PENDING", label: "Pendentes" },
] as const;

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

function readEnvelopeData<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const payload = json as Record<string, unknown>;
  if (payload.data && typeof payload.data === "object") {
    return payload.data as T;
  }
  return payload as unknown as T;
}

function statusTone(status: string) {
  if (status === "CHECKED_IN") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
  if (status === "SUSPENDED" || status === "REVOKED") return "border-rose-400/40 bg-rose-500/10 text-rose-100";
  if (status === "PENDING") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-white/20 bg-white/10 text-white/85";
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

  const [deviceId, setDeviceId] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");
  const [isOnline, setIsOnline] = useState(true);

  const [listItems, setListItems] = useState<CheckInAttendeeItem[]>([]);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(mode === "list");
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [listStatuses, setListStatuses] = useState<string[]>([]);
  const [selectedForManual, setSelectedForManual] = useState<CheckInAttendeeItem | null>(null);
  const [manualReason, setManualReason] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);

  const [logItems, setLogItems] = useState<CheckInAttendeeItem[]>([]);
  const [logCursor, setLogCursor] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(mode === "logs");
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

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
      const data = readEnvelopeData<{ ok?: boolean; items?: OrgEventItem[]; error?: string }>(json);
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        throw new Error(data?.error || "Não foi possível carregar eventos.");
      }
      const nextEvents = data.items;
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

  useEffect(() => {
    if (mode !== "devices" && mode !== "list") return;
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

  const loadList = useCallback(
    async (eventId: number, cursor?: string | null) => {
      if (!Number.isFinite(eventId) || eventId <= 0) return;
      if (cursor) {
        setListLoadingMore(true);
      } else {
        setListLoading(true);
        setListError(null);
      }
      try {
        const params = new URLSearchParams({ pageSize: "40" });
        const trimmedSearch = listSearch.trim();
        if (trimmedSearch) params.set("search", trimmedSearch);
        if (listStatuses.length > 0) params.set("status", listStatuses.join(","));
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/org/${orgId}/events/${eventId}/attendees?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        const data = readEnvelopeData<{ items?: CheckInAttendeeItem[]; nextCursor?: string | null; error?: string }>(json);
        if (!res.ok || !data || !Array.isArray(data.items)) {
          throw new Error(data?.error || "Não foi possível carregar a lista.");
        }
        setListItems((prev) => (cursor ? [...prev, ...data.items!] : data.items!));
        setListCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
      } catch (err) {
        if (!cursor) setListItems([]);
        setListError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setListLoading(false);
        setListLoadingMore(false);
      }
    },
    [listSearch, listStatuses, orgId],
  );

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
        const data = readEnvelopeData<{ items?: CheckInAttendeeItem[]; nextCursor?: string | null; error?: string }>(json);
        if (!res.ok || !data || !Array.isArray(data.items)) {
          throw new Error(data?.error || "Não foi possível carregar os registos.");
        }
        setLogItems((prev) => (cursor ? [...prev, ...data.items!] : data.items!));
        setLogCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
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
    if (mode !== "list") return;
    if (!selectedEventId) {
      setListItems([]);
      setListCursor(null);
      setListLoading(false);
      return;
    }
    setSelectedForManual(null);
    setManualReason("");
    setManualFeedback(null);
    setManualConfirmOpen(false);
    void loadList(selectedEventId, null);
  }, [loadList, mode, selectedEventId]);

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

  const toggleListStatus = useCallback((status: string) => {
    setListStatuses((prev) => (prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]));
  }, []);

  const canManualConfirm = useMemo(() => {
    if (!selectedForManual) return false;
    if (!MANUAL_LIST_ENABLED) return false;
    if (selectedForManual.status !== "ACTIVE") return false;
    if (selectedForManual.checkedInAt) return false;
    if (!selectedEventId || !deviceId) return false;
    return manualReason.trim().length >= 4;
  }, [deviceId, manualReason, selectedEventId, selectedForManual]);

  const handleManualConfirm = useCallback(async () => {
    if (!selectedForManual || !selectedEventId || !deviceId || !MANUAL_LIST_ENABLED) return;
    setManualSubmitting(true);
    setManualFeedback(null);
    try {
      const res = await fetch(`/api/org/${orgId}/checkin/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          entitlementId: selectedForManual.entitlementId,
          deviceId,
          reason: manualReason.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      const data = readEnvelopeData<CheckinResultPayload>(json);
      if (!res.ok) {
        throw new Error("Não foi possível confirmar o check-in manual.");
      }
      const resultCode = data?.code ?? "UNKNOWN";
      if (resultCode === "OK") {
        setManualFeedback("Check-in manual confirmado.");
      } else if (resultCode === "ALREADY_USED") {
        setManualFeedback("Já existia check-in para este participante.");
      } else {
        setManualFeedback(`Bloqueado: ${resultCode}.`);
      }
      await loadList(selectedEventId, null);
    } catch (err) {
      setManualFeedback(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setManualSubmitting(false);
      setManualConfirmOpen(false);
    }
  }, [deviceId, loadList, manualReason, orgId, selectedEventId, selectedForManual]);

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

  const sessionsView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Ferramenta Check-in</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Sessões</h1>
          <p className="mt-1 text-sm text-white/65">
            Seleciona um evento e abre scanner, lista operacional ou registos sem sair do fluxo.
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
          {eventsLoading ? "A carregar eventos..." : `${events.length} eventos disponíveis`}
        </p>
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Pesquisar evento..."
          className="w-full rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] sm:w-72"
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
                selected ? "border-[#22D3EE]/45 bg-[#22D3EE]/10" : "border-white/12 bg-white/5 hover:border-white/30"
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
                  Scanner
                </Link>
                <Link
                  href={buildOrgHref(orgId, "/check-in/list", eventIdQuery)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
                >
                  Lista
                </Link>
                <Link
                  href={buildOrgHref(orgId, "/check-in/logs", eventIdQuery)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
                >
                  Registos
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const listView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Ferramenta Check-in</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Lista operacional</h1>
          <p className="mt-1 text-sm text-white/65">
            Pesquisa participantes, pré-valida o estado e confirma manualmente com motivo auditável.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={selectedEventId ? buildOrgHref(orgId, "/check-in/scanner", { eventId: String(selectedEventId) }) : buildOrgHref(orgId, "/check-in/scanner")}
            className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-2 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-400/20"
          >
            Abrir scanner
          </Link>
          <button
            type="button"
            onClick={() => {
              if (selectedEventId) void loadList(selectedEventId, null);
            }}
            disabled={listLoading || !selectedEventId}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
          >
            {listLoading ? "A atualizar..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={listSearch}
          onChange={(event) => setListSearch(event.target.value)}
          placeholder="Pesquisar por nome, email ou título..."
          className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE]"
        />
        <select
          value={selectedEventId ?? ""}
          onChange={(event) => {
            const next = parseEventId(event.target.value);
            setSelectedEventId(next);
            syncEventQuery(next);
          }}
          className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE]"
        >
          <option value="">Seleciona um evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title || `Evento #${event.id}`}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {LIST_STATUS_FILTERS.map((status) => {
          const active = listStatuses.includes(status.key);
          return (
            <button
              key={status.key}
              type="button"
              onClick={() => toggleListStatus(status.key)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                active
                  ? "border-[#22D3EE]/60 bg-[#22D3EE]/15 text-[#C7FFFF]"
                  : "border-white/20 bg-white/5 text-white/70 hover:border-white/35"
              }`}
            >
              {status.label}
            </button>
          );
        })}
      </div>

      {!MANUAL_LIST_ENABLED ? (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Check-in manual desativado por feature flag.
        </div>
      ) : null}

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

      {listError ? (
        <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {listError}
        </div>
      ) : null}

      {listLoading ? (
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
          A carregar lista...
        </div>
      ) : null}

      {!listLoading && !listError && selectedEventId && listItems.length === 0 ? (
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
          Sem participantes para os filtros aplicados.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {listItems.map((item) => {
            const selected = selectedForManual?.entitlementId === item.entitlementId;
            const canPrecheck = item.status === "ACTIVE" && !item.checkedInAt;
            return (
              <article
                key={item.entitlementId}
                className={`rounded-2xl border px-4 py-3 ${selected ? "border-[#22D3EE]/45 bg-[#22D3EE]/10" : "border-white/12 bg-white/5"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.holder.name || "Participante"}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-white/60">
                  {item.holder.email || "Sem email"}
                  {item.checkedInAt ? ` · ${formatDateTime(item.checkedInAt)}` : ""}
                </p>
                <p className="mt-1 text-[12px] text-white/55">
                  {item.snapshot.title || "Sem título"} · {formatDateTime(item.snapshot.startAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedForManual(item);
                      setManualFeedback(null);
                    }}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/15"
                  >
                    Pré-validar
                  </button>
                  <button
                    type="button"
                    disabled={!canPrecheck || !MANUAL_LIST_ENABLED}
                    onClick={() => {
                      setSelectedForManual(item);
                      setManualFeedback(null);
                    }}
                    className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
                  >
                    Confirmar manual
                  </button>
                </div>
              </article>
            );
          })}

          {listCursor ? (
            <button
              type="button"
              onClick={() => {
                if (selectedEventId) void loadList(selectedEventId, listCursor);
              }}
              disabled={listLoadingMore}
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
            >
              {listLoadingMore ? "A carregar..." : "Carregar mais"}
            </button>
          ) : null}
        </div>

        <aside className="space-y-3 rounded-2xl border border-white/12 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Pré-validação manual</p>
          {!selectedForManual ? (
            <p className="text-sm text-white/65">Escolhe um participante para pré-validar.</p>
          ) : (
            <>
              <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm text-white/85">
                <p className="font-semibold">{selectedForManual.holder.name || "Participante"}</p>
                <p className="text-[12px] text-white/60">{selectedForManual.holder.email || "Sem email"}</p>
                <p className="mt-2 text-[12px] text-white/70">
                  Estado atual: <span className="font-semibold">{selectedForManual.status}</span>
                </p>
                {selectedForManual.checkedInAt ? (
                  <p className="text-[12px] text-amber-200">Check-in já registado em {formatDateTime(selectedForManual.checkedInAt)}.</p>
                ) : (
                  <p className="text-[12px] text-emerald-200">Elegível para confirmação manual, sujeito a policy e janela.</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="manual-reason" className="text-[12px] text-white/70">
                  Motivo obrigatório (auditoria)
                </label>
                <textarea
                  id="manual-reason"
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  placeholder="Ex.: QR ilegível no telemóvel do participante"
                  className="min-h-[96px] w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE]"
                />
              </div>

              <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                Dispositivo: {deviceId || "A carregar..."}
              </div>

                  <button
                    type="button"
                    disabled={!canManualConfirm || manualSubmitting}
                    onClick={() => setManualConfirmOpen(true)}
                    className="w-full rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-50"
                  >
                    {manualSubmitting ? "A confirmar..." : "Confirmar check-in manual"}
                  </button>

              {manualFeedback ? (
                <p role="status" aria-live="polite" className="text-sm text-white/80">
                  {manualFeedback}
                </p>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {manualConfirmOpen && selectedForManual ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-confirm-title"
            className="w-full max-w-md space-y-4 rounded-2xl border border-white/15 bg-[#0D1424] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
          >
            <h2 id="manual-confirm-title" className="text-lg font-semibold">
              Confirmar check-in manual
            </h2>
            <p className="text-sm text-white/75">
              Vais confirmar manualmente a entrada de{" "}
              <span className="font-semibold text-white">
                {selectedForManual.holder.name || "Participante"}
              </span>
              .
            </p>
            <p className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs text-white/75">
              Motivo registado: {manualReason.trim()}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualConfirmOpen(false)}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canManualConfirm || manualSubmitting}
                onClick={() => void handleManualConfirm()}
                className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
              >
                {manualSubmitting ? "A confirmar..." : "Confirmar agora"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );

  const logsView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Ferramenta Check-in</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Registos</h1>
          <p className="mt-1 text-sm text-white/65">Auditoria de entradas com método, operador e motivo manual.</p>
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
          className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE]"
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
          A carregar registos...
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
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(item.status)}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-white/60">
              {item.holder.email || "Sem email"} · {formatDateTime(item.checkedInAt)}
            </p>
            <p className="mt-1 text-[12px] text-white/55">
              {item.snapshot.title || "Sem título"} · {formatDateTime(item.snapshot.startAt)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/70">
              <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5">
                Método: {item.checkinMethod || "N/D"}
              </span>
              {item.checkedInByLabel ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5">
                  Operador: {item.checkedInByLabel}
                </span>
              ) : null}
              {item.checkinManualReason ? (
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5">
                  Motivo: {item.checkinManualReason}
                </span>
              ) : null}
            </div>
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

  const devicesView = (
    <section className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Ferramenta Check-in</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Dispositivos</h1>
          <p className="mt-1 text-sm text-white/65">
            Identidade local do posto de check-in e diagnóstico operacional básico.
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
          <p className="mt-1 text-sm text-white/85">{isOnline ? "Ligado" : "Sem ligação"}</p>
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
  if (mode === "list") {
    return <div className="space-y-5 text-white">{listView}</div>;
  }
  if (mode === "logs") {
    return <div className="space-y-5 text-white">{logsView}</div>;
  }
  return <div className="space-y-5 text-white">{devicesView}</div>;
}
