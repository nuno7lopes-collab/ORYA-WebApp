"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { defaultBlurDataURL } from "@/lib/image";
import { getEventCoverUrl } from "@/lib/eventCover";
import { PORTUGAL_CITIES } from "@/config/cities";
import { clampWithGap } from "@/lib/filters";
import { trackEvent } from "@/lib/analytics";
import { useUser } from "@/app/hooks/useUser";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type ExploreItem = {
  id: number;
  type: "EVENT";
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

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
  };
  nextAvailability: string | null;
};

type ApiResponse = {
  items: ExploreItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
};

type ServiceApiResponse = {
  ok: boolean;
  items: ServiceItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
  error?: string;
  debug?: string;
};

type PadelTournamentItem = {
  id: number;
  slug: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  coverImageUrl: string | null;
  locationName: string | null;
  locationCity: string | null;
  priceFrom: number | null;
  organizationName: string | null;
  format: string | null;
  eligibility: string | null;
  levels: Array<{ id: number; label: string }>;
};

type PadelClubItem = {
  id: number;
  name: string;
  shortName: string;
  city: string | null;
  address: string | null;
  courtsCount: number;
  slug: string | null;
  organizationName: string | null;
  organizationUsername: string | null;
  courts: Array<{ id: number; name: string; indoor: boolean; surface: string | null }>;
};

type PadelOpenPairingItem = {
  id: number;
  paymentMode: string;
  deadlineAt: string | null;
  category: { id: number; label: string } | null;
  openSlots: number;
  event: {
    id: number;
    slug: string;
    title: string;
    startsAt: string | null;
    locationName: string | null;
    locationCity: string | null;
    coverImageUrl: string | null;
  };
};

type PadelDiscoverResponse = {
  ok: boolean;
  items: PadelTournamentItem[];
  levels?: Array<{ id: number; label: string }>;
  error?: string;
};

type PadelClubResponse = { ok: boolean; items: PadelClubItem[]; error?: string };
type PadelOpenPairingsResponse = { ok: boolean; items: PadelOpenPairingItem[]; error?: string };

type DateFilter = "all" | "today" | "weekend" | "custom";
type TypeFilter = "all" | "event";
type ExploreWorld = "EVENTOS" | "PADEL" | "RESERVAS";

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "Todas as datas" },
  { value: "today", label: "Hoje" },
  { value: "weekend", label: "Este fim de semana" },
] as const;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "event", label: "Eventos" },
];

const WORLD_OPTIONS: { value: ExploreWorld; label: string; accent: string }[] = [
  { value: "EVENTOS", label: "Eventos", accent: "from-[#FF00C8] via-[#9B8CFF] to-[#1646F5]" },
  { value: "PADEL", label: "Padel", accent: "from-[#6BFFFF] via-[#4ADE80] to-[#1E40AF]" },
  { value: "RESERVAS", label: "Reservas", accent: "from-[#FCD34D] via-[#FB923C] to-[#F97316]" },
];

const CATEGORY_OPTIONS = [
  { value: "PADEL", label: "Padel", accent: "from-[#6BFFFF] to-[#4ADE80]" },
  { value: "GERAL", label: "Eventos gerais", accent: "from-[#FF00C8] via-[#9B8CFF] to-[#1646F5]" },
] as const;

const PADEL_FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos os formatos" },
  { value: "TODOS_CONTRA_TODOS", label: "Todos contra todos" },
  { value: "QUADRO_ELIMINATORIO", label: "Quadro eliminatório" },
  { value: "GRUPOS_ELIMINATORIAS", label: "Grupos + eliminatórias" },
  { value: "CAMPEONATO_LIGA", label: "Campeonato/Liga" },
  { value: "QUADRO_AB", label: "Quadro A/B" },
  { value: "NON_STOP", label: "Non-stop" },
];

const PADEL_ELIGIBILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "OPEN", label: "Aberto" },
  { value: "MALE_ONLY", label: "Masculino" },
  { value: "FEMALE_ONLY", label: "Feminino" },
  { value: "MIXED", label: "Misto" },
];

const resolveCover = (
  coverImageUrl: string | null | undefined,
  seed: string | number,
  width = 900,
) => getEventCoverUrl(coverImageUrl, { seed, width, quality: 72 });

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

