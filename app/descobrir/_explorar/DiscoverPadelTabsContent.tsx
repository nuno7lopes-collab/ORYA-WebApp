"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import { trackEvent } from "@/lib/analytics";
import { OryaDateField } from "@/components/ui/datetime";
import { PADEL_FORMAT_OPTIONS_PT } from "@/domain/padel/formatPresentation";
import { PORTUGAL_CITIES } from "@/config/cities";
import {
  CalendarIcon,
  PadelIcon,
  PinIcon,
  PriceIcon,
  PuzzleIcon,
  TicketIcon,
} from "./WorldIcons";
import { DoubleRange } from "./DoubleRange";
import {
  PadelClubCard,
  PadelServiceCard,
  PadelTournamentCard,
} from "./DiscoverCards";
import type {
  DiscoverTab,
  PadelClubItem,
  PadelClubResponse,
  PadelDiscoverResponse,
  PadelServiceItem,
  PadelServicesResponse,
  PadelTournamentItem,
} from "./discoverTypes";

type DateFilter = "all" | "today" | "weekend" | "upcoming" | "custom";

type RankingItem = {
  position: number;
  points: number;
  player: {
    id: number;
    fullName: string;
    level?: string | null;
  };
};

type RankingResponse = {
  ok?: boolean;
  items?: RankingItem[];
  error?: string;
};

type TabState = Record<DiscoverTab, boolean>;
type TabErrorState = Record<DiscoverTab, string | null>;

type CacheEntry = {
  key: string;
  ts: number;
  payload: unknown;
};

type TabMeta = {
  id: DiscoverTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
  subtitle: string;
};

const TAB_OPTIONS: TabMeta[] = [
  {
    id: "torneios",
    label: "Torneios",
    icon: PadelIcon,
    subtitle: "Competições públicas com filtros por formato e nível.",
  },
  {
    id: "clubes",
    label: "Clubes",
    icon: PinIcon,
    subtitle: "Clubes ativos com courts e ligação à comunidade.",
  },
  {
    id: "reservas",
    label: "Reservas",
    icon: PuzzleIcon,
    subtitle: "Courts disponíveis para reserva direta.",
  },
  {
    id: "jogadores",
    label: "Jogadores",
    icon: TicketIcon,
    subtitle: "Ranking global de jogadores em competição.",
  },
  {
    id: "academia",
    label: "Academia",
    icon: CalendarIcon,
    subtitle: "Aulas e treinos com foco na evolução técnica.",
  },
];

const PADEL_FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos os formatos" },
  ...PADEL_FORMAT_OPTIONS_PT,
];

const PADEL_ELIGIBILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "OPEN", label: "Aberto" },
  { value: "MALE_ONLY", label: "Masculino" },
  { value: "FEMALE_ONLY", label: "Feminino" },
  { value: "MIXED", label: "Misto" },
];

const CACHE_TTL_MS = 30_000;
const PREFETCH_DELAY_MS = 700;

const FILTER_PANEL_CLASS =
  "relative z-20 rounded-3xl border border-white/12 bg-gradient-to-r from-white/8 via-[#0b1222]/65 to-white/6 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl";

const TAB_BAR_WRAPPER_CLASS =
  "sticky top-[64px] z-20 rounded-3xl border border-white/12 bg-[#0b1222]/75 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:top-[84px]";

const FIELD_CLASS =
  "rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/85 placeholder:text-white/45 focus:border-white/45 focus:outline-none";

const SELECT_CLASS =
  "rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/85 focus:border-white/45 focus:outline-none";

const PILL_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80";

function resolveTab(value: string | null): DiscoverTab {
  if (value === "clubes") return "clubes";
  if (value === "reservas") return "reservas";
  if (value === "jogadores") return "jogadores";
  if (value === "academia") return "academia";
  return "torneios";
}

