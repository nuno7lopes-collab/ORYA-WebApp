"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";

type ExploreItem = {
  id: number;
  type: "EVENT" | "EXPERIENCE";
  slug: string;
  title: string;
  shortDescription: string | null;
  startsAt: string;
  endsAt: string;
  location: {
    name: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };
  coverImageUrl: string | null;
  isFree: boolean;
  priceFrom: number | null;
  categories: string[];
  hostName: string | null;
  hostUsername: string | null;
  status: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT";
  isHighlighted: boolean;
};

type ApiResponse = {
  items: ExploreItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
};

type DateFilter = "all" | "today" | "upcoming";
type TypeFilter = "all" | "event" | "experience";

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "Todas as datas" },
  { value: "today", label: "Hoje" },
  { value: "upcoming", label: "Próximos dias" },
] as const;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "event", label: "Eventos" },
  { value: "experience", label: "Experiências" },
];

const CATEGORY_OPTIONS = [
  { value: "FESTA", label: "Festa", accent: "from-[#FF00C8] to-[#FF8AD9]" },
  { value: "DESPORTO", label: "Desporto", accent: "from-[#6BFFFF] to-[#4ADE80]" },
  { value: "CONCERTO", label: "Concerto", accent: "from-[#9B8CFF] to-[#6BFFFF]" },
  { value: "PALESTRA", label: "Palestra", accent: "from-[#FDE68A] to-[#F472B6]" },
  { value: "ARTE", label: "Arte", accent: "from-[#F472B6] to-[#A855F7]" },
  { value: "COMIDA", label: "Comida", accent: "from-[#F97316] to-[#FACC15]" },
  { value: "DRINKS", label: "Drinks", accent: "from-[#34D399] to-[#6BFFFF]" },
] as const;

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

function statusTag(status: ExploreItem["status"]) {
  if (status === "CANCELLED") return { text: "Cancelado", className: "text-red-200" };
  if (status === "PAST") return { text: "Já aconteceu", className: "text-white/55" };
  if (status === "DRAFT") return { text: "Rascunho", className: "text-white/60" };
  return { text: "Em breve", className: "text-[#6BFFFF]" };
}

function buildSlug(type: ExploreItem["type"], slug: string) {
  return type === "EXPERIENCE" ? `/experiencias/${slug}` : `/eventos/${slug}`;
}

function ExplorarContent() {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100); // 100 = "sem limite" (100+)

  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);

  const [likedItems, setLikedItems] = useState<number[]>([]);
  const searchParams = useSearchParams();
  const requestController = useRef<AbortController | null>(null);

  // City via geolocation + Mapbox (opcional)
  // Geolocation desativada para evitar preencher com valores inválidos

  const effectiveMaxParam = priceMax >= 100 ? null : priceMax;

  const hasActiveFilters = useMemo(
    () =>
      search.trim().length > 0 ||
      dateFilter !== "all" ||
      typeFilter !== "all" ||
      selectedCategories.length > 0 ||
      city.trim().length > 0 ||
      priceMin > 0 ||
      effectiveMaxParam !== null,
    [city, dateFilter, effectiveMaxParam, priceMin, search, selectedCategories.length, typeFilter],
  );

  function toggleLike(id: number) {
    setLikedItems((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  async function fetchItems(opts?: { append?: boolean; cursor?: number | null }) {
    const append = opts?.append ?? false;
    const cursorToUse = opts?.cursor ?? null;

    // Cancelar pedidos anteriores para evitar estados inconsistentes
    if (requestController.current) {
      requestController.current.abort();
    }
    const controller = new AbortController();
    requestController.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const currentRequest = controller;

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
      if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
      if (city.trim()) params.set("city", city.trim());
      if (priceMin > 0) params.set("priceMin", String(priceMin));
      if (effectiveMaxParam !== null) params.set("priceMax", String(effectiveMaxParam));
      if (cursorToUse !== null) params.set("cursor", String(cursorToUse));

      const res = await fetch(`/api/explorar/list?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        if (process.env.NODE_ENV !== "production") {
          console.error("Erro a carregar explorar:", text);
        } else {
          console.warn("Erro a carregar explorar");
        }
        throw new Error("Erro ao carregar explorar");
      }

      const data: ApiResponse = await res.json();
      const nextItems = Array.isArray(data?.items) ? data.items : [];

      if (requestController.current === currentRequest) {
        if (append) {
          setItems((prev) => [...(Array.isArray(prev) ? prev : []), ...nextItems]);
        } else {
          setItems(nextItems);
        }

        setNextCursor(data.pagination.nextCursor);
        setHasMore(data.pagination.hasMore);
      }
    } catch (err) {
      if (requestController.current !== currentRequest) return;
      const isAbort = (err as Error | undefined)?.name === "AbortError";
      if (!isAbort && process.env.NODE_ENV !== "production") {
        console.error(err);
      }
      setError(
        isAbort
          ? "Demorou demasiado a responder. Tenta novamente."
          : "Não conseguimos carregar. Tenta outra vez.",
      );
    } finally {
      clearTimeout(timeoutId);
      if (requestController.current === currentRequest) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    fetchItems({ append: false, cursor: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFilter, typeFilter, selectedCategories, city, priceMin, effectiveMaxParam]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Atualiza pesquisa ao entrar via query da Navbar (/explorar?query=)
  useEffect(() => {
    const qp = searchParams.get("query") ?? searchParams.get("q") ?? "";
    setSearchInput(qp);
    setSearch(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const handle = setTimeout(() => setCity(cityInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [cityInput]);

  const headingCity = city.trim() || "Portugal";
  const resultsLabel = items.length === 1 ? "1 resultado" : `${items.length} resultados`;
  const showSkeleton = loading || (error && items.length === 0);

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
                <span className="font-medium">{headingCity}</span>
              </button>
              {isCityOpen && (
                <div className="mt-2 w-full rounded-2xl border border-white/15 bg-black/85 p-3 backdrop-blur md:absolute md:w-64 md:shadow-2xl">
                  <p className="text-[11px] text-white/60 mb-2">
                    Escreve a cidade (autocomplete de morada liga depois ao Mapbox)
                  </p>
                  <input
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="Porto, Lisboa, Braga..."
                    className="mb-2 w-full rounded-xl bg-white/5 border border-white/15 px-3 py-1.5 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCityInput("");
                      setCity("");
                      setIsCityOpen(false);
                    }}
                    className="mt-1 px-2.5 py-1 rounded-full bg-transparent border border-white/15 text-[11px] text-white/70 hover:bg-white/5"
                  >
                    Limpar cidade
                  </button>
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
                  {DATE_FILTER_OPTIONS.find((d) => d.value === dateFilter)?.label}
                </span>
              </button>
              {isDateOpen && (
                <div className="mt-2 w-full rounded-2xl border border-white/15 bg-black/85 p-3 backdrop-blur md:absolute md:w-64 md:shadow-2xl">
                  <p className="text-[11px] text-white/60 mb-2">Quando queres sair?</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {DATE_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDateFilter(opt.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] ${
                          dateFilter === opt.value
                            ? "bg-[#6BFFFF]/25 border border-[#6BFFFF]/70 text-[#E5FFFF]"
                            : "bg-white/5 border border-white/18 text-white/75 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/45">
                    Em breve: calendário completo com intervalos personalizados.
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
                  {priceMin === 0 && effectiveMaxParam === null
                    ? "Qualquer preço"
                    : `€${priceMin} – ${effectiveMaxParam === null ? "100+" : effectiveMaxParam}`}
                </span>
              </button>
              {isPriceOpen && (
                <div className="mt-2 w-full rounded-2xl border border-white/15 bg-black/85 p-3 backdrop-blur space-y-3 md:absolute md:w-80 md:shadow-2xl">
                  <p className="text-[11px] text-white/60">Intervalo de preço</p>
                  <DoubleRange
                    min={0}
                    max={100}
                    step={5}
                    valueMin={priceMin}
                    valueMax={priceMax}
                    onChange={(min, max) => {
                      setPriceMin(min);
                      setPriceMax(max);
                    }}
                  />
                  <div className="flex items-center justify-between text-[11px] text-white/70">
                    <span>Mín: € {priceMin}</span>
                    <span>Máx: {priceMax >= 100 ? "100+ (sem limite)" : `€ ${priceMax}`}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceMin(0);
                      setPriceMax(100);
                      setIsPriceOpen(false);
                    }}
                    className="text-[11px] text-white/60 hover:text-white/90"
                  >
                    Limpar filtro de preço
                  </button>
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="flex flex-wrap items-center gap-2 ml-auto text-[11px]">
              <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/15 px-1 py-1">
                {TYPE_OPTIONS.map((opt) => {
                  const isActive = typeFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTypeFilter(opt.value)}
                      className={`px-3 py-1 rounded-full transition ${
                        isActive
                          ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.35)]"
                          : "text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setDateFilter("all");
                    setTypeFilter("all");
                    setSelectedCategories([]);
                    setCity("");
                    setCityInput("");
                    setPriceMin(0);
                    setPriceMax(100);
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
            <span className="text-[10px] text-white/50 shrink-0">Categorias:</span>
            <div className="flex gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const isActive = selectedCategories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setSelectedCategories((prev) =>
                        prev.includes(cat.value)
                          ? prev.filter((c) => c !== cat.value)
                          : [...prev, cat.value],
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[11px] whitespace-nowrap transition ${
                      isActive
                        ? "bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                        : "bg-white/5 border-white/18 text-white/80 hover:bg-white/10"
                    }`}
                    aria-pressed={isActive}
                    aria-label={`${cat.label} – categoria`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full bg-gradient-to-r ${cat.accent} shadow-[0_0_12px_rgba(255,255,255,0.45)]`}
                    />
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
              Eventos e experiências em{" "}
              <span className="text-white/85">{headingCity}</span>
            </span>
          </div>
        </div>

        {/* LOADING */}
        {showSkeleton && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden>
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
        {error && (
          <div className="mt-4 max-w-xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
            <p className="font-semibold mb-1">Não foi possível carregar.</p>
            <p className="text-[12px] text-red-50/85 leading-relaxed">{error}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => fetchItems({ append: false, cursor: null })}
                className="rounded-full bg-white text-red-700 px-4 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setDateFilter("all");
                  setTypeFilter("all");
                  setSelectedCategories([]);
                  setCity("");
                  setCityInput("");
                  setPriceMin(0);
                  setPriceMax(100);
                  fetchItems({ append: false, cursor: null });
                }}
                className="rounded-full border border-white/25 text-white/85 px-4 py-1.5 text-[11px] hover:bg-white/5 transition"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        )}

        {/* SEM RESULTADOS */}
        {!loading && !error && items.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center gap-2 text-sm text-white/60">
            <p>Não encontrámos eventos ou experiências com estes filtros.</p>
            <p className="text-xs text-white/40 max-w-sm">
              Ajusta a cidade, categorias ou preço — ou volta mais tarde. A cidade está sempre a
              mexer.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setDateFilter("all");
                setTypeFilter("all");
                setSelectedCategories([]);
                setCity("");
                setCityInput("");
                setPriceMin(0);
                setPriceMax(100);
              }}
              className="mt-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-xs text-white/80 hover:bg-white/10"
            >
              Limpar filtros e voltar ao início
            </button>
          </div>
        )}

        {/* LISTA */}
        {!loading && items.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((item) =>
                item.type === "EVENT" ? (
                  <EventCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    onLike={toggleLike}
                    liked={likedItems.includes(item.id)}
                  />
                ) : (
                  <ExperienceCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    onLike={toggleLike}
                    liked={likedItems.includes(item.id)}
                  />
                ),
              )}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchItems({ append: true, cursor: nextCursor })}
                  disabled={isLoadingMore}
                  className="px-5 py-2 rounded-full bg-white/5 border border-white/20 text-xs text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {isLoadingMore ? "A carregar mais..." : "Ver mais"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default function ExplorarPage() {
  return (
    <Suspense fallback={null}>
      <ExplorarContent />
    </Suspense>
  );
}

