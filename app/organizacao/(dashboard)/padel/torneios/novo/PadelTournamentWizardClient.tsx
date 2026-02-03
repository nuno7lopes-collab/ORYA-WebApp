"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PadelClub = {
  id: number;
  name: string;
  isActive: boolean;
  locationSource?: "APPLE_MAPS" | "OSM" | "MANUAL" | null;
  locationProviderId?: string | null;
  locationFormattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
    latitude?: number | null;
    longitude?: number | null;
    sourceProvider?: string | null;
    sourceProviderPlaceId?: string | null;
  } | null;
};

type PadelCategory = {
  id: number;
  label: string;
  genderRestriction?: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
  isActive: boolean;
};

type PadelRuleSet = {
  id: number;
  name: string;
  season?: string | null;
  year?: number | null;
};

type Court = {
  id: number;
  name: string;
  isActive: boolean;
};

type CategoryDraft = {
  selected: boolean;
  price: string;
  capacityTeams: string;
  format: string;
};

const PADEL_FORMATS = [
  { value: "TODOS_CONTRA_TODOS", label: "Todos contra todos" },
  { value: "GRUPOS_ELIMINATORIAS", label: "Grupos + eliminatórias" },
  { value: "QUADRO_ELIMINATORIO", label: "Quadro eliminatório" },
  { value: "QUADRO_AB", label: "Quadro A/B" },
  { value: "DUPLA_ELIMINACAO", label: "Dupla eliminação" },
  { value: "CAMPEONATO_LIGA", label: "Campeonato liga" },
  { value: "NON_STOP", label: "Non-stop" },
];

const ELIGIBILITY_OPTIONS = [
  { value: "OPEN", label: "Aberto" },
  { value: "MALE_ONLY", label: "Masculino" },
  { value: "FEMALE_ONLY", label: "Feminino" },
  { value: "MIXED", label: "Mistos" },
];