function clampPrice(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function parsePrice(value: string | null, fallback: number) {
  if (!value) return fallback;
  return clampPrice(Number(value), fallback);
}

function parseDateFilter(dateParam: string | null, dayParam: string | null) {
  if (dateParam === "day" && dayParam) {
    return { filter: "custom" as DateFilter, day: dayParam };
  }
  if (dateParam === "today" || dateParam === "weekend" || dateParam === "upcoming") {
    return { filter: dateParam as DateFilter, day: "" };
  }
  return { filter: "all" as DateFilter, day: "" };
}

function parsePeriodDays(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (parsed === 30 || parsed === 90 || parsed === 365) return parsed;
  return 90;
}

function formatCount(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function normalizeApiError(raw: unknown, fallback: string) {
  if (typeof raw === "string" && raw.trim()) return raw;
  return fallback;
}

export function DiscoverPadelTabsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialDate = parseDateFilter(searchParams.get("date"), searchParams.get("day"));

  const [tab, setTab] = useState<DiscoverTab>(() => resolveTab(searchParams.get("tab")));
  const [queryInput, setQueryInput] = useState(() => searchParams.get("q") ?? "");
  const [query, setQuery] = useState(() => (searchParams.get("q") ?? "").trim());
  const [cityInput, setCityInput] = useState(() => searchParams.get("city") ?? "");
  const [city, setCity] = useState(() => (searchParams.get("city") ?? "").trim());

  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDate.filter);
  const [customDate, setCustomDate] = useState(initialDate.day);
  const [priceMin, setPriceMin] = useState(() => parsePrice(searchParams.get("priceMin"), 0));
  const [priceMax, setPriceMax] = useState(() => parsePrice(searchParams.get("priceMax"), 100));
  const [padelFormatFilter, setPadelFormatFilter] = useState(() => {
    const raw = searchParams.get("format");
    if (!raw) return "all";
    return PADEL_FORMAT_OPTIONS.some((option) => option.value === raw) ? raw : "all";
  });
  const [padelEligibilityFilter, setPadelEligibilityFilter] = useState(() => {
    const raw = searchParams.get("eligibility");
    if (!raw) return "all";
    return PADEL_ELIGIBILITY_OPTIONS.some((option) => option.value === raw) ? raw : "all";
  });
  const [padelLevelFilter, setPadelLevelFilter] = useState(() => {
    const raw = searchParams.get("level");
    if (!raw) return "all";
    return Number.isFinite(Number(raw)) ? raw : "all";
  });
  const [periodDays, setPeriodDays] = useState(() => parsePeriodDays(searchParams.get("periodDays")));
  const [tierFilter, setTierFilter] = useState(() => searchParams.get("tier") ?? "");

  const [padelTournaments, setPadelTournaments] = useState<PadelTournamentItem[]>([]);
  const [padelLevels, setPadelLevels] = useState<Array<{ id: number; label: string }>>([]);
  const [padelClubs, setPadelClubs] = useState<PadelClubItem[]>([]);
  const [reservasServices, setReservasServices] = useState<PadelServiceItem[]>([]);
  const [academiaServices, setAcademiaServices] = useState<PadelServiceItem[]>([]);
  const [rankingItems, setRankingItems] = useState<RankingItem[]>([]);

  const [loadingByTab, setLoadingByTab] = useState<TabState>({
    torneios: false,
    clubes: false,
    reservas: false,
    jogadores: false,
    academia: false,
  });
  const [errorByTab, setErrorByTab] = useState<TabErrorState>({
    torneios: null,
    clubes: null,
    reservas: null,
    jogadores: null,
    academia: null,
  });

  const cacheRef = useRef<Partial<Record<DiscoverTab, CacheEntry>>>({});
  const controllersRef = useRef<Partial<Record<DiscoverTab, AbortController>>>({});
  const lastQuerySyncRef = useRef<string>("");
  const lastFilterTrackRef = useRef<string>("");

  const effectiveMaxParam = priceMax >= 100 ? null : priceMax;
  const headingCity = city.trim() || "Portugal";

  const filteredCities = useMemo(() => {
    const needle = cityInput.trim().toLowerCase();
    if (!needle) return [];
    return PORTUGAL_CITIES.filter((entry) => entry.toLowerCase().includes(needle)).slice(0, 8);
  }, [cityInput]);

  const hasAnyFilter = useMemo(() => {
    if (query.trim()) return true;
    if (city.trim()) return true;
    if (priceMin > 0 || effectiveMaxParam !== null) return true;
    if (dateFilter !== "all" || customDate) return true;
    if (padelFormatFilter !== "all" || padelEligibilityFilter !== "all" || padelLevelFilter !== "all") return true;
    if (periodDays !== 90 || tierFilter.trim()) return true;
    return false;
  }, [
    city,
    customDate,
    dateFilter,
    effectiveMaxParam,
    padelEligibilityFilter,
    padelFormatFilter,
    padelLevelFilter,
    periodDays,
    priceMin,
    query,
    tierFilter,
  ]);

  const activeCount = useMemo(() => {
    if (tab === "torneios") return padelTournaments.length;
    if (tab === "clubes") return padelClubs.length;
    if (tab === "reservas") return reservasServices.length;
    if (tab === "jogadores") return rankingItems.length;
    return academiaServices.length;
  }, [academiaServices.length, padelClubs.length, padelTournaments.length, rankingItems.length, reservasServices.length, tab]);

  const queryStringForUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (query.trim()) params.set("q", query.trim());
    if (city.trim()) params.set("city", city.trim());
    if (priceMin > 0) params.set("priceMin", String(priceMin));
    if (effectiveMaxParam !== null) params.set("priceMax", String(effectiveMaxParam));
    if (dateFilter === "custom" && customDate) {
      params.set("date", "day");
      params.set("day", customDate);
    } else if (dateFilter !== "all") {
      params.set("date", dateFilter);
    }
    if (padelFormatFilter !== "all") params.set("format", padelFormatFilter);
    if (padelEligibilityFilter !== "all") params.set("eligibility", padelEligibilityFilter);
    if (padelLevelFilter !== "all") params.set("level", padelLevelFilter);
    if (periodDays !== 90) params.set("periodDays", String(periodDays));
    if (tierFilter.trim()) params.set("tier", tierFilter.trim());
    return params.toString();
  }, [
    city,
    customDate,
    dateFilter,
    effectiveMaxParam,
    padelEligibilityFilter,
    padelFormatFilter,
    padelLevelFilter,
    periodDays,
    priceMin,
    query,
    tab,
    tierFilter,
  ]);

  const cacheKeys = useMemo(
    () => ({
      torneios: JSON.stringify({
        tab: "torneios",
        query,
        city,
        dateFilter,
        customDate,
        priceMin,
        priceMax: effectiveMaxParam,
        padelFormatFilter,
        padelEligibilityFilter,
        padelLevelFilter,
      }),
      clubes: JSON.stringify({ tab: "clubes", query, city }),
      reservas: JSON.stringify({
        tab: "reservas",
        query,
        city,
        priceMin,
        priceMax: effectiveMaxParam,
      }),
      jogadores: JSON.stringify({
        tab: "jogadores",
        periodDays,
        city,
        tier: tierFilter.trim(),
      }),
      academia: JSON.stringify({
        tab: "academia",
        query,
        city,
        priceMin,
        priceMax: effectiveMaxParam,
      }),
    }),
    [
      city,
      customDate,
      dateFilter,
      effectiveMaxParam,
      padelEligibilityFilter,
      padelFormatFilter,
      padelLevelFilter,
      periodDays,
      priceMin,
      query,
      tierFilter,
    ],
  );

  const setLoadingForTab = useCallback((targetTab: DiscoverTab, value: boolean) => {
    setLoadingByTab((prev) => ({ ...prev, [targetTab]: value }));
  }, []);

  const setErrorForTab = useCallback((targetTab: DiscoverTab, value: string | null) => {
    setErrorByTab((prev) => ({ ...prev, [targetTab]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setQueryInput("");
    setQuery("");
    setCityInput("");
    setCity("");
    setDateFilter("all");
    setCustomDate("");
    setPriceMin(0);
    setPriceMax(100);
    setPadelFormatFilter("all");
    setPadelEligibilityFilter("all");
    setPadelLevelFilter("all");
    setPeriodDays(90);
    setTierFilter("");
  }, []);

  const getJson = useCallback(async <T extends { ok?: boolean; error?: string }>(url: string, signal: AbortSignal) => {
    const response = await fetch(url, { cache: "no-store", signal });
    const raw = await response.text().catch(() => "");
    let data: T | null = null;
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as T;
      } catch {
        data = null;
      }
    }
    if (!response.ok || !data || data.ok === false) {
      const detail =
        normalizeApiError(data?.error, "") || (raw ? raw.slice(0, 200) : "") || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    return data;
  }, []);

  const requestTabData = useCallback(
    async (targetTab: DiscoverTab, signal: AbortSignal) => {
      if (targetTab === "torneios") {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (city.trim()) params.set("city", city.trim());
        if (dateFilter === "custom" && customDate) {
          params.set("date", "day");
          params.set("day", customDate);
        } else if (dateFilter !== "all") {
          params.set("date", dateFilter);
        }
        if (priceMin > 0) params.set("priceMin", String(priceMin));
        if (effectiveMaxParam !== null) params.set("priceMax", String(effectiveMaxParam));
        if (padelFormatFilter !== "all") params.set("format", padelFormatFilter);
        if (padelEligibilityFilter !== "all") params.set("eligibility", padelEligibilityFilter);
        if (padelLevelFilter !== "all") params.set("level", padelLevelFilter);
        params.set("limit", "24");
        return getJson<PadelDiscoverResponse>(`/api/padel/discover?${params.toString()}`, signal);
      }

      if (targetTab === "clubes") {
        const params = new URLSearchParams();
        params.set("includeCourts", "1");
        params.set("limit", "24");
        if (query.trim()) params.set("q", query.trim());
        if (city.trim()) params.set("city", city.trim());
        return getJson<PadelClubResponse>(`/api/padel/public/clubs?${params.toString()}`, signal);
      }

      if (targetTab === "reservas" || targetTab === "academia") {
        const params = new URLSearchParams();
        params.set("kind", targetTab === "reservas" ? "COURT" : "CLASS");
        params.set("limit", "24");
        if (query.trim()) params.set("q", query.trim());
        if (city.trim()) params.set("city", city.trim());
        if (priceMin > 0) params.set("priceMin", String(priceMin));
        if (effectiveMaxParam !== null) params.set("priceMax", String(effectiveMaxParam));
        return getJson<PadelServicesResponse>(`/api/padel/public/services?${params.toString()}`, signal);
      }

      const params = new URLSearchParams();
      params.set("scope", "global");
      params.set("limit", "80");
      params.set("periodDays", String(periodDays));
      if (city.trim()) params.set("city", city.trim());
      if (tierFilter.trim()) params.set("tier", tierFilter.trim());
      return getJson<RankingResponse>(`/api/padel/rankings?${params.toString()}`, signal);
    },
    [
      city,
      customDate,
      dateFilter,
      effectiveMaxParam,
      getJson,
      padelEligibilityFilter,
      padelFormatFilter,
      padelLevelFilter,
      periodDays,
      priceMin,
      query,
      tierFilter,
    ],
  );

  const applyPayload = useCallback((targetTab: DiscoverTab, payload: unknown) => {
    if (targetTab === "torneios") {
      const typed = payload as PadelDiscoverResponse;
      setPadelTournaments(Array.isArray(typed.items) ? typed.items : []);
      setPadelLevels(Array.isArray(typed.levels) ? typed.levels : []);
      return;
    }

    if (targetTab === "clubes") {
      const typed = payload as PadelClubResponse;
      setPadelClubs(Array.isArray(typed.items) ? typed.items : []);
      return;
    }

    if (targetTab === "reservas") {
      const typed = payload as PadelServicesResponse;
      setReservasServices(Array.isArray(typed.items) ? typed.items : []);
      return;
    }

    if (targetTab === "academia") {
      const typed = payload as PadelServicesResponse;
      setAcademiaServices(Array.isArray(typed.items) ? typed.items : []);
      return;
    }

    const typed = payload as RankingResponse;
    setRankingItems(Array.isArray(typed.items) ? typed.items : []);
  }, []);

  const loadTab = useCallback(
    async (targetTab: DiscoverTab, opts?: { prefetch?: boolean }) => {
      const shouldPrefetch = opts?.prefetch ?? false;
      const cacheKey = cacheKeys[targetTab];
      const cached = cacheRef.current[targetTab];

      if (cached && cached.key === cacheKey && Date.now() - cached.ts <= CACHE_TTL_MS) {
        applyPayload(targetTab, cached.payload);
        if (!shouldPrefetch) {
          setLoadingForTab(targetTab, false);
          setErrorForTab(targetTab, null);
        }
        return;
      }

      const existingController = controllersRef.current[targetTab];
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      controllersRef.current[targetTab] = controller;

      if (!shouldPrefetch) {
        setLoadingForTab(targetTab, true);
        setErrorForTab(targetTab, null);
      }

      try {
        const payload = await requestTabData(targetTab, controller.signal);
        if (controllersRef.current[targetTab] !== controller) return;
        cacheRef.current[targetTab] = {
          key: cacheKey,
          ts: Date.now(),
          payload,
        };
        applyPayload(targetTab, payload);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!shouldPrefetch) {
          const message =
            normalizeApiError((err as Error | undefined)?.message, "Não foi possível carregar esta secção.");
          setErrorForTab(targetTab, message);
        }
      } finally {
        if (!shouldPrefetch && controllersRef.current[targetTab] === controller) {
          setLoadingForTab(targetTab, false);
        }
      }
    },
    [applyPayload, cacheKeys, requestTabData, setErrorForTab, setLoadingForTab],
  );

  const trackCardClick = useCallback((targetTab: DiscoverTab, cardId: number) => {
    trackEvent("discover_card_click", {
      tab: targetTab,
      cardId,
    });
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(queryInput.trim()), 320);
    return () => clearTimeout(handle);
  }, [queryInput]);

  useEffect(() => {
    const handle = setTimeout(() => setCity(cityInput.trim()), 320);
    return () => clearTimeout(handle);
  }, [cityInput]);

  useEffect(() => {
    if (padelLevelFilter === "all") return;
    const exists = padelLevels.some((level) => String(level.id) === padelLevelFilter);
    if (!exists) {
      setPadelLevelFilter("all");
    }
  }, [padelLevelFilter, padelLevels]);

  useEffect(() => {
    trackEvent("discover_tab_open", { tab });
  }, [tab]);

  const activeFilterSignature = useMemo(() => {
    if (tab === "torneios") {
      return JSON.stringify({
        tab,
        query,
        city,
        dateFilter,
        customDate,
        priceMin,
        priceMax: effectiveMaxParam,
        padelFormatFilter,
        padelEligibilityFilter,
        padelLevelFilter,
      });
    }
    if (tab === "clubes") {
      return JSON.stringify({ tab, query, city });
    }
    if (tab === "jogadores") {
      return JSON.stringify({ tab, periodDays, city, tier: tierFilter.trim() });
    }
    return JSON.stringify({
      tab,
      query,
      city,
      priceMin,
      priceMax: effectiveMaxParam,
    });
  }, [
    city,
    customDate,
    dateFilter,
    effectiveMaxParam,
    padelEligibilityFilter,
    padelFormatFilter,
    padelLevelFilter,
    periodDays,
    priceMin,
    query,
    tab,
    tierFilter,
  ]);

  useEffect(() => {
    if (lastFilterTrackRef.current === activeFilterSignature) return;
    lastFilterTrackRef.current = activeFilterSignature;
    trackEvent("discover_tab_filter_change", {
      tab,
      filters: activeFilterSignature,
    });
  }, [activeFilterSignature, tab]);

  useEffect(() => {
    void loadTab(tab);
  }, [loadTab, tab]);

  const nextTab = useMemo(() => {
    const index = TAB_OPTIONS.findIndex((option) => option.id === tab);
    const nextIndex = index >= 0 ? (index + 1) % TAB_OPTIONS.length : 0;
    return TAB_OPTIONS[nextIndex].id;
  }, [tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) return;
    const handle = window.setTimeout(() => {
      void loadTab(nextTab, { prefetch: true });
    }, PREFETCH_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [loadTab, nextTab]);

  useEffect(() => {
    if (!pathname) return;
    if (lastQuerySyncRef.current === queryStringForUrl) return;
    lastQuerySyncRef.current = queryStringForUrl;
    if (searchParams.toString() === queryStringForUrl) return;
    const href = queryStringForUrl ? `${pathname}?${queryStringForUrl}` : pathname;
    router.replace(href, { scroll: false });
  }, [pathname, queryStringForUrl, router, searchParams]);

  useEffect(
    () => () => {
      Object.values(controllersRef.current).forEach((controller) => controller?.abort());
    },
    [],
  );

  const activeLoading = loadingByTab[tab];
  const activeError = errorByTab[tab];

  const activeTabMeta = TAB_OPTIONS.find((option) => option.id === tab) ?? TAB_OPTIONS[0];

  return (
    <main className="min-h-screen w-full text-white">
      <MobileTopBar variant="search-only" searchPlaceholder="Pesquisar em descobrir" />

      <section className="orya-page-width px-6 md:px-10 py-6 md:py-8 space-y-5">
        <div className={FILTER_PANEL_CLASS}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/50">
                Pesquisa
              </label>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Torneios, clubes, jogadores, aulas..."
                className={`${FIELD_CLASS} w-full`}
              />
            </div>

            <div className="min-w-[180px]">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/50">
                Cidade
              </label>
              <input
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                placeholder="Portugal ou cidade"
                list="discover-city-suggestions"
                className={`${FIELD_CLASS} w-full`}
              />
              <datalist id="discover-city-suggestions">
                {filteredCities.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
            </div>

            <div className="ml-auto flex items-end gap-2">
              <span className={PILL_CLASS}>
                <PinIcon className="h-4 w-4" />
                {headingCity}
              </span>
              {hasAnyFilter ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {tab === "torneios" && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={dateFilter === "custom" ? "custom" : dateFilter}
                  onChange={(event) => {
                    const next = event.target.value as "all" | "today" | "weekend" | "upcoming" | "custom";
                    if (next === "custom") {
                      setDateFilter("custom");
                      return;
                    }
                    setDateFilter(next);
                    setCustomDate("");
                  }}
                  className={SELECT_CLASS}
                >
                  <option value="all">Todas as datas</option>
                  <option value="today">Hoje</option>
                  <option value="weekend">Fim de semana</option>
                  <option value="upcoming">Próximos</option>
                  <option value="custom">Dia específico</option>
                </select>

                <div className="min-w-[170px]">
                  <OryaDateField
                    value={customDate}
                    onChange={(next) => {
                      setCustomDate(next);
                      setDateFilter(next ? "custom" : "all");
                    }}
                    placeholder="Escolher dia"
                    className="w-full"
                    buttonClassName={`${FIELD_CLASS} h-[36px] w-full justify-start`}
                  />
                </div>

                <select
                  value={padelFormatFilter}
                  onChange={(event) => setPadelFormatFilter(event.target.value)}
                  className={SELECT_CLASS}
                >
                  {PADEL_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-black text-white">
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={padelEligibilityFilter}
                  onChange={(event) => setPadelEligibilityFilter(event.target.value)}
                  className={SELECT_CLASS}
                >
                  {PADEL_ELIGIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-black text-white">
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={padelLevelFilter}
                  onChange={(event) => setPadelLevelFilter(event.target.value)}
                  className={SELECT_CLASS}
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
              </div>
            )}

            {(tab === "torneios" || tab === "reservas" || tab === "academia") && (
              <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <div className="mb-3 flex items-center justify-between text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1.5">
                    <PriceIcon className="h-4 w-4" />
                    Preço
                  </span>
                  <span>
                    {priceMin === 0 && effectiveMaxParam === null
                      ? "Qualquer preço"
                      : `€${priceMin} - ${effectiveMaxParam === null ? "100+" : effectiveMaxParam}`}
                  </span>
                </div>
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
              </div>
            )}

            {tab === "jogadores" && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={periodDays}
                  onChange={(event) => setPeriodDays(parsePeriodDays(event.target.value))}
                  className={SELECT_CLASS}
                >
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                  <option value={365}>Últimos 12 meses</option>
                </select>
                <input
                  value={tierFilter}
                  onChange={(event) => setTierFilter(event.target.value)}
                  placeholder="Nível (M3, M4...)"
                  className={`${FIELD_CLASS} min-w-[180px]`}
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-white/60">
            <span>
              Encontrados <span className="font-semibold text-white/90">{activeCount}</span> resultados em{" "}
              <span className="text-white/85">{activeTabMeta.label}</span>
            </span>
            <span>{headingCity}</span>
          </div>
        </div>

        <div className={TAB_BAR_WRAPPER_CLASS}>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
            {TAB_OPTIONS.map((option) => {
              const isActive = option.id === tab;
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTab(option.id)}
                  className={`rounded-2xl px-3 py-2 text-left transition ${
                    isActive
                      ? "border border-white/35 bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                      : "border border-white/12 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-[12px] font-semibold">{option.label}</span>
                  </div>
                  <p className={`mt-1 text-[10px] ${isActive ? "text-black/70" : "text-white/55"}`}>
                    {option.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {activeLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" aria-hidden>
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="w-full rounded-2xl border border-white/10 orya-skeleton-surface p-3 animate-pulse space-y-3"
              >
                <div className="rounded-xl bg-white/10 aspect-square" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/8" />
              </div>
            ))}
          </div>
        )}

        {!activeLoading && activeError && (
          <div className="max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-50">
            <p className="font-semibold">Não foi possível carregar {activeTabMeta.label.toLowerCase()}.</p>
            <p className="mt-1 text-[12px] text-red-100/85">{activeError}</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void loadTab(tab)}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] text-white/90 hover:bg-white/20"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!activeLoading && !activeError && tab === "torneios" && (
          <>
            {padelTournaments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                Sem torneios com os filtros atuais.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {padelTournaments.map((item, index) => (
                  <div key={item.id} onClickCapture={() => trackCardClick("torneios", item.id)}>
                    <PadelTournamentCard item={item} imagePriority={index < 2} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!activeLoading && !activeError && tab === "clubes" && (
          <>
            {padelClubs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                Sem clubes disponíveis com estes filtros.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {padelClubs.map((item) => (
                  <div key={item.id} onClickCapture={() => trackCardClick("clubes", item.id)}>
                    <PadelClubCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!activeLoading && !activeError && tab === "reservas" && (
          <>
            {reservasServices.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                Sem courts para reserva com estes filtros.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reservasServices.map((item) => (
                  <div key={item.id} onClickCapture={() => trackCardClick("reservas", item.id)}>
                    <PadelServiceCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!activeLoading && !activeError && tab === "academia" && (
          <>
            {academiaServices.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                Sem aulas ou treinos disponíveis com estes filtros.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {academiaServices.map((item) => (
                  <div key={item.id} onClickCapture={() => trackCardClick("academia", item.id)}>
                    <PadelServiceCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!activeLoading && !activeError && tab === "jogadores" && (
          <>
            {rankingItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                Sem jogadores elegíveis no ranking para estes filtros.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {rankingItems.slice(0, 3).map((entry) => (
                    <div
                      key={`top-${entry.player.id}`}
                      onClickCapture={() => trackCardClick("jogadores", entry.player.id)}
                      className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                    >
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">#{entry.position}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{entry.player.fullName}</p>
                      <p className="text-[12px] text-white/70">{entry.points} pts</p>
                      {entry.player.level ? (
                        <span className="mt-2 inline-flex rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                          Nível {entry.player.level}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/60">
                    <span>Ranking completo</span>
                    <Link href="/padel/rankings" className="text-[11px] text-white/75 hover:text-white">
                      Abrir página de ranking
                    </Link>
                  </div>

                  <div className="mt-3 space-y-2">
                    {rankingItems.map((entry) => (
                      <div
                        key={`row-${entry.player.id}-${entry.position}`}
                        onClickCapture={() => trackCardClick("jogadores", entry.player.id)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] text-white/60">#{entry.position}</span>
                          <div>
                            <p className="text-sm text-white/90">{entry.player.fullName}</p>
                            {entry.player.level ? (
                              <p className="text-[11px] text-white/55">Nível {entry.player.level}</p>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-[12px] text-white/70">{entry.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!activeLoading && !activeError && activeCount > 0 && (
          <p className="text-[11px] text-white/45">
            {formatCount(activeCount, "resultado", "resultados")} em {activeTabMeta.label.toLowerCase()}.
          </p>
        )}
      </section>
    </main>
  );
}
