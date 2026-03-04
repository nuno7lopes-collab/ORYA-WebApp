"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { OryaDateField } from "@/components/ui/datetime";
import { CalendarCommandBar } from "../CalendarCommandBar";
import type { CalendarView } from "../ViewSwitcher";
import { normalizeCalendarTimezone } from "../timezones";
import { summarizeAgendaItemsByStatus } from "../statusSummary";
import { resolveEventToneClass } from "../eventTones";
import {
  addDays,
  addMonthsToParts,
  buildZonedDate,
  fetchJson,
  formatDateParam,
  formatMonthLabel,
  getDayKey,
  parseDateParam,
  parseIdList,
} from "../day/helpers";
import type { AgendaItem, AgendaResponse } from "../day/types";
import { buildMonthGridWindow, getEventsForDay } from "./helpers";

const ALL_KIND_FILTER_OPTIONS = [
  { value: "RESERVATION", label: "Reserva" },
  { value: "CLASS", label: "Aula" },
  { value: "EVENT", label: "Evento" },
  { value: "TOURNAMENT", label: "Torneio" },
] as const;
const AGENDA_SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 15_000,
  keepPreviousData: true,
} as const;

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function formatSlotTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(value));
}

function getMonthDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
  };
}

export default function MonthCalendarReadClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const timezone = useMemo(() => normalizeCalendarTimezone(searchParams.get("tz")), [searchParams]);
  const selectedDate = useMemo(
    () => parseDateParam(searchParams.get("date"), timezone) ?? new Date(),
    [searchParams, timezone],
  );
  const selectedProfessionalIds = useMemo(() => parseIdList(searchParams.get("professionals")), [searchParams]);
  const selectedResourceIds = useMemo(() => parseIdList(searchParams.get("resources")), [searchParams]);
  const selectedCourtIds = useMemo(() => parseIdList(searchParams.get("courts")), [searchParams]);
  const [visibleKinds, setVisibleKinds] = useState<Array<(typeof ALL_KIND_FILTER_OPTIONS)[number]["value"]>>(
    ALL_KIND_FILTER_OPTIONS.map((option) => option.value),
  );
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);

  const replaceState = (input: { nextDate?: Date; nextView?: "day" | "week" | "month" }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    const nextDate = input.nextDate ?? selectedDate;
    nextParams.set("date", formatDateParam(nextDate, timezone));
    nextParams.set("view", input.nextView ?? "month");
    nextParams.delete("tz");
    nextParams.delete("scopeMode");
    const destination = buildOrgHref(organizationId, "/calendar");
    const serialized = nextParams.toString();
    router.replace(serialized ? `${destination}?${serialized}` : destination, { scroll: false });
  };
  const setView = (nextView: CalendarView) => replaceState({ nextView });

  const monthParts = useMemo(() => {
    const parts = getMonthDateParts(selectedDate, timezone);
    return { year: parts.year, month: parts.month };
  }, [selectedDate, timezone]);
  const monthWindow = useMemo(() => buildMonthGridWindow(monthParts, timezone), [monthParts, timezone]);
  const monthLabel = useMemo(() => formatMonthLabel(monthParts), [monthParts]);
  const rangeFrom = monthWindow.gridStart;
  const rangeTo = new Date(monthWindow.gridEndExclusive.getTime() - 1);

  const agendaUrl =
    Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/agenda?${new URLSearchParams({
          from: rangeFrom.toISOString(),
          to: rangeTo.toISOString(),
        }).toString()}`
      : null;
  const { data, error, isLoading } = useSWR<AgendaResponse>(agendaUrl, fetchJson, AGENDA_SWR_OPTIONS);
  const availableKindOptions = useMemo(() => {
    if (!data?.capabilities) return ALL_KIND_FILTER_OPTIONS;
    return ALL_KIND_FILTER_OPTIONS.filter((option) => {
      if (option.value === "RESERVATION" || option.value === "CLASS") return data.capabilities?.reservas;
      if (option.value === "EVENT") return data.capabilities?.eventos;
      if (option.value === "TOURNAMENT") return data.capabilities?.torneios;
      return false;
    });
  }, [data?.capabilities]);
  useEffect(() => {
    const allowed = new Set(availableKindOptions.map((option) => option.value));
    setVisibleKinds((current) => {
      const next = current.filter((kind) => allowed.has(kind));
      if (next.length > 0) return next;
      if (availableKindOptions.length > 0) return [availableKindOptions[0].value];
      return current;
    });
  }, [availableKindOptions]);

  const filteredItems = useMemo(() => {
    return (data?.items ?? []).filter((item) => {
      if (!visibleKinds.includes(item.kind)) return false;
      const matchesProfessional = Boolean(item.professionalId && selectedProfessionalIds.includes(item.professionalId));
      const matchesResource = Boolean(item.resourceId && selectedResourceIds.includes(item.resourceId));
      const matchesCourt = Boolean(item.courtId && selectedCourtIds.includes(item.courtId));
      const hasSelection =
        selectedProfessionalIds.length > 0 || selectedResourceIds.length > 0 || selectedCourtIds.length > 0;
      if (!hasSelection) return true;
      return matchesProfessional || matchesResource || matchesCourt;
    });
  }, [data?.items, selectedCourtIds, selectedProfessionalIds, selectedResourceIds, visibleKinds]);
  const statusSummary = useMemo(() => summarizeAgendaItemsByStatus(filteredItems), [filteredItems]);
  const hasCachedAgendaItems = (data?.items?.length ?? 0) > 0;
  const showSoftAgendaError = Boolean(error) && hasCachedAgendaItems;

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    monthWindow.rows.flat().forEach((cell) => {
      if (!cell) return;
      const dayDate = buildZonedDate(cell, timezone, 12, 0);
      map.set(getDayKey(dayDate, timezone), getEventsForDay(filteredItems, dayDate, timezone));
    });
    return map;
  }, [filteredItems, monthWindow.rows, timezone]);

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="flex min-h-[calc(100dvh-88px)] flex-col gap-2 p-2 md:p-3">
      <CalendarCommandBar
        view="month"
        onViewChange={setView}
        rangeLabel={monthLabel}
        onPrevious={() => {
          const next = addMonthsToParts(monthParts, -1);
          replaceState({
            nextDate: buildZonedDate({ year: next.year, month: next.month, day: 1 }, timezone, 12, 0),
          });
        }}
        onNext={() => {
          const next = addMonthsToParts(monthParts, 1);
          replaceState({
            nextDate: buildZonedDate({ year: next.year, month: next.month, day: 1 }, timezone, 12, 0),
          });
        }}
        onToday={() => replaceState({ nextDate: new Date() })}
        dateControl={
          <OryaDateField
            value={formatDateParam(selectedDate, timezone)}
            onChange={(nextDateRaw) => {
              const nextDate = parseDateParam(nextDateRaw, timezone);
              if (!nextDate) return;
              replaceState({ nextDate });
            }}
            buttonClassName="rounded-full px-3 py-1 text-xs"
          />
        }
        filterControl={
          <button
            type="button"
            onClick={() => setQuickPanelOpen((current) => !current)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3 text-xs transition",
              quickPanelOpen
                ? "border-cyan-300/45 bg-cyan-400/14 text-cyan-100"
                : "border-white/20 bg-black/35 text-white/80 hover:border-white/35 hover:text-white",
            )}
          >
            Tipos e resumo
          </button>
        }
      />

      {quickPanelOpen ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">Tipo</span>
            {availableKindOptions.map((option) => {
              const isActive = visibleKinds.includes(option.value);
              return (
                <button
                  key={`month-kind-${option.value}`}
                  type="button"
                  onClick={() => {
                    setVisibleKinds((current) => {
                      if (current.includes(option.value)) {
                        const next = current.filter((entry) => entry !== option.value);
                        return next.length > 0 ? next : current;
                      }
                      return [...current, option.value];
                    });
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    isActive
                      ? "border-cyan-300/45 bg-cyan-400/12 text-cyan-100"
                      : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {showSoftAgendaError ? (
        <p className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          A mostrar dados anteriores da agenda enquanto a sincronização falha.
        </p>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-[rgba(6,10,20,0.9)] p-2">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-white/80">
            {statusSummary.total} {statusSummary.total === 1 ? "ocupação" : "ocupações"}
          </span>
          {statusSummary.confirmed > 0 ? (
            <span className="rounded-full border border-sky-300/45 bg-sky-400/12 px-2 py-1 text-sky-100">
              Confirmado {statusSummary.confirmed}
            </span>
          ) : null}
          {statusSummary.pending > 0 ? (
            <span className="rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-1 text-amber-100">
              Pendente {statusSummary.pending}
            </span>
          ) : null}
          {statusSummary.cancelled > 0 ? (
            <span className="rounded-full border border-rose-300/45 bg-rose-400/12 px-2 py-1 text-rose-100">
              Cancelado/No-show {statusSummary.cancelled}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-7 gap-2 border-b border-white/10 pb-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={`month-weekday-${label}`} className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
              {label}
            </div>
          ))}
        </div>

        <div className="orya-scrollbar-hide mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {monthWindow.rows.map((row, rowIndex) => {
            const rowStart = addDays(monthWindow.gridStart, rowIndex * 7, timezone);
            return (
              <div key={`month-row-${rowIndex}`} className="space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => replaceState({ nextDate: rowStart, nextView: "week" })}
                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/70 transition hover:border-white/35 hover:text-white"
                  >
                    Ver semana
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {row.map((cell, cellIndex) => {
                    if (!cell) {
                      return (
                        <div
                          key={`month-empty-${rowIndex}-${cellIndex}`}
                          className="min-h-[124px] rounded-xl border border-white/5 bg-black/20"
                        />
                      );
                    }
                    const dayDate = buildZonedDate(cell, timezone, 12, 0);
                    const isToday = getDayKey(dayDate, timezone) === getDayKey(new Date(), timezone);
                    const dayKey = getDayKey(dayDate, timezone);
                    const dayItems = itemsByDay.get(dayKey) ?? [];
                    return (
                      <button
                        key={`month-cell-${dayKey}`}
                        type="button"
                        onClick={() => replaceState({ nextDate: dayDate, nextView: "day" })}
                        className={cn(
                          "min-h-[124px] rounded-xl border bg-[rgba(8,14,28,0.86)] p-2 text-left transition hover:border-cyan-300/35",
                          isToday ? "border-cyan-300/35 ring-1 ring-inset ring-cyan-300/20" : "border-white/10",
                        )}
                      >
                        <p className={cn("text-sm font-semibold", isToday ? "text-cyan-100" : "text-white/85")}>{cell.day}</p>
                        <div className="mt-2 space-y-1">
                          {dayItems.slice(0, 3).map((item) => (
                            <p
                              key={`month-item-${dayKey}-${item.kind}-${item.startsAt}-${item.title}`}
                              className={cn(
                                "truncate rounded-md border px-1.5 py-0.5 text-[10px] text-white/90",
                                resolveEventToneClass({ kind: item.kind, status: item.status }),
                              )}
                            >
                              {formatSlotTime(item.startsAt, timezone)} {item.title}
                            </p>
                          ))}
                          {dayItems.length > 3 ? (
                            <p className="text-[10px] text-white/55">+{dayItems.length - 3} itens</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {isLoading ? <p className="mt-3 text-sm text-white/70">A carregar agenda...</p> : null}
        {error && !showSoftAgendaError ? <p className="mt-3 text-sm text-rose-200">Falha ao carregar agenda: {error.message}</p> : null}
      </section>
    </div>
  );
}
