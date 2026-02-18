"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildProjectedEvents, buildPositionedEvents, invertIntervals, minuteToLabel, SLOT_MINUTES } from "./helpers";
import {
  buildAggregateAgendaItems,
  type AggregateAgendaItem as WeekAggregateAgendaItem,
  type ProjectedAgendaItem as WeekProjectedAgendaItem,
} from "../week/aggregation";
import type { CalendarColumn, CalendarEvent } from "./types";
import { EventBlock } from "./EventBlock";
import { AggregateEventBlock } from "./AggregateEventBlock";

export type VirtualRowItem = {
  key: string | number | bigint;
  index: number;
  start: number;
  size: number;
};

type DayColumnProps = {
  column: CalendarColumn;
  date: Date;
  timezone: string;
  events: CalendarEvent[];
  minuteHeight: number;
  nowTop: number | null;
  totalHeight: number;
  rowVirtualItems: VirtualRowItem[];
  onHoverChange?: (payload: { minute: number } | null) => void;
  onHoverEventChange?: (event: CalendarEvent | null) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  selectedEventId?: string | null;
};

export function DayColumn({
  column,
  date,
  timezone,
  events,
  minuteHeight,
  nowTop,
  totalHeight,
  rowVirtualItems,
  onHoverChange,
  onHoverEventChange,
  onSelectEvent,
  selectedEventId,
}: DayColumnProps) {
  const projectedEvents = useMemo(
    () => buildProjectedEvents({ events, day: date, timezone }),
    [date, events, timezone],
  );
  const positionedEvents = useMemo(
    () => buildPositionedEvents({ events, day: date, timezone, minuteHeight }),
    [date, events, minuteHeight, timezone],
  );
  const aggregatePositions = useMemo<WeekProjectedAgendaItem<CalendarEvent>[]>(
    () =>
      projectedEvents.map((entry) => ({
        item: entry.event,
        start: entry.start,
        end: entry.end,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
      })),
    [projectedEvents],
  );
  const aggregateEvents = useMemo(
    () =>
      buildAggregateAgendaItems<CalendarEvent>({
        positions: aggregatePositions,
        dayKey: `${column.id}-${date.toISOString()}`,
        minuteHeight,
        minimumHeight: 20,
      }),
    [aggregatePositions, column.id, date, minuteHeight],
  );
  const useAggregateBlocks = column.entityKind === "GENERAL";
  const outsideIntervals = useMemo(() => invertIntervals(column.workingIntervals), [column.workingIntervals]);
  const emitHover = (element: HTMLDivElement, clientY: number) => {
    if (!onHoverChange) return;
    const rect = element.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    if (!Number.isFinite(relativeY)) return;
    const clampedY = Math.max(0, Math.min(totalHeight, relativeY));
    const minute = Math.round(clampedY / minuteHeight);
    onHoverChange({ minute: Math.max(0, Math.min(24 * 60, minute)) });
  };

  return (
    <div
      className="relative h-full border-l border-white/10 first:border-l-0"
      style={{ height: totalHeight }}
      onMouseMove={(event) => {
        emitHover(event.currentTarget, event.clientY);
      }}
      onMouseEnter={(event) => emitHover(event.currentTarget, event.clientY)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      {outsideIntervals.map((interval) => (
        <div
          key={`${column.id}-${interval.startMinute}-${interval.endMinute}`}
          className="absolute left-0 right-0 border-y border-white/5 bg-[repeating-linear-gradient(135deg,rgba(4,8,16,0.7),rgba(4,8,16,0.7)_8px,rgba(255,255,255,0.06)_8px,rgba(255,255,255,0.06)_16px)]"
          style={{
            top: interval.startMinute * minuteHeight,
            height: (interval.endMinute - interval.startMinute) * minuteHeight,
          }}
        />
      ))}

      <div className="absolute inset-0">
        {rowVirtualItems.map((row) => {
          const minute = row.index * SLOT_MINUTES;
          const isHour = minute % 60 === 0;
          return (
            <div
              key={`${column.id}-slot-${row.key}`}
              title={minuteToLabel(minute)}
              className={cn(
                "absolute left-0 right-0 border-t transition",
                isHour ? "border-white/10" : "border-white/5",
                "hover:border-cyan-300/45 hover:bg-cyan-300/10",
              )}
              style={{ top: row.start, height: row.size }}
            />
          );
        })}
      </div>

      {nowTop !== null && nowTop >= 0 && nowTop <= totalHeight ? (
        <div className="pointer-events-none absolute left-0 right-0 z-30 flex items-center gap-2" style={{ top: nowTop }}>
          <span className="h-[1px] flex-1 bg-red-400/70" />
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">Agora</span>
        </div>
      ) : null}

      {useAggregateBlocks
        ? aggregateEvents.map((aggregate) => (
            <AggregateEventBlock
              key={`${aggregate.dayKey}-${aggregate.startMinute}-${aggregate.endMinute}`}
              aggregate={aggregate}
              timezone={timezone}
              selectedEventId={selectedEventId}
              onHoverEventChange={onHoverEventChange}
              onSelectEvent={onSelectEvent}
            />
          ))
        : positionedEvents.map((positioned) => (
            <EventBlock
              key={positioned.event.id}
              positioned={positioned}
              timezone={timezone}
              selected={selectedEventId === positioned.event.id}
              onHoverEventChange={onHoverEventChange}
              onSelectEvent={onSelectEvent}
            />
          ))}
    </div>
  );
}
