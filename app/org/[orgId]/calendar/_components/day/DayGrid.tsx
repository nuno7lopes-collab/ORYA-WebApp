"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getTimeParts, HOUR_END, HOUR_START, isSameDay, minuteToLabel, pad2, SLOT_MINUTES } from "./helpers";
import type { CalendarEvent, CalendarColumn } from "./types";
import { DayColumn, type VirtualRowItem } from "./DayColumn";

type DayGridProps = {
  date: Date;
  timezone: string;
  columns: CalendarColumn[];
  events: CalendarEvent[];
  showAvailabilityOverlay?: boolean;
  availabilityOverlayHint?: string;
  hourHeight: number;
  selectedEventId?: string | null;
  onHoverEventChange?: (event: CalendarEvent | null) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
};

const TIME_GUTTER_WIDTH = 72;
const DEFAULT_COLUMN_WIDTH = 240;
const MIN_COLUMN_WIDTH = 220;
const FIT_MIN_COLUMN_WIDTH = 160;

export function DayGrid({
  date,
  timezone,
  columns,
  events,
  showAvailabilityOverlay = false,
  availabilityOverlayHint,
  hourHeight,
  selectedEventId = null,
  onHoverEventChange,
  onSelectEvent,
}: DayGridProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [hoverSlot, setHoverSlot] = useState<{ columnId: string; minute: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const minuteHeight = hourHeight / 60;
  const now = new Date(nowTick);
  const nowTop = isSameDay(date, now, timezone)
    ? (() => {
        const nowParts = getTimeParts(now, timezone);
        return (nowParts.hour * 60 + nowParts.minute) * minuteHeight;
      })()
    : null;

  const rowCount = ((HOUR_END - HOUR_START) * 60) / SLOT_MINUTES;
  const rowSize = minuteHeight * SLOT_MINUTES;
  const bodyViewportWidth = Math.max(0, viewportWidth - TIME_GUTTER_WIDTH);
  const fitColumnWidth = columns.length > 0 ? (bodyViewportWidth > 0 ? bodyViewportWidth / columns.length : DEFAULT_COLUMN_WIDTH) : DEFAULT_COLUMN_WIDTH;
  const shouldForceFitColumns = columns.length > 0 && columns.length <= 4;
  const columnWidth = shouldForceFitColumns
    ? Math.max(FIT_MIN_COLUMN_WIDTH, fitColumnWidth)
    : Math.max(MIN_COLUMN_WIDTH, fitColumnWidth);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowSize,
    overscan: 10,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => columnWidth,
    overscan: 4,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [hourHeight, rowVirtualizer]);
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnVirtualizer, columnWidth]);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () => setViewportWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setHoverSlot(null);
  }, [columns, date]);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const nowLocal = new Date();
    const targetMinute = isSameDay(date, nowLocal, timezone)
      ? (() => {
          const parts = getTimeParts(nowLocal, timezone);
          return parts.hour * 60 + parts.minute;
        })()
      : 8 * 60;
    const top = Math.max(0, targetMinute * minuteHeight - hourHeight * 2);
    node.scrollTo({ top, behavior: "auto" });
  }, [date, timezone, hourHeight, minuteHeight, columns.length]);

  const totalHeight = rowVirtualizer.getTotalSize();
  const totalColumnsWidth =
    shouldForceFitColumns && bodyViewportWidth > 0
      ? bodyViewportWidth
      : Math.max(columnVirtualizer.getTotalSize(), columns.length * columnWidth, bodyViewportWidth || 0);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  const columnIndexById = useMemo(() => new Map(columns.map((column, index) => [column.id, index])), [columns]);

  const rowVirtualItems = useMemo<VirtualRowItem[]>(
    () =>
      virtualRows.map((row) => ({
        key: row.key,
        index: row.index,
        start: row.start,
        size: row.size,
      })),
    [virtualRows],
  );

  const eventsByProfessional = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    events.forEach((event) => {
      if (!event.professionalId) return;
      const existing = map.get(event.professionalId) ?? [];
      existing.push(event);
      map.set(event.professionalId, existing);
    });
    return map;
  }, [events]);

  const eventsByResource = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    events.forEach((event) => {
      if (!event.resourceId) return;
      const existing = map.get(event.resourceId) ?? [];
      existing.push(event);
      map.set(event.resourceId, existing);
    });
    return map;
  }, [events]);
  const eventsByCourt = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    events.forEach((event) => {
      if (!event.courtId) return;
      const existing = map.get(event.courtId) ?? [];
      existing.push(event);
      map.set(event.courtId, existing);
    });
    return map;
  }, [events]);

  if (columns.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
        Sem colunas para apresentar. Usa o filtro Geral ou seleciona um profissional/recurso.
      </div>
    );
  }

  const scrollToMinute = (minute: number) => {
    const node = scrollRef.current;
    if (!node) return;
    const top = Math.max(0, minute * minuteHeight - hourHeight * 2);
    node.scrollTo({ top, behavior: "smooth" });
  };
  const jumpTimes = [8, 12, 16, 20];

  return (
    <section className="rounded-2xl border border-white/10 bg-[rgba(6,10,20,0.88)] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
      <div className="mb-2 px-1">
        <h2 className="text-sm font-semibold text-white">Agenda diária</h2>
        <p className="text-xs text-white/55">Slots de 15 minutos, altura proporcional por duração real e colunas por entidade.</p>
        <p className="mt-1 text-[11px] text-white/50">
          {availabilityOverlayHint ??
            (showAvailabilityOverlay
              ? "Sobreposição de disponibilidade ativa."
              : "Sobreposição de disponibilidade desligada.")}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/65">
          <span className="rounded-full border border-sky-300/45 bg-sky-400/12 px-2 py-0.5 text-sky-100">Confirmado</span>
          <span className="rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-0.5 text-amber-100">Pendente</span>
          <span className="rounded-full border border-rose-300/45 bg-rose-400/12 px-2 py-0.5 text-rose-100">Cancelado/No-show</span>
          <span className="rounded-full border border-fuchsia-300/45 bg-fuchsia-400/12 px-2 py-0.5 text-fuchsia-100">Disputa</span>
          <span className="text-white/45">Click fixa detalhe · hover pré-visualiza</span>
          </div>
          <div className="flex items-center gap-2">
            {jumpTimes.map((hour) => (
              <button
                key={`jump-hour-${hour}`}
                type="button"
                onClick={() => scrollToMinute(hour * 60)}
                className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/70 transition hover:border-white/30 hover:text-white"
              >
                {pad2(hour)}:00
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const parts = getTimeParts(new Date(), timezone);
                scrollToMinute(parts.hour * 60 + parts.minute);
              }}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/35 hover:text-white"
            >
              Ir para agora
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10" data-virtual-ready="true">
        <div className="grid border-b border-white/10 bg-[rgba(5,10,20,0.92)]" style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px minmax(0,1fr)` }}>
          <div className="h-12 border-r border-white/10" />
          <div className="relative h-12 overflow-hidden">
            <div className="relative h-full" style={{ width: totalColumnsWidth, transform: `translateX(${-scrollLeft}px)` }}>
              {virtualColumns.map((virtualColumn) => {
                const column = columns[virtualColumn.index];
                if (!column) return null;
                return (
                  <div
                    key={`column-head-${column.id}`}
                    className="absolute top-0 h-full border-l border-white/10 px-2"
                    style={{ left: virtualColumn.start, width: virtualColumn.size }}
                  >
                    <div className="flex h-full items-center gap-2">
                      <Avatar
                        src={column.avatarUrl}
                        name={column.label}
                        className="h-7 w-7"
                        fallbackText={column.label.slice(0, 2)}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-white/80">
                          {column.label}
                        </p>
                        {column.subtitle ? <p className="truncate text-[10px] text-white/55">{column.subtitle}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="overflow-auto orya-scrollbar-hide"
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          style={{ height: hourHeight * 10, maxHeight: "calc(100vh - 320px)" }}
        >
          <div
            className="relative"
            style={{
              width: TIME_GUTTER_WIDTH + totalColumnsWidth,
              height: totalHeight,
            }}
          >
            <div
              className="pointer-events-none absolute top-0 z-30 border-r border-white/10 bg-[rgba(7,12,24,0.88)]"
              style={{
                left: 0,
                width: TIME_GUTTER_WIDTH,
                height: totalHeight,
                transform: `translateX(${scrollLeft}px)`,
                backgroundImage:
                  "linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: `100% ${rowSize}px, 100% ${hourHeight}px`,
              }}
            >
              {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => {
                const hour = HOUR_START + index;
                const top = (hour - HOUR_START) * hourHeight;
                return (
                  <div
                    key={`hour-${hour}`}
                    className={cn(
                      "absolute right-2 text-[10px] font-mono tracking-[0.1em] text-white/45",
                      hour === HOUR_START ? "top-0" : "-translate-y-1/2",
                    )}
                    style={{ top }}
                  >
                    {pad2(hour)}:00
                  </div>
                );
              })}
            </div>

            <div className="absolute top-0" style={{ left: TIME_GUTTER_WIDTH, width: totalColumnsWidth, height: totalHeight }}>
              {virtualColumns.map((virtualColumn) => {
                const column = columns[virtualColumn.index];
                if (!column) return null;
                const columnEvents =
                  column.entityKind === "PROFESSIONAL"
                    ? eventsByProfessional.get(column.entityId) ?? []
                    : column.entityKind === "COURT"
                      ? eventsByCourt.get(column.entityId) ?? []
                      : column.entityKind === "RESOURCE"
                        ? eventsByResource.get(column.entityId) ?? []
                        : events;
                return (
                  <div
                    key={`column-body-${column.id}`}
                    className="absolute top-0"
                    style={{ left: virtualColumn.start, width: virtualColumn.size, height: totalHeight }}
                  >
                    <DayColumn
                      column={column}
                      date={date}
                      timezone={timezone}
                      events={columnEvents}
                      showAvailabilityOverlay={showAvailabilityOverlay}
                      minuteHeight={minuteHeight}
                      nowTop={nowTop}
                      totalHeight={totalHeight}
                      rowVirtualItems={rowVirtualItems}
                      onHoverChange={(payload) => {
                        if (!payload) {
                          setHoverSlot((current) => (current?.columnId === column.id ? null : current));
                          return;
                        }
                        setHoverSlot((current) => {
                          if (current?.columnId === column.id && current.minute === payload.minute) {
                            return current;
                          }
                          return { columnId: column.id, minute: payload.minute };
                        });
                      }}
                      onHoverEventChange={onHoverEventChange}
                      onSelectEvent={onSelectEvent}
                      selectedEventId={selectedEventId}
                    />
                  </div>
                );
              })}

              {hoverSlot ? (
                (() => {
                  const columnIndex = columnIndexById.get(hoverSlot.columnId);
                  if (columnIndex == null) return null;
                  const minute = Math.max(0, Math.min(24 * 60, hoverSlot.minute));
                  const top = minute * minuteHeight;
                  const left = columnIndex * columnWidth;
                  return (
                    <div className="pointer-events-none absolute z-40" style={{ top, left, width: columnWidth }}>
                      <span className="absolute left-2 top-0 -translate-y-1/2 rounded-md border border-cyan-200/60 bg-[#050912]/95 px-2 py-0.5 text-[10px] font-mono text-cyan-100">
                        {minuteToLabel(minute)}
                      </span>
                      <span className="absolute left-0 right-0 top-0 h-px bg-cyan-300/60" />
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
