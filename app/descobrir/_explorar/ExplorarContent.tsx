"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PORTUGAL_CITIES } from "@/config/cities";
import { trackEvent } from "@/lib/analytics";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import {
  CalendarIcon,
  CloseIcon,
  PadelIcon,
  PinIcon,
  PriceIcon,
  PuzzleIcon,
  TicketIcon,
} from "./WorldIcons";
import type {
  ApiResponse,
  DateFilter,
  ExploreItem,
  ExploreWorld,
  PadelClubItem,
  PadelClubResponse,
  PadelDiscoverResponse,
  PadelOpenPairingItem,
  PadelOpenPairingsResponse,
  PadelTournamentItem,
  ServiceApiResponse,
  ServiceItem,
} from "./discoverTypes";
import {
  EventCard,
  PadelClubCard,
  PadelOpenPairingCard,
  PadelTournamentCard,
  ServiceCard,
} from "./DiscoverCards";
import { DoubleRange } from "./DoubleRange";
import { sendDiscoverEventSignal } from "./eventSignals";

const DATE_FILTER_OPTIONS = [
  { value: "all", label: "Todas as datas" },
  { value: "today", label: "Hoje" },
  { value: "weekend", label: "Este fim de semana" },
  { value: "upcoming", label: "Próximos dias" },
] as const;

const WORLD_OPTIONS: { value: ExploreWorld; label: string; accent: string }[] = [
  { value: "EVENTOS", label: "Eventos", accent: "from-[#FF00C8] via-[#9B8CFF] to-[#1646F5]" },
  { value: "PADEL", label: "Torneios", accent: "from-[#6BFFFF] via-[#4ADE80] to-[#1E40AF]" },
  { value: "RESERVAS", label: "Reservas", accent: "from-[#FCD34D] via-[#FB923C] to-[#F97316]" },
];
const WORLD_HREFS: Record<ExploreWorld, string> = {
  EVENTOS: "/descobrir/eventos",
  PADEL: "/descobrir/torneios",
  RESERVAS: "/descobrir/reservas",
};
const WORLD_META: Record<
  ExploreWorld,
  { title: string; subtitle: string; icon: ComponentType<{ className?: string }>; accent: string }
> = {
  EVENTOS: {
    title: "Eventos",
    subtitle: "Concertos, festas, talks e experiências com bilhetes ORYA.",
    icon: TicketIcon,
    accent: "from-[#FF5EDB] via-[#9B8CFF] to-[#2E55FF]",
  },
  PADEL: {
    title: "Torneios",
    subtitle: "Competições de padel com formatos, níveis e clubes premium.",
    icon: PadelIcon,
    accent: "from-[#6BFFFF] via-[#4ADE80] to-[#1E40AF]",
  },
  RESERVAS: {
    title: "Reservas",
    subtitle: "Serviços prontos a reservar com horários e preços claros.",
    icon: PuzzleIcon,
    accent: "from-[#FCD34D] via-[#FB923C] to-[#F97316]",
  },
};

const PADEL_FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos os formatos" },
  { value: "TODOS_CONTRA_TODOS", label: "Todos contra todos" },
  { value: "QUADRO_ELIMINATORIO", label: "Quadro eliminatório" },
  { value: "GRUPOS_ELIMINATORIAS", label: "Grupos + eliminatórias" },
  { value: "QUADRO_AB", label: "Quadro A/B" },
  { value: "DUPLA_ELIMINACAO", label: "Dupla eliminação" },
  { value: "NON_STOP", label: "Non-stop" },
  { value: "CAMPEONATO_LIGA", label: "Campeonato/Liga" },
];

const PADEL_ELIGIBILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "OPEN", label: "Aberto" },
  { value: "MALE_ONLY", label: "Masculino" },
  { value: "FEMALE_ONLY", label: "Feminino" },
  { value: "MIXED", label: "Misto" },
];

