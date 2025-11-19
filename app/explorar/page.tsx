"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Helper para estado do evento
function getEventStatus(
  start: string,
  end: string,
): "ongoing" | "upcoming" | "past" {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (now < startDate) return "upcoming";
  if (now > endDate) return "past";
  return "ongoing";
}

type EventListItem = {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  venue: {
    name: string;
    address: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };
  coverImageUrl: string | null;
  isFree: boolean;
  priceFrom: number | null;
  stats: {
    goingCount: number;
    interestedCount: number;
  };
  wavesSummary: {
    totalWaves: number;
    onSaleCount: number;
    soldOutCount: number;
    nextWaveOpensAt: string | null;
  };
  category: string | null;
  tags: string[];
};

type ApiResponse = {
  events: EventListItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
};

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "Todas as datas" },
  { value: "today", label: "Hoje" },
  { value: "upcoming", label: "Próximos dias" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "Todos os eventos" },
  { value: "free", label: "Grátis" },
  { value: "paid", label: "Pagos" },
] as const;

const SORT_OPTIONS = [
  { value: "recommended", label: "Recomendados" },
  { value: "newest", label: "Mais recentes" },
  { value: "price_asc", label: "Preço ↑" },
  { value: "price_desc", label: "Preço ↓" },
] as const;

const CATEGORY_CHIPS = [
  { value: "all", label: "Tudo", emoji: "✨" },
  { value: "party", label: "Festa", emoji: "🎉" },
  { value: "sports", label: "Desporto", emoji: "🏅" },
  { value: "music", label: "Concerto", emoji: "🎵" },
  { value: "talks", label: "Palestra", emoji: "🎤" },
  { value: "art", label: "Arte", emoji: "🎨" },
  { value: "food", label: "Comida & drinks", emoji: "🍻" },
] as const;

type CategoryFilter = (typeof CATEGORY_CHIPS)[number]["value"];
type DateFilter = (typeof DATE_FILTER_OPTIONS)[number]["value"];
type TypeFilter = (typeof TYPE_OPTIONS)[number]["value"];
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const QUICK_CITIES = [
  "Porto",
  "Lisboa",
  "Braga",
  "Aveiro",
  "Coimbra",
  "Faro",
] as const;

