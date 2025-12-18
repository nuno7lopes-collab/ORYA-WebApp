"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";
import { PORTUGAL_CITIES } from "@/config/cities";
import { clampWithGap } from "@/lib/filters";
import { trackEvent } from "@/lib/analytics";

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

type DateFilter = "all" | "today" | "weekend" | "custom";
type TypeFilter = "all" | "event" | "experience";

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "Todas as datas" },
  { value: "today", label: "Hoje" },
  { value: "weekend", label: "Este fim de semana" },
] as const;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "event", label: "Eventos" },
  { value: "experience", label: "Experiências" },
];

const CATEGORY_OPTIONS = [
  { value: "DESPORTO", label: "Desporto", accent: "from-[#6BFFFF] to-[#4ADE80]" },
  { value: "GERAL", label: "Eventos gerais", accent: "from-[#FF00C8] via-[#9B8CFF] to-[#1646F5]" },
] as const;

const defaultCover = (() => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#0b0c12"/>
      <stop offset="50%" stop-color="#080910"/>
      <stop offset="100%" stop-color="#05060b"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="24%" r="34%">
      <stop offset="0%" stop-color="#9aa6c7" stop-opacity="0.35"/>
      <stop offset="70%" stop-color="#9aa6c7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="78%" cy="20%" r="30%">
      <stop offset="0%" stop-color="#7d8fb5" stop-opacity="0.32"/>
      <stop offset="70%" stop-color="#7d8fb5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow3" cx="52%" cy="80%" r="42%">
      <stop offset="0%" stop-color="#4f5b73" stop-opacity="0.28"/>
      <stop offset="70%" stop-color="#4f5b73" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0.02)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="20%" stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.1)"/>
      <stop offset="78%" stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.14)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#glow1)"/>
  <rect width="1200" height="1200" fill="url(#glow2)"/>
  <rect width="1200" height="1200" fill="url(#glow3)"/>
  <rect x="120" y="150" width="960" height="840" rx="36" fill="url(#glass)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <rect x="100" y="130" width="1000" height="880" fill="url(#sheen)" opacity="0.45"/>
  <g opacity="0.12" stroke="rgba(255,255,255,0.24)" stroke-width="1">
    <path d="M110 260 Q520 180 890 280 T1090 260"/>
    <path d="M90 520 Q520 460 900 560 T1110 520"/>
    <path d="M80 760 Q520 720 900 820 T1120 800"/>
  </g>
  <g opacity="0.32" stroke="rgba(255,255,255,0.18)" stroke-width="1.3" fill="none">
    <circle cx="320" cy="300" r="42"/>
    <circle cx="880" cy="300" r="36"/>
    <circle cx="820" cy="760" r="40"/>
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
})();
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

const exploreMainClass =
  "min-h-screen w-full text-white bg-[radial-gradient(circle_at_12%_18%,rgba(255,0,200,0.06),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(107,255,255,0.06),transparent_32%),radial-gradient(circle_at_42%_78%,rgba(22,70,245,0.06),transparent_38%),linear-gradient(135deg,#050611_0%,#040812_60%,#05060f_100%)]";

const exploreFilterClass =
  "relative z-30 flex flex-col gap-4 rounded-3xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0f1424]/45 to-white/6 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-3xl";

