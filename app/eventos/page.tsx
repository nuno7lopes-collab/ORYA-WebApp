"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { getEventLocationDisplay } from "@/lib/location/eventLocation";

type EventCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  locationCity: string | null;
  address: string | null;
  locationFormattedAddress: string | null;
  locationSource: "OSM" | "MANUAL" | null;
  locationComponents: Record<string, unknown> | null;
  locationOverrides: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
  isGratis: boolean;
  priceFrom: number | null;
};

export default function EventosFeedPage() {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/eventos/list?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Falha ao carregar eventos");
      }

      const data = await res.json();
      const items: EventCard[] = Array.isArray(data.events)
        ? data.events.map((ev: any) => ({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            description: ev.shortDescription ?? ev.description ?? null,
            startsAt: ev.startDate ?? ev.startsAt ?? "",
            endsAt: ev.endDate ?? null,
            locationName: ev.venue?.name ?? ev.locationName ?? null,
            locationCity: ev.venue?.city ?? ev.locationCity ?? null,
            address: ev.venue?.address ?? null,
            locationFormattedAddress: ev.venue?.formattedAddress ?? null,
            locationSource: ev.venue?.source ?? null,
            locationComponents: ev.venue?.components ?? null,
            locationOverrides: ev.venue?.overrides ?? null,
            latitude: ev.venue?.lat ?? null,
            longitude: ev.venue?.lng ?? null,
            isGratis: Boolean(ev.isGratis),
            priceFrom: ev.priceFrom ?? null,
          }))
        : [];
      setEvents(items);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Erro ao carregar eventos.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchEvents();
  }

  return (
    <main className="min-h-screen w-full text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="orya-page-width px-6 md:px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                Explorar eventos
              </p>
              <p className="text-sm text-white/80">
                Descobre o que está a acontecer perto de ti (e onde devias
                estar).
              </p>
            </div>
          </div>

          <Link
            href="/organizacao/eventos/novo"
            className={`${CTA_PRIMARY} hidden sm:inline-flex px-4 py-1.5 text-xs active:scale-95`}
          >
            + Criar evento
          </Link>
        </div>
      </header>

      <section className="orya-page-width px-6 md:px-10 py-8 md:py-10 space-y-6">
        {/* Search */}
        <div className="space-y-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row gap-3 md:items-center"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                🔍
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por evento, local ou vibe..."
                className="w-full rounded-full bg-black/60 border border-white/15 pl-8 pr-24 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 transition"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-white/90 text-[11px] font-medium text-black hover:bg-white"
              >
                Pesquisar
              </button>
            </div>
          </form>
        </div>

        {/* Estado de loading / erro */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
            {error}
          </div>
        )}

        {/* Grid de eventos */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {loading && !events.length ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square w-full rounded-2xl border border-white/10 orya-skeleton-surface animate-pulse"
              />
            ))
          ) : events.length === 0 ? (
            <p className="text-sm text-white/60 col-span-full">
              Ainda não há eventos. Tenta ajustar a pesquisa ou criar o primeiro
              evento.
            </p>
          ) : (
            events.map((ev) => {
              const locationDisplay = getEventLocationDisplay(
                {
                  locationName: ev.locationName,
                  locationCity: ev.locationCity,
                  address: ev.address,
                  locationFormattedAddress: ev.locationFormattedAddress,
                  locationSource: ev.locationSource,
                  locationComponents: ev.locationComponents,
                  locationOverrides: ev.locationOverrides,
                  latitude: ev.latitude,
                  longitude: ev.longitude,
                },
                "Local a definir",
              );
              return (
                <Link
                  key={ev.id}
                  href={`/eventos/${ev.slug}`}
                  className="group w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-black/70 to-black/90 overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.7)] hover:border-[#6BFFFF]/60 hover:shadow-[0_0_40px_rgba(107,255,255,0.35)] transition"
                >
                <div className="relative aspect-square overflow-hidden">
                  <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#FF00C8_0,_#02020a_65%)] flex items-center justify-center text-xs text-white/60">
                    ORYA • Evento
                  </div>
                  {ev.isGratis && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-[#6BFFFF] border border-[#6BFFFF]/40">
                      Evento gratuito
                    </span>
                  )}
                </div>

                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-white/60">
                      {formatDate(ev.startsAt)}
                    </p>
                    {ev.priceFrom !== null && !ev.isGratis && (
                      <p className="text-[11px] text-white">
                        desde{" "}
                        <span className="font-semibold">
                          {ev.priceFrom} €{" "}
                        </span>
                      </p>
                    )}
                  </div>

                  <h2 className="text-sm font-semibold line-clamp-2">
                    {ev.title}
                  </h2>

                  <p className="text-[11px] text-white/60 line-clamp-2">
                    {ev.description || "Sem descrição adicionada."}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] text-white/70 line-clamp-1">
                        {locationDisplay.primary}
                      </p>
                      {locationDisplay.secondary && (
                        <p className="text-[10px] text-white/40 line-clamp-1">
                          {locationDisplay.secondary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

// Helpers
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