export default function ExplorarPage() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortOption>("recommended");

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);

  // likes locais (UI) – depois ligamos ao backend
  const [likedEvents, setLikedEvents] = useState<number[]>([]);

  const resultsLabel =
    events.length === 1 ? "1 evento" : `${events.length} eventos`;

  const hasActiveFilters =
    search.trim().length > 0 ||
    dateFilter !== "all" ||
    typeFilter !== "all" ||
    category !== "all" ||
    city.trim().length > 0 ||
    maxPrice !== null ||
    sort !== "recommended";

  function toggleLike(id: number) {
    setLikedEvents((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  async function fetchEvents(opts?: { append?: boolean; cursor?: number | null }) {
    const append = opts?.append ?? false;
    const cursorToUse = opts?.cursor ?? null;

    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      const params = new URLSearchParams();

      if (search.trim()) params.set("q", search.trim());
      if (dateFilter !== "all") params.set("date", dateFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (category !== "all") params.set("category", category);
      if (city.trim()) params.set("city", city.trim());
      if (maxPrice !== null) params.set("maxPrice", String(maxPrice));
      if (sort) params.set("sort", sort);
      if (cursorToUse !== null) params.set("cursor", String(cursorToUse));

      const res = await fetch(`/api/v1/events?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Erro a carregar eventos:", text);
        throw new Error("Erro ao carregar eventos");
      }

      const data: ApiResponse = await res.json();

      if (append) {
        setEvents((prev) => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
      }

      setNextCursor(data.pagination.nextCursor);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      console.error(err);
      setError("Não conseguimos carregar os eventos. Tenta outra vez.");
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchEvents({ append: false, cursor: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFilter, typeFilter, sort, category, city, maxPrice]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setCity(cityInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [cityInput]);

  function formatDateRange(start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const sameDay = startDate.toDateString() === endDate.toDateString();

    const baseOpts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    };

    const startStr = startDate.toLocaleString("pt-PT", baseOpts);

    if (sameDay) {
      const endTime = endDate.toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${startStr} · ${endTime}`;
    }

    const endStr = endDate.toLocaleString("pt-PT", baseOpts);
    return `${startStr} → ${endStr}`;
  }

  const headingCity =
    city.trim().length > 0
      ? city.trim()
      : events[0]?.venue.city ?? "Portugal";

  return (
    <main className="orya-body-bg min-h-screen w-full text-white">
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-6 md:py-8 space-y-6">
        {/* TOPO – FILTROS PRINCIPAIS */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Localização */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsCityOpen((v) => !v);
                  setIsDateOpen(false);
                  setIsPriceOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/18 bg-black/40 px-3.5 py-2 text-xs md:text-sm hover:border-[#6BFFFF]/70 hover:bg-black/60 transition"
              >
                <span className="text-base">📍</span>
                <span className="font-medium">
                  {headingCity ? headingCity : "Portugal"}
                </span>
              </button>
              {isCityOpen && (
                <div className="absolute z-20 mt-2 w-64 rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur">
                  <p className="text-[11px] text-white/60 mb-2">
                    Escolhe uma cidade
                  </p>
                  <input
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="Procurar cidade..."
                    className="mb-2 w-full rounded-xl bg-white/5 border border-white/15 px-3 py-1.5 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CITIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCityInput(c);
                          setCity(c);
                          setIsCityOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white/5 border border-white/18 text-[11px] text-white/80 hover:bg-white/10"
                      >
                        {c}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCityInput("");
                        setCity("");
                        setIsCityOpen(false);
                      }}
                      className="mt-1 px-2.5 py-1 rounded-full bg-transparent border border-white/15 text-[11px] text-white/70 hover:bg-white/5"
                    >
                      Todo o país
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Data */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsDateOpen((v) => !v);
                  setIsCityOpen(false);
                  setIsPriceOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/18 bg-black/40 px-3.5 py-2 text-xs md:text-sm hover:border-[#6BFFFF]/70 hover:bg-black/60 transition"
              >
                <span className="text-base">📅</span>
                <span className="font-medium">
                  {
                    DATE_FILTER_OPTIONS.find((d) => d.value === dateFilter)
                      ?.label
                  }
                </span>
              </button>
              {isDateOpen && (
                <div className="absolute z-20 mt-2 w-64 rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur">
                  <p className="text-[11px] text-white/60 mb-2">
                    Quando queres sair?
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      type="button"
                      onClick={() => setDateFilter("today")}
                      className={`px-2.5 py-1 rounded-full text-[11px] ${
                        dateFilter === "today"
                          ? "bg-[#6BFFFF]/25 border border-[#6BFFFF]/70 text-[#E5FFFF]"
                          : "bg-white/5 border border-white/18 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter("upcoming")}
                      className={`px-2.5 py-1 rounded-full text-[11px] ${
                        dateFilter === "upcoming"
                          ? "bg-[#FF00C8]/20 border border-[#FF00C8]/70 text-[#FFE6FA]"
                          : "bg-white/5 border border-white/18 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      Próximos dias
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter("all")}
                      className={`px-2.5 py-1 rounded-full text-[11px] ${
                        dateFilter === "all"
                          ? "bg-white/15 border border-white/70 text-black"
                          : "bg-white/5 border border-white/18 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      Todas as datas
                    </button>
                  </div>
                  <p className="text-[10px] text-white/45">
                    Mais tarde podemos trocar isto por um calendário completo.
                  </p>
                </div>
              )}
            </div>

            {/* Preço */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsPriceOpen((v) => !v);
                  setIsCityOpen(false);
                  setIsDateOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/18 bg-black/40 px-3.5 py-2 text-xs md:text-sm hover:border-[#6BFFFF]/70 hover:bg-black/60 transition"
              >
                <span className="text-base">💸</span>
                <span className="font-medium">
                  {maxPrice === null ? "Qualquer preço" : `Até ${maxPrice} €`}
                </span>
              </button>
              {isPriceOpen && (
                <div className="absolute z-20 mt-2 w-64 rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur">
                  <p className="text-[11px] text-white/60 mb-2">
                    Define o máximo que queres gastar
                  </p>
                  <div className="rounded-xl bg-black/70 border border-white/20 px-3 py-2">
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={maxPrice ?? 100}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMaxPrice(val === 100 ? null : val);
                      }}
                      className="w-full accent-[#6BFFFF]"
                      aria-label="Filtrar por preço máximo"
                    />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-white/55">
                      <span>5 €</span>
                      <span>
                        {maxPrice === null
                          ? "Sem limite"
                          : `Até ${maxPrice.toFixed(0)} €`}
                      </span>
                      <span>100 €</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaxPrice(null);
                      setIsPriceOpen(false);
                    }}
                    className="mt-2 text-[11px] text-white/60 hover:text-white/90"
                  >
                    Limpar limite de preço
                  </button>
                </div>
              )}
            </div>

            {/* tipo & ordenação */}
            <div className="flex flex-wrap items-center gap-2 ml-auto text-[11px]">
              <button
                type="button"
                onClick={() =>
                  setTypeFilter((prev) =>
                    prev === "free" ? "all" : "free",
                  )
                }
                className={`px-2.5 py-1 rounded-full border transition ${
                  typeFilter === "free"
                    ? "bg-emerald-500/20 border-emerald-400/70 text-emerald-100"
                    : "bg-white/5 border-white/18 text-white/70 hover:bg-white/10"
                }`}
              >
                Só grátis
              </button>
              <button
                type="button"
                onClick={() =>
                  setTypeFilter((prev) =>
                    prev === "paid" ? "all" : "paid",
                  )
                }
                className={`px-2.5 py-1 rounded-full border transition ${
                  typeFilter === "paid"
                    ? "bg-[#FF8AD9]/20 border-[#FF8AD9]/70 text-[#FFE6F7]"
                    : "bg-white/5 border-white/18 text-white/70 hover:bg-white/10"
                }`}
              >
                Só pagos
              </button>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="rounded-full bg-black/40 border border-white/18 px-2.5 py-1 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                aria-label="Ordenar eventos"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setDateFilter("all");
                    setTypeFilter("all");
                    setSort("recommended");
                    setCategory("all");
                    setCity("");
                    setCityInput("");
                    setMaxPrice(null);
                  }}
                  className="text-[11px] text-white/55 hover:text-white/90"
                >
                  Limpar tudo
                </button>
              )}
            </div>
          </div>

          {/* categorias */}
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] text-white/50 shrink-0">
              Categorias:
            </span>
            <div className="flex gap-1.5">
              {CATEGORY_CHIPS.map((cat) => {
                const isActive = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[11px] whitespace-nowrap transition ${
                      isActive
                        ? "bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                        : "bg-white/5 border-white/18 text-white/80 hover:bg-white/10"
                    }`}
                    aria-pressed={isActive}
                    aria-label={`${cat.label} – categoria de eventos`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* resumo */}
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>
              Encontrados{" "}
              <span className="font-semibold text-white/90">
                {resultsLabel}
              </span>
            </span>
            <span className="text-white/45">
              Eventos populares em{" "}
              <span className="text-white/85">{headingCity}</span>
            </span>
          </div>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-white/10 bg-white/5 p-3 animate-pulse space-y-3"
              >
                <div className="rounded-2xl bg-white/10 aspect-square" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/8" />
              </div>
            ))}
          </div>
        )}

        {/* ERRO */}
        {error && !loading && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* SEM RESULTADOS */}
        {!loading && !error && events.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center gap-2 text-sm text-white/60">
            <p>Não encontrámos eventos com estes filtros.</p>
            <p className="text-xs text-white/40 max-w-sm">
              Tenta mudar a data, tipo ou cidade — ou volta mais tarde. A
              cidade está sempre a mexer.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setDateFilter("all");
                setTypeFilter("all");
                setSort("recommended");
                setCategory("all");
                setCity("");
                setCityInput("");
                setMaxPrice(null);
              }}
              className="mt-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-xs text-white/80 hover:bg-white/10"
            >
              Limpar filtros e voltar ao início
            </button>
          </div>
        )}

        {/* LISTA DE EVENTOS */}
        {!loading && events.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {events.map((event) => {
                const badgeText =
                  event.wavesSummary.soldOutCount === event.wavesSummary.totalWaves
                    ? "Esgotado"
                    : event.isFree
                    ? "Entrada gratuita"
                    : event.priceFrom !== null
                    ? `Desde ${event.priceFrom.toFixed(2)}€`
                    : "Preço a anunciar";

                const status = getEventStatus(
                  event.startDate,
                  event.endDate,
                );
                const isPast = status === "past";
                const isLiked = likedEvents.includes(event.id);

                const dateLabel = formatDateRange(
                  event.startDate,
                  event.endDate,
                );

                const venueLabel =
                  event.venue.name || event.venue.city || "Local a anunciar";

                return (
                  <Link
                    key={event.id}
                    href={`/eventos/${event.slug}`}
                    className={`group rounded-3xl border border-white/12 bg-white/[0.03] overflow-hidden flex flex-col transition-all hover:border-[#6BFFFF]/80 hover:shadow-[0_18px_50px_rgba(15,23,42,0.95)] hover:-translate-y-1 ${
                      isPast ? "opacity-60 hover:opacity-100" : ""
                    }`}
                  >
                    {/* imagem quadrada */}
                    <div className="relative overflow-hidden">
                      <div className="aspect-square w-full">
                        {event.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={event.coverImageUrl}
                            alt={event.title}
                            className="h-full w-full object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-[#FF00C8]/25 via-[#6BFFFF]/10 to-[#1646F5]/40" />
                        )}
                      </div>

                      {/* like redondo */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleLike(event.id);
                        }}
                        className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 border border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.6)] text-base opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all hover:bg-black/80"
                        aria-label={
                          isLiked ? "Remover interesse" : "Marcar interesse"
                        }
                      >
                        <span
                          className={`transition-transform duration-150 ${
                            isLiked
                              ? "scale-110 text-[#FF00C8]"
                              : "scale-100 text-white"
                          }`}
                        >
                          {isLiked ? "♥" : "♡"}
                        </span>
                      </button>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </div>

                    {/* meta */}
                    <div className="p-3.5 flex flex-col gap-1.5">
                      <h2 className="text-[15px] md:text-base font-semibold leading-snug text-white line-clamp-2">
                        {event.title}
                      </h2>

                      <p className="text-[11px] text-white/80 line-clamp-2">
                        {dateLabel}
                      </p>

                      <p className="text-[11px] text-white/70">
                        {venueLabel}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/22 text-white font-medium">
                          {badgeText}
                        </span>
                        {status === "ongoing" && (
                          <span className="text-[10px] text-emerald-300">
                            A acontecer agora
                          </span>
                        )}
                        {status === "upcoming" && (
                          <span className="text-[10px] text-[#6BFFFF]">
                            Em breve
                          </span>
                        )}
                        {status === "past" && (
                          <span className="text-[10px] text-white/55">
                            Já aconteceu
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    fetchEvents({ append: true, cursor: nextCursor })
                  }
                  disabled={isLoadingMore}
                  className="px-5 py-2 rounded-full bg-white/5 border border-white/20 text-xs text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {isLoadingMore ? "A carregar mais..." : "Ver mais eventos"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}