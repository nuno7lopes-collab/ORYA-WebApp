"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterChip } from "@/app/components/mobile/MobileFilters";
import DoubleRange from "@/app/components/mobile/DoubleRange";
import { cn } from "@/lib/utils";
import { fetchGeoAutocomplete } from "@/lib/geo/client";
import type { GeoAutocompleteItem } from "@/lib/geo/types";
import type { DiscoverDateFilter, DiscoverWorld } from "@/app/descobrir/_lib/discoverFeed";

const WORLD_ORDER: DiscoverWorld[] = ["padel", "events", "services"];
const WORLD_OPTIONS: Array<{ key: DiscoverWorld; label: string }> = [
  { key: "padel", label: "Padel" },
  { key: "events", label: "Eventos" },
  { key: "services", label: "Serviços" },
];

const DATE_OPTIONS: Array<{ key: DiscoverDateFilter; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "upcoming", label: "Próximos" },
  { key: "weekend", label: "Fim de semana" },
  { key: "day", label: "Dia" },
  { key: "all", label: "Todas" },
];

type DiscoverFiltersProps = {
  initialWorlds: DiscoverWorld[];
  initialQuery: string;
  initialCity: string;
  initialDate: DiscoverDateFilter;
  initialDay: string;
  initialPriceMin: number;
  initialPriceMax: number;
  initialDistanceKm: number | null;
};

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeWorlds = (values: string[]): DiscoverWorld[] => {
  const unique = Array.from(new Set(values)) as DiscoverWorld[];
  const filtered = unique.filter((value) => WORLD_ORDER.includes(value));
  if (filtered.length === 0) return [...WORLD_ORDER];
  return WORLD_ORDER.filter((value) => filtered.includes(value));
};