type CardProps = {
  item: ExploreItem;
  liked: boolean;
  onLike: (id: number) => void;
  neonClass?: string;
};

function PriceBadge({ item }: { item: ExploreItem }) {
  if (item.isFree) return <span className="text-emerald-200">Grátis</span>;
  if (item.priceFrom !== null) return <span>Desde {item.priceFrom.toFixed(2)} €</span>;
  return <span>Preço a anunciar</span>;
}

function clampWithGap(
  minValue: number,
  maxValue: number,
  step: number,
  gap: number,
  bounds: { min: number; max: number }
) {
  const quantize = (v: number) => Math.round(v / step) * step;
  const snappedMin = Math.max(bounds.min, Math.min(minValue, maxValue - gap));
  const snappedMax = Math.min(bounds.max, Math.max(maxValue, snappedMin + gap));
  return { min: quantize(snappedMin), max: quantize(snappedMax) };
}

type DoubleRangeProps = {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
};

// Estilo inline para evitar que clicar no track mova os thumbs
const doubleRangeStyles = `
.price-range-thumb::-webkit-slider-runnable-track { pointer-events: none; }
.price-range-thumb::-moz-range-track { pointer-events: none; }
.price-range-thumb::-ms-track { pointer-events: none; }
.price-range-thumb::-webkit-slider-thumb { pointer-events: auto; }
.price-range-thumb::-moz-range-thumb { pointer-events: auto; }
.price-range-thumb::-ms-thumb { pointer-events: auto; }
`;

// eslint-disable-next-line @next/next/no-css-tags
if (typeof document !== "undefined") {
  const existing = document.getElementById("double-range-styles");
  if (!existing) {
    const style = document.createElement("style");
    style.id = "double-range-styles";
    style.innerHTML = doubleRangeStyles;
    document.head.appendChild(style);
  }
}

