"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildPositionedEvents, invertIntervals, minuteToLabel, SLOT_MINUTES } from "./helpers";
import type { CalendarColumn, CalendarEvent } from "./types";
import { EventBlock } from "./EventBlock";

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
}: DayColumnProps) {
  const positionedEvents = useMemo(
    () => buildPositionedEvents({ events, day: date, timezone, minuteHeight }),
    [date, events, minuteHeight, timezone],
  );
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
          className="absolute left-0 right-0 bg-black/35"
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

      {positionedEvents.map((positioned) => (
        <EventBlock key={positioned.event.id} positioned={positioned} timezone={timezone} />
      ))}
    </div>
  );
}