const parseWorldsParam = (worldsParam: string | null, tabParam: string | null): DiscoverWorld[] => {
  if (worldsParam) {
    return normalizeWorlds(
      worldsParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }
  if (tabParam === "torneios") return ["padel"];
  if (tabParam === "reservas") return ["services"];
  if (tabParam === "eventos") return ["events"];
  return [...WORLD_ORDER];
};

const parseDateParam = (value: string | null): DiscoverDateFilter => {
  if (!value) return "all";
  if (value === "today" || value === "upcoming" || value === "weekend" || value === "day") return value;
  return "all";
};

export default function DiscoverFilters({
  initialWorlds,
  initialQuery,
  initialCity,
  initialDate,
  initialDay,
  initialPriceMin,
  initialPriceMax,
  initialDistanceKm,
}: DiscoverFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [worlds, setWorlds] = useState<DiscoverWorld[]>(initialWorlds);
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [date, setDate] = useState<DiscoverDateFilter>(initialDate);
  const [day, setDay] = useState(initialDay);
  const [priceMin, setPriceMin] = useState(initialPriceMin);
  const [priceMax, setPriceMax] = useState(initialPriceMax);
  const [distanceKm, setDistanceKm] = useState<number>(initialDistanceKm ?? 5);
  const [distanceTouched, setDistanceTouched] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const priceRef = useRef<HTMLDivElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const distanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const hasCoords = Number.isFinite(toNumber(latParam)) && Number.isFinite(toNumber(lngParam));
  const currentQ = searchParams.get("q") ?? "";
  const currentCity = searchParams.get("city") ?? "";
  const currentDistance = toNumber(searchParams.get("distanceKm"));

  useEffect(() => {
    const parsedWorlds = parseWorldsParam(searchParams.get("worlds"), searchParams.get("tab"));
    setWorlds(parsedWorlds);
    setQuery(searchParams.get("q") ?? "");
    setCity(searchParams.get("city") ?? "");
    setDate(parseDateParam(searchParams.get("date")));
    setDay(searchParams.get("day") ?? "");
    setPriceMin(toNumber(searchParams.get("priceMin")) ?? 0);
    setPriceMax(toNumber(searchParams.get("priceMax")) ?? 100);
    const parsedDistance = toNumber(searchParams.get("distanceKm"));
    if (parsedDistance !== null) setDistanceKm(parsedDistance);
  }, [searchParams]);

  useEffect(() => {
    if (!isPriceOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (priceRef.current && target && !priceRef.current.contains(target)) {
        setIsPriceOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isPriceOpen]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (suggestionsRef.current && target && !suggestionsRef.current.contains(target)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [suggestionsOpen]);

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const applyWorlds = (nextWorlds: DiscoverWorld[]) => {
    const normalized = normalizeWorlds(nextWorlds);
    setWorlds(normalized);
    updateParams((params) => {
      params.delete("tab");
      if (normalized.length === WORLD_ORDER.length) {
        params.delete("worlds");
      } else {
        params.set("worlds", normalized.join(","));
      }
    });
  };

  const toggleWorld = (value: DiscoverWorld) => {
    if (worlds.includes(value)) {
      applyWorlds(worlds.filter((world) => world !== value));
      return;
    }
    applyWorlds([...worlds, value]);
  };

  const applyDate = (nextDate: DiscoverDateFilter) => {
    setDate(nextDate);
    updateParams((params) => {
      if (nextDate === "all") {
        params.delete("date");
        params.delete("day");
        return;
      }
      params.set("date", nextDate);
      if (nextDate !== "day") params.delete("day");
    });
  };

  const handleDayChange = (value: string) => {
    setDay(value);
    updateParams((params) => {
      params.set("date", "day");
      if (value) {
        params.set("day", value);
      } else {
        params.delete("day");
      }
    });
  };

  const handlePriceCommit = (min: number, max: number) => {
    setPriceMin(min);
    setPriceMax(max);
    updateParams((params) => {
      if (min > 0) {
        params.set("priceMin", String(min));
      } else {
        params.delete("priceMin");
      }
      if (max < 100) {
        params.set("priceMax", String(max));
      } else {
        params.delete("priceMax");
      }
    });
  };

  const handleLocationToggle = () => {
    if (hasCoords) {
      updateParams((params) => {
        params.delete("lat");
        params.delete("lng");
        params.delete("distanceKm");
      });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateParams((params) => {
          params.set("lat", pos.coords.latitude.toFixed(6));
          params.set("lng", pos.coords.longitude.toFixed(6));
          if (!params.get("distanceKm")) params.set("distanceKm", String(distanceKm));
        });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const priceLabel = useMemo(() => {
    if (priceMin === 0 && priceMax === 0) return "Gratuito";
    if (priceMin === 0 && priceMax >= 100) return "Preço";
    const maxLabel = priceMax >= 100 ? "100+" : String(priceMax);
    return `${priceMin}-${maxLabel} EUR`;
  }, [priceMin, priceMax]);

  useEffect(() => {
    if (typingRef.current) clearTimeout(typingRef.current);
    if (query.trim() === currentQ) return;
    typingRef.current = setTimeout(() => {
      updateParams((params) => {
        const trimmed = query.trim();
        if (trimmed) {
          params.set("q", trimmed);
        } else {
          params.delete("q");
        }
      });
    }, 350);
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!hasCoords || !distanceTouched) return;
    if (currentDistance === distanceKm) return;
    if (distanceRef.current) clearTimeout(distanceRef.current);
    distanceRef.current = setTimeout(() => {
      updateParams((params) => {
        if (distanceKm) {
          params.set("distanceKm", String(distanceKm));
        } else {
          params.delete("distanceKm");
        }
      });
    }, 300);
    return () => {
      if (distanceRef.current) clearTimeout(distanceRef.current);
    };
  }, [distanceKm, hasCoords]);

  useEffect(() => {
    const trimmed = city.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      fetchGeoAutocomplete(trimmed)
        .then((items) => {
          setSuggestions(items);
          setSuggestionsOpen(true);
        })
        .catch(() => {
          setSuggestions([]);
          setSuggestionsOpen(false);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [city]);

  const applyCity = (nextCity: string) => {
    setCity(nextCity);
    updateParams((params) => {
      const trimmed = nextCity.trim();
      if (trimmed === currentCity.trim()) return;
      if (trimmed) {
        params.set("city", trimmed);
      } else {
        params.delete("city");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pesquisa</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar eventos, torneios ou serviços"
            className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </div>
        <div className="relative" ref={suggestionsRef}>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Cidade</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCity(city);
              }}
              placeholder="Lisboa, Porto..."
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="absolute z-40 mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1224]/95 p-2 backdrop-blur-xl">
              {suggestions.map((item) => (
                <button
                  key={item.providerId}
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5"
                  onClick={() => {
                    const label = item.city || item.name || item.label;
                    applyCity(label || "");
                    setSuggestionsOpen(false);
                  }}
                >
                  <span className="text-sm text-white">{item.label}</span>
                  {item.city && <span className="text-[11px] text-white/50">{item.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORLD_OPTIONS.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            active={worlds.includes(option.key)}
            onClick={() => toggleWorld(option.key)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {DATE_OPTIONS.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            active={date === option.key}
            onClick={() => applyDate(option.key)}
          />
        ))}
        {date === "day" && (
          <input
            type="date"
            value={day}
            onChange={(e) => handleDayChange(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label={hasCoords ? "Localização ativa" : isLocating ? "A localizar" : "Ativar localização"}
          active={hasCoords}
          onClick={handleLocationToggle}
        />
        {hasCoords && (
          <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/70">
            <span>{distanceKm} km</span>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={distanceKm}
              onChange={(e) => {
                setDistanceTouched(true);
                setDistanceKm(Number(e.target.value));
              }}
              className="h-1 w-28 cursor-pointer accent-white"
            />
          </div>
        )}
        <div ref={priceRef} className="relative">
          <FilterChip
            label={priceLabel}
            active={isPriceOpen || priceMin > 0 || priceMax < 100}
            onClick={() => setIsPriceOpen((prev) => !prev)}
          />
          {isPriceOpen && (
            <div
              className={cn(
                "absolute left-1/2 z-40 mt-2 w-[min(320px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl orya-menu-surface p-4 backdrop-blur-xl sm:left-0 sm:w-[280px] sm:translate-x-0",
              )}
            >
              <div className="mb-3 flex items-center justify-between text-[11px] text-white/70">
                <span>Intervalo de valor</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-white/60 hover:text-white"
                    onClick={() => {
                      setPriceMin(0);
                      setPriceMax(0);
                      handlePriceCommit(0, 0);
                    }}
                  >
                    Gratuito
                  </button>
                  <button
                    type="button"
                    className="text-white/60 hover:text-white"
                    onClick={() => {
                      setPriceMin(0);
                      setPriceMax(100);
                      handlePriceCommit(0, 100);
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <DoubleRange
                min={0}
                max={100}
                step={1}
                valueMin={priceMin}
                valueMax={priceMax}
                onCommit={handlePriceCommit}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
