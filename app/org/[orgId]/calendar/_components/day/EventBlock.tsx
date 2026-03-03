"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent, PositionedEvent } from "./types";
import { resolveEventToneClass } from "../eventTones";

type EventBlockProps = {
  positioned: PositionedEvent;
  timezone: string;
  selected?: boolean;
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

function statusLabel(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED") return "Confirmado";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "Pendente";
  if (normalized === "NO_SHOW") return "No-show";
  if (normalized === "DISPUTED") return "Disputa";
  if (normalized.startsWith("CANCELLED")) return "Cancelado";
  return status;
}

export function EventBlock({ positioned, timezone, selected = false, onHoverEventChange, onSelectEvent }: EventBlockProps) {
  const width = 100 / positioned.laneCount;
  const left = positioned.lane * width;
  const start = new Date(positioned.event.startsAt);
  const end = new Date(positioned.event.endsAt);
  const status = statusLabel(positioned.event.status);

  return (
    <article
      className={cn(
        "absolute z-20 cursor-pointer rounded-xl border px-2 py-1.5 text-left text-[11px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.5)]",
        "backdrop-blur-[1px]",
        resolveEventToneClass({ status: positioned.event.status, kind: positioned.event.kind }),
        selected && "ring-1 ring-cyan-200/80",
      )}
      style={{
        top: positioned.top,
        height: positioned.height,
        left: `calc(${left}% + 3px)`,
        width: `calc(${width}% - 6px)`,
      }}
      title={`${positioned.event.title} (${formatTime(start, timezone)}-${formatTime(end, timezone)})`}
      onMouseEnter={() => onHoverEventChange?.(positioned.event)}
      onMouseLeave={() => onHoverEventChange?.(null)}
      onClick={() => onSelectEvent?.(positioned.event)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectEvent?.(positioned.event);
        }
      }}
      role="button"
      aria-pressed={selected}
      aria-label={`${positioned.event.title} ${formatTime(start, timezone)}-${formatTime(end, timezone)} ${status}`}
      tabIndex={0}
    >
      <p className="truncate font-semibold leading-tight">{positioned.event.title}</p>
      <p className="mt-0.5 truncate text-[10px] text-white/85">
        {formatTime(start, timezone)} - {formatTime(end, timezone)}
      </p>
      <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-white/70">{status}</p>
    </article>
  );
}