function formatServiceAvailability(value: string | null) {
  if (!value) return "Sem horários";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem horários";
  return parsed.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

function formatPadelDate(start: string | null, end: string | null) {
  if (!start) return "Data a anunciar";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "Data a anunciar";
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) {
      return formatDateRange(start, end);
    }
  }
  return startDate.toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPadelFormat(value: string | null) {
  if (!value) return "Formato a definir";
  return PADEL_FORMAT_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function formatPadelEligibility(value: string | null) {
  if (!value) return "Elegibilidade aberta";
  return PADEL_ELIGIBILITY_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function formatPadelPaymentMode(value: string) {
  if (value === "SPLIT") return "Pagamento dividido";
  if (value === "FULL") return "Pago pelo capitão";
  return "Pagamento";
}

function formatPadelDeadline(value: string | null) {
  if (!value) return "Sem prazo definido";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem prazo definido";
  return parsed.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatCount(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function statusTag(status: ExploreItem["status"]) {
  if (status === "CANCELLED") return { text: "Cancelado", className: "text-red-200" };
  if (status === "PAST") return { text: "Já aconteceu", className: "text-white/55" };
  if (status === "DRAFT") return { text: "Rascunho", className: "text-white/60" };
  return { text: "Em breve", className: "text-[#6BFFFF]" };
}

function buildSlug(_type: ExploreItem["type"], slug: string) {
  return `/eventos/${slug}`;
}

const exploreMainClass = "min-h-screen w-full text-white";

const exploreFilterClass =
  "relative z-30 flex flex-col gap-4 rounded-3xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0f1424]/45 to-white/6 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-3xl";

function ExplorarContent() {
  const { user } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<ExploreWorld>("EVENTOS");

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceNextCursor, setServiceNextCursor] = useState<number | null>(null);
  const [serviceHasMore, setServiceHasMore] = useState(false);
  const [serviceLoadingMore, setServiceLoadingMore] = useState(false);

  const [padelTournaments, setPadelTournaments] = useState<PadelTournamentItem[]>([]);
  const [padelClubs, setPadelClubs] = useState<PadelClubItem[]>([]);
  const [padelOpenPairings, setPadelOpenPairings] = useState<PadelOpenPairingItem[]>([]);
  const [padelLevels, setPadelLevels] = useState<Array<{ id: number; label: string }>>([]);
  const [padelFormatFilter, setPadelFormatFilter] = useState("all");
  const [padelEligibilityFilter, setPadelEligibilityFilter] = useState("all");
  const [padelLevelFilter, setPadelLevelFilter] = useState("all");
  const [padelLoading, setPadelLoading] = useState(false);
  const [padelError, setPadelError] = useState<string | null>(null);
  const [padelJoinLoadingId, setPadelJoinLoadingId] = useState<number | null>(null);

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
  const serviceRequestController = useRef<AbortController | null>(null);
  const padelRequestController = useRef<AbortController | null>(null);
  const lastEventCategories = useRef<string[]>([]);
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
    () => {
      const typeActive = world === "EVENTOS" ? typeFilter !== "all" : false;
      const categoryActive = world === "EVENTOS" ? selectedCategories.length > 0 : false;
      const padelFormatActive = world === "PADEL" ? padelFormatFilter !== "all" : false;
      const padelEligibilityActive = world === "PADEL" ? padelEligibilityFilter !== "all" : false;
      const padelLevelActive = world === "PADEL" ? padelLevelFilter !== "all" : false;
      const hasCustomDate = dateFilter === "custom" && !!customDate;

      return (
        search.trim().length > 0 ||
        dateFilter !== "all" ||
        hasCustomDate ||
        typeActive ||
        categoryActive ||
        padelFormatActive ||
        padelEligibilityActive ||
        padelLevelActive ||
        city.trim().length > 0 ||
        priceMin > 0 ||
        effectiveMaxParam !== null
      );
    },
    [
      city,
      customDate,
      dateFilter,
      effectiveMaxParam,
      priceMin,
      padelEligibilityFilter,
      padelFormatFilter,
      padelLevelFilter,
      search,
      selectedCategories.length,
      typeFilter,
      world,
    ],
  );

  const isReservasWorld = world === "RESERVAS";
  const isPadelWorld = world === "PADEL";
  const isEventosWorld = world === "EVENTOS";

  function toggleLike(id: number) {
    setLikedItems((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  useEffect(() => {
    if (world === "PADEL") {
      if (selectedCategories.length !== 1 || selectedCategories[0] !== "PADEL") {
        lastEventCategories.current = selectedCategories.filter((c) => c !== "PADEL");
        setSelectedCategories(["PADEL"]);
      }
      if (typeFilter !== "all") {
        setTypeFilter("all");
      }
      return;
    }

    if (world === "RESERVAS") {
      if (selectedCategories.length > 0) {
        setSelectedCategories([]);
      }
      if (typeFilter !== "all") {
        setTypeFilter("all");
      }
      return;
    }

    if (world === "EVENTOS") {
      if (selectedCategories.length === 1 && selectedCategories[0] === "PADEL") {
        setSelectedCategories(lastEventCategories.current);
      }
    }
  }, [selectedCategories, typeFilter, world]);

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
                    ? `${CTA_PRIMARY} justify-center p-0 text-[12px]`
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

  async function fetchServices(opts?: { append?: boolean; cursor?: number | null }) {
    const append = opts?.append ?? false;
    const cursorToUse = opts?.cursor ?? null;

    if (serviceRequestController.current) {
      serviceRequestController.current.abort();
    }
    const controller = new AbortController();
    serviceRequestController.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const currentRequest = controller;

    try {
      if (!append) {
        setServiceLoading(true);
        setServiceError(null);
      } else {
        setServiceLoadingMore(true);
      }

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (dateFilter === "custom" && customDate) {
        params.set("date", "day");
        params.set("day", customDate);
      } else if (dateFilter !== "all") {
        params.set("date", dateFilter);
      }
      if (city.trim()) params.set("city", city.trim());
      if (priceMin > 0) params.set("priceMin", String(priceMin));
      if (effectiveMaxParam !== null) params.set("priceMax", String(effectiveMaxParam));
      if (cursorToUse !== null) params.set("cursor", String(cursorToUse));

      const res = await fetch(`/api/servicos/list?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const rawText = await res.text().catch(() => "");
      let data: ServiceApiResponse | null = null;
      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText) as ServiceApiResponse;
        } catch {
          data = null;
        }
      }

      if (!res.ok || !data || !data.ok) {
        const errorPayload = data as { error?: string; debug?: string } | null;
        const detail =
          errorPayload?.debug ||
          errorPayload?.error ||
          (rawText ? rawText.slice(0, 200) : null) ||
          `HTTP ${res.status}`;
        throw new Error(`Erro ao carregar serviços: ${detail}`);
      }

      if (serviceRequestController.current === currentRequest) {
        if (append) {
          setServiceItems((prev) => [...(Array.isArray(prev) ? prev : []), ...data.items]);
        } else {
          setServiceItems(data.items ?? []);
        }

        setServiceNextCursor(data.pagination.nextCursor);
        setServiceHasMore(data.pagination.hasMore);
      }
    } catch (err) {
      if (serviceRequestController.current !== currentRequest) return;
      const isAbort = (err as Error | undefined)?.name === "AbortError";
      if (!isAbort && process.env.NODE_ENV !== "production") {
        console.error(err);
      }
      setServiceError(
        isAbort
          ? "Demorou demasiado a responder. Tenta novamente."
          : "Não conseguimos carregar. Tenta outra vez.",
      );
    } finally {
      clearTimeout(timeoutId);
      if (serviceRequestController.current === currentRequest) {
        setServiceLoading(false);
        setServiceLoadingMore(false);
      }
    }
  }

  async function fetchPadel() {
    if (padelRequestController.current) {
      padelRequestController.current.abort();
    }
    const controller = new AbortController();
    padelRequestController.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const currentRequest = controller;

    const fetchJson = async <T extends { ok?: boolean; error?: string }>(url: string) => {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      const rawText = await res.text().catch(() => "");
      let data: T | null = null;
      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText) as T;
        } catch {
          data = null;
        }
      }
      if (!res.ok || !data || data.ok === false) {
        const detail =
          data?.error || (rawText ? rawText.slice(0, 200) : null) || `HTTP ${res.status}`;
        throw new Error(detail);
      }
      return data;
    };

    try {
      setPadelLoading(true);
      setPadelError(null);
      setPadelTournaments([]);
      setPadelClubs([]);
      setPadelOpenPairings([]);

      const baseParams = new URLSearchParams();
      if (search.trim()) baseParams.set("q", search.trim());
      if (city.trim()) baseParams.set("city", city.trim());

      const tournamentParams = new URLSearchParams(baseParams);
      if (dateFilter === "custom" && customDate) {
        tournamentParams.set("date", "day");
        tournamentParams.set("day", customDate);
      } else if (dateFilter !== "all") {
        tournamentParams.set("date", dateFilter);
      }
      if (priceMin > 0) tournamentParams.set("priceMin", String(priceMin));
      if (effectiveMaxParam !== null) tournamentParams.set("priceMax", String(effectiveMaxParam));
      if (padelFormatFilter !== "all") tournamentParams.set("format", padelFormatFilter);
      if (padelEligibilityFilter !== "all") tournamentParams.set("eligibility", padelEligibilityFilter);
      if (padelLevelFilter !== "all") tournamentParams.set("level", padelLevelFilter);

      const clubsParams = new URLSearchParams(baseParams);
      clubsParams.set("includeCourts", "1");

      const pairingsParams = new URLSearchParams(baseParams);

      const [tournamentsResult, clubsResult, pairingsResult] = await Promise.allSettled([
        fetchJson<PadelDiscoverResponse>(
          `/api/padel/discover${tournamentParams.toString() ? `?${tournamentParams.toString()}` : ""}`,
        ),
        fetchJson<PadelClubResponse>(
          `/api/padel/public/clubs${clubsParams.toString() ? `?${clubsParams.toString()}` : ""}`,
        ),
        fetchJson<PadelOpenPairingsResponse>(
          `/api/padel/public/open-pairings${pairingsParams.toString() ? `?${pairingsParams.toString()}` : ""}`,
        ),
      ]);

      if (padelRequestController.current !== currentRequest) return;

      const errors: string[] = [];

      if (tournamentsResult.status === "fulfilled") {
        setPadelTournaments(tournamentsResult.value.items ?? []);
        setPadelLevels(tournamentsResult.value.levels ?? []);
      } else if (tournamentsResult.reason?.name !== "AbortError") {
        errors.push("torneios");
      }

      if (clubsResult.status === "fulfilled") {
        setPadelClubs(clubsResult.value.items ?? []);
      } else if (clubsResult.reason?.name !== "AbortError") {
        errors.push("clubes");
      }

      if (pairingsResult.status === "fulfilled") {
        setPadelOpenPairings(pairingsResult.value.items ?? []);
      } else if (pairingsResult.reason?.name !== "AbortError") {
        errors.push("jogos comunitários");
      }

      if (errors.length === 0) {
        setPadelError(null);
      } else if (errors.length === 3) {
        setPadelError("Não conseguimos carregar o Padel agora.");
      } else {
        setPadelError("Algumas secções do Padel não carregaram.");
      }
    } catch (err) {
      if (padelRequestController.current !== currentRequest) return;
      const isAbort = (err as Error | undefined)?.name === "AbortError";
      if (!isAbort && process.env.NODE_ENV !== "production") {
        console.error(err);
      }
      setPadelError(
        isAbort
          ? "Demorou demasiado a responder. Tenta novamente."
          : "Não conseguimos carregar o Padel. Tenta outra vez.",
      );
    } finally {
      clearTimeout(timeoutId);
      if (padelRequestController.current === currentRequest) {
        setPadelLoading(false);
      }
    }
  }

  async function handleJoinOpenPairing(item: PadelOpenPairingItem) {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/eventos/${item.event.slug}`)}`);
      return;
    }
    setPadelError(null);
    setPadelJoinLoadingId(item.id);
    try {
      const res = await fetch("/api/padel/pairings/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingId: item.id }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; action?: string } | null;
      if (!res.ok || !data?.ok) {
        const action = data?.action;
        if (action === "CHECKOUT_PARTNER" || action === "CHECKOUT_CAPTAIN") {
          router.push(`/eventos/${item.event.slug}`);
          return;
        }
        const errorMap: Record<string, string> = {
          UNAUTHENTICATED: "Precisas de iniciar sessão.",
          PAIRING_ALREADY_ACTIVE: "Já tens uma dupla ativa neste torneio.",
          PAIRING_EXPIRED: "Este convite expirou.",
          NO_PENDING_SLOT: "Esta dupla já está completa.",
        };
        const detail = data?.error ? errorMap[data.error] ?? data.error : null;
        throw new Error(detail || "Não foi possível entrar na dupla.");
      }
      router.push(`/eventos/${item.event.slug}`);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error(err);
      }
      const message = (err as Error | undefined)?.message || "Não foi possível entrar na dupla.";
      setPadelError(message);
    } finally {
      setPadelJoinLoadingId(null);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => setFiltersTick((v) => v + 1), 250);
    return () => clearTimeout(handle);
  }, [
    search,
    dateFilter,
    customDate,
    typeFilter,
    selectedCategories,
    city,
    priceMin,
    effectiveMaxParam,
    padelFormatFilter,
    padelEligibilityFilter,
    padelLevelFilter,
    world,
  ]);

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
    if (padelLevelFilter === "all") return;
    const exists = padelLevels.some((level) => String(level.id) === padelLevelFilter);
    if (!exists) {
      setPadelLevelFilter("all");
    }
  }, [padelLevels, padelLevelFilter]);

  useEffect(() => {
    if (!city && !cityInput) return;
    trackEvent("explore_filter_location_changed", { city: city || cityInput });
  }, [city, cityInput]);

  useEffect(() => {
    if (world === "RESERVAS") {
      fetchServices({ append: false, cursor: null });
    } else if (world === "PADEL") {
      fetchPadel();
    } else {
      fetchItems({ append: false, cursor: null });
    }
  }, [filtersTick, world]);

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
    const worldQ = searchParams.get("world") ?? searchParams.get("mundo");
    const padelFormatQ = searchParams.get("format");
    const padelEligibilityQ = searchParams.get("eligibility");
    const padelLevelQ = searchParams.get("level");

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
    if (dateQ === "today" || dateQ === "weekend") {
      setDateFilter(dateQ);
    } else if (dateQ === "upcoming") {
      setDateFilter("all");
    } else if (dateQ === "day" && dayQ) {
      setDateFilter("custom");
      setCustomDate(dayQ);
    }
    if (typeQ === "event") {
      setTypeFilter(typeQ);
    }
    if (worldQ === "padel") {
      setWorld("PADEL");
    } else if (worldQ === "reservas") {
      setWorld("RESERVAS");
    } else if (worldQ === "eventos") {
      setWorld("EVENTOS");
    }
    if (catsQ) {
      const arr = catsQ
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      setSelectedCategories(arr);
    }

    if (padelFormatQ && PADEL_FORMAT_OPTIONS.some((opt) => opt.value === padelFormatQ)) {
      setPadelFormatFilter(padelFormatQ);
    }
    if (padelEligibilityQ && PADEL_ELIGIBILITY_OPTIONS.some((opt) => opt.value === padelEligibilityQ)) {
      setPadelEligibilityFilter(padelEligibilityQ);
    }
    if (padelLevelQ && Number.isFinite(Number(padelLevelQ))) {
      setPadelLevelFilter(padelLevelQ);
    }
    setHydratedFromParams(true);
  }, [searchParams, hydratedFromParams]);

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
  const visibleOpenPairings = padelOpenPairings.filter((pairing) => pairing.openSlots > 0);
  const padelHasContent =
    padelTournaments.length > 0 || padelClubs.length > 0 || visibleOpenPairings.length > 0;
  const activeItemsCount = isReservasWorld
    ? serviceItems.length
    : isPadelWorld
      ? padelTournaments.length
      : items.length;
  const resultsLabel = isPadelWorld
    ? `${formatCount(padelTournaments.length, "torneio", "torneios")} · ${formatCount(
        padelClubs.length,
        "clube",
        "clubes",
      )} · ${formatCount(visibleOpenPairings.length, "jogo", "jogos")}`
    : activeItemsCount === 1
      ? "1 resultado"
      : `${activeItemsCount} resultados`;
  const showSkeleton = isReservasWorld
    ? serviceLoading || (serviceError && serviceItems.length === 0)
    : isPadelWorld
      ? padelLoading || (padelError && !padelHasContent)
      : loading || (error && items.length === 0);
  const worldSummaryLabel = isReservasWorld ? "Serviços" : isPadelWorld ? "Padel" : "Eventos";
  const activeItems = isReservasWorld ? serviceItems : isPadelWorld ? padelTournaments : items;
  const activeError = isReservasWorld ? serviceError : isPadelWorld ? padelError : error;
  const activeLoading = isReservasWorld ? serviceLoading : isPadelWorld ? padelLoading : loading;
  const activeHasMore = isReservasWorld ? serviceHasMore : isPadelWorld ? false : hasMore;
  const activeIsLoadingMore = isReservasWorld ? serviceLoadingMore : isPadelWorld ? false : isLoadingMore;
  const activeNextCursor = isReservasWorld ? serviceNextCursor : isPadelWorld ? null : nextCursor;

  return (
    <main className={exploreMainClass}>
      <section className="orya-page-width px-6 md:px-10 py-6 md:py-8 space-y-6">
        {/* TOPO – FILTROS PRINCIPAIS */}
        <div className={exploreFilterClass}>
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] text-white/50 shrink-0">Mundos:</span>
            <div className="flex gap-1.5">
              {WORLD_OPTIONS.map((opt) => {
                const isActive = world === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWorld(opt.value)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-[11px] whitespace-nowrap transition ${
                      isActive
                        ? "bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                        : "bg-white/5 border-white/18 text-white/80 hover:bg-white/10"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span
                      className={`h-2 w-2 rounded-full bg-gradient-to-r ${opt.accent} shadow-[0_0_12px_rgba(255,255,255,0.45)]`}
                    />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full">
            <label className="text-[11px] text-white/60">Pesquisar</label>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                isReservasWorld
                  ? "Ex: manicure, fisioterapia, cowork"
                  : isPadelWorld
                    ? "Ex: torneios, clubes, rankings"
                    : "Ex: festas, talks, concertos"
              }
              className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/35 focus:outline-none"
            />
          </div>

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
              {isEventosWorld && (
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
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setDateFilter("all");
                    setTypeFilter("all");
                    setSelectedCategories(world === "PADEL" ? ["PADEL"] : []);
                    setCity("");
                    setCityInput("");
                    setPriceMin(0);
                    setPriceMax(100);
                    setCustomDate("");
                    setPadelFormatFilter("all");
                    setPadelEligibilityFilter("all");
                    setPadelLevelFilter("all");
                  }}
                  className="text-[11px] text-white/55 hover:text-white/90"
                >
                  Limpar tudo
                </button>
              )}
            </div>
          </div>

          {/* categorias */}
          {isEventosWorld && (
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
          )}

          {isPadelWorld && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-[10px] text-white/55">
                Formato
                <select
                  value={padelFormatFilter}
                  onChange={(e) => setPadelFormatFilter(e.target.value)}
                  className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 focus:border-white/35 focus:outline-none"
                >
                  {PADEL_FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-black text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-white/55">
                Elegibilidade
                <select
                  value={padelEligibilityFilter}
                  onChange={(e) => setPadelEligibilityFilter(e.target.value)}
                  className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 focus:border-white/35 focus:outline-none"
                >
                  {PADEL_ELIGIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-black text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-white/55">
                Nível
                <select
                  value={padelLevelFilter}
                  onChange={(e) => setPadelLevelFilter(e.target.value)}
                  className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 focus:border-white/35 focus:outline-none"
                >
                  <option value="all" className="bg-black text-white">
                    Todos os níveis
                  </option>
                  {padelLevels.map((level) => (
                    <option key={level.id} value={String(level.id)} className="bg-black text-white">
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* resumo */}
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>
              Encontrados{" "}
              <span className="font-semibold text-white/90">
                {resultsLabel}
              </span>
            </span>
            <span className="text-white/45">
              {worldSummaryLabel} em{" "}
              <span className="text-white/85">{headingCity}</span>
            </span>
          </div>
        </div>

        {/* LOADING */}
        {showSkeleton && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-full rounded-3xl border border-white/10 orya-skeleton-surface p-3 animate-pulse space-y-3"
              >
                <div className="rounded-2xl bg-white/10 aspect-square" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/8" />
              </div>
            ))}
          </div>
        )}

        {/* ERRO */}
        {activeError && (
          <div className="mt-4 max-w-xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
            <p className="font-semibold mb-1">Não foi possível carregar.</p>
            <p className="text-[12px] text-red-50/85 leading-relaxed">{activeError}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  isReservasWorld
                    ? fetchServices({ append: false, cursor: null })
                    : isPadelWorld
                      ? fetchPadel()
                      : fetchItems({ append: false, cursor: null })
                }
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
                  setSelectedCategories(world === "PADEL" ? ["PADEL"] : []);
                  setCity("");
                  setCityInput("");
                  setPriceMin(0);
                  setPriceMax(100);
                  setCustomDate("");
                  setPadelFormatFilter("all");
                  setPadelEligibilityFilter("all");
                  setPadelLevelFilter("all");
                  if (isReservasWorld) {
                    fetchServices({ append: false, cursor: null });
                  } else if (isPadelWorld) {
                    fetchPadel();
                  } else {
                    fetchItems({ append: false, cursor: null });
                  }
                }}
                className="rounded-full border border-white/25 text-white/85 px-4 py-1.5 text-[11px] hover:bg-white/5 transition"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        )}

        {/* SEM RESULTADOS */}
        {!activeLoading && !activeError && (isPadelWorld ? !padelHasContent : activeItems.length === 0) && (
          <div className="mt-10 flex flex-col items-center text-center gap-2 text-sm text-white/60">
            <p>
              {isReservasWorld
                ? "Não encontrámos serviços com estes filtros."
                : isPadelWorld
                  ? "Não encontrámos torneios, clubes ou jogos comunitários com estes filtros."
                  : "Não encontrámos eventos com estes filtros."}
            </p>
            <p className="text-xs text-white/40 max-w-sm">
              Ajusta a cidade, data ou preço — ou volta mais tarde. A cidade está sempre a mexer.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setDateFilter("all");
                setTypeFilter("all");
                setSelectedCategories(world === "PADEL" ? ["PADEL"] : []);
                setCity("");
                setCityInput("");
                setPriceMin(0);
                setPriceMax(100);
                setCustomDate("");
                setPadelFormatFilter("all");
                setPadelEligibilityFilter("all");
                setPadelLevelFilter("all");
              }}
              className="mt-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-xs text-white/80 hover:bg-white/10"
            >
              Limpar filtros e voltar ao início
            </button>
          </div>
        )}

        {/* LISTA */}
        {!activeLoading && (isPadelWorld ? padelHasContent : activeItems.length > 0) && (
          <>
            {isPadelWorld ? (
              <div className="mt-4 space-y-8">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Torneios</p>
                    <h3 className="text-lg font-semibold text-white">Torneios de padel em destaque</h3>
                    <p className="text-xs text-white/55">
                      Filtra por formato, elegibilidade e nível para encontrares o torneio certo.
                    </p>
                  </div>
                  {padelTournaments.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
                      Sem torneios com estes filtros.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                      {padelTournaments.map((item) => (
                        <PadelTournamentCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Clubes & Courts</p>
                    <h3 className="text-lg font-semibold text-white">Clubes ativos em Portugal</h3>
                    <p className="text-xs text-white/55">
                      Descobre clubes públicos e os courts disponíveis.
                    </p>
                  </div>
                  {padelClubs.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
                      Sem clubes disponíveis neste momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {padelClubs.map((item) => (
                        <PadelClubCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Jogos comunitários</p>
                    <h3 className="text-lg font-semibold text-white">Duplas à procura de parceiro</h3>
                    <p className="text-xs text-white/55">
                      Junta-te a uma dupla aberta e garante o teu lugar no torneio.
                    </p>
                  </div>
                  {visibleOpenPairings.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
                      Sem duplas abertas por agora.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visibleOpenPairings.map((item) => (
                        <PadelOpenPairingCard
                          key={item.id}
                          item={item}
                          onJoin={() => handleJoinOpenPairing(item)}
                          isLoading={padelJoinLoadingId === item.id}
                          isAuthenticated={Boolean(user)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : isReservasWorld ? (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {[...serviceItems.map((item) => ({ item })), ...Array.from({ length: Math.max(0, 3 - serviceItems.length) }).map((_, idx) => ({ item: null, key: `placeholder-${idx}` }))].map(
                  (entry, idx) =>
                    entry.item ? (
                      <ServiceCard key={`service-${entry.item.id}`} item={entry.item} />
                    ) : (
                      <PlaceholderCard key={entry.key ?? `placeholder-${idx}`} />
                    ),
                )}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {[...items.map((item) => ({ item })), ...Array.from({ length: Math.max(0, 3 - items.length) }).map((_, idx) => ({ item: null, key: `placeholder-${idx}` }))].map(
                  (entry, idx) =>
                    entry.item ? (
                      <EventCard
                        key={`${entry.item.type}-${entry.item.id}`}
                        item={entry.item}
                        onLike={toggleLike}
                        liked={likedItems.includes(entry.item.id)}
                      />
                    ) : (
                      <PlaceholderCard key={entry.key ?? `placeholder-${idx}`} />
                    ),
                )}
              </div>
            )}

            {!isPadelWorld && activeHasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    isReservasWorld
                      ? fetchServices({ append: true, cursor: activeNextCursor })
                      : fetchItems({ append: true, cursor: activeNextCursor })
                  }
                  disabled={activeIsLoadingMore}
                  className="px-5 py-2 rounded-full bg-white/5 border border-white/20 text-xs text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {activeIsLoadingMore ? "A carregar mais..." : "Ver mais"}
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

type ServiceCardProps = {
  item: ServiceItem;
};

type PadelTournamentCardProps = {
  item: PadelTournamentItem;
};

type PadelClubCardProps = {
  item: PadelClubItem;
};

type PadelOpenPairingCardProps = {
  item: PadelOpenPairingItem;
  onJoin: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
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
  badge,
  neonClass,
}: CardProps & { badge: string }) {
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
      className={`group w-full rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col transition-all hover:border-white/16 hover:-translate-y-[6px] ${neonClass ?? ""}`}
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <Image
            src={resolveCover(item.coverImageUrl, item.slug ?? item.id, 900)}
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
            <span className="truncate">{item.hostName || "Organização ORYA"}</span>
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
      badge="Evento"
      neonClass="shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
    />
  );
}

function ServiceCard({ item }: ServiceCardProps) {
  const organizationName = item.organization.publicName || item.organization.businessName || "Organização";
  const availabilityLabel = formatServiceAvailability(item.nextAvailability);
  const priceLabel = `${(item.price / 100).toFixed(2)} ${item.currency}`;

  return (
    <Link
      href={`/servicos/${item.id}`}
      className="group w-full rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col transition-all hover:border-white/16 hover:-translate-y-[6px] shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <Image
            src={resolveCover(null, `service-${item.id}`, 900)}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
          />
        </div>

        <div className="absolute top-2 left-2 flex items-center gap-2 rounded-2xl border border-white/16 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-lg bg-gradient-to-r from-white/10 via-white/7 to-white/5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
            🧩
          </span>
          <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-[#FCD34D] via-[#FB923C] to-[#F97316]" />
          <span className="tracking-wide leading-none">Serviço</span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/2 via-transparent to-white/2">
        <div className="flex items-center justify-between text-[11px] text-white/75">
          <span className="truncate">{organizationName}</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
            {item.organization.city || "Cidade"}
          </span>
        </div>

        <h2 className="text-[14px] md:text-[15px] font-semibold leading-snug text-white line-clamp-2">
          {item.name}
        </h2>

        <p className="text-[11px] text-white/80 line-clamp-2">
          {item.description || "Serviço pronto a reservar na ORYA."}
        </p>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/22 text-white font-medium">
            {item.durationMinutes} min · {priceLabel}
          </span>
          <span className="text-white/70">{availabilityLabel}</span>
        </div>
      </div>
    </Link>
  );
}

function PadelTournamentCard({ item }: PadelTournamentCardProps) {
  const dateLabel = formatPadelDate(item.startsAt, item.endsAt);
  const locationLabel = item.locationName || item.locationCity || "Local a anunciar";
  const priceLabel =
    item.priceFrom == null ? "Preço a anunciar" : item.priceFrom === 0 ? "Grátis" : `Desde ${item.priceFrom.toFixed(2)} €`;
  const formatLabel = formatPadelFormat(item.format);
  const eligibilityLabel = formatPadelEligibility(item.eligibility);

  return (
    <Link
      href={`/eventos/${item.slug}`}
      className="group w-full rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col transition-all hover:border-white/16 hover:-translate-y-[6px] shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <Image
            src={resolveCover(item.coverImageUrl, item.slug ?? item.id, 900)}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transform transition-transform duration-300 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
          />
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-2 rounded-2xl border border-white/16 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-lg bg-gradient-to-r from-white/10 via-white/7 to-white/5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
            🎾
          </span>
          <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-[#6BFFFF] via-[#4ADE80] to-[#1E40AF]" />
          <span className="tracking-wide leading-none">Torneio</span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="p-3 flex flex-col gap-1.5 bg-gradient-to-b from-white/2 via-transparent to-white/2">
        <div className="flex items-center justify-between text-[11px] text-white/75">
          <span className="truncate">{item.organizationName || "Clube ORYA"}</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">{priceLabel}</span>
        </div>

        <h2 className="text-[14px] md:text-[15px] font-semibold leading-snug text-white line-clamp-2">
          {item.title}
        </h2>

        <p className="text-[11px] text-white/80">{dateLabel}</p>
        <p className="text-[11px] text-white/70">{locationLabel}</p>

        <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] text-white/75">
          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
            {formatLabel}
          </span>
          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
            {eligibilityLabel}
          </span>
          {item.levels.length === 0 && (
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              Nível aberto
            </span>
          )}
          {item.levels.slice(0, 3).map((level) => (
            <span
              key={level.id}
              className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5"
            >
              {level.label}
            </span>
          ))}
          {item.levels.length > 3 && (
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              +{item.levels.length - 3}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PadelClubCard({ item }: PadelClubCardProps) {
  const clubHref = item.organizationUsername ? `/${item.organizationUsername}` : null;
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Clube</p>
        <h3 className="text-lg font-semibold text-white">{item.shortName || item.name}</h3>
        <p className="text-xs text-white/55">
          {item.city || "Cidade"} · {item.courtsCount} courts
        </p>
      </div>
      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/75">
        {item.address || "Endereço a anunciar"}
      </span>
    </div>
  );

  const courts = item.courts ?? [];
  const content = (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.4)] transition-all hover:border-white/16 hover:-translate-y-[4px]">
      {header}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {courts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
            Courts a anunciar.
          </div>
        ) : (
          courts.slice(0, 4).map((court) => (
            <div
              key={court.id}
              className="rounded-2xl border border-white/12 bg-black/35 px-3 py-2 text-[11px] text-white/75"
            >
              <p className="font-semibold text-white/90">{court.name}</p>
              <p className="text-[10px] text-white/55">
                {court.indoor ? "Indoor" : "Outdoor"}
                {court.surface ? ` · ${court.surface}` : ""}
              </p>
            </div>
          ))
        )}
      </div>
      {clubHref && (
        <div className="mt-4 text-[11px] text-white/70 group-hover:text-white/90">
          Ver perfil do clube →
        </div>
      )}
    </div>
  );

  if (clubHref) {
    return (
      <Link href={clubHref} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function PadelOpenPairingCard({
  item,
  onJoin,
  isLoading,
  isAuthenticated,
}: PadelOpenPairingCardProps) {
  const dateLabel = formatPadelDate(item.event.startsAt, item.event.startsAt);
  const locationLabel = item.event.locationName || item.event.locationCity || "Local a anunciar";
  const deadlineLabel = formatPadelDeadline(item.deadlineAt);
  const paymentLabel = formatPadelPaymentMode(item.paymentMode);
  const slotsLabel = item.openSlots === 1 ? "1 vaga" : `${item.openSlots} vagas`;
  const joinLabel = isAuthenticated ? "Juntar-me" : "Iniciar sessão";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <Image
            src={resolveCover(item.event.coverImageUrl, item.event.slug ?? item.event.id, 240)}
            alt={item.event.title}
            fill
            sizes="80px"
            className="object-cover"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
          />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Dupla aberta</p>
          <Link href={`/eventos/${item.event.slug}`} className="text-base font-semibold text-white hover:text-white/90">
            {item.event.title}
          </Link>
          <p className="text-[11px] text-white/65">{dateLabel}</p>
          <p className="text-[11px] text-white/55">{locationLabel}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-white/75">
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
              {item.category?.label || "Nível aberto"}
            </span>
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">{slotsLabel}</span>
            <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">{paymentLabel}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/55">Prazo: {deadlineLabel}</p>
        <button
          type="button"
          onClick={onJoin}
          disabled={isLoading}
          className="rounded-full bg-white text-black px-4 py-1.5 text-[11px] font-semibold hover:bg-white/90 disabled:opacity-60"
        >
          {isLoading ? "A entrar..." : joinLabel}
        </button>
      </div>
    </div>
  );
}

function PlaceholderCard() {
  return (
    <div className="group w-full rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col shadow-[0_14px_32px_rgba(0,0,0,0.4)]">
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={resolveCover(null, "explorar-placeholder", 900)}
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
