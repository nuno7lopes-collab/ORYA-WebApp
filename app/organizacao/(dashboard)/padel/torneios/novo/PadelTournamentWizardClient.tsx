"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { trackEvent } from "@/lib/analytics";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { computeMatchSlots, estimateMaxTeamsForSlots } from "@/lib/padel/capacityRecommendation";
import type { Prisma } from "@prisma/client";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PadelClub = {
  id: number;
  name: string;
  isActive: boolean;
  addressId?: string | null;
  locationSource?: "APPLE_MAPS" | null;
  locationProviderId?: string | null;
  locationFormattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Prisma.JsonValue | null;
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
  indoor?: boolean | null;
  displayOrder?: number | null;
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
  { value: "AMERICANO", label: "Americano" },
  { value: "MEXICANO", label: "Mexicano" },
];

const ELIGIBILITY_OPTIONS = [
  { value: "OPEN", label: "Aberto" },
  { value: "MALE_ONLY", label: "Masculino" },
  { value: "FEMALE_ONLY", label: "Feminino" },
  { value: "MIXED", label: "Mistos" },
];

const TIMEZONE_OPTIONS = [
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Africa/Maputo",
];

const asNumber = (value: string) => {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatDateTimeLocal = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
};

const parseDateTimeLocal = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoFromLocalInput = (value: string) => {
  const date = parseDateTimeLocal(value);
  return date ? date.toISOString() : null;
};

const shiftDateTimeLocal = (value: string, minutes: number) => {
  const date = parseDateTimeLocal(value);
  if (!date) return "";
  const shifted = new Date(date.getTime() + minutes * 60 * 1000);
  return formatDateTimeLocal(shifted);
};

function resolveClubLocation(club: PadelClub | null) {
  if (!club) {
    return {
      formatted: "",
      addressId: null,
    };
  }
  const formatted =
    club.addressRef?.formattedAddress ||
    club.locationFormattedAddress ||
    "";
  return {
    formatted,
    addressId: club.addressId ?? null,
  };
}

