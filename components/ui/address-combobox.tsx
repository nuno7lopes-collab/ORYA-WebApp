"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import {
  fetchGeoAutocompleteWithMeta,
  fetchGeoDetails,
  type GeoAutocompleteWithMetaResult,
} from "@/lib/geo/client";
import type { GeoAutocompleteItem, GeoDetailsItem } from "@/lib/geo/types";
import {
  distanceKm,
  formatDistanceLabel,
  MAX_RECENT_LOCATIONS,
  RECENT_LOCATION_KEY,
  sanitizeRecentLocation,
} from "@/lib/geo/locationUx";
import { partitionSuggestionsByCountry } from "@/lib/geo/autocompletePolicy";

type AddressComboboxProps = {
  label: string;
  placeholder?: string;
  disabled?: boolean;

  value: string;
  onValueChange: (next: string) => void;

  addressId: string | null;
  onAddressIdChange: (next: string | null) => void;

  onDetailsResolved?: (details: GeoDetailsItem | null) => void;
  inputRef?: RefObject<HTMLInputElement | null>;

  className?: string;
  inputClassName?: string;

  minChars?: number;
  maxItems?: number;
  enableRecents?: boolean;
  enableGeolocationCta?: boolean;
};

type Bias = { lat: number; lng: number; source: "GEOLOCATION" | "NONE" };
type SuggestionMeta = Pick<
  GeoAutocompleteWithMetaResult,
  "expectedCountryCode" | "effectiveCountryCode" | "queryCountryIntentCode" | "locationBiasSource" | "sourceProvider"
>;

const readRecents = () => {
  if (typeof window === "undefined") return [] as GeoAutocompleteItem[];
  try {
    const raw = window.localStorage.getItem(RECENT_LOCATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeRecentLocation(entry))
      .filter((entry): entry is GeoAutocompleteItem => Boolean(entry))
      .slice(0, MAX_RECENT_LOCATIONS);
  } catch {
    return [];
  }
};