function formatCount(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

const exploreMainClass = "min-h-screen w-full text-white";

const exploreFilterClass =
  "relative z-30 flex flex-col gap-4 rounded-3xl border border-white/12 bg-gradient-to-r from-white/8 via-[#0b1222]/65 to-white/6 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl";
const exploreTabsCardClass =
  "rounded-3xl border border-white/10 bg-white/4 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]";
const filterPillClass =
  "inline-flex items-center gap-2 rounded-full border border-white/15 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-3 py-2 sm:px-3.5 sm:py-2 text-xs md:text-sm text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_rgba(0,0,0,0.35)] hover:border-white/35 hover:bg-white/10 transition-all duration-200 ease-out";
const filterPillActiveClass =
  "border-white/45 bg-[linear-gradient(120deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))]";
const filterSelectClass =
  "rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 focus:border-white/45 focus:outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:border-white/30 transition-all duration-200 ease-out";
const panelShellClass =
  "rounded-2xl border border-white/12 bg-gradient-to-br from-[#0c1325] via-[#0b1124] to-[#050914] p-3 sm:p-4 shadow-[0_16px_45px_rgba(0,0,0,0.55)] transition-shadow duration-200 ease-out";
const panelHeaderClass = "flex items-center justify-between text-[11px] text-white/70";
const panelTitleClass = "flex items-center gap-2 text-white/85";
const panelActionClass =
  "rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/35 hover:bg-white/10 transition-all duration-200 ease-out";
const panelActionLinkClass = "text-[11px] text-white/60 hover:text-white/90 transition-colors duration-150 ease-out";
const panelInputClass =
  "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/40 focus:border-white/45 focus:outline-none transition-all duration-200 ease-out";
const panelChipClass =
  "rounded-full border border-white/18 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:bg-white/10 transition-all duration-150 ease-out";
const panelChipActiveClass =
  "rounded-full border border-[#6BFFFF]/70 bg-[#6BFFFF]/20 text-[#E5FFFF] shadow-[0_0_14px_rgba(107,255,255,0.35)]";
const panelListItemClass =
  "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px] transition-all duration-150 ease-out";
const panelListItemActiveClass =
  "border-[#6BFFFF]/70 bg-[#6BFFFF]/15 text-white shadow-[0_0_12px_rgba(107,255,255,0.25)]";
const panelListItemIdleClass =
  "border-white/12 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/8";
const panelPopoverBaseClass =
  "mt-2 w-full rounded-2xl border border-white/15 bg-gradient-to-br from-[#0c1325] via-[#0b1124] to-[#050914] p-3 sm:p-4 backdrop-blur space-y-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-shadow duration-200 ease-out";
const panelModalClass =
  "w-full max-w-sm rounded-2xl border border-white/15 bg-gradient-to-br from-[#0c1325] via-[#0b1124] to-[#050914] p-4 space-y-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-shadow duration-200 ease-out";

type ExplorarContentProps = {
  initialWorld?: ExploreWorld;
  hideWorldTabs?: boolean;
};

export function ExplorarContent({ initialWorld, hideWorldTabs = false }: ExplorarContentProps) {
  const { user } = useUser();
  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const router = useRouter();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<ExploreWorld>(initialWorld ?? "EVENTOS");

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
  const [hiddenEventIds, setHiddenEventIds] = useState<number[]>([]);
  const searchParams = useSearchParams();
  const requestController = useRef<AbortController | null>(null);
  const serviceRequestController = useRef<AbortController | null>(null);
  const padelRequestController = useRef<AbortController | null>(null);
  const [hydratedFromParams, setHydratedFromParams] = useState(false);

  // City via geolocation (opcional)
  // Geolocation desativada para evitar preencher com valores inválidos

  const effectiveMaxParam = priceMax >= 100 ? null : priceMax;
  const filteredCities = useMemo(() => {
    const needle = citySearch.trim().toLowerCase();
    if (!needle) return PORTUGAL_CITIES;
    return PORTUGAL_CITIES.filter((c) => c.toLowerCase().includes(needle));
  }, [citySearch]);

  const hasActiveFilters = useMemo(
    () => {
      const padelFormatActive = world === "PADEL" ? padelFormatFilter !== "all" : false;
      const padelEligibilityActive = world === "PADEL" ? padelEligibilityFilter !== "all" : false;
      const padelLevelActive = world === "PADEL" ? padelLevelFilter !== "all" : false;
      const hasCustomDate = dateFilter === "custom" && !!customDate;

      return (
        search.trim().length > 0 ||
        dateFilter !== "all" ||
        hasCustomDate ||
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
      world,
    ],
  );
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim().length > 0) count += 1;
    if (city.trim().length > 0) count += 1;
    if (dateFilter !== "all") count += 1;
    if (priceMin > 0 || effectiveMaxParam !== null) count += 1;
    if (world === "PADEL") {
      if (padelFormatFilter !== "all") count += 1;
      if (padelEligibilityFilter !== "all") count += 1;
      if (padelLevelFilter !== "all") count += 1;
    }
    return count;
  }, [
    city,
    dateFilter,
    effectiveMaxParam,
    padelEligibilityFilter,
    padelFormatFilter,
    padelLevelFilter,
    priceMin,
    search,
    world,
  ]);

  const isReservasWorld = world === "RESERVAS";
  const isPadelWorld = world === "PADEL";
  const isEventosWorld = world === "EVENTOS";
  const isAuthenticated = Boolean(user?.id);

  const sendSignal = useCallback(
    (payload: Parameters<typeof sendDiscoverEventSignal>[0]) => {
      void sendDiscoverEventSignal(payload, isAuthenticated);
    },
    [isAuthenticated],
  );

  function toggleLike(id: number) {
    setLikedItems((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function hideEvent(id: number) {
    setHiddenEventIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  const CityPanel = () => (
    <>
      <div className={panelHeaderClass}>
        <div className={panelTitleClass}>
          <PinIcon className="h-4 w-4" />
          <span>Local</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setCityInput("");
            setCity("");
          }}
          className={panelActionClass}
        >
          Limpar
        </button>
      </div>
      <div>
        <input
          value={citySearch}
          onChange={(e) => setCitySearch(e.target.value)}
          placeholder="Procurar cidade"
          className={panelInputClass}
        />
      </div>
      <div className="max-h-48 sm:max-h-60 overflow-auto space-y-1.5 pr-1">
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
              className={`${panelListItemClass} ${active ? panelListItemActiveClass : panelListItemIdleClass}`}
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
          className={panelActionLinkClass}
        >
          Fechar
        </button>
        <span className="text-[10px] text-white/45">Escolhe uma cidade em Portugal</span>
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

  const DatePanel = () => {
    const todayIso = new Date().toISOString().slice(0, 10);

    return (
      <>
        <div className={panelHeaderClass}>
          <div className={panelTitleClass}>
            <CalendarIcon className="h-4 w-4" />
            <span>Data</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCustomDate("");
              setDateFilter("today");
            }}
            className={panelActionClass}
          >
            Hoje
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DATE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setCustomDate("");
                setDateFilter(opt.value as DateFilter);
              }}
              className={
                dateFilter === opt.value && !customDate ? panelChipActiveClass : panelChipClass
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className={`${panelShellClass} mt-3`}>
          <div className="mb-2 flex items-center justify-between text-[12px] text-white/80">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(calendarMonth);
                prev.setMonth(prev.getMonth() - 1);
                setCalendarMonth(prev);
              }}
              className={panelActionClass}
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
              className={panelActionClass}
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
              const isToday = iso === todayIso;
              const baseClass = "h-9 w-9 rounded-xl transition-all duration-150 ease-out";
              const selectedClass =
                "bg-[#6BFFFF] text-black shadow-[0_0_18px_rgba(107,255,255,0.45)]";
              const todayClass = "border border-white/25 bg-white/10 text-white";
              const idleClass = "bg-white/5 text-white/80 hover:bg-white/10";
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setCustomDate(iso);
                    setDateFilter("custom");
                  }}
                  className={`${baseClass} ${
                    isSelected ? selectedClass : isToday ? todayClass : idleClass
                  }`}
                >
                  {d.date.getDate()}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-white/45">Sem input livre.</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => setIsDateOpen(false)} className={panelActionLinkClass}>
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomDate("");
              setDateFilter("all");
              setIsDateOpen(false);
            }}
            className={panelActionClass}
          >
            Limpar
          </button>
        </div>
      </>
    );
  };

  const PricePanel = () => (
    <>
      <div className={panelHeaderClass}>
        <div className={panelTitleClass}>
          <PriceIcon className="h-4 w-4" />
          <span>Preço</span>
        </div>
        <span className="text-white/45">Arrasta para definir o intervalo</span>
      </div>
      <div className={`${panelShellClass} px-3 py-4 space-y-3`}>
        <DoubleRange
          min={0}
          max={100}
          step={1}
          valueMin={priceMin}
          valueMax={priceMax}
          onCommit={(min, max) => {
            setPriceMin(min);
            setPriceMax(max);
          }}
        />
        <div className="flex items-center justify-between text-[11px] text-white/80">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            Mín: € {priceMin}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            Máx: {priceMax >= 100 ? "100+" : `€ ${priceMax}`}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <button
            type="button"
            onClick={() => {
              setPriceMin(0);
              setPriceMax(100);
            }}
            className={panelActionClass}
          >
            Limpar
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setPriceMin(0);
          setPriceMax(100);
          setIsPriceOpen(false);
        }}
        className={panelActionLinkClass}
      >
        Limpar
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
      const redirectTo = `/eventos/${item.event.slug}`;
      if (!isAuthOpen) {
        openAuthModal({ mode: "login", redirectTo, showGoogle: true });
      }
      return;
    }
    if (item.isExpired) {
      setPadelError("Prazo expirado.");
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
        if (data?.error === "PADEL_ONBOARDING_REQUIRED") {
          const params = new URLSearchParams();
          params.set("redirectTo", `/eventos/${item.event.slug}`);
          router.push(`/onboarding/padel?${params.toString()}`);
          return;
        }
        const errorMap: Record<string, string> = {
          UNAUTHENTICATED: "Precisas de iniciar sessão.",
          PAIRING_ALREADY_ACTIVE: "Já tens uma dupla ativa neste torneio.",
          PAIRING_EXPIRED: "Este convite expirou.",
          NO_PENDING_SLOT: "Esta dupla já está completa.",
          CATEGORY_PLAYERS_FULL: "Categoria cheia.",
          EVENT_NOT_PUBLISHED: "As inscrições ainda não estão abertas.",
          INSCRIPTIONS_NOT_OPEN: "As inscrições ainda não abriram.",
          INSCRIPTIONS_CLOSED: "As inscrições já fecharam.",
          TOURNAMENT_STARTED: "O torneio já começou.",
          CATEGORY_GENDER_MISMATCH: "Esta categoria exige uma dupla compatível com o género definido.",
          CATEGORY_LEVEL_MISMATCH: "O teu nível não é compatível com esta categoria.",
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

  // Atualiza pesquisa ao entrar via query da Navbar (/descobrir/eventos?query=)
  useEffect(() => {
    if (hydratedFromParams) return;
    const qp = searchParams.get("query") ?? searchParams.get("q") ?? "";
    const cityQ = searchParams.get("city") ?? "";
    const priceMinQ = searchParams.get("priceMin");
    const priceMaxQ = searchParams.get("priceMax");
    const dateQ = searchParams.get("date");
    const dayQ = searchParams.get("day");
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
    if (dateQ === "today" || dateQ === "weekend" || dateQ === "upcoming") {
      setDateFilter(dateQ);
    } else if (dateQ === "day" && dayQ) {
      setDateFilter("custom");
      setCustomDate(dayQ);
    }
    if (!initialWorld) {
      if (worldQ === "padel") {
        setWorld("PADEL");
      } else if (worldQ === "reservas") {
        setWorld("RESERVAS");
      } else if (worldQ === "eventos") {
        setWorld("EVENTOS");
      }
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
  }, [searchParams, hydratedFromParams, initialWorld]);

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
  const visibleEventItems = useMemo(
    () =>
      items.filter((item) => {
        if (hiddenEventIds.includes(item.id)) return false;
        return true;
      }),
    [hiddenEventIds, items],
  );
  const visibleOpenPairings = padelOpenPairings.filter((pairing) => pairing.openSlots > 0);
  const padelHasContent =
    padelTournaments.length > 0 || padelClubs.length > 0 || visibleOpenPairings.length > 0;
  const activeItemsCount = isReservasWorld
    ? serviceItems.length
    : isPadelWorld
      ? padelTournaments.length
      : visibleEventItems.length;
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
      : loading || (error && visibleEventItems.length === 0);
  const worldSummaryLabel = isReservasWorld ? "Reservas" : isPadelWorld ? "Torneios" : "Eventos";
  const activeItems = isReservasWorld
    ? serviceItems
    : isPadelWorld
      ? padelTournaments
      : visibleEventItems;
  const activeError = isReservasWorld ? serviceError : isPadelWorld ? padelError : error;
  const activeLoading = isReservasWorld ? serviceLoading : isPadelWorld ? padelLoading : loading;
  const activeHasMore = isReservasWorld ? serviceHasMore : isPadelWorld ? false : hasMore;
  const activeIsLoadingMore = isReservasWorld ? serviceLoadingMore : isPadelWorld ? false : isLoadingMore;
  const activeNextCursor = isReservasWorld ? serviceNextCursor : isPadelWorld ? null : nextCursor;
  const emptyStateSuggestions = useMemo(() => {
    const suggestions: Array<{ key: string; label: string; apply: () => void }> = [];

    if (city.trim()) {
      suggestions.push({
        key: "city",
        label: "Ver em todo o país",
        apply: () => {
          setCity("");
          setCityInput("");
        },
      });
    }
    if (dateFilter !== "all" || customDate) {
      suggestions.push({
        key: "date",
        label: "Remover filtro de data",
        apply: () => {
          setCustomDate("");
          setDateFilter("all");
        },
      });
    }
    if (search.trim()) {
      suggestions.push({
        key: "search",
        label: "Limpar pesquisa textual",
        apply: () => {
          setSearch("");
          setSearchInput("");
        },
      });
    }
    if (priceMin > 0 || effectiveMaxParam !== null) {
      suggestions.push({
        key: "price",
        label: "Voltar a qualquer preço",
        apply: () => {
          setPriceMin(0);
          setPriceMax(100);
        },
      });
    }
    if (hiddenEventIds.length > 0 && world === "EVENTOS") {
      suggestions.push({
        key: "hidden",
        label: "Repor ocultações desta sessão",
        apply: () => setHiddenEventIds([]),
      });
    }
    if (world !== "EVENTOS") {
      suggestions.push({
        key: "world-eventos",
        label: "Experimentar mundo Eventos",
        apply: () => setWorld("EVENTOS"),
      });
    }

    return suggestions.slice(0, 4);
  }, [
    city,
    customDate,
    dateFilter,
    effectiveMaxParam,
    hiddenEventIds.length,
    priceMin,
    search,
    world,
  ]);

  return (
    <main className={exploreMainClass}>
      <MobileTopBar />
      <section className="orya-page-width px-6 md:px-10 py-6 md:py-8 space-y-6">
        {!hideWorldTabs && (
          <div className={exploreTabsCardClass}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/45">
                Mundos
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/4 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              {WORLD_OPTIONS.map((opt) => {
                const isActive = world === opt.value;
                const WorldIcon = WORLD_META[opt.value].icon;
                return (
                  <Link
                    key={opt.value}
                    href={WORLD_HREFS[opt.value]}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] md:text-[12px] font-semibold transition ${
                        isActive
                          ? "bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                          : "text-white/75 hover:bg-white/10"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                  >
                    <WorldIcon className="h-4 w-4" />
                    <span className="tracking-wide">{opt.label}</span>
                    <span
                      className={`h-1.5 w-6 rounded-full bg-gradient-to-r ${opt.accent} shadow-[0_0_12px_rgba(255,255,255,0.35)]`}
                    />
                  </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TOPO – FILTROS PRINCIPAIS */}
        <div className={exploreFilterClass}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-white/45">
            <span>Filtros</span>
            <span className="text-white/35">
              {activeFiltersCount > 0 ? `${activeFiltersCount} ativos` : "Refina a pesquisa"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Localização */}
            <div className="relative" ref={cityRef}>
              <button
                type="button"
                onClick={() => {
                  setIsCityOpen((v) => !v);
                  setIsDateOpen(false);
                  setIsPriceOpen(false);
                }}
                className={`${filterPillClass} ${isCityOpen ? filterPillActiveClass : ""}`}
              >
                <PinIcon className="h-4 w-4" />
                <span className="font-medium">{headingCity}</span>
              </button>
              {isCityOpen && (
                <>
                  {isMobile && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center p-4">
                      <div className={panelModalClass}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white">Escolhe cidade</h3>
                          <button
                            type="button"
                            onClick={() => setIsCityOpen(false)}
                            className="text-white/60 hover:text-white"
                            aria-label="Fechar"
                          >
                            <CloseIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <CityPanel />
                      </div>
                    </div>
                  )}
                  {!isMobile && (
                    <div className={`${panelPopoverBaseClass} md:absolute md:w-72 md:z-50`}>
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
                className={`${filterPillClass} ${isDateOpen ? filterPillActiveClass : ""}`}
              >
                <CalendarIcon className="h-4 w-4" />
                <span className="font-medium">{dateLabel}</span>
              </button>
              {isDateOpen && (
                <>
                  {isMobile && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center p-4">
                      <div className={panelModalClass}>
                        <DatePanel />
                      </div>
                    </div>
                  )}
                  {!isMobile && (
                    <div className={`${panelPopoverBaseClass} md:absolute md:w-72 md:z-50`}>
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
                className={`${filterPillClass} ${isPriceOpen ? filterPillActiveClass : ""}`}
              >
                <PriceIcon className="h-4 w-4" />
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
                      <div className={panelModalClass}>
                        <PricePanel />
                      </div>
                    </div>
                  )}
                  {!isMobile && (
                    <div className={`${panelPopoverBaseClass} md:absolute md:w-80 md:z-50`}>
                      <PricePanel />
                    </div>
                  )}
                </>
              )}
            </div>

            {isPadelWorld && (
              <div className="hidden lg:block h-8 w-px bg-white/10" />
            )}

            {isPadelWorld && (
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/60">
                <label className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">Formato</span>
                  <select
                    value={padelFormatFilter}
                    onChange={(e) => setPadelFormatFilter(e.target.value)}
                    className={filterSelectClass}
                  >
                    {PADEL_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-black text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">Elegibilidade</span>
                  <select
                    value={padelEligibilityFilter}
                    onChange={(e) => setPadelEligibilityFilter(e.target.value)}
                    className={filterSelectClass}
                  >
                    {PADEL_ELIGIBILITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-black text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">Nível</span>
                  <select
                    value={padelLevelFilter}
                    onChange={(e) => setPadelLevelFilter(e.target.value)}
                    className={filterSelectClass}
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

            <div className="ml-auto flex items-center gap-2 text-[11px]">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setDateFilter("all");
                    setCity("");
                    setCityInput("");
                    setPriceMin(0);
                    setPriceMax(100);
                    setCustomDate("");
                    setPadelFormatFilter("all");
                    setPadelEligibilityFilter("all");
                    setPadelLevelFilter("all");
                    setHiddenEventIds([]);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:border-white/40 hover:bg-white/10 transition"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                  Limpar tudo
                </button>
              )}
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
                className="w-full rounded-2xl border border-white/10 orya-skeleton-surface p-3 animate-pulse space-y-3"
              >
                <div className="rounded-xl bg-white/10 aspect-square" />
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
                  setCity("");
                  setCityInput("");
                  setPriceMin(0);
                  setPriceMax(100);
                  setCustomDate("");
                  setPadelFormatFilter("all");
                  setPadelEligibilityFilter("all");
                  setPadelLevelFilter("all");
                  setHiddenEventIds([]);
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
                ? "Não encontrámos reservas com estes filtros."
                : isPadelWorld
                  ? "Não encontrámos torneios, clubes ou jogos comunitários com estes filtros."
                  : "Não encontrámos eventos com estes filtros."}
            </p>
            <p className="text-xs text-white/40 max-w-sm">
              Ajusta a cidade, data ou preço — ou volta mais tarde. A cidade está sempre a mexer.
            </p>
            {emptyStateSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 max-w-xl">
                {emptyStateSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.key}
                    type="button"
                    onClick={suggestion.apply}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setDateFilter("all");
                setCity("");
                setCityInput("");
                setPriceMin(0);
                setPriceMax(100);
                setCustomDate("");
                setPadelFormatFilter("all");
                setPadelEligibilityFilter("all");
                setPadelLevelFilter("all");
                setHiddenEventIds([]);
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
                      {padelTournaments.map((item, index) => (
                        <PadelTournamentCard key={item.id} item={item} imagePriority={index < 2} />
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
                      {visibleOpenPairings.map((item, index) => (
                        <PadelOpenPairingCard
                          key={item.id}
                          item={item}
                          onJoin={() => handleJoinOpenPairing(item)}
                          isLoading={padelJoinLoadingId === item.id}
                          isAuthenticated={Boolean(user)}
                          imagePriority={index < 2}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : isReservasWorld ? (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {serviceItems.map((item, idx) => (
                  <ServiceCard key={`service-${item.id}`} item={item} imagePriority={idx < 2} />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {visibleEventItems.map((item, idx) => (
                  <EventCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    onLike={toggleLike}
                    onHide={hideEvent}
                    onSignal={sendSignal}
                    liked={likedItems.includes(item.id)}
                    imagePriority={idx < 2}
                  />
                ))}
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
