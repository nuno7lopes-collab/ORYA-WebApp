"use client";

import { cn } from "@/lib/utils";
import type { AggregateAgendaItem } from "../week/aggregation";
import type { CalendarEvent } from "./types";

type AggregateEventBlockProps = {
  aggregate: AggregateAgendaItem<CalendarEvent>;
  timezone: string;
  selectedEventId?: string | null;
  onHoverEventChange?: (event: CalendarEvent | null) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
};

function formatTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

function toneClass(items: AggregateAgendaItem<CalendarEvent>["items"]) {
  const hasCancelled = items.some((entry) => {
    const status = entry.item.status.trim().toUpperCase();
    return status.startsWith("CANCELLED") || status === "NO_SHOW";
  });
  if (hasCancelled) {
    return "border-rose-300/60 bg-[linear-gradient(135deg,rgba(244,63,94,0.26),rgba(244,63,94,0.09))]";
  }

  const hasPending = items.some((entry) => {
    const status = entry.item.status.trim().toUpperCase();
    return status === "PENDING" || status === "PENDING_CONFIRMATION";
  });
  if (hasPending) {
    return "border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(251,191,36,0.1))]";
  }

  return "border-cyan-200/55 bg-[linear-gradient(135deg,rgba(34,211,238,0.24),rgba(16,185,129,0.12))]";
}

export function AggregateEventBlock({
  aggregate,
  timezone,
  selectedEventId,
  onHoverEventChange,
  onSelectEvent,
}: AggregateEventBlockProps) {
  const isSelected = Boolean(selectedEventId && aggregate.items.some((entry) => entry.item.id === selectedEventId));

  return (
    <article
      className={cn(
        "absolute z-20 cursor-pointer rounded-xl border px-2 py-1.5 text-left text-[11px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.5)]",
        "backdrop-blur-[1px]",
        toneClass(aggregate.items),
        isSelected && "ring-1 ring-cyan-200/80",
      )}
      style={{
        top: aggregate.top,
        height: aggregate.height,
        left: 3,
        width: "calc(100% - 6px)",
      }}
      onMouseEnter={() => onHoverEventChange?.(aggregate.items[0]?.item ?? null)}
      onMouseLeave={() => onHoverEventChange?.(null)}
      onClick={() => {
        const firstEvent = aggregate.items[0]?.item;
        if (firstEvent) onSelectEvent?.(firstEvent);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const firstEvent = aggregate.items[0]?.item;
          if (firstEvent) onSelectEvent?.(firstEvent);
        }
      }}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${formatTime(aggregate.start, timezone)}-${formatTime(aggregate.end, timezone)} ${aggregate.items.length} ocupações`}
      tabIndex={0}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-white/90">
        {formatTime(aggregate.start, timezone)} - {formatTime(aggregate.end, timezone)} · {aggregate.items.length}{" "}
        {aggregate.items.length === 1 ? "ocupação" : "ocupações"}
      </p>

      <div className="mt-1 space-y-0.5">
        {aggregate.items.slice(0, 4).map((entry) => (
          <button
            key={`${entry.item.id}-${entry.start.toISOString()}`}
            type="button"
            className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white/90 transition hover:bg-black/25"
            onMouseEnter={() => onHoverEventChange?.(entry.item)}
            onMouseLeave={() => onHoverEventChange?.(null)}
            onClick={(event) => {
              event.stopPropagation();
              onSelectEvent?.(entry.item);
            }}
          >
            {formatTime(entry.start, timezone)} {entry.item.title}
          </button>
        ))}
      </div>

      {aggregate.items.length > 4 ? (
        <p className="mt-0.5 truncate text-[10px] text-white/70">+{aggregate.items.length - 4} adicionais</p>
      ) : null}
    </article>
  );
}