export default function PadelTournamentWizardClient({ organizationId }: { organizationId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("Torneio Padel");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState("Europe/Lisbon");
  const [registrationStartsAt, setRegistrationStartsAt] = useState("");
  const [registrationEndsAt, setRegistrationEndsAt] = useState("");
  const [scheduleWindowStart, setScheduleWindowStart] = useState("");
  const [scheduleWindowEnd, setScheduleWindowEnd] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [slotMinutes, setSlotMinutes] = useState("15");
  const [bufferMinutes, setBufferMinutes] = useState("5");
  const [minRestMinutes, setMinRestMinutes] = useState("10");
  const [schedulePriority, setSchedulePriority] = useState<"GROUPS_FIRST" | "KNOCKOUT_FIRST">("GROUPS_FIRST");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [format, setFormat] = useState<string>(PADEL_FORMATS[0]?.value ?? "TODOS_CONTRA_TODOS");
  const [eligibility, setEligibility] = useState<string>("OPEN");
  const [splitDeadlineHours, setSplitDeadlineHours] = useState<string>("48");
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [isInterclub, setIsInterclub] = useState(false);
  const [teamSize, setTeamSize] = useState("4");
  const [ruleSetId, setRuleSetId] = useState<string>("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, CategoryDraft>>({});
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [useAllCourts, setUseAllCourts] = useState(true);
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [savingMode, setSavingMode] = useState<"DRAFT" | "PUBLISH" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftEventId, setDraftEventId] = useState<number | null>(null);
  const saving = savingMode !== null;

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

  useEffect(() => {
    if (typeof Intl === "undefined") return;
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && timezone === "Europe/Lisbon") {
      setTimezone(resolved);
    }
    // run once to avoid overriding manual changes
  }, []);

  useEffect(() => {
    if (!registrationStartsAt) {
      const now = formatDateTimeLocal(new Date());
      if (now) setRegistrationStartsAt(now);
    }
    // run once to preserve manual clears
  }, []);

  useEffect(() => {
    if (!startsAt) return;
    if (!endsAt) {
      const shifted = shiftDateTimeLocal(startsAt, 5 * 60);
      if (shifted) setEndsAt(shifted);
    }
    if (!registrationEndsAt) {
      const shifted = shiftDateTimeLocal(startsAt, -24 * 60);
      if (shifted) setRegistrationEndsAt(shifted);
    }
    if (!scheduleWindowStart) {
      setScheduleWindowStart(startsAt);
    }
    if (!scheduleWindowEnd) {
      setScheduleWindowEnd(endsAt || startsAt);
    }
  }, [startsAt, endsAt, registrationEndsAt, scheduleWindowStart, scheduleWindowEnd]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === Number(selectedClubId)) ?? null,
    [clubs, selectedClubId],
  );
  const location = useMemo(() => resolveClubLocation(selectedClub), [selectedClub]);

  const selectedCategories = useMemo(
    () => categories.filter((cat) => categoryDrafts[cat.id]?.selected),
    [categories, categoryDrafts],
  );

  const activeCourts = useMemo(() => courts.filter((court) => court.isActive), [courts]);
  const resolvedCourts = useMemo(() => {
    if (useAllCourts) return activeCourts;
    const selected = new Set(selectedCourtIds);
    return activeCourts.filter((court) => selected.has(court.id));
  }, [activeCourts, selectedCourtIds, useAllCourts]);
  const courtsCount = resolvedCourts.length;

  const registrationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const regStart = parseDateTimeLocal(registrationStartsAt);
    const regEnd = parseDateTimeLocal(registrationEndsAt);
    const eventStart = parseDateTimeLocal(startsAt);
    if (regStart && regEnd && regStart >= regEnd) {
      warnings.push("A janela de inscrições começa depois do fim.");
    }
    if (regEnd && eventStart && regEnd >= eventStart) {
      warnings.push("O fim das inscrições precisa de ser antes do início do torneio.");
    }
    return warnings;
  }, [registrationStartsAt, registrationEndsAt, startsAt]);

  const scheduleWarnings = useMemo(() => {
    const warnings: string[] = [];
    const windowStart = parseDateTimeLocal(scheduleWindowStart || startsAt);
    const windowEnd = parseDateTimeLocal(scheduleWindowEnd || endsAt || startsAt);
    if (windowStart && windowEnd && windowStart >= windowEnd) {
      warnings.push("A janela de calendário termina antes do início.");
    }
    return warnings;
  }, [scheduleWindowStart, scheduleWindowEnd, startsAt, endsAt]);

  const capacityWarnings = useMemo(() => {
    const windowStart = parseDateTimeLocal(scheduleWindowStart || startsAt);
    const windowEnd = parseDateTimeLocal(scheduleWindowEnd || endsAt || startsAt);
    if (!windowStart || !windowEnd || windowEnd <= windowStart) return null;
    const duration = asNumber(durationMinutes) ?? 60;
    const buffer = asNumber(bufferMinutes) ?? 5;
    const courts = Math.max(1, courtsCount || 1);
    const totalSlots = computeMatchSlots({
      start: windowStart,
      end: windowEnd,
      courts,
      durationMinutes: duration,
      bufferMinutes: buffer,
    });
    if (!totalSlots || selectedCategories.length === 0) {
      return null;
    }
    const slotsPerCategory = Math.max(1, Math.floor(totalSlots / selectedCategories.length));
    const warnings = selectedCategories
      .map((category) => {
        const draft = categoryDrafts[category.id];
        const capacity = asNumber(draft?.capacityTeams ?? "") ?? null;
        if (!capacity || capacity <= 0) return null;
        const formatValue = draft?.format || format;
        const recommended = estimateMaxTeamsForSlots({
          format: formatValue,
          totalSlots: slotsPerCategory,
        });
        if (recommended && capacity > recommended) {
          return {
            categoryId: category.id,
            label: category.label,
            capacity,
            recommended,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ categoryId: number; label: string; capacity: number; recommended: number }>;
    return { totalSlots, slotsPerCategory, warnings, courts };
  }, [
    scheduleWindowStart,
    scheduleWindowEnd,
    startsAt,
    endsAt,
    durationMinutes,
    bufferMinutes,
    courtsCount,
    selectedCategories,
    categoryDrafts,
    format,
  ]);

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

  const handleSubmit = async (mode: "DRAFT" | "PUBLISH") => {
    setError(null);
    setDraftEventId(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Indica o título do torneio.");
      return;
    }
    if (!startsAt) {
      setError("Indica a data/hora de início.");
      return;
    }
    if (!endsAt) {
      setError("Indica a data/hora de fim.");
      return;
    }
    if (startsAt && endsAt) {
      const startDate = parseDateTimeLocal(startsAt);
      const endDate = parseDateTimeLocal(endsAt);
      if (startDate && endDate && endDate <= startDate) {
        setError("A data/hora de fim tem de ser depois do início.");
        return;
      }
    }
    const clubIdValue = Number(selectedClubId);
    if (!Number.isFinite(clubIdValue) || clubIdValue <= 0) {
      setError("Seleciona um clube.");
      return;
    }
    if (mode === "PUBLISH" && selectedCategories.length === 0) {
      setError("Seleciona pelo menos uma categoria para publicar.");
      return;
    }
    if (!location.addressId) {
      setError("A morada do clube precisa de estar normalizada (Apple Maps).");
      return;
    }
    if (mode === "PUBLISH" && registrationWarnings.length > 0) {
      setError(registrationWarnings[0]);
      return;
    }
    if (mode === "PUBLISH" && scheduleWarnings.length > 0) {
      setError(scheduleWarnings[0]);
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
    const scheduleDuration = asNumber(durationMinutes) ?? 60;
    const scheduleSlot = asNumber(slotMinutes) ?? 15;
    const scheduleBuffer = asNumber(bufferMinutes) ?? 5;
    const scheduleRest = asNumber(minRestMinutes) ?? 10;
    const numberOfCourts = Math.max(1, courtsCount || 1);
    const courtIdsPayload = useAllCourts ? activeCourts.map((court) => court.id) : selectedCourtIds;
    const courtsFromClubs = (resolvedCourts.length > 0 ? resolvedCourts : activeCourts).map((court, idx) => ({
      id: court.id,
      clubId: clubIdValue,
      clubName: selectedClub?.name ?? null,
      name: court.name,
      indoor: court.indoor ?? null,
      displayOrder: typeof court.displayOrder === "number" ? court.displayOrder : idx,
    }));

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      startsAt,
      endsAt: endsAt || shiftDateTimeLocal(startsAt, 5 * 60) || startsAt,
      status: "DRAFT",
      timezone: timezone || undefined,
      addressId: location.addressId,
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
        courtIds: courtIdsPayload,
        numberOfCourts,
        padelV2Enabled: true,
        advancedSettings: {
          waitlistEnabled,
          registrationStartsAt: toIsoFromLocalInput(registrationStartsAt),
          registrationEndsAt: toIsoFromLocalInput(registrationEndsAt),
          gameDurationMinutes: Number.isFinite(scheduleDuration) ? Math.max(1, Math.round(scheduleDuration)) : null,
          scheduleDefaults: {
            windowStart: toIsoFromLocalInput(scheduleWindowStart),
            windowEnd: toIsoFromLocalInput(scheduleWindowEnd),
            durationMinutes: Number.isFinite(scheduleDuration) ? Math.max(1, Math.round(scheduleDuration)) : null,
            slotMinutes: Number.isFinite(scheduleSlot) ? Math.max(5, Math.round(scheduleSlot)) : null,
            bufferMinutes: Number.isFinite(scheduleBuffer) ? Math.max(0, Math.round(scheduleBuffer)) : null,
            minRestMinutes: Number.isFinite(scheduleRest) ? Math.max(0, Math.round(scheduleRest)) : null,
            priority: schedulePriority,
          },
          courtsFromClubs: courtsFromClubs.length > 0 ? courtsFromClubs : null,
        },
      },
    };

    if (mode === "PUBLISH" && capacityWarnings?.warnings?.length) {
      trackEvent("padel_capacity_warning", {
        title: trimmedTitle,
        totalSlots: capacityWarnings.totalSlots,
        slotsPerCategory: capacityWarnings.slotsPerCategory,
        courts: capacityWarnings.courts,
        warnings: capacityWarnings.warnings,
      });
    }

    setSavingMode(mode);
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
      if (!eventId) {
        router.push(appendOrganizationIdToHref("/organizacao/padel/torneios", organizationId));
        return;
      }

      if (mode === "PUBLISH") {
        const publishRes = await fetch("/api/padel/tournaments/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, nextStatus: "PUBLISHED" }),
        });
        const publishJson = await publishRes.json().catch(() => null);
        if (!publishRes.ok || publishJson?.ok === false) {
          const missing = Array.isArray(publishJson?.missing) ? publishJson.missing : [];
          const missingLabels: Record<string, string> = {
            PADEL_V2_DISABLED: "Padel V2 não ativo",
            FORMAT_MISSING: "Formato do torneio",
            CLUB_MISSING: "Clube",
            COURTS_MISSING: "Courts",
            CATEGORIES_MISSING: "Categorias",
            CATEGORY_PRICES_MISSING: "Preços por categoria",
            REGISTRATION_WINDOW_INVALID: "Janela de inscrições inválida",
            REGISTRATION_END_AFTER_START: "Fim das inscrições após início",
          };
          const missingLabel = missing.length
            ? missing.map((code: string) => missingLabels[code] || code).join(", ")
            : publishJson?.error || "Não foi possível publicar.";
          setError(`Publicação bloqueada: ${missingLabel}.`);
          setDraftEventId(eventId);
          return;
        }
      }

      router.push(appendOrganizationIdToHref(`/organizacao/padel/torneios/${eventId}`, organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar torneio.");
    } finally {
      setSavingMode(null);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] py-10 text-white">
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
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Inscrições & agenda</p>
            <p className="text-sm text-white/70">
              Define timezone, janela de inscrições e padrões para o calendário (auto-schedule).
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Timezone</span>
              <input
                list="padel-timezones"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Europe/Lisbon"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Inscrições abrem</span>
              <input
                type="datetime-local"
                value={registrationStartsAt}
                onChange={(e) => setRegistrationStartsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Inscrições fecham (T-24)</span>
              <input
                type="datetime-local"
                value={registrationEndsAt}
                onChange={(e) => setRegistrationEndsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>
          <datalist id="padel-timezones">
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={`tz-${tz}`} value={tz} />
            ))}
          </datalist>

          {registrationWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
              {registrationWarnings.map((warning) => (
                <p key={`reg-warning-${warning}`}>{warning}</p>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Janela calendário início</span>
              <input
                type="datetime-local"
                value={scheduleWindowStart}
                onChange={(e) => setScheduleWindowStart(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Janela calendário fim</span>
              <input
                type="datetime-local"
                value={scheduleWindowEnd}
                onChange={(e) => setScheduleWindowEnd(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Duração jogo (min)</span>
              <input
                type="number"
                min={10}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Slot (min)</span>
              <input
                type="number"
                min={5}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Buffer (min)</span>
              <input
                type="number"
                min={0}
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Descanso (min)</span>
              <input
                type="number"
                min={0}
                value={minRestMinutes}
                onChange={(e) => setMinRestMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Prioridade agenda</span>
              <select
                value={schedulePriority}
                onChange={(e) =>
                  setSchedulePriority(e.target.value === "KNOCKOUT_FIRST" ? "KNOCKOUT_FIRST" : "GROUPS_FIRST")
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="GROUPS_FIRST">Grupos primeiro</option>
                <option value="KNOCKOUT_FIRST">Eliminatórias primeiro</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
              />
              Waitlist ativa (quando não há vaga)
            </label>
          </div>

          {scheduleWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
              {scheduleWarnings.map((warning) => (
                <p key={`schedule-warning-${warning}`}>{warning}</p>
              ))}
            </div>
          )}

          {capacityWarnings && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
              <p className="font-semibold">Capacidade recomendada (estimativa)</p>
              <p>
                Com {capacityWarnings.courts} courts cabem ~{capacityWarnings.totalSlots} jogos na janela. Isso dá ~
                {capacityWarnings.slotsPerCategory} jogos por categoria.
              </p>
              {capacityWarnings.warnings.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {capacityWarnings.warnings.map((warning) => (
                    <p key={`cap-warning-${warning.categoryId}`}>
                      • {warning.label}: capacidade {warning.capacity} &gt; recomendado {warning.recommended}
                    </p>
                  ))}
                  <p className="mt-2 text-[11px] text-amber-200/80">Aviso apenas, não bloqueia publicação.</p>
                </div>
              ) : (
                <p className="mt-2 text-emerald-200/80">Capacidades dentro da recomendação.</p>
              )}
            </div>
          )}
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-[#0b1322] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Categorias</p>
              <p className="text-sm text-white/70">Configura níveis e preços por categoria.</p>
            </div>
            <Link
              href={appendOrganizationIdToHref(
                "/organizacao/padel/torneios?section=padel-tournaments&padel=manage",
                organizationId,
              )}
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

        {draftEventId && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Rascunho criado.{" "}
            <Link
              href={appendOrganizationIdToHref(`/organizacao/padel/torneios/${draftEventId}`, organizationId)}
              className="underline"
            >
              Abrir torneio
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("DRAFT")}
            disabled={saving}
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white shadow disabled:opacity-60"
          >
            {savingMode === "DRAFT" ? "A guardar…" : "Guardar rascunho"}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("PUBLISH")}
            disabled={saving}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow disabled:opacity-60"
          >
            {savingMode === "PUBLISH" ? "A publicar…" : "Publicar"}
          </button>
          <span className="text-[12px] text-white/60">Wizard dedicado a Padel. Sem bilhetes.</span>
        </div>
      </div>
    </div>
  );
}
