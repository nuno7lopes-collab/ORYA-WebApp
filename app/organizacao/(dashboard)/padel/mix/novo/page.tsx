"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";
import { fetchGeoAutocomplete, fetchGeoDetails } from "@/lib/geo/client";
import type { GeoAutocompleteItem } from "@/lib/geo/provider";

type MixFormat = "NON_STOP" | "FASE_FINALS";

export default function PadelMixNovoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = parseOrganizationId(searchParams?.get("organizationId"));
  const [title, setTitle] = useState("Mix rápido");
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [teamsCount, setTeamsCount] = useState(8);
  const [format, setFormat] = useState<MixFormat>("NON_STOP");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);
  const addressSearchSeqRef = useRef(0);
  const addressDetailsSeqRef = useRef(0);
  const addressSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeProviderRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 2) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressError(null);
      return;
    }
    if (addressSearchTimeoutRef.current) {
      clearTimeout(addressSearchTimeoutRef.current);
    }
    setAddressError(null);
    const seq = ++addressSearchSeqRef.current;
    addressSearchTimeoutRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        if (addressSearchSeqRef.current === seq) {
          setAddressSuggestions(items);
        }
      } catch (err) {
        if (addressSearchSeqRef.current === seq) {
          setAddressSuggestions([]);
          setAddressError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
        }
      } finally {
        if (addressSearchSeqRef.current === seq) {
          setAddressLoading(false);
        }
      }
    }, 280);

    return () => {
      if (addressSearchTimeoutRef.current) {
        clearTimeout(addressSearchTimeoutRef.current);
      }
    };
  }, [addressQuery]);

  const handleSelectSuggestion = async (item: GeoAutocompleteItem) => {
    setAddressError(null);
    setAddressId(null);
    setAddressQuery(item.label);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    activeProviderRef.current = item.providerId;
    const seq = ++addressDetailsSeqRef.current;
    setAddressLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId, {
        sourceProvider: item.sourceProvider ?? null,
        lat: item.lat,
        lng: item.lng,
      });
      if (addressDetailsSeqRef.current !== seq) return;
      if (activeProviderRef.current !== item.providerId) return;
      const resolvedAddressId = details?.addressId ?? null;
      if (!resolvedAddressId) {
        setAddressError("Morada inválida.");
        return;
      }
      setAddressId(resolvedAddressId);
      if (details?.formattedAddress) {
        setAddressQuery(details.formattedAddress);
      }
    } catch (err) {
      if (addressDetailsSeqRef.current === seq) {
        setAddressError(err instanceof Error ? err.message : "Falha ao normalizar morada.");
      }
    } finally {
      if (addressDetailsSeqRef.current === seq) {
        setAddressLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!startsAt) {
      setError("Indica a data/hora de início.");
      return;
    }
    if (teamsCount < 2 || teamsCount > 8) {
      setError("O Mix rápido suporta entre 2 e 8 equipas.");
      return;
    }
    if (addressQuery.trim() && !addressId) {
      setError("Seleciona uma morada Apple Maps.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/organizacao/padel/mix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt,
          durationMinutes,
          teamsCount,
          format,
          addressId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível criar o Mix.");
      }
      router.push(appendOrganizationIdToHref(`/organizacao/padel/torneios/${json.eventId}`, organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar o Mix.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 text-white">
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Easy Mix</p>
          <h1 className="text-3xl font-semibold">Criar Mix rápido</h1>
          <p className="text-sm text-white/70">
            Torneio curto (2-3h) para grupos de pessoas. Podes adicionar as duplas depois.
          </p>
        </header>

        <div className="grid gap-4 rounded-2xl border border-white/15 bg-white/5 p-4">
          <label className="space-y-1 text-sm text-white/70">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Nome</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Início</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Duração (min)</span>
              <input
                type="number"
                min={60}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Equipas (2-8)</span>
              <input
                type="number"
                min={2}
                max={8}
                value={teamsCount}
                onChange={(e) => setTeamsCount(Number(e.target.value))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Formato</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as MixFormat)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              >
                <option value="NON_STOP">Nonstop (todos contra todos)</option>
                <option value="FASE_FINALS">Fase + finais (2 grupos)</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Morada (Apple Maps)</span>
              <div className="relative overflow-visible">
                <input
                  value={addressQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAddressQuery(next);
                    setAddressId(null);
                    setAddressError(null);
                    activeProviderRef.current = null;
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    if (addressBlurTimeoutRef.current) {
                      clearTimeout(addressBlurTimeoutRef.current);
                    }
                    addressBlurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 120);
                  }}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                  placeholder="Procura um local ou morada"
                />
                {showSuggestions && (
                  <div className="mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl">
                    {addressLoading ? (
                      <div className="px-3 py-2 text-sm text-white/70 animate-pulse">A procurar…</div>
                    ) : addressError ? (
                      <div className="px-3 py-2 text-sm text-amber-100">{addressError}</div>
                    ) : addressSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-white/60">Sem sugestões.</div>
                    ) : (
                      addressSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.providerId}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                        >
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="font-semibold text-white">{suggestion.label}</span>
                            <div className="flex items-center gap-2 text-[12px] text-white/65">
                              <span>{suggestion.city || "—"}</span>
                              {suggestion.sourceProvider === "APPLE_MAPS" && (
                                <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                                  Apple
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </label>
            {addressId && (
              <p className="text-[12px] text-emerald-200">Morada confirmada.</p>
            )}
          </div>

          {error && <p className="text-sm text-amber-200">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {loading ? "A criar..." : "Criar Mix"}
          </button>
        </div>
      </div>
    </div>
  );
}