const writeRecents = (item: GeoAutocompleteItem) => {
  if (typeof window === "undefined") return;
  try {
    const current = readRecents();
    const next = [
      item,
      ...current.filter((entry) => entry.providerId !== item.providerId),
    ].slice(0, MAX_RECENT_LOCATIONS);
    window.localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const buildQueryTerms = (query: string) =>
  query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 4);

const highlightQueryTerms = (text: string, query: string) => {
  const terms = buildQueryTerms(query).map((term) => escapeRegex(term));
  if (!terms.length) return text;
  const regex = new RegExp(`(${terms.join("|")})`, "ig");
  const chunks = text.split(regex);
  return chunks.map((chunk, index) => {
    if (!chunk) return null;
    const isMatch = terms.some((term) => new RegExp(`^${term}$`, "i").test(chunk));
    if (!isMatch) return <span key={`txt-${index}`}>{chunk}</span>;
    return (
      <mark key={`hl-${index}`} className="rounded-sm bg-cyan-300/20 px-0.5 text-cyan-100">
        {chunk}
      </mark>
    );
  });
};

const computeClientSuggestionScore = (query: string, item: GeoAutocompleteItem) => {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const label = normalizeSearchText(item.label);
  const secondary = normalizeSearchText(item.secondaryLabel ?? item.address ?? item.city ?? "");
  let score = 0;
  if (label === q) score += 180;
  if (label.startsWith(q)) score += 120;
  if (label.includes(q)) score += 70;
  if (secondary.startsWith(q)) score += 35;
  if (secondary.includes(q)) score += 15;
  if (item.city) score += 4;
  return score;
};

export function AddressCombobox({
  label,
  placeholder = "Procura uma rua, cidade ou local",
  disabled = false,
  value,
  onValueChange,
  addressId,
  onAddressIdChange,
  onDetailsResolved,
  inputRef,
  className,
  inputClassName,
  minChars = 2,
  maxItems = 10,
  enableRecents = true,
  enableGeolocationCta = true,
}: AddressComboboxProps) {
  const inputId = useId();
  const listboxId = useId();
  const rootId = useId();
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeqRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [meta, setMeta] = useState<SuggestionMeta | null>(null);
  const [showForeign, setShowForeign] = useState(false);
  const [recentItems, setRecentItems] = useState<GeoAutocompleteItem[]>([]);
  const [bias, setBias] = useState<Bias>({ lat: 0, lng: 0, source: "NONE" });
  const biasCoords = useMemo(
    () => (bias.source === "GEOLOCATION" ? { lat: bias.lat, lng: bias.lng } : null),
    [bias.lat, bias.lng, bias.source],
  );

  const trimmedQuery = value.trim();
  const waitingForTyping = trimmedQuery.length < minChars;

  useEffect(() => {
    mountedRef.current = true;
    setRecentItems(readRecents());
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Close on outside interactions.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const input = internalInputRef.current;
      const dropdown = dropdownRef.current;
      if (!target || !input) return;
      if (input.contains(target)) return;
      if (dropdown && dropdown.contains(target)) return;
      setOpen(false);
      setActiveIndex(-1);
      setShowForeign(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const requestGeolocationBias = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setError("Este browser não suporta geolocalização.");
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setError("Localização inválida.");
          return;
        }
        setBias({ lat, lng, source: "GEOLOCATION" });
      },
      () => {
        setError("Não foi possível obter a localização atual.");
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Fetch suggestions (debounced).
  useEffect(() => {
    if (disabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (waitingForTyping) {
      setLoading(false);
      setError(null);
      setSuggestions([]);
      setMeta(null);
      setActiveIndex(-1);
      setShowForeign(false);
      return;
    }

    const seq = ++fetchSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchGeoAutocompleteWithMeta(trimmedQuery, biasCoords ?? undefined);
        if (!mountedRef.current || fetchSeqRef.current !== seq) return;
        const items = (result.items ?? [])
          .map((item, index) => ({ item, index }))
          .sort((a, b) => {
            const scoreDiff =
              computeClientSuggestionScore(trimmedQuery, b.item) - computeClientSuggestionScore(trimmedQuery, a.item);
            if (scoreDiff !== 0) return scoreDiff;
            return a.index - b.index;
          })
          .map((entry) => entry.item)
          .slice(0, clamp(maxItems, 4, 12));
        setSuggestions(items);
        setMeta({
          expectedCountryCode: result.expectedCountryCode,
          effectiveCountryCode: result.effectiveCountryCode,
          queryCountryIntentCode: result.queryCountryIntentCode,
          locationBiasSource: result.locationBiasSource,
          sourceProvider: result.sourceProvider,
        });
        setActiveIndex(items.length > 0 ? 0 : -1);
      } catch (err) {
        if (!mountedRef.current || fetchSeqRef.current !== seq) return;
        setSuggestions([]);
        setMeta(null);
        setActiveIndex(-1);
        setError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
      } finally {
        if (!mountedRef.current || fetchSeqRef.current !== seq) return;
        setLoading(false);
      }
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [biasCoords, disabled, maxItems, minChars, trimmedQuery, waitingForTyping]);

  const grouped = useMemo(() => {
    if (!meta?.effectiveCountryCode) {
      return { primary: suggestions, foreign: [] as GeoAutocompleteItem[] };
    }
    const partitioned = partitionSuggestionsByCountry(suggestions, meta.effectiveCountryCode);
    const hasLocal = partitioned.local.length > 0 || partitioned.unknown.length > 0;
    const showForeignFallback = !hasLocal && partitioned.foreign.length > 0;
    const primary = showForeignFallback
      ? partitioned.foreign
      : [...partitioned.local, ...partitioned.unknown];
    const foreign = showForeignFallback ? [] : partitioned.foreign;
    return { primary, foreign };
  }, [meta?.effectiveCountryCode, suggestions]);

  const visibleSuggestions = useMemo(() => {
    if (!grouped.foreign.length) return grouped.primary;
    return showForeign ? [...grouped.primary, ...grouped.foreign] : grouped.primary;
  }, [grouped.foreign.length, grouped.primary, grouped.foreign, showForeign]);

  const rankingHint = useMemo(() => {
    if (meta?.queryCountryIntentCode) {
      return `Pesquisa global por país (${meta.queryCountryIntentCode}).`;
    }
    if (bias.source === "GEOLOCATION") {
      return "Ranking local melhorado com a tua localização atual.";
    }
    if (meta?.effectiveCountryCode) {
      return `Sugestões priorizadas para ${meta.effectiveCountryCode}.`;
    }
    return "Sugestões por relevância textual e contexto local.";
  }, [bias.source, meta?.effectiveCountryCode, meta?.queryCountryIntentCode]);

  const selectSuggestion = useCallback(
    async (item: GeoAutocompleteItem) => {
      setLoading(true);
      setError(null);
      setActiveIndex(-1);
      const seq = ++fetchSeqRef.current;
      try {
        const details = await fetchGeoDetails(item.providerId, { lat: item.lat, lng: item.lng });
        if (!mountedRef.current || fetchSeqRef.current !== seq) return;
        if (!details?.addressId) {
          setError("Morada inválida.");
          onAddressIdChange(null);
          onDetailsResolved?.(null);
          setLoading(false);
          return;
        }
        const formatted = details.formattedAddress?.trim() || item.secondaryLabel?.trim() || item.label;
        onValueChange(formatted);
        onAddressIdChange(details.addressId);
        onDetailsResolved?.(details);
        writeRecents({
          ...item,
          secondaryLabel: item.secondaryLabel ?? details.formattedAddress ?? null,
          city: item.city ?? details.city ?? null,
          address: item.address ?? details.address ?? details.formattedAddress ?? null,
        });
        setRecentItems(readRecents());
        setOpen(false);
        setShowForeign(false);
      } catch (err) {
        if (!mountedRef.current || fetchSeqRef.current !== seq) return;
        setError(err instanceof Error ? err.message : "Falha ao normalizar morada.");
      } finally {
        if (!mountedRef.current || fetchSeqRef.current !== seq) return;
        setLoading(false);
      }
    },
    [onAddressIdChange, onDetailsResolved, onValueChange],
  );

  const overlayPosition = useOverlayPosition({ open, anchorRef: internalInputRef, dropdownRef });

  const onInputChange = (next: string) => {
    onValueChange(next);
    if (addressId) {
      onAddressIdChange(null);
      onDetailsResolved?.(null);
    }
    setOpen(true);
    setShowForeign(false);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      setShowForeign(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : prev + 1;
        return visibleSuggestions.length ? next % visibleSuggestions.length : -1;
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => {
        if (!visibleSuggestions.length) return -1;
        const next = prev < 0 ? visibleSuggestions.length - 1 : prev - 1;
        return (next + visibleSuggestions.length) % visibleSuggestions.length;
      });
      return;
    }
    if (event.key === "Enter") {
      if (!open) return;
      if (activeIndex < 0 || activeIndex >= visibleSuggestions.length) return;
      event.preventDefault();
      void selectSuggestion(visibleSuggestions[activeIndex]!);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
      setShowForeign(false);
    }
  };

  const activeDescendantId =
    open && activeIndex >= 0 && activeIndex < visibleSuggestions.length
      ? `${rootId}-opt-${activeIndex}`
      : undefined;

  const showDistance = bias.source === "GEOLOCATION";
  const topSectionCount = Math.min(5, visibleSuggestions.length);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const optionId = `${rootId}-opt-${activeIndex}`;
    const option = typeof document !== "undefined" ? document.getElementById(optionId) : null;
    if (option && dropdownRef.current?.contains(option)) {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open, rootId]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const renderSuggestionRow = (item: GeoAutocompleteItem, idx: number): ReactNode => {
    const isActive = idx === activeIndex;
    const distance =
      showDistance &&
      biasCoords &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng)
        ? formatDistanceLabel(distanceKm(biasCoords, { lat: item.lat, lng: item.lng }))
        : null;
    return (
      <button
        key={item.providerId}
        id={`${rootId}-opt-${idx}`}
        role="option"
        aria-selected={isActive}
        type="button"
        className={cn(
          "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
          isActive ? "bg-white/12" : "hover:bg-white/8",
        )}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => void selectSuggestion(item)}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{highlightQueryTerms(item.label, trimmedQuery)}</p>
          <p className="truncate text-[12px] text-white/60">
            {highlightQueryTerms(item.secondaryLabel || item.address || item.city || "—", trimmedQuery)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {distance ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
              {distance}
            </span>
          ) : null}
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
            Apple
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={inputId} className="text-[12px] text-white/70">
        {label}
      </label>

      <input
        id={inputId}
        ref={(node) => {
          internalInputRef.current = node;
          if (inputRef) {
            inputRef.current = node;
          }
        }}
        value={value}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={onInputKeyDown}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
        }}
        onBlur={() => {
          if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
          blurTimerRef.current = setTimeout(() => {
            setOpen(false);
            setActiveIndex(-1);
            setShowForeign(false);
          }, 120);
        }}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendantId}
        className={cn(
          "w-full rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40 disabled:cursor-not-allowed disabled:opacity-70",
          inputClassName,
        )}
      />

      {!addressId && trimmedQuery.length > 0 ? (
        <p className="text-[11px] text-amber-200">Seleciona uma sugestão para confirmar a morada.</p>
      ) : null}

      {open && !disabled && overlayPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              className={cn(
                "fixed z-[80] overflow-hidden rounded-2xl border border-white/12 bg-black/92 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl",
              )}
              style={overlayPosition}
              onMouseDown={(event) => {
                // Prevent blur when interacting with dropdown.
                event.preventDefault();
              }}
            >
              <div className="px-3 py-2">
                {waitingForTyping ? (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Sugestões</p>
                    <p className="text-[12px] text-white/70">Começa a escrever para procurar locais.</p>
                    {enableRecents && recentItems.length > 0 ? (
                      <div className="pt-1">
                        <p className="text-[11px] text-white/55">Recentes</p>
                        <div className="mt-2 space-y-1">
                          {recentItems.map((item) => (
                            <button
                              key={`recent-${item.providerId}`}
                              type="button"
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                              onClick={() => void selectSuggestion(item)}
                            >
                              <p className="text-sm font-semibold text-white">{item.label}</p>
                              <p className="text-[12px] text-white/60">
                                {item.secondaryLabel || item.address || item.city || "—"}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : enableRecents ? (
                      <p className="text-[12px] text-white/55">Sem localizações recentes.</p>
                    ) : null}
                    {enableGeolocationCta ? (
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:border-white/40 hover:bg-white/10"
                        onClick={() => requestGeolocationBias()}
                      >
                        Usar localização atual para melhorar sugestões
                      </button>
                    ) : null}
                    {error ? <p className="text-[11px] text-amber-100">{error}</p> : null}
                  </div>
                ) : loading ? (
                  <div className="px-1 py-2 text-sm text-white/70 animate-pulse">A procurar...</div>
                ) : error ? (
                  <div className="px-1 py-2 text-sm text-amber-100">{error}</div>
                ) : visibleSuggestions.length === 0 ? (
                  <div className="space-y-1 px-1 py-2 text-sm text-white/65">
                    <p>Sem sugestões.</p>
                    <p className="text-[12px] text-white/50">
                      Tenta rua + cidade, por exemplo: &quot;Rua de Ceuta Porto&quot;.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <p className="text-[11px] text-cyan-100/90">{rankingHint}</p>
                      {meta?.sourceProvider ? (
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
                          {meta.sourceProvider.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>
                    <div
                      id={listboxId}
                      role="listbox"
                      className="max-h-[340px] overflow-y-auto -mx-3 px-1"
                    >
                      {topSectionCount > 0 ? (
                        <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                          Melhores sugestões
                        </div>
                      ) : null}
                      {visibleSuggestions.slice(0, topSectionCount).map((item, idx) => renderSuggestionRow(item, idx))}
                      {visibleSuggestions.length > topSectionCount ? (
                        <>
                          <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                            Mais resultados
                          </div>
                          {visibleSuggestions
                            .slice(topSectionCount)
                            .map((item, offset) => renderSuggestionRow(item, topSectionCount + offset))}
                        </>
                      ) : null}
                    </div>

                    {grouped.foreign.length > 0 ? (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-white/75 hover:bg-white/8"
                          onClick={() => setShowForeign((prev) => !prev)}
                        >
                          <span>Outros países ({grouped.foreign.length})</span>
                          <span aria-hidden>{showForeign ? "▴" : "▾"}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function useOverlayPosition(params: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  dropdownRef: React.RefObject<HTMLElement | null>;
}) {
  const { open, anchorRef, dropdownRef } = params;
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const compute = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 8;

    const preferredWidth = rect.width;
    const maxWidth = Math.min(preferredWidth, viewportW - 16);
    const left = clamp(rect.left, 8, viewportW - maxWidth - 8);

    const dropdownEl = dropdownRef.current;
    const measuredHeight = dropdownEl ? dropdownEl.getBoundingClientRect().height : 360;
    const spaceBelow = viewportH - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;

    const placeBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    const top = placeBelow
      ? rect.bottom + gap
      : Math.max(8, rect.top - gap - Math.min(measuredHeight, spaceAbove));

    const maxHeight = Math.max(220, Math.min(380, placeBelow ? spaceBelow : spaceAbove));

    setStyle({
      left,
      top,
      width: maxWidth,
      maxHeight,
    });
  }, [anchorRef, dropdownRef]);

  useEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    compute();
    const onScroll = () => compute();
    const onResize = () => compute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const raf = window.requestAnimationFrame(compute);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [compute, open]);

  return style;
}
