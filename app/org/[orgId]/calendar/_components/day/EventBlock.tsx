"use client";

import { cn } from "@/lib/utils";
import type { PositionedEvent } from "./types";

type EventBlockProps = {
  positioned: PositionedEvent;
  timezone: string;
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

function toneClass(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "COMPLETED") {
    return "border-emerald-300/55 bg-[linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.12))]";
  }
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") {
    return "border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(251,191,36,0.1))]";
  }
  if (normalized.startsWith("CANCELLED") || normalized === "NO_SHOW") {
    return "border-rose-300/60 bg-[linear-gradient(135deg,rgba(244,63,94,0.26),rgba(244,63,94,0.09))]";
  }
  if (normalized === "DISPUTED") {
    return "border-fuchsia-200/60 bg-[linear-gradient(135deg,rgba(217,70,239,0.24),rgba(126,34,206,0.1))]";
  }
  return "border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))]";
}

export function EventBlock({ positioned, timezone }: EventBlockProps) {
  const width = 100 / positioned.laneCount;
  const left = positioned.lane * width;
  const start = new Date(positioned.event.startsAt);
  const end = new Date(positioned.event.endsAt);
  const status = statusLabel(positioned.event.status);

  return (
    <article
      className={cn(
        "absolute z-20 rounded-xl border px-2 py-1.5 text-left text-[11px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.5)]",
        "backdrop-blur-[1px]",
        toneClass(positioned.event.status),
      )}
      style={{
        top: positioned.top,
        height: positioned.height,
        left: `calc(${left}% + 3px)`,
        width: `calc(${width}% - 6px)`,
      }}
      title={`${positioned.event.title} (${formatTime(start, timezone)}-${formatTime(end, timezone)})`}
    >
      <p className="truncate font-semibold leading-tight">{positioned.event.title}</p>
      <p className="mt-0.5 truncate text-[10px] text-white/85">
        {formatTime(start, timezone)} - {formatTime(end, timezone)}
      </p>
      <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-white/70">{status}</p>
    </article>
  );
}
