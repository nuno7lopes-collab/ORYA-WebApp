"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

type CalendarView = "week" | "day";

type AgendaItem = {
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION";
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

type AgendaResponse = {
  ok: boolean;
  items: AgendaItem[];
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json());

function getWeekStart(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const offset = (day + 6) % 7;
  next.setDate(next.getDate() - offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLabel(date: Date) {
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(dateRaw: string) {
  const date = new Date(dateRaw);
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarReadClient({ view }: { view: CalendarView }) {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const range = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return null;
    if (view === "day") {
      const from = new Date(anchorDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(anchorDate);
      to.setHours(23, 59, 59, 999);
      return {
        from,
        to,
        label: formatLabel(from),
      };
    }

    const from = getWeekStart(anchorDate);
    const to = addDays(from, 6);
    to.setHours(23, 59, 59, 999);
    return {
      from,
      to,
      label: `${formatLabel(from)} - ${formatLabel(to)}`,
    };
  }, [anchorDate, organizationId, view]);

  const apiUrl = useMemo(() => {
    if (!range) return null;
    const query = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    return `/api/org/${organizationId}/agenda?${query.toString()}`;
  }, [organizationId, range]);

  const { data, error, isLoading } = useSWR<AgendaResponse>(apiUrl, fetcher);
  const items = data?.items ?? [];

  if (!range) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Calendar</p>
        <h1 className="mt-1 text-xl font-semibold text-white">Calendário operacional</h1>
        <p className="mt-2 text-sm text-white/70">
          Superfície read-first da ocupação. Escrita de disponibilidade e regras permanece em Bookings.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchorDate((current) => addDays(current, view === "day" ? -1 : -7))}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/35"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate(new Date())}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/35"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate((current) => addDays(current, view === "day" ? 1 : 7))}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/35"
          >
            Seguinte
          </button>
        </div>
        <p className="text-sm font-medium text-white">{range.label}</p>
        <Link
          href={buildOrgHref(organizationId, "/bookings/availability")}
          className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-100 hover:border-cyan-300/70"
        >
          Gerir disponibilidade em Bookings
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        {isLoading && <p className="text-sm text-white/70">A carregar agenda...</p>}
        {error && <p className="text-sm text-red-200">Falha ao carregar agenda.</p>}
        {!isLoading && !error && items.length === 0 && (
          <p className="text-sm text-white/60">Sem ocupação para o intervalo selecionado.</p>
        )}
        {!isLoading && !error && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={`${item.kind}-${item.startsAt}-${item.endsAt}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-white/70">
                  {formatTime(item.startsAt)} - {formatTime(item.endsAt)}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-white/50">
                  {item.kind} · {item.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