function DoubleRange({ min, max, step, valueMin, valueMax, onChange }: DoubleRangeProps) {
  const gap = 5;
  const bounds = { min, max };

  return (
    <div className="space-y-3">
      <div className="relative h-1.5 rounded-full bg-white/10">
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
          style={{
            left: `${(valueMin / max) * 100}%`,
            right: `${100 - (valueMax / max) * 100}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => {
            const next = Number(e.target.value);
            const { min: cMin, max: cMax } = clampWithGap(next, valueMax, step, gap, bounds);
            onChange(cMin, cMax);
          }}
          className="price-range-thumb pointer-events-auto absolute -top-2 h-5 w-full appearance-none bg-transparent z-30"
          style={{ touchAction: "none" }}
        />
        <input
          type="range"
          min={min + gap}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => {
            const next = Number(e.target.value);
            const { min: cMin, max: cMax } = clampWithGap(valueMin, next, step, gap, bounds);
            onChange(cMin, cMax);
          }}
          className="price-range-thumb pointer-events-auto absolute -top-2 h-5 w-full appearance-none bg-transparent z-20"
          style={{ touchAction: "none" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/60">
        <span>{min}€</span>
        <span>{max}+€</span>
      </div>
    </div>
  );
}

function BaseCard({
  item,
  liked,
  onLike,
  accentClass,
  badge,
  neonClass,
}: CardProps & { accentClass: string; badge: string }) {
  const router = useRouter();
  const status = statusTag(item.status);
  const dateLabel = formatDateRange(item.startsAt, item.endsAt);
  const venueLabel = item.location.name || item.location.city || "Local a anunciar";
  const isEvent = badge === "Evento";
  const badgeGrad = isEvent
    ? "from-white/12 via-white/9 to-white/6"
    : "from-white/10 via-white/8 to-white/5";
  const badgeDot = isEvent
    ? "from-[#FF66E0]/70 via-[#8DEFFF]/70 to-[#5270FF]/70"
    : "from-[#6EE7FF]/70 via-[#34d399]/70 to-[#3b82f6]/70";
  const badgeIcon = isEvent ? "🎟️" : "✨";

  return (
    <Link
      href={buildSlug(item.type, item.slug)}
      className={`group rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col transition-all hover:border-white/16 hover:-translate-y-[6px] ${neonClass ?? ""}`}
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          {item.coverImageUrl ? (
            <Image
              src={optimizeImageUrl(item.coverImageUrl, 900, 72)}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
              placeholder="blur"
              blurDataURL={defaultBlurDataURL}
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${accentClass}`} />
          )}
        </div>

        <div
          className={`absolute top-2 left-2 flex items-center gap-2 rounded-2xl border border-white/16 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-lg bg-gradient-to-r ${badgeGrad}`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
            {badgeIcon}
          </span>
          <span
            className={`h-1.5 w-6 rounded-full bg-gradient-to-r ${badgeDot}`}
          />
          <span className="tracking-wide leading-none">{badge}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLike(item.id);
          }}
          className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 border border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.6)] text-base opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all hover:bg-black/80"
          aria-label={liked ? "Remover interesse" : "Marcar interesse"}
        >
          <span
            className={`transition-transform duration-150 ${
              liked ? "scale-110 text-[#FF00C8]" : "scale-100 text-white"
            }`}
          >
            {liked ? "♥" : "♡"}
          </span>
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-white/75">
          {item.hostUsername ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/${item.hostUsername}`);
              }}
              className="truncate text-left hover:text-[#6BFFFF]"
            >
              {item.hostName || `@${item.hostUsername}`}
            </button>
          ) : (
            <span className="truncate">{item.hostName || "Organizador ORYA"}</span>
          )}
          <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
            <PriceBadge item={item} />
          </span>
        </div>

        <h2 className="text-[14px] md:text-[15px] font-semibold leading-snug text-white line-clamp-2">
          {item.title}
        </h2>

        <p className="text-[11px] text-white/80 line-clamp-2">{dateLabel}</p>
        <p className="text-[11px] text-white/70">{venueLabel}</p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.categories.map((c) => {
            const catLabel = CATEGORY_OPTIONS.find((opt) => opt.value === c)?.label ?? c;
            return (
              <span
                key={c}
                className="text-[10px] rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-white/75"
              >
                {catLabel}
              </span>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/22 text-white font-medium">
            {item.isFree ? "Entrada gratuita" : "Bilhetes disponíveis"}
          </span>
          <span className={status.className}>{status.text}</span>
        </div>
      </div>
    </Link>
  );
}

function EventCard(props: CardProps) {
  return (
    <BaseCard
      {...props}
      accentClass="from-[#FF00C8]/45 via-[#6BFFFF]/25 to-[#1646F5]/45"
      badge="Evento"
      neonClass="shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
    />
  );
}

function ExperienceCard(props: CardProps) {
  return (
    <BaseCard
      {...props}
      accentClass="from-[#22d3ee]/45 via-[#34d399]/25 to-[#0ea5e9]/45"
      badge="Experiência"
      neonClass="shadow-[0_14px_32px_rgba(0,0,0,0.42)]"
    />
  );
}