function ExplorarContent() {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100); // 100 = "sem limite" (100+)
  const [filtersTick, setFiltersTick] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const priceRef = useRef<HTMLDivElement | null>(null);

  const [likedItems, setLikedItems] = useState<number[]>([]);
  const searchParams = useSearchParams();
  const requestController = useRef<AbortController | null>(null);
  const [hydratedFromParams, setHydratedFromParams] = useState(false);

  // City via geolocation + Mapbox (opcional)
  // Geolocation desativada para evitar preencher com valores inválidos

  const effectiveMaxParam = priceMax >= 100 ? null : priceMax;
  const filteredCities = useMemo(() => {
    const needle = citySearch.trim().toLowerCase();
    if (!needle) return PORTUGAL_CITIES;
    return PORTUGAL_CITIES.filter((c) => c.toLowerCase().includes(needle));
  }, [citySearch]);

  const hasActiveFilters = useMemo(
    () =>
      search.trim().length > 0 ||
      dateFilter !== "all" ||
      (dateFilter === "custom" && !!customDate) ||
      typeFilter !== "all" ||
      selectedCategories.length > 0 ||
      city.trim().length > 0 ||
      priceMin > 0 ||
      effectiveMaxParam !== null,
    [city, customDate, dateFilter, effectiveMaxParam, priceMin, search, selectedCategories.length, typeFilter],
  );

  function toggleLike(id: number) {
    setLikedItems((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  const CityPanel = () => (
    <>
      {isMobile && (
        <div className="mb-2">
          <input
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Procurar cidade"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-white/40 focus:border-white/35 focus:outline-none"
          />
        </div>
      )}
      <div className="max-h-52 overflow-auto space-y-1.5 pr-1">
        {filteredCities.map((c) => {
          const active = city === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCity(c);
                setCityInput(c);
                setIsCityOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] ${
                active
                  ? "border-[#6BFFFF]/70 bg-[#6BFFFF]/15 text-white"
                  : "border-white/12 bg-white/5 text-white/80 hover:border-white/30"
              }`}
            >
              {c}
              {active && <span className="text-[10px] text-[#E5FFFF]">Selecionada</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setIsCityOpen(false)}
          className="text-[11px] text-white/70 hover:text-white/90"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={() => {
            setCityInput("");
            setCity("");
            setIsCityOpen(false);
          }}
          className="px-2.5 py-1 rounded-full bg-transparent border border-white/15 text-[11px] text-white/70 hover:bg-white/5"
        >
          Limpar cidade
        </button>
      </div>
    </>
  );

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const startWeekday = firstOfMonth.getDay(); // domingo = 0
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const list: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startWeekday; i++) {
      list.push({ date: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ date: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d) });
    }
    return list;
  }, [calendarMonth]);

  const monthLabel = useMemo(
    () =>
      calendarMonth.toLocaleString("pt-PT", {
        month: "long",
        year: "numeric",
      }),
    [calendarMonth],
  );

  const DatePanel = () => (
    <>
      <p className="text-[11px] text-white/60 mb-1.5">Quando queres sair?</p>
      <div className="flex flex-wrap gap-1.5">
        {DATE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setCustomDate("");
              setDateFilter(opt.value as DateFilter);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] ${
              dateFilter === opt.value && !customDate
                ? "bg-[#6BFFFF]/25 border border-[#6BFFFF]/70 text-[#E5FFFF]"
                : "bg-white/5 border border-white/18 text-white/75 hover:bg-white/10"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/12 bg-white/5 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
        <div className="mb-2 flex items-center justify-between text-[12px] text-white/80">
          <button
            type="button"
            onClick={() => {
              const prev = new Date(calendarMonth);
              prev.setMonth(prev.getMonth() - 1);
              setCalendarMonth(prev);
            }}
            className="rounded-full px-2 py-1 hover:bg-white/10"
          >
            ←
          </button>
          <span className="font-semibold capitalize">{monthLabel}</span>
          <button
            type="button"
            onClick={() => {
              const next = new Date(calendarMonth);
              next.setMonth(next.getMonth() + 1);
              setCalendarMonth(next);
            }}
            className="rounded-full px-2 py-1 hover:bg-white/10"
          >
            →
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-[10px] text-white/45">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, idx) => (
            <span key={`${d}-${idx}`} className="text-center uppercase tracking-wide">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-[12px]">
          {calendarDays.map((d, idx) => {
            if (!d.date) return <span key={`blank-${idx}`} />;
            const iso = d.date.toISOString().slice(0, 10);
            const isSelected = customDate ? iso === customDate : false;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  setCustomDate(iso);
                  setDateFilter("custom");
                }}
                className={`h-9 w-9 rounded-full transition ${
                  isSelected
                    ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_16px_rgba(107,255,255,0.55)]"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {d.date.getDate()}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-white/45">Sem input livre: escolhe pelo calendário ou chips.</p>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setIsDateOpen(false)}
          className="text-[11px] text-white/70 hover:text-white/90"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomDate("");
            setDateFilter("all");
            setIsDateOpen(false);
          }}
          className="px-2.5 py-1 rounded-full bg-transparent border border-white/15 text-[11px] text-white/70 hover:bg-white/5"
        >
          Limpar datas
        </button>
      </div>
    </>
  );

  const PricePanel = () => (
    <>
      <p className="text-[11px] text-white/60">Intervalo de preço</p>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b162c] via-[#0a1227] to-[#060b18] px-3 py-4 space-y-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
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
        <div className="flex items-center justify-between text-[11px] text-white/80">
          <span>Mín: € {priceMin}</span>
          <span>Máx: {priceMax >= 100 ? "100+ (sem limite)" : `€ ${priceMax}`}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <button
            type="button"
            onClick={() => {
              setPriceMin(0);
              setPriceMax(100);
            }}
            className="rounded-full border border-white/15 px-3 py-1 text-white/75 hover:border-white/35 hover:bg-white/5"
          >
            Limpar filtro de preço
          </button>
          <span className="text-[10px] text-white/50">Debounce 250ms</span>
        </div>
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
    </>
  );

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
      if (dateFilter === "custom" && customDate) {
        params.set("date", "day");
        params.set("day", customDate);
      } else if (dateFilter !== "all") {
        params.set("date", dateFilter);
      }
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
    const handle = setTimeout(() => setFiltersTick((v) => v + 1), 250);
    return () => clearTimeout(handle);
  }, [search, dateFilter, customDate, typeFilter, selectedCategories, city, priceMin, effectiveMaxParam]);

  useEffect(() => {
    trackEvent("explore_filter_price_changed", {
      min: priceMin,
      max: effectiveMaxParam ?? "100_plus",
    });
  }, [priceMin, effectiveMaxParam]);

  useEffect(() => {
    trackEvent("explore_filter_date_changed", {
      dateFilter,
      customDate: customDate || null,
    });
  }, [dateFilter, customDate]);

  useEffect(() => {
    if (!city && !cityInput) return;
    trackEvent("explore_filter_location_changed", { city: city || cityInput });
  }, [city, cityInput]);

  useEffect(() => {
    fetchItems({ append: false, cursor: null });
  }, [filtersTick]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!customDate) return;
    const parsed = new Date(customDate);
    if (Number.isNaN(parsed.getTime())) return;
    parsed.setHours(0, 0, 0, 0);
    setCalendarMonth(parsed);
  }, [customDate]);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(typeof window !== "undefined" ? window.innerWidth < 640 : false);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      const normalized = cityInput.trim();
      if (!normalized) {
        setCity("");
        return;
      }
      const match = PORTUGAL_CITIES.find((c) => c.toLowerCase() === normalized.toLowerCase());
      setCity(match ?? "");
    }, 300);
    return () => clearTimeout(handle);
  }, [cityInput]);

  // Atualiza pesquisa ao entrar via query da Navbar (/explorar?query=)
  useEffect(() => {
    if (hydratedFromParams) return;
    const qp = searchParams.get("query") ?? searchParams.get("q") ?? "";
    const cityQ = searchParams.get("city") ?? "";
    const priceMinQ = searchParams.get("priceMin");
    const priceMaxQ = searchParams.get("priceMax");
    const dateQ = searchParams.get("date");
    const dayQ = searchParams.get("day");
    const typeQ = searchParams.get("type") as TypeFilter | null;
    const catsQ = searchParams.get("categories");

    if (qp) {
      setSearchInput(qp);
      setSearch(qp);
    }
    if (cityQ) {
      setCityInput(cityQ);
      setCity(cityQ);
    }
    if (priceMinQ) setPriceMin(Math.max(0, Number(priceMinQ)));
    if (priceMaxQ) {
      const maxVal = Math.max(0, Number(priceMaxQ));
      setPriceMax(Number.isFinite(maxVal) ? maxVal : 100);
    }
    if (dateQ === "today" || dateQ === "upcoming" || dateQ === "weekend") {
      setDateFilter(dateQ);
    } else if (dateQ === "day" && dayQ) {
      setDateFilter("custom");
      setCustomDate(dayQ);
    }
    if (typeQ === "event" || typeQ === "experience") {
      setTypeFilter(typeQ);
    }
    if (catsQ) {
      const arr = catsQ
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      setSelectedCategories(arr);
    }
    setHydratedFromParams(true);
     
  }, [searchParams, hydratedFromParams]);

  useEffect(() => {
    const handle = setTimeout(() => setCity(cityInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [cityInput]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (isCityOpen && cityRef.current && !cityRef.current.contains(target)) {
        setIsCityOpen(false);
      }
      if (isDateOpen && dateRef.current && !dateRef.current.contains(target)) {
        setIsDateOpen(false);
      }
      if (isPriceOpen && priceRef.current && !priceRef.current.contains(target)) {
        setIsPriceOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isCityOpen, isDateOpen, isPriceOpen]);

  const headingCity = city.trim() || "Portugal";
  const dateLabel =
    dateFilter === "custom" && customDate
      ? new Date(customDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
      : DATE_FILTER_OPTIONS.find((d) => d.value === dateFilter)?.label;
  const resultsLabel = items.length === 1 ? "1 resultado" : `${items.length} resultados`;
  const showSkeleton = loading || (error && items.length === 0);

  return (
    <main className={exploreMainClass}>
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-6 md:py-8 space-y-6">
        {/* TOPO – FILTROS PRINCIPAIS */}
        <div className={exploreFilterClass}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Localização */}
            <div className="relative" ref={cityRef}>
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
                <>
                  {isMobile && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center p-4">
                      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-4 space-y-3 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white">Escolhe cidade</h3>
                          <button
                            type="button"
                            onClick={() => setIsCityOpen(false)}
                            className="text-white/60 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                        <CityPanel />
                      </div>
                    </div>
                  )}
                  {!isMobile && (
                    <div className="mt-2 w-full rounded-2xl border border-white/15 bg-black/90 p-3 backdrop-blur md:absolute md:w-72 md:shadow-2xl md:z-50">
                      <CityPanel />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Data */}
            <div className="relative" ref={dateRef}>
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
                <span className="font-medium">{dateLabel}</span>
              </button>
              {isDateOpen && (
                <>
                  {isMobile && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center p-4">
                      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-4 space-y-3 shadow-2xl">
                        <DatePanel />
                      </div>
                    </div>
                  )}
                  {!isMobile && (
                    <div className="mt-2 w-full rounded-2xl border border-white/15 bg-black/90 p-3 backdrop-blur space-y-3 md:absolute md:w-72 md:shadow-2xl md:z-50">
                      <DatePanel />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Preço */}
            <div className="relative" ref={priceRef}>
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
                <>
                  {isMobile && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center p-4">
                      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-4 space-y-3 shadow-2xl">
                        <PricePanel />
                      </div>
                    </div>
                  )}
                  {!isMobile && (
                    <div className="mt-2 w-full rounded-2xl border border-white/15 bg-black/90 p-3 backdrop-blur space-y-3 md:absolute md:w-80 md:shadow-2xl md:z-50">
                      <PricePanel />
                    </div>
                  )}
                </>
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
              {[...items.map((item) => ({ item })), ...Array.from({ length: Math.max(0, 3 - items.length) }).map((_, idx) => ({ item: null, key: `placeholder-${idx}` }))].map((entry, idx) =>
                entry.item ? (
                  entry.item.type === "EVENT" ? (
                    <EventCard
                      key={`${entry.item.type}-${entry.item.id}`}
                      item={entry.item}
                      onLike={toggleLike}
                      liked={likedItems.includes(entry.item.id)}
                    />
                  ) : (
                    <ExperienceCard
                      key={`${entry.item.type}-${entry.item.id}`}
                      item={entry.item}
                      onLike={toggleLike}
                      liked={likedItems.includes(entry.item.id)}
                    />
                  )
                ) : (
                  <PlaceholderCard key={entry.key ?? `placeholder-${idx}`} />
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
.price-range-thumb::-webkit-slider-thumb {
  pointer-events: auto;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #E5FFFF, #6BFFFF 55%, #1646F5 100%);
  box-shadow: 0 0 12px rgba(107,255,255,0.6);
  border: 2px solid rgba(255,255,255,0.6);
  margin-top: -8px;
}
.price-range-thumb::-moz-range-thumb {
  pointer-events: auto;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #E5FFFF, #6BFFFF 55%, #1646F5 100%);
  box-shadow: 0 0 12px rgba(107,255,255,0.6);
  border: 2px solid rgba(255,255,255,0.6);
}
.price-range-thumb::-ms-thumb {
  pointer-events: auto;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #E5FFFF, #6BFFFF 55%, #1646F5 100%);
  box-shadow: 0 0 12px rgba(107,255,255,0.6);
  border: 2px solid rgba(255,255,255,0.6);
}
`;

 
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
      <div className="relative h-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#9B8CFF] to-[#6BFFFF]">
        <div
          className="absolute h-full rounded-full bg-black/30"
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
          className="price-range-thumb pointer-events-auto absolute -top-3 h-7 w-full appearance-none bg-transparent z-20"
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
          className="price-range-thumb pointer-events-auto absolute -top-3 h-7 w-full appearance-none bg-transparent z-30"
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
          <Image
            src={
              item.coverImageUrl
                ? optimizeImageUrl(item.coverImageUrl, 900, 72)
                : defaultCover
            }
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
          />
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

      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/2 via-transparent to-white/2">
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

function PlaceholderCard() {
  return (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col shadow-[0_14px_32px_rgba(0,0,0,0.4)]">
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={defaultCover}
          alt="Em breve na ORYA"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL={defaultBlurDataURL}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70" />
        <div className="absolute top-3 left-3 rounded-full border border-white/16 bg-black/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
          Em breve
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/2 via-transparent to-white/2">
        <h2 className="text-[14px] md:text-[15px] font-semibold text-white">Novos eventos a caminho</h2>
        <p className="text-[11px] text-white/75">
          Fica atento — mais eventos vão surgir aqui com o look glassy premium.
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/22 text-white font-medium">
            Brevemente
          </span>
          <span className="text-white/60">ORYA</span>
        </div>
      </div>
    </div>
  );
}
