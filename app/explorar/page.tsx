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
  { value: "food", label: "Comida &amp; drinks", emoji: "🍻" },
] as const;

type CategoryFilter = (typeof CATEGORY_CHIPS)[number]["value"];

type DateFilter = (typeof DATE_FILTER_OPTIONS)[number]["value"];
type TypeFilter = (typeof TYPE_OPTIONS)[number]["value"];
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

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

  // Chips de filtros activos
  const activeFilterChips: string[] = [];
  if (search.trim()) {
    activeFilterChips.push(`Pesquisa: "${search.trim()}"`);
  }
  if (dateFilter !== "all") {
    if (dateFilter === "today") activeFilterChips.push("Data: Hoje");
    else if (dateFilter === "upcoming")
      activeFilterChips.push("Data: Próximos dias");
  }
  if (typeFilter !== "all") {
    if (typeFilter === "free") activeFilterChips.push("Tipo: Grátis");
    else if (typeFilter === "paid") activeFilterChips.push("Tipo: Pago");
  }
  if (category !== "all") {
    const catLabel =
      CATEGORY_CHIPS.find((c) => c.value === category)?.label ?? category;
    activeFilterChips.push(`Categoria: ${catLabel}`);
  }
  if (city.trim()) {
    activeFilterChips.push(`Cidade: ${city.trim()}`);
  }
  if (maxPrice !== null) {
    activeFilterChips.push(`Até ${maxPrice.toFixed(0)} €`);
  }
  if (sort !== "recommended") {
    if (sort === "newest")
      activeFilterChips.push("Ordenação: Mais recentes");
    else if (sort === "price_asc")
      activeFilterChips.push("Ordenação: Preço ↑");
    else if (sort === "price_desc")
      activeFilterChips.push("Ordenação: Preço ↓");
  }
  const hasActiveFilters: boolean = activeFilterChips.length > 0;

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

  const resultsLabel =
    events.length === 1 ? "1 evento" : `${events.length} eventos`;

  return (
    <main className="orya-body-bg min-h-screen w-full text-white">
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-8 md:py-10 space-y-6">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-[#FF8AD910] via-[#9BE7FF1A] to-[#020617f2] px-5 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-[0_22px_60px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[10px] font-extrabold tracking-[0.18em]">
              OR
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium tracking-[0.25em] text-white/60 uppercase">
                Explorar
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Descobre o que está a acontecer por perto — e o que vem a
                seguir.
              </h1>
              <p className="text-xs md:text-sm text-white/70 max-w-xl">
                Eventos, torneios, festas, sunsets. A ORYA mostra-te onde está a
                energia da cidade, wave a wave.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <Link
              href="/eventos/novo"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-1.5 text-[11px] font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.45)] hover:scale-105 active:scale-95 transition-transform"
            >
              <span className="text-xs">＋</span> Criar evento
            </Link>
            <div className="hidden md:flex items-center gap-2 text-[10px] text-white/55">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#6BFFFF]" />
              Atualizado em tempo real com base nas waves e bilhetes
              disponíveis.
            </div>
          </div>

          {/* Glow decorativo */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#FF00C8]/20 blur-3xl" />
        </div>

        {/* FILTROS + SEARCH */}
        <div className="relative -mt-4 z-[1]">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#020617f2] via-[#020617] to-[#020617]/95 backdrop-blur-xl px-4 py-4 md:px-6 md:py-5 shadow-[0_22px_60px_rgba(15,23,42,0.9)] space-y-3">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="space-y-2 md:flex-1">
                <label className="block text-[11px] font-medium text-white/65">
                  Procurar eventos
                </label>
                <div className="relative">
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Padel, techno, sunset, jantar, torneio..."
                    className="w-full rounded-2xl bg-black/70 border border-white/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70 pr-9"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                    ⌕
                  </span>
                </div>
                <p className="hidden md:block text-[10px] text-white/45">
                  Escreve o que te apetece fazer e deixa a ORYA tratar do
                  resto.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:w-[420px]">
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-white/65">
                    Data
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) =>
                      setDateFilter(e.target.value as DateFilter)
                    }
                    className="w-full rounded-2xl bg-black/70 border border-white/20 px-2.5 py-2 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  >
                    {DATE_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] text-white/65">
                    Tipo
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as TypeFilter)
                    }
                    className="w-full rounded-2xl bg-black/70 border border-white/20 px-2.5 py-2 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[11px] text-white/65">
                    Ordenar por
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="w-full rounded-2xl bg-black/70 border border-white/20 px-2.5 py-2 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Categorias principais */}
            <div className="mt-2 flex w-full items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[10px] text-white/50 shrink-0">
                Explorar por vibe:
              </span>
              <div className="flex gap-1.5">
                {CATEGORY_CHIPS.map((cat) => {
                  const isActive = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] whitespace-nowrap transition ${
                        isActive
                          ? "bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                          : "bg-white/5 border-white/18 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cidade + Preço */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] text-white/65">
                  Cidade
                </label>
                <input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="Porto, Lisboa, Braga..."
                  className="w-full rounded-2xl bg-black/70 border border-white/20 px-3 py-2 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                />
                <p className="text-[9px] text-white/40">
                  Vamos afinando isto para adicionar todas as cidades em breve.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] text-white/65">
                  Preço máximo
                </label>
                <div className="rounded-2xl bg-black/70 border border-white/20 px-3 py-2">
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
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-white/55">
                    <span>5 €</span>
                    <span>
                      {maxPrice === null ? "Sem limite" : `Até ${maxPrice.toFixed(0)} €`}
                    </span>
                    <span>100 €</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros rápidos */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] mt-3">
              <span className="text-white/45">Filtros rápidos:</span>
              <button
                type="button"
                onClick={() => setDateFilter("today")}
                className={`px-2.5 py-1 rounded-full border text-[10px] transition ${
                  dateFilter === "today"
                    ? "bg-[#6BFFFF]/20 border-[#6BFFFF]/70 text-[#CFFFFF]"
                    : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("upcoming")}
                className={`px-2.5 py-1 rounded-full border text-[10px] transition ${
                  dateFilter === "upcoming"
                    ? "bg-[#FF00C8]/15 border-[#FF00C8]/60 text-[#FFD9F7]"
                    : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                }`}
              >
                Próximos dias
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("free")}
                className={`px-2.5 py-1 rounded-full border text-[10px] transition ${
                  typeFilter === "free"
                    ? "bg-emerald-500/20 border-emerald-400/70 text-emerald-100"
                    : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                }`}
              >
                Só eventos grátis
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("paid")}
                className={`px-2.5 py-1 rounded-full border text-[10px] transition ${
                  typeFilter === "paid"
                    ? "bg-[#FF8AD9]/20 border-[#FF8AD9]/70 text-[#FFE6F7]"
                    : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                }`}
              >
                Só eventos pagos
              </button>
            </div>

            {/* Resumo dos filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1.5">
              <p className="text-[10px] text-white/50">
                Encontrados{" "}
                <span className="font-medium text-white/80">
                  {resultsLabel}
                </span>
              </p>
              {hasActiveFilters && (
                <div className="flex items-center flex-wrap gap-1">
                  {activeFilterChips.map((chip, idx) => (
                    <span
                      key={chip + idx}
                      className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[10px] text-white/70"
                    >
                      {chip}
                    </span>
                  ))}
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
                    className="ml-1.5 text-[10px] text-white/55 hover:text-white/90"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LOADING SKELETON */}
        {loading && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/12 bg-gradient-to-b from-[#FF8AD910] via-[#020617f2] to-[#020617] p-3 animate-pulse space-y-3"
              >
                <div className="h-32 rounded-xl bg-white/5" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/8" />
                <div className="flex gap-2">
                  <div className="h-4 w-16 rounded-full bg-white/10" />
                  <div className="h-4 w-12 rounded-full bg-white/10" />
                </div>
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
              Tenta mudar a data, tipo ou pesquisa — ou volta mais tarde. A
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
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => {
                const badgeText = event.isFree
                  ? "Entrada gratuita"
                  : event.priceFrom !== null
                  ? `Desde ${event.priceFrom.toFixed(2)}€`
                  : "Preço a anunciar";

                const wavesInfo =
                  event.wavesSummary.totalWaves > 1
                    ? `${event.wavesSummary.totalWaves} waves`
                    : "1 wave";

                const status = getEventStatus(
                  event.startDate,
                  event.endDate,
                );

                let audienceStats = "";
                if (
                  event.stats.goingCount > 0 ||
                  event.stats.interestedCount > 0
                ) {
                  const statsParts: string[] = [];
                  if (event.stats.goingCount > 0) {
                    statsParts.push(`${event.stats.goingCount} confirmados`);
                  }
                  if (event.stats.interestedCount > 0) {
                    statsParts.push(
                      `${event.stats.interestedCount} interessados`,
                    );
                  }
                  audienceStats = statsParts.join(" • ");
                }

                const isPast = status === "past";

                return (
                  <Link
                    key={event.id}
                    href={`/eventos/${event.slug}`}
                    className={`group rounded-2xl border border-white/12 bg-gradient-to-b from-[#FF8AD910] via-[#020617f2] to-[#020617] overflow-hidden flex flex-col hover:border-[#6BFFFF]/70 hover:shadow-[0_22px_60px_rgba(15,23,42,0.95)] transition-all ${
                      isPast ? "opacity-60 hover:opacity-100" : ""
                    }`}
                  >
                    {/* imagem / capa */}
                    <div className="relative h-40 overflow-hidden">
                      {event.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.coverImageUrl}
                          alt={event.title}
                          className="h-full w-full object-cover transform group-hover:scale-[1.04] transition-transform duration-400"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-[#FF00C8]/25 via-[#6BFFFF]/10 to-[#1646F5]/40" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

                      <div className="absolute top-2 left-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-black/65 border border-white/15 text-[10px] uppercase tracking-[0.16em] text-white/70">
                          {event.venue.name || "Local a anunciar"}
                        </span>
                      </div>

                      {/* Status pill */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {status === "ongoing" && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-[10px] text-emerald-100">
                            A acontecer agora
                          </span>
                        )}
                        {status === "upcoming" && (
                          <span className="px-2 py-0.5 rounded-full bg-[#6BFFFF]/15 border border-[#6BFFFF]/40 text-[10px] text-[#CFFFFF]">
                            Em breve
                          </span>
                        )}
                        {status === "past" && (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-[10px] text-white/60">
                            Já aconteceu
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/85">
                          {formatDateRange(
                            event.startDate,
                            event.endDate,
                          )}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-black/65 border border-white/20 text-[10px] text-white/85">
                          {badgeText}
                        </span>
                      </div>
                    </div>

                    {/* info */}
                    <div className="p-3.5 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold leading-snug line-clamp-2">
                          {event.title}
                        </h2>
                      </div>

                      <p className="text-[11px] text-white/60 line-clamp-3">
                        {event.shortDescription}
                      </p>

                      {(event.category || event.tags.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {event.category && (
                            <span className="px-2 py-0.5 rounded-full bg-white/6 border border-white/18 text-[10px] text-white/75 uppercase tracking-[0.12em]">
                              {event.category}
                            </span>
                          )}
                          {event.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full bg-white/4 border border-white/12 text-[10px] text-white/70"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-2 text-white/55">
                          <span className="px-2 py-0.5 rounded-full bg-white/6 border border-white/18">
                            {wavesInfo}
                          </span>
                          {event.wavesSummary.onSaleCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200">
                              {event.wavesSummary.onSaleCount} à venda
                            </span>
                          )}
                          {event.wavesSummary.soldOutCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/40 text-red-200">
                              {event.wavesSummary.soldOutCount} esgotada(s)
                            </span>
                          )}
                          {audienceStats && (
                            <span className="text-[10px] text-white/45">
                              {audienceStats}
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-[10px] text-white/55 group-hover:text-white/80 transition-colors">
                          Ver detalhes
                          <span className="text-[11px] group-hover:translate-x-0.5 transition-transform">
                            ↗
                          </span>
                        </span>
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