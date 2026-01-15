"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterChip, SegmentedTabs } from "@/app/components/mobile/MobileFilters";
import DoubleRange from "@/app/components/mobile/DoubleRange";
import { cn } from "@/lib/utils";

type RangeValue = "today" | "week" | "near";
type DiscoverTab = "eventos" | "torneios" | "reservas";

type DiscoverFiltersProps = {
  initialTab: DiscoverTab;
  initialRange: RangeValue;
  initialPriceMin: number;
  initialPriceMax: number;
};

const TABS = [
  { value: "eventos", label: "Eventos" },
  { value: "torneios", label: "Torneios" },
  { value: "reservas", label: "Reservas" },
];

export default function DiscoverFilters({
  initialTab,
  initialRange,
  initialPriceMin,
  initialPriceMax,
}: DiscoverFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DiscoverTab>(initialTab);
  const [range, setRange] = useState<RangeValue>(initialRange);
  const [priceMin, setPriceMin] = useState(initialPriceMin);
  const [priceMax, setPriceMax] = useState(initialPriceMax);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const priceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTab(initialTab);
    setRange(initialRange);
  }, [initialRange, initialTab]);

  useEffect(() => {
    setPriceMin(initialPriceMin);
    setPriceMax(initialPriceMax);
  }, [initialPriceMin, initialPriceMax]);

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

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleTabChange = (nextTab: DiscoverTab) => {
    setTab(nextTab);
    updateParams((params) => {
      if (nextTab === "eventos") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }
    });
  };

  const handleRangeChange = (nextRange: RangeValue) => {
    if (nextRange === "near") {
      setIsLocating(true);
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            updateParams((params) => {
              params.set("range", "near");
              params.set("lat", pos.coords.latitude.toFixed(6));
              params.set("lng", pos.coords.longitude.toFixed(6));
            });
            setRange("near");
            setIsLocating(false);
          },
          () => {
            updateParams((params) => {
              params.delete("range");
              params.delete("lat");
              params.delete("lng");
            });
            setRange("week");
            setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 6000 },
        );
      } else {
        updateParams((params) => {
          params.delete("range");
          params.delete("lat");
          params.delete("lng");
        });
        setRange("week");
        setIsLocating(false);
      }
      return;
    }

    updateParams((params) => {
      if (nextRange === "week") {
        params.delete("range");
      } else {
        params.set("range", nextRange);
      }
      params.delete("lat");
      params.delete("lng");
    });
    setRange(nextRange);
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

  const priceLabel = useMemo(() => {
    if (priceMin === 0 && priceMax === 0) return "Gratuito";
    if (priceMin === 0 && priceMax >= 100) return "Preço";
    const maxLabel = priceMax >= 100 ? "100+" : String(priceMax);
    return `${priceMin}-${maxLabel} EUR`;
  }, [priceMin, priceMax]);

  const hasCoords = Boolean(searchParams.get("lat") && searchParams.get("lng"));
  const nearLabel = isLocating ? "A localizar" : hasCoords ? "Perto de ti" : "Ativar localização";

  return (
    <div className="space-y-4">
      <SegmentedTabs
        items={TABS}
        value={tab}
        onChange={(value) => handleTabChange(value as DiscoverTab)}
      />

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Hoje"
          active={range === "today"}
          onClick={() => handleRangeChange("today")}
        />
        <FilterChip
          label={nearLabel}
          active={range === "near" && hasCoords}
          onClick={() => handleRangeChange("near")}
        />
        <FilterChip
          label="Esta semana"
          active={range === "week"}
          onClick={() => handleRangeChange("week")}
        />
        <div ref={priceRef} className="relative">
          <FilterChip
            label={priceLabel}
            active={isPriceOpen || priceMin > 0 || priceMax < 100}
            onClick={() => setIsPriceOpen((prev) => !prev)}
          />
          {isPriceOpen && (
            <div
              className={cn(
                "absolute left-1/2 z-40 mt-2 w-[min(320px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/12 bg-[#0b0f18]/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:left-0 sm:w-[280px] sm:translate-x-0",
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