const asNumber = (value: string) => {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickCanonicalField = (canonical: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!canonical) return null;
  for (const key of keys) {
    const raw = canonical[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
};

function resolveClubLocation(club: PadelClub | null) {
  if (!club) {
    return {
      city: "",
      address: "",
      formatted: "",
      providerId: null,
      components: null,
      latitude: null,
      longitude: null,
      source: "APPLE_MAPS",
    };
  }
  const canonical = club.addressRef?.canonical ?? null;
  const city =
    pickCanonicalField(canonical, ["city", "addressLine2", "locality"]) || "";
  const address =
    pickCanonicalField(canonical, ["addressLine1", "street", "road"]) || "";
  const formatted =
    club.addressRef?.formattedAddress ||
    club.locationFormattedAddress ||
    [address, city].filter(Boolean).join(", ");
  return {
    city,
    address,
    formatted,
    providerId: club.addressRef?.sourceProviderPlaceId || club.locationProviderId || null,
    components: canonical,
    latitude: club.addressRef?.latitude ?? club.latitude ?? null,
    longitude: club.addressRef?.longitude ?? club.longitude ?? null,
    source: club.locationSource === "OSM" ? "APPLE_MAPS" : club.locationSource || "APPLE_MAPS",
  };
}

export default function PadelTournamentWizardClient({ organizationId }: { organizationId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("Torneio Padel");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [format, setFormat] = useState<string>(PADEL_FORMATS[0]?.value ?? "TODOS_CONTRA_TODOS");
  const [eligibility, setEligibility] = useState<string>("OPEN");
  const [splitDeadlineHours, setSplitDeadlineHours] = useState<string>("48");
  const [isInterclub, setIsInterclub] = useState(false);
  const [teamSize, setTeamSize] = useState("4");
  const [ruleSetId, setRuleSetId] = useState<string>("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, CategoryDraft>>({});
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [useAllCourts, setUseAllCourts] = useState(true);
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clubsRes } = useSWR<{ ok?: boolean; items?: PadelClub[] }>(
    organizationId ? `/api/padel/clubs?organizationId=${organizationId}&includeInactive=0` : null,
    fetcher,
  );
  const { data: categoriesRes } = useSWR<{ ok?: boolean; items?: PadelCategory[] }>(
    organizationId ? `/api/padel/categories/my?organizationId=${organizationId}&includeInactive=0` : null,
    fetcher,
  );
  const { data: rulesetsRes } = useSWR<{ ok?: boolean; items?: PadelRuleSet[] }>(
    organizationId ? `/api/padel/rulesets?organizationId=${organizationId}` : null,
    fetcher,
  );

  const clubIdNumber = Number(selectedClubId);
  const { data: courtsRes } = useSWR<{ ok?: boolean; items?: Court[] }>(
    clubIdNumber ? `/api/padel/clubs/${clubIdNumber}/courts` : null,
    fetcher,
  );

  const clubs = useMemo(() => (Array.isArray(clubsRes?.items) ? clubsRes?.items ?? [] : []), [clubsRes?.items]);
  const categories = useMemo(
    () => (Array.isArray(categoriesRes?.items) ? categoriesRes?.items ?? [] : []),
    [categoriesRes?.items],
  );
  const rulesets = useMemo(() => (Array.isArray(rulesetsRes?.items) ? rulesetsRes?.items ?? [] : []), [rulesetsRes?.items]);
  const courts = useMemo(() => (Array.isArray(courtsRes?.items) ? courtsRes?.items ?? [] : []), [courtsRes?.items]);

  useEffect(() => {
    if (selectedClubId || clubs.length === 0) return;
    const activeClub = clubs.find((club) => club.isActive) ?? clubs[0];
    if (activeClub) setSelectedClubId(String(activeClub.id));
  }, [clubs, selectedClubId]);

  useEffect(() => {
    setSelectedCourtIds([]);
    setUseAllCourts(true);
  }, [selectedClubId]);

  useEffect(() => {
    if (categories.length === 0) return;
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      categories.forEach((cat) => {
        if (!next[cat.id]) {
          next[cat.id] = {
            selected: false,
            price: "0",
            capacityTeams: "",
            format,
          };
        }
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!categories.find((cat) => cat.id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [categories, format]);

  useEffect(() => {
    const selectedIds = categories
      .map((cat) => cat.id)
      .filter((id) => categoryDrafts[id]?.selected);
    if (selectedIds.length === 0) {
      setDefaultCategoryId(null);
      return;
    }
    if (!defaultCategoryId || !selectedIds.includes(defaultCategoryId)) {
      setDefaultCategoryId(selectedIds[0]);
    }
  }, [categoryDrafts, categories, defaultCategoryId]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === Number(selectedClubId)) ?? null,
    [clubs, selectedClubId],
  );
  const location = useMemo(() => resolveClubLocation(selectedClub), [selectedClub]);

  const selectedCategories = useMemo(
    () => categories.filter((cat) => categoryDrafts[cat.id]?.selected),
    [categories, categoryDrafts],
  );

  const toggleCategory = (id: number) => {
    setCategoryDrafts((prev) => {
      const current = prev[id] ?? { selected: false, price: "0", capacityTeams: "", format };
      return {
        ...prev,
        [id]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };

  const toggleCourt = (courtId: number) => {
    setSelectedCourtIds((prev) =>
      prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId],
    );
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Indica o título do torneio.");
      return;
    }
    if (!startsAt) {
      setError("Indica a data/hora de início.");
      return;
    }
    const clubIdValue = Number(selectedClubId);
    if (!Number.isFinite(clubIdValue) || clubIdValue <= 0) {
      setError("Seleciona um clube.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Seleciona pelo menos uma categoria.");
      return;
    }
    if (!location.providerId || !Number.isFinite(location.latitude ?? NaN) || !Number.isFinite(location.longitude ?? NaN)) {
      setError("A morada do clube precisa de estar normalizada.");
      return;
    }
    const teamSizeValue = isInterclub ? asNumber(teamSize) : null;
    if (isInterclub) {
      if (!teamSizeValue || teamSizeValue < 2) {
        setError("Define o tamanho da equipa (mínimo 2).");
        return;
      }
    }

    const categoryConfigs = selectedCategories.map((cat) => {
      const draft = categoryDrafts[cat.id];
      const priceValue = asNumber(draft?.price ?? "0") ?? 0;
      const capacityValue = asNumber(draft?.capacityTeams ?? "") ?? null;
      return {
        padelCategoryId: cat.id,
        pricePerPlayer: Math.max(0, priceValue),
        capacityTeams: capacityValue && capacityValue > 0 ? Math.floor(capacityValue) : null,
        format: draft?.format || format,
        currency: "EUR",
      };
    });

    const hasPaid = categoryConfigs.some((cfg) => (cfg.pricePerPlayer ?? 0) > 0);
    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      startsAt,
      endsAt: endsAt || startsAt,
      locationName: selectedClub?.name ?? null,
      locationCity: location.city || null,
      address: location.formatted || null,
      locationSource: location.source || "APPLE_MAPS",
      locationProviderId: location.providerId,
      locationFormattedAddress: location.formatted || null,
      locationComponents: location.components || null,
      latitude: location.latitude,
      longitude: location.longitude,
      templateType: "PADEL",
      pricingMode: hasPaid ? "STANDARD" : "FREE_ONLY",
      padel: {
        padelClubId: clubIdValue,
        categoryIds: selectedCategories.map((cat) => cat.id),
        defaultCategoryId,
        format,
        eligibilityType: eligibility,
        splitDeadlineHours: asNumber(splitDeadlineHours) ?? null,
        ruleSetId: ruleSetId ? Number(ruleSetId) : null,
        isInterclub,
        teamSize: isInterclub && teamSizeValue ? Math.floor(teamSizeValue) : null,
        categoryConfigs,
        ...(useAllCourts ? {} : { courtIds: selectedCourtIds }),
        padelV2Enabled: true,
      },
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/organizacao/events/create?organizationId=${organizationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const message = json?.message || json?.error || json?.errorCode || "Falha ao criar torneio.";
        throw new Error(message);
      }
      const eventId = json?.data?.event?.id ?? json?.event?.id;
      if (eventId) {
        router.push(appendOrganizationIdToHref(`/organizacao/torneios/${eventId}`, organizationId));
        return;
      }
      router.push(appendOrganizationIdToHref("/organizacao/torneios", organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar torneio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070f] py-10 text-white">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Padel Wizard</p>
          <h1 className="text-3xl font-semibold">Novo torneio de Padel</h1>
          <p className="text-sm text-white/65">
            Fluxo dedicado para padel: escolhe clube, categorias e regras num único passo.
          </p>
        </header>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-[#0b1322] to-[#05070f] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Clube</span>
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Seleciona...</option>
                {clubs.map((club) => (
                  <option key={`club-${club.id}`} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Início</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Fim (opcional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm text-white/70">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
            />
          </label>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            <p className="text-[12px] uppercase tracking-[0.18em] text-white/50">Localização</p>
            {selectedClub ? (
              <div>
                <p className="font-semibold text-white">{selectedClub.name}</p>
                <p className="text-[12px] text-white/60">{location.formatted || "Morada por definir"}</p>
              </div>
            ) : (
              <p className="text-[12px] text-white/60">Seleciona um clube para carregar a morada.</p>
            )}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-[#0b1322] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Categorias</p>
              <p className="text-sm text-white/70">Configura níveis e preços por categoria.</p>
            </div>
            <Link
              href={appendOrganizationIdToHref("/organizacao/torneios?section=padel-tournaments&padel=categories", organizationId)}
              className="text-[12px] text-white/70 underline"
            >
              Gerir categorias
            </Link>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-[12px] text-white/60">
              Ainda não tens categorias. Cria pelo menos uma antes de avançar.
            </div>
          ) : (
            <div className="grid gap-3">
              {categories.map((cat) => {
                const draft = categoryDrafts[cat.id];
                return (
                  <div
                    key={`cat-${cat.id}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(draft?.selected)}
                          onChange={() => toggleCategory(cat.id)}
                          className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                        />
                        <span className="font-semibold">{cat.label}</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                        {cat.genderRestriction && <span>{cat.genderRestriction}</span>}
                        {cat.minLevel && <span>{cat.minLevel}</span>}
                        {cat.maxLevel && <span>{cat.maxLevel}</span>}
                      </div>
                    </div>
                    {draft?.selected && (
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Preço / jogador (€)</span>
                          <input
                            value={draft.price}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => {
                                const current = prev[cat.id] ?? { selected: true, price: "0", capacityTeams: "", format };
                                return {
                                  ...prev,
                                  [cat.id]: { ...current, price: e.target.value },
                                };
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Capacidade (equipas)</span>
                          <input
                            value={draft.capacityTeams}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => {
                                const current = prev[cat.id] ?? { selected: true, price: "0", capacityTeams: "", format };
                                return {
                                  ...prev,
                                  [cat.id]: { ...current, capacityTeams: e.target.value },
                                };
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Formato</span>
                          <select
                            value={draft.format}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => {
                                const current = prev[cat.id] ?? { selected: true, price: "0", capacityTeams: "", format };
                                return {
                                  ...prev,
                                  [cat.id]: { ...current, format: e.target.value },
                                };
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          >
                            {PADEL_FORMATS.map((opt) => (
                              <option key={`cat-format-${cat.id}-${opt.value}`} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Categoria principal</span>
              <select
                value={defaultCategoryId ?? ""}
                onChange={(e) => setDefaultCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Seleciona...</option>
                {selectedCategories.map((cat) => (
                  <option key={`default-cat-${cat.id}`} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Formato global</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                {PADEL_FORMATS.map((opt) => (
                  <option key={`format-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-[#0b1322] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Elegibilidade</span>
              <select
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                {ELIGIBILITY_OPTIONS.map((opt) => (
                  <option key={`elig-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Deadline split (h)</span>
              <input
                value={splitDeadlineHours}
                onChange={(e) => setSplitDeadlineHours(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">RuleSet</span>
              <select
                value={ruleSetId}
                onChange={(e) => setRuleSetId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Padrão</option>
                {rulesets.map((set) => (
                  <option key={`ruleset-${set.id}`} value={set.id}>
                    {set.name}
                    {set.season ? ` · ${set.season}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={isInterclub}
                onChange={(e) => setIsInterclub(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
              />
              Torneio interclubes (equipas)
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Tamanho da equipa</span>
              <input
                type="number"
                min={2}
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                disabled={!isInterclub}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF] disabled:opacity-60"
              />
            </label>
          </div>

          {selectedClub && courts.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">Courts</p>
                <label className="flex items-center gap-2 text-[12px] text-white/70">
                  <input
                    type="checkbox"
                    checked={useAllCourts}
                    onChange={() => setUseAllCourts((prev) => !prev)}
                    className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                  />
                  Usar todos
                </label>
              </div>
              {!useAllCourts && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {courts.map((court) => (
                    <label key={`court-${court.id}`} className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={selectedCourtIds.includes(court.id)}
                        onChange={() => toggleCourt(court.id)}
                        className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                      />
                      {court.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow disabled:opacity-60"
          >
            {saving ? "A criar…" : "Criar torneio"}
          </button>
          <span className="text-[12px] text-white/60">Wizard dedicado a Padel. Sem bilhetes.</span>
        </div>
      </div>
    </div>
  );
}
