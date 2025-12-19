"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { FlowStickyFooter } from "@/app/components/flows/FlowStickyFooter";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { StepperDots, type WizardStep } from "@/components/organizador/eventos/wizard/StepperDots";
import { PT_CITIES, type PTCity } from "@/lib/constants/ptCities";

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
};

type ToastTone = "success" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

const DRAFT_KEY = "orya-organizer-new-event-draft";

const CATEGORY_OPTIONS = [
  {
    key: "padel",
    value: "SPORT",
    label: "Padel / Torneio",
    accent: "from-[#6BFFFF] to-[#22c55e]",
    copy: "Setup rápido com courts, rankings e lógica de torneio.",
    categories: ["DESPORTO"],
  },
  {
    key: "default",
    value: "OTHER",
    label: "Evento padrão",
    accent: "from-[#9ca3af] to-[#6b7280]",
    copy: "Fluxo base sem extras — serve para qualquer formato simples.",
    categories: ["FESTA"],
  },
] as const;

const DEFAULT_PLATFORM_FEE_BPS = 800; // 8%
const DEFAULT_PLATFORM_FEE_FIXED_CENTS = 30; // €0.30
const DEFAULT_STRIPE_FEE_BPS = 140; // 1.4%
const DEFAULT_STRIPE_FEE_FIXED_CENTS = 25; // €0.25

type PlatformFeeResponse =
  | {
      ok: true;
      orya: { feeBps: number; feeFixedCents: number };
      stripe: { feeBps: number; feeFixedCents: number; region: string };
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type StepKey = "preset" | "details" | "schedule" | "tickets" | "review";
type FieldKey =
  | "preset"
  | "title"
  | "description"
  | "startsAt"
  | "endsAt"
  | "locationName"
  | "locationCity"
  | "address"
  | "tickets";

type RecentVenuesResponse = {
  ok: boolean;
  items?: Array<{ name: string; city?: string | null }>;
};

type PadelClubSummary = {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
  isActive: boolean;
  courtsCount?: number | null;
};
type PadelCourtSummary = { id: number; name: string; isActive: boolean; displayOrder: number };
type PadelStaffSummary = { id: number; fullName?: string | null; email?: string | null; inheritToEvents?: boolean | null };

function computeFeePreview(
  priceEuro: number,
  mode: "ON_TOP" | "INCLUDED",
  platformFees: { feeBps: number; feeFixedCents: number },
  stripeFees: { feeBps: number; feeFixedCents: number },
) {
  const baseCents = Math.round(Math.max(0, priceEuro) * 100);
  const feeCents = Math.round((baseCents * platformFees.feeBps) / 10_000) + platformFees.feeFixedCents;

  if (mode === "ON_TOP") {
    const totalCliente = baseCents + feeCents;
    const stripeOnTotal = Math.round((totalCliente * stripeFees.feeBps) / 10_000) + stripeFees.feeFixedCents;
    const recebeOrganizador = Math.max(0, baseCents - stripeOnTotal);
    return { baseCents, feeCents, totalCliente, recebeOrganizador, stripeFeeCents: stripeOnTotal };
  }

  const totalCliente = baseCents;
  const stripeOnBase = Math.round((totalCliente * stripeFees.feeBps) / 10_000) + stripeFees.feeFixedCents;
  const recebeOrganizador = Math.max(0, baseCents - feeCents - stripeOnBase);
  return { baseCents, feeCents, totalCliente, recebeOrganizador, stripeFeeCents: stripeOnBase };
}

export default function NewOrganizerEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const { data: platformFeeData } = useSWR<PlatformFeeResponse>("/api/platform/fees", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: organizerStatus } = useSWR<{
    ok?: boolean;
    organizer?: {
      id?: number | null;
      status?: string | null;
      officialEmail?: string | null;
      officialEmailVerifiedAt?: string | null;
    } | null;
    membershipRole?: string | null;
    paymentsStatus?: string;
    profileStatus?: string;
  }>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState<PTCity>(PT_CITIES[0]);
  const [locationManuallySet, setLocationManuallySet] = useState(false);
  const [address, setAddress] = useState("");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([{ name: "Geral", price: "", totalQuantity: "" }]);
  const [feeMode, setFeeMode] = useState<"ON_TOP" | "INCLUDED">("ON_TOP");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isFreeEvent, setIsFreeEvent] = useState(false);
  const [freeTicketName, setFreeTicketName] = useState("Inscrição");
  const [freeCapacity, setFreeCapacity] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [selectedPadelClubId, setSelectedPadelClubId] = useState<number | null>(null);
  const [selectedPadelCourtIds, setSelectedPadelCourtIds] = useState<number[]>([]);
  const [selectedPadelStaffIds, setSelectedPadelStaffIds] = useState<number[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripeAlert, setStripeAlert] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [backendAlert, setBackendAlert] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [errorSummary, setErrorSummary] = useState<{ field: FieldKey; message: string }[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [pendingFocusField, setPendingFocusField] = useState<FieldKey | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<{ eventId?: number; slug?: string } | null>(null);
  const prevStepIndexRef = useRef(0);

  const ctaAlertRef = useRef<HTMLDivElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startsRef = useRef<HTMLDivElement | null>(null);
  const endsRef = useRef<HTMLDivElement | null>(null);
  const locationNameRef = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const ticketsRef = useRef<HTMLDivElement | null>(null);
  const suggestionBlurTimeout = useRef<NodeJS.Timeout | null>(null);

  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const isOrganizer =
    roles.includes("organizer") ||
    Boolean(organizerStatus?.organizer?.id) ||
    Boolean(organizerStatus?.membershipRole);
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const paymentsStatus = isAdmin ? "READY" : organizerStatus?.paymentsStatus ?? "NO_STRIPE";
  const platformFees =
    platformFeeData && platformFeeData.ok
      ? platformFeeData.orya
      : { feeBps: DEFAULT_PLATFORM_FEE_BPS, feeFixedCents: DEFAULT_PLATFORM_FEE_FIXED_CENTS };
  const stripeFees =
    platformFeeData && platformFeeData.ok
      ? platformFeeData.stripe
      : { feeBps: DEFAULT_STRIPE_FEE_BPS, feeFixedCents: DEFAULT_STRIPE_FEE_FIXED_CENTS, region: "UE" };
  const hasPaidTicket = useMemo(
    () => !isFreeEvent && ticketTypes.some((t) => Number(t.price.replace(",", ".")) > 0),
    [isFreeEvent, ticketTypes],
  );
  const organizerOfficialEmail =
    (organizerStatus?.organizer as { officialEmail?: string | null } | null)?.officialEmail ?? null;
  const organizerOfficialEmailVerified = Boolean(
    (organizerStatus?.organizer as { officialEmailVerifiedAt?: string | null } | null)?.officialEmailVerifiedAt,
  );
  const needsOfficialEmailVerification = !isAdmin && (!organizerOfficialEmail || !organizerOfficialEmailVerified);
  const stripeNotReady = !isAdmin && paymentsStatus !== "READY";
  const paidTicketsBlocked = stripeNotReady || needsOfficialEmailVerification;
  const paidTicketsBlockedMessage = useMemo(() => {
    if (!paidTicketsBlocked) return null;
    const reasons: string[] = [];
    if (stripeNotReady) reasons.push("ligares o Stripe em Finanças & Payouts");
    if (needsOfficialEmailVerification) {
      reasons.push(
        organizerOfficialEmail
          ? "verificares o email oficial da organização em Definições"
          : "definires o email oficial da organização e o verificares em Definições",
      );
    }
    const reasonsText = reasons.join(" e ");
    return `Eventos pagos só ficam ativos depois de ${reasonsText}. Até lá podes criar eventos gratuitos (preço = 0 €).`;
  }, [paidTicketsBlocked, stripeNotReady, needsOfficialEmailVerification, organizerOfficialEmail]);

  const presetMap = useMemo(() => {
    const map = new Map<string, (typeof CATEGORY_OPTIONS)[number]>();
    CATEGORY_OPTIONS.forEach((opt) => map.set(opt.key, opt));
    return map;
  }, []);

  const { data: recentVenues } = useSWR<RecentVenuesResponse>(
    user ? `/api/organizador/venues/recent?q=${encodeURIComponent(locationName.trim())}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelClubs } = useSWR<{ ok: boolean; items?: PadelClubSummary[] }>(
    selectedPreset === "padel" ? "/api/padel/clubs" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelCourts } = useSWR<{ ok: boolean; items?: PadelCourtSummary[] }>(
    selectedPreset === "padel" && selectedPadelClubId ? `/api/padel/clubs/${selectedPadelClubId}/courts` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelStaff } = useSWR<{ ok: boolean; items?: PadelStaffSummary[] }>(
    selectedPreset === "padel" && selectedPadelClubId ? `/api/padel/clubs/${selectedPadelClubId}/staff` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (draftLoaded) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      setDraftLoaded(true);
      return;
    }
    try {
      const draft = JSON.parse(raw) as Partial<{
        title: string;
        description: string;
        startsAt: string;
        endsAt: string;
        locationName: string;
        locationCity: string;
        address: string;
        ticketTypes: TicketTypeRow[];
        feeMode: "ON_TOP" | "INCLUDED";
        coverUrl: string | null;
        selectedPreset: string | null;
        isFreeEvent: boolean;
        freeTicketName: string;
        freeCapacity: string;
        currentStep: number;
        maxStepReached: number;
        savedAt: number;
      }>;
      setTitle(draft.title ?? "");
      setDescription(draft.description ?? "");
      setStartsAt(draft.startsAt ?? "");
      setEndsAt(draft.endsAt ?? "");
      setLocationName(draft.locationName ?? "");
      setLocationCity(
        draft.locationCity && PT_CITIES.includes(draft.locationCity as PTCity)
          ? (draft.locationCity as PTCity)
          : PT_CITIES[0],
      );
      setAddress(draft.address ?? "");
      setTicketTypes(
        Array.isArray(draft.ticketTypes) && draft.ticketTypes.length > 0
          ? draft.ticketTypes
          : [{ name: "Geral", price: "", totalQuantity: "" }],
      );
      setFeeMode(draft.feeMode ?? "ON_TOP");
      setCoverUrl(draft.coverUrl ?? null);
      setSelectedPreset(draft.selectedPreset ?? null);
      setIsFreeEvent(Boolean(draft.isFreeEvent));
      setFreeTicketName(draft.freeTicketName || "Inscrição");
      setFreeCapacity(draft.freeCapacity || "");
      const draftCurrentStep =
        typeof draft.currentStep === "number" && Number.isFinite(draft.currentStep) ? draft.currentStep : 0;
      const draftMaxStep =
        typeof draft.maxStepReached === "number" && Number.isFinite(draft.maxStepReached)
          ? draft.maxStepReached
          : draftCurrentStep;
      setCurrentStep(Math.min(draftCurrentStep, 4));
      setMaxStepReached(Math.min(draftMaxStep, 4));
      setDraftSavedAt(draft.savedAt ?? null);
    } catch (err) {
      console.warn("Falha ao carregar rascunho local", err);
    } finally {
      setDraftLoaded(true);
    }
  }, [draftLoaded]);

  useEffect(() => {
    if (!draftLoaded) return;
    const typeParam = searchParams?.get("type");
    const keyParam = searchParams?.get("category") ?? searchParams?.get("preset");
    if (selectedPreset || (!typeParam && !keyParam)) return;
    const match = CATEGORY_OPTIONS.find((opt) => opt.value === typeParam || opt.key === keyParam);
    if (match) {
      setSelectedPreset(match.key);
    }
  }, [draftLoaded, searchParams, selectedPreset]);

  useEffect(() => {
    if (!isFreeEvent) return;
    setTicketTypes([
      {
        name: freeTicketName.trim() || "Inscrição",
        price: "0",
        totalQuantity: freeCapacity,
      },
    ]);
  }, [isFreeEvent, freeTicketName, freeCapacity]);

  useEffect(() => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
  }, [isFreeEvent]);

  useEffect(() => {
    if (selectedPreset !== "padel") {
      setSelectedPadelClubId(null);
      setSelectedPadelCourtIds([]);
      setSelectedPadelStaffIds([]);
      setLocationManuallySet(false);
      return;
    }
    if (padelClubs?.items && padelClubs.items.length > 0 && !selectedPadelClubId) {
      const firstActive = padelClubs.items.find((c) => c.isActive) ?? padelClubs.items[0];
      setSelectedPadelClubId(firstActive.id);
    }
  }, [selectedPreset, padelClubs, selectedPadelClubId]);

  useEffect(() => {
    if (!padelCourts?.items) return;
    const activeCourts = padelCourts.items.filter((c) => c.isActive).map((c) => c.id);
    if (activeCourts.length > 0) setSelectedPadelCourtIds(activeCourts);
  }, [padelCourts]);

  useEffect(() => {
    if (!padelStaff?.items) return;
    const inherited = padelStaff.items.filter((s) => s.inheritToEvents).map((s) => s.id);
    if (inherited.length > 0) setSelectedPadelStaffIds(inherited);
  }, [padelStaff]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    if (!selectedPadelClubId) return;
    const club = padelClubs?.items?.find((c) => c.id === selectedPadelClubId);
    if (!club) return;
    const composed = [club.address?.trim(), club.city?.trim()].filter(Boolean).join(", ");
    if (!locationManuallySet) {
      if (composed) setLocationName(composed);
      else if (!locationName) setLocationName(club.name ?? "");
    }
    if (club.city && PT_CITIES.includes(club.city as PTCity)) {
      // Preenche cidade a partir do clube, mas não sobrepõe escolha manual já feita.
      if (!locationManuallySet || !locationCity) {
        setLocationCity(club.city as PTCity);
      }
    }
  }, [selectedPreset, selectedPadelClubId, padelClubs?.items, locationManuallySet, locationName]);

  const stepOrder = useMemo<{ key: StepKey; title: string; subtitle: string }[]>(
    () => [
      { key: "preset", title: "Formato", subtitle: "Escolhe o tipo de evento" },
      { key: "details", title: "Essenciais", subtitle: "Imagem, título e descrição" },
      { key: "schedule", title: "Datas", subtitle: "Início, fim e local" },
      {
        key: "tickets",
        title: "Bilhetes",
        subtitle: isFreeEvent ? "Capacidade e vagas" : "Preços e stock",
      },
      { key: "review", title: "Rever", subtitle: "Confirma & cria" },
    ],
    [isFreeEvent],
  );

  const stepIndexMap = useMemo(() => {
    const map = new Map<StepKey, number>();
    stepOrder.forEach((step, idx) => map.set(step.key, idx));
    return map;
  }, [stepOrder]);
  const wizardSteps: WizardStep[] = useMemo(
    () => [
      { id: "formato", title: "Formato" },
      { id: "essenciais", title: "Essenciais" },
      { id: "datas_local", title: "Datas" },
      { id: "bilhetes", title: "Bilhetes" },
      { id: "revisao", title: "Rever" },
    ],
    [],
  );
  const stepIdByKey: Record<StepKey, WizardStep["id"]> = {
    preset: "formato",
    details: "essenciais",
    schedule: "datas_local",
    tickets: "bilhetes",
    review: "revisao",
  };
  const baseInputClasses =
    "w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/90 placeholder:text-white/45 outline-none transition backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.35)] focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)] focus:ring-offset-0 focus:ring-offset-transparent";
  const errorInputClasses =
    "border-[rgba(255,0,200,0.45)] focus:border-[rgba(255,0,200,0.6)] focus:ring-[rgba(255,0,200,0.4)]";
  const inputClass = (errored?: boolean) => `${baseInputClasses} ${errored ? errorInputClasses : ""}`;
  const labelClass =
    "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 flex items-center gap-1";
  const helperClass = "text-[12px] text-white/60 min-h-[18px]";
  const errorTextClass = "flex items-center gap-2 text-[12px] font-semibold text-pink-200 min-h-[18px]";
  const breadcrumbs = wizardSteps.map((s) => s.title).join(" · ");
  const dateOrderWarning = startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime();
  const currentStepLabel = wizardSteps[currentStep]?.title ?? "";

  const pushToast = (message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  };

  const saveDraft = () => {
    if (typeof window === "undefined") return;
    const payload = {
      title,
      description,
      startsAt,
      endsAt,
      locationName,
      locationCity,
      address,
      ticketTypes,
      feeMode,
      coverUrl,
      selectedPreset,
      isFreeEvent,
      freeTicketName,
      freeCapacity,
      currentStep,
      maxStepReached,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setDraftSavedAt(Date.now());
    pushToast("Rascunho guardado.", "success");
  };

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: "/organizador/(dashboard)/eventos/novo",
    });
  };

  const handleSelectPreset = (key: string) => {
    const preset = presetMap.get(key);
    if (!preset) return;
    setSelectedPreset(preset.key);
    setValidationAlert(null);
    setErrorMessage(null);
    clearErrorsForFields(["preset"]);
  };

  const handleSelectLocationSuggestion = (suggestion: { name: string; city?: string | null }) => {
    setLocationName(suggestion.name);
    if (suggestion.city && PT_CITIES.includes(suggestion.city as PTCity)) {
      setLocationCity(suggestion.city as PTCity);
    }
    setLocationManuallySet(true);
    clearErrorsForFields(["locationName", "locationCity"]);
    setShowLocationSuggestions(false);
  };

  const handleAddTicketType = () => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
    setTicketTypes((prev) => [...prev, { name: "", price: "", totalQuantity: "" }]);
  };

  const handleRemoveTicketType = (index: number) => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTicketChange = (index: number, field: keyof TicketTypeRow, value: string) => {
    setTicketTypes((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadingCover(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro no upload de capa", err);
      setErrorMessage("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const buildTicketsPayload = () => {
    if (isFreeEvent) {
      const totalQuantityRaw = freeCapacity ? Number(freeCapacity) : null;
      const parsedQuantity =
        typeof totalQuantityRaw === "number" && Number.isFinite(totalQuantityRaw) && totalQuantityRaw > 0
          ? totalQuantityRaw
          : null;
      return [
        {
          name: freeTicketName.trim() || "Inscrição",
          price: 0,
          totalQuantity: parsedQuantity,
        },
      ];
    }

    return ticketTypes
      .map((row) => {
        const parsedPrice = Number(row.price.replace(",", "."));
        const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
        return {
          name: row.name.trim(),
          price,
          totalQuantity: row.totalQuantity ? Number(row.totalQuantity) : null,
        };
      })
      .filter((t) => t.name);
  };

  const fieldsByStep: Record<StepKey, FieldKey[]> = {
    preset: ["preset"],
    details: ["title", "description"],
    schedule: ["startsAt", "endsAt", "locationName", "locationCity", "address"],
    tickets: ["tickets"],
    review: [],
  };

  function collectStepErrors(stepKey: StepKey | "all") {
    const keys = stepKey === "all" ? (["preset", "details", "schedule", "tickets"] as StepKey[]) : [stepKey];
    const issues: { field: FieldKey; message: string }[] = [];
    keys.forEach((key) => {
      if (key === "preset" && !selectedPreset) {
        issues.push({ field: "preset", message: "Escolhe um formato." });
      }
      if (key === "details") {
        if (!title.trim()) {
          issues.push({ field: "title", message: "Título obrigatório." });
        }
      }
      if (key === "schedule") {
        if (!startsAt) issues.push({ field: "startsAt", message: "Data/hora de início obrigatória." });
        if (!endsAt) issues.push({ field: "endsAt", message: "Data/hora de fim obrigatória." });
        if (!locationName.trim()) issues.push({ field: "locationName", message: "Local obrigatório." });
        if (!locationCity.trim()) issues.push({ field: "locationCity", message: "Cidade obrigatória." });
        if (endsAt && startsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
          issues.push({ field: "endsAt", message: "A data/hora de fim tem de ser depois do início." });
        }
      }
      if (key === "tickets") {
        const preparedTickets = buildTicketsPayload();
        if (preparedTickets.length === 0) {
          issues.push({ field: "tickets", message: "Adiciona pelo menos um bilhete ou inscrição." });
        }
        if (!isFreeEvent) {
          const hasNegativePrice = preparedTickets.some((t) => t.price < 0);
          const hasBelowMinimum = preparedTickets.some((t) => t.price >= 0 && t.price < 1);
          if (hasNegativePrice) {
            issues.push({ field: "tickets", message: "Preço tem de ser positivo." });
          }
          if (hasBelowMinimum) {
            issues.push({
              field: "tickets",
              message: "Para eventos pagos, cada bilhete tem de custar pelo menos 1 €.",
            });
          }
        }
        if (!isFreeEvent && hasPaidTicket && paidTicketsBlocked) {
          issues.push({
            field: "tickets",
            message:
              paidTicketsBlockedMessage ??
              "Liga o Stripe e verifica o email oficial da organização para vender bilhetes pagos.",
          });
        }
      }
    });
    return issues;
  }

  const fieldStepMap = useMemo<Record<FieldKey, StepKey>>(
    () => ({
      preset: "preset",
      title: "details",
      description: "details",
      startsAt: "schedule",
      endsAt: "schedule",
      locationName: "schedule",
      locationCity: "schedule",
      address: "schedule",
      tickets: "tickets",
    }),
    [],
  );

  function clearErrorsForFields(fields: FieldKey[]) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        delete next[field];
      });
      return next;
    });
    setErrorSummary((prev) => prev.filter((err) => !fields.includes(err.field)));
  }

  function applyErrors(errors: { field: FieldKey; message: string }[], focusSummary = true) {
    if (errors.length === 0) {
      setErrorSummary([]);
    } else {
      setErrorSummary(errors);
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      errors.forEach((err) => {
        next[err.field] = err.message;
      });
      return next;
    });
    if (errors.length > 0 && focusSummary) {
      setTimeout(() => {
        errorSummaryRef.current?.focus({ preventScroll: false });
      }, 40);
    }
  }

  const focusField = useCallback(
    (field: FieldKey) => {
      const targetStep = fieldStepMap[field];
      const targetStepIndex = stepIndexMap.get(targetStep);
      if (typeof targetStepIndex === "number" && targetStepIndex !== currentStep) {
        setCurrentStep(targetStepIndex);
        setMaxStepReached((prev) => Math.max(prev, targetStepIndex));
        setPendingFocusField(field);
        return;
      }

      const focusable =
        field === "title"
          ? titleRef.current
          : field === "startsAt"
          ? (startsRef.current?.querySelector("button") as HTMLElement | null)
          : field === "endsAt"
            ? (endsRef.current?.querySelector("button") as HTMLElement | null)
            : field === "locationName"
              ? locationNameRef.current
              : field === "locationCity"
                ? cityRef.current
                : field === "tickets"
                  ? (ticketsRef.current?.querySelector("input,button,select,textarea") as HTMLElement | null)
                  : null;

      if (focusable) {
        focusable.scrollIntoView({ behavior: "smooth", block: "center" });
        focusable.focus({ preventScroll: true });
      }
    },
    [currentStep, fieldStepMap, stepIndexMap],
  );

  useEffect(() => {
    if (!pendingFocusField) return;
    const expectedStep = fieldStepMap[pendingFocusField];
    const targetStepIndex = stepIndexMap.get(expectedStep);
    if (typeof targetStepIndex === "number" && targetStepIndex !== currentStep) return;
    focusField(pendingFocusField);
    setPendingFocusField(null);
  }, [pendingFocusField, currentStep, stepIndexMap, fieldStepMap, focusField]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isSubmitting) {
      timer = setTimeout(() => setShowLoadingHint(true), 750);
    } else {
      setShowLoadingHint(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSubmitting]);

  const activeStepKey = stepOrder[currentStep]?.key ?? "preset";
  const nextDisabledReason = (() => {
    const issues =
      activeStepKey === "review" ? collectStepErrors("all") : collectStepErrors(activeStepKey as StepKey);
    if (isSubmitting) return "A criar evento…";
    return issues[0]?.message ?? null;
  })();

  const currentWizardStepId = stepIdByKey[activeStepKey];
  const direction = currentStep >= prevStepIndexRef.current ? "right" : "left";
  useEffect(() => {
    prevStepIndexRef.current = currentStep;
  }, [currentStep]);

  const filteredLocationSuggestions = useMemo(() => {
    const items = recentVenues?.ok && Array.isArray(recentVenues.items) ? recentVenues.items : [];
    if (items.length === 0) return [];
    const term = `${locationName} ${locationCity}`.toLowerCase().trim();
    const filtered = items.filter((s) => `${s.name} ${s.city ?? ""}`.toLowerCase().includes(term));
    return (term ? filtered : items).slice(0, 8);
  }, [recentVenues, locationName, locationCity]);

  useEffect(() => {
    if (title.trim()) clearErrorsForFields(["title"]);
  }, [title]);

  useEffect(() => {
    if (startsAt) clearErrorsForFields(["startsAt"]);
  }, [startsAt]);

  useEffect(() => {
    if (locationName.trim()) clearErrorsForFields(["locationName"]);
  }, [locationName]);

  useEffect(() => {
    if (locationCity.trim()) clearErrorsForFields(["locationCity"]);
  }, [locationCity]);

  useEffect(() => {
    if (endsAt && startsAt && new Date(endsAt).getTime() > new Date(startsAt).getTime()) {
      clearErrorsForFields(["endsAt"]);
    }
  }, [endsAt, startsAt]);

  const FormAlert = ({
    variant,
    title: alertTitle,
    message,
    actionLabel,
    onAction,
  }: {
    variant: "error" | "warning" | "success";
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    const tones =
      variant === "error"
        ? "border-red-500/40 bg-red-500/10 text-red-100"
        : variant === "warning"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50";
    return (
      <div className={`rounded-md border px-4 py-3 text-sm ${tones}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            {alertTitle && <p className="font-semibold">{alertTitle}</p>}
            <p>{message}</p>
          </div>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold hover:bg-white/10"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  };

  const goNext = () => {
    const activeKey = stepOrder[currentStep]?.key;
    if (!activeKey) return;
    const issues = activeKey === "review" ? collectStepErrors("all") : collectStepErrors(activeKey as StepKey);
    const paidAlert = !isFreeEvent && hasPaidTicket && paidTicketsBlocked ? paidTicketsBlockedMessage : null;
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos em falta antes de continuar.");
      setErrorMessage(issues[0]?.message ?? null);
      setStripeAlert(paidAlert);
      return;
    }
    clearErrorsForFields(fieldsByStep[activeKey as StepKey]);
    setValidationAlert(null);
    setErrorMessage(null);
    setStripeAlert(null);
    setErrorSummary([]);
    if (currentStep >= stepOrder.length - 1) {
      handleSubmit();
      return;
    }
    setValidationAlert(null);
    setErrorMessage(null);
    setCurrentStep((s) => s + 1);
    setMaxStepReached((prev) => Math.max(prev, currentStep + 1));
  };

  const goPrev = () => {
    setValidationAlert(null);
    setErrorMessage(null);
    setErrorSummary([]);
    setStripeAlert(null);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async () => {
    setStripeAlert(null);
    setValidationAlert(null);
    setBackendAlert(null);
    setErrorMessage(null);

    const issues = collectStepErrors("all");
    const paidAlert = !isFreeEvent && hasPaidTicket && paidTicketsBlocked ? paidTicketsBlockedMessage : null;
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos em falta antes de criar o evento.");
      setErrorMessage(issues[0]?.message ?? null);
      setStripeAlert(paidAlert);
      return;
    }

    const preparedTickets = buildTicketsPayload();
    const scrollTo = (el?: HTMLElement | null) => el?.scrollIntoView({ behavior: "smooth", block: "center" });

    if (!user) {
      handleRequireLogin();
      return;
    }

    if (!isOrganizer) {
      setErrorMessage("Ainda não és organizador. Vai à área de organizador para ativares essa função.");
      return;
    }

    setIsSubmitting(true);

    try {
      const preset = selectedPreset ? presetMap.get(selectedPreset) : null;
      const categoriesToSend = preset?.categories ?? ["FESTA"];
      const templateToSend = preset?.value ?? "OTHER";
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      startsAt,
      endsAt,
        locationName: locationName.trim() || null,
        locationCity: locationCity.trim() || null,
        templateType: templateToSend,
        address: address.trim() || null,
        categories: categoriesToSend,
        ticketTypes: preparedTickets,
        coverImageUrl: coverUrl,
        feeMode,
        isTest: isAdmin ? isTest : undefined,
        padelConfig:
          selectedPreset === "padel"
            ? {
                clubId: selectedPadelClubId,
                courtIds: selectedPadelCourtIds,
                staffIds: selectedPadelStaffIds,
              }
            : undefined,
    };

      const res = await fetch("/api/organizador/events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao criar evento.");
      }

      const event = data.event;
      if (event?.id || event?.slug) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DRAFT_KEY);
        }
        setCreationSuccess({ eventId: event.id, slug: event.slug });
        setCurrentStep(stepOrder.length - 1);
        setMaxStepReached(stepOrder.length - 1);
        setErrorSummary([]);
        setFieldErrors({});
      }
    } catch (err) {
      console.error("Erro ao criar evento de organizador:", err);
      const message = err instanceof Error ? err.message : null;
      setBackendAlert(message || "Algo correu mal ao guardar o evento. Tenta novamente em segundos.");
      scrollTo(ctaAlertRef.current);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedPreset(null);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setLocationName("");
    setLocationCity(PT_CITIES[0]);
    setAddress("");
    setTicketTypes([{ name: "Geral", price: "", totalQuantity: "" }]);
    setIsFreeEvent(false);
    setFreeTicketName("Inscrição");
    setFreeCapacity("");
    setCoverUrl(null);
    setCreationSuccess(null);
    setCurrentStep(0);
    setMaxStepReached(0);
    setValidationAlert(null);
    setErrorMessage(null);
    setErrorSummary([]);
    setFieldErrors({});
    setStripeAlert(null);
    setBackendAlert(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  };

  if (isUserLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p>A carregar a tua conta…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p>Precisas de iniciar sessão para criar eventos como organizador.</p>
        <button
          type="button"
          onClick={handleRequireLogin}
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p>Ainda não és organizador. Vai à área de organizador para ativar essa função.</p>
        <Link
          href="/organizador"
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Ir para área de organizador
        </Link>
      </div>
    );
  }

  const renderPresetStep = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-white/75">Escolhe o formato. Padel ativa o wizard dedicado; Evento padrão é neutro.</p>
        <p className="text-[12px] text-white/55">Tudo segue a mesma linguagem visual.</p>
        {fieldErrors.preset && (
          <p className={errorTextClass}>
            <span aria-hidden>⚠️</span>
            {fieldErrors.preset}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORY_OPTIONS.map((opt) => {
          const isActive = selectedPreset === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelectPreset(opt.key)}
              className={`group flex flex-col items-start gap-2 rounded-2xl border border-white/12 bg-black/40 p-4 text-left transition hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${
                isActive ? "ring-2 ring-[#6BFFFF]/40 border-white/30" : ""
              }`}
            >
              <span
                className={`inline-flex items-center rounded-full bg-gradient-to-r ${opt.accent} px-3 py-1 text-[11px] font-semibold text-black shadow`}
              >
                {opt.label}
              </span>
              <p className="text-sm text-white/80">{opt.copy}</p>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                {opt.categories.length === 0 ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5">Personalizado</span>
                ) : (
                  opt.categories.map((cat) => (
                    <span key={cat} className="rounded-full border border-white/15 px-2 py-0.5">
                      {cat}
                    </span>
                  ))
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-4 animate-fade-slide">
      {isAdmin && (
        <label className="flex items-center gap-3 rounded-2xl border border-white/12 bg-black/30 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={isTest}
            onChange={(e) => setIsTest(e.target.checked)}
            className="h-4 w-4 rounded border-white/40 bg-transparent"
          />
          <span className="text-white/80">Evento de teste (visível só para admin, não aparece em explorar)</span>
        </label>
      )}

      <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 space-y-3 shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={labelClass}>Imagem de capa</p>
            <p className="text-[12px] text-white/65">Hero do evento — legível em mobile.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            {uploadingCover && <span className="animate-pulse text-white/70">A carregar…</span>}
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                className="rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10"
              >
                Remover
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-36 w-56 rounded-xl border border-white/15 bg-gradient-to-br from-[#12121f] via-[#0b0b18] to-[#1f1630] overflow-hidden flex items-center justify-center text-[11px] text-white/60">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white/55">Sem imagem</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[12px] text-white/60">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/25 px-3 py-1 hover:bg-white/10">
              <span>{coverUrl ? "Trocar imagem" : "Adicionar imagem"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-white/50">
              1200x630 recomendado
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className={labelClass}>
            Título <span aria-hidden>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            ref={titleRef}
            aria-invalid={Boolean(fieldErrors.title)}
            className={inputClass(Boolean(fieldErrors.title))}
            placeholder="Torneio Sunset Padel"
          />
          {fieldErrors.title && (
            <p className={errorTextClass}>
              <span aria-hidden>⚠️</span>
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className={labelClass}>Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputClass(false)}
            placeholder="Explica rapidamente o que torna o evento único."
          />
        </div>
      </div>
    </div>
  );

  const renderScheduleStep = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div ref={startsRef} className="space-y-1">
          <InlineDateTimePicker
            label="🗓️ Data/hora início *"
            value={startsAt}
            onChange={(v) => setStartsAt(v)}
            minDateTime={new Date()}
            required
          />
          {fieldErrors.startsAt && (
            <p className={errorTextClass}>
              <span aria-hidden>⚠️</span>
              {fieldErrors.startsAt}
            </p>
          )}
        </div>
        <div ref={endsRef} className="space-y-1">
          <InlineDateTimePicker
            label="⏱️ Data/hora fim *"
            value={endsAt}
            onChange={(v) => setEndsAt(v)}
            minDateTime={startsAt ? new Date(startsAt) : new Date()}
          />
          {fieldErrors.endsAt ? (
            <p className={errorTextClass}>
              <span aria-hidden>⚠️</span>
              {fieldErrors.endsAt}
            </p>
          ) : dateOrderWarning ? (
            <p className={errorTextClass}>
              <span aria-hidden>⚠️</span>Fim antes do início
            </p>
          ) : (
            <p className={helperClass}>Duração ajuda no planeamento de staff.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass} title="Nome do local ou clube.">
            📍 Local <span aria-hidden>*</span>
          </label>
          <div className="relative overflow-visible">
            <input
              type="text"
              value={locationName}
              onChange={(e) => {
                setLocationManuallySet(true);
                setLocationName(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => {
                if (suggestionBlurTimeout.current) clearTimeout(suggestionBlurTimeout.current);
                suggestionBlurTimeout.current = setTimeout(() => setShowLocationSuggestions(false), 120);
              }}
              ref={locationNameRef}
              aria-invalid={Boolean(fieldErrors.locationName)}
              className={inputClass(Boolean(fieldErrors.locationName))}
              placeholder="Clube, sala ou venue"
            />
            {showLocationSuggestions && (
              <div className="absolute left-0 right-0 z-[70] mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl animate-popover">
                {recentVenues === undefined ? (
                  <div className="px-3 py-2 text-sm text-white/70 animate-pulse">A procurar…</div>
                ) : filteredLocationSuggestions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-white/60">Sem locais recentes.</div>
                ) : (
                  filteredLocationSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.name}-${suggestion.city ?? "?"}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectLocationSuggestion(suggestion)}
                      className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="font-semibold text-white">{suggestion.name}</span>
                        <span className="text-[12px] text-white/65">{suggestion.city || "Cidade por definir"}</span>
                      </div>
                      <span className="text-[11px] text-white/50">Usado em eventos deste organizador</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {fieldErrors.locationName && (
            <p className={errorTextClass}>
              <span aria-hidden>⚠️</span>
              {fieldErrors.locationName}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className={labelClass} title="Escolhe a cidade para facilitar a procura.">
            🏙️ Cidade <span aria-hidden>*</span>
          </label>
          <select
            value={locationCity}
            onChange={(e) => {
              setLocationManuallySet(true);
              setLocationCity(e.target.value);
              setShowLocationSuggestions(true);
            }}
            ref={cityRef}
            aria-invalid={Boolean(fieldErrors.locationCity)}
            onFocus={() => setShowLocationSuggestions(true)}
            onBlur={() => {
              if (suggestionBlurTimeout.current) clearTimeout(suggestionBlurTimeout.current);
              suggestionBlurTimeout.current = setTimeout(() => setShowLocationSuggestions(false), 120);
            }}
            className={inputClass(Boolean(fieldErrors.locationCity))}
          >
            {PT_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        {fieldErrors.locationCity && (
          <p className={errorTextClass}>
            <span aria-hidden>⚠️</span>
            {fieldErrors.locationCity}
          </p>
        )}
        {!fieldErrors.locationCity && <p className="text-[12px] text-white/60">Usa a capital do concelho para pesquisa fácil.</p>}
      </div>
    </div>

    {selectedPreset === "padel" && (
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0c1224]/88 via-[#0a0f1d]/90 to-[#0b1224]/88 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-5 transition-all">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Wizard Padel avançado</p>
            <p className="text-[12px] text-white/70">
              Liga clube, courts e staff herdado sem sair do fluxo. Ajusta detalhes no hub sempre que precisares.
            </p>
          </div>
          <Link
            href="/organizador?tab=padel"
            className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:border-white/30 hover:bg-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
          >
            Abrir hub de Padel
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4 shadow-inner">
            <div className="flex items-center justify-between">
              <label className={`${labelClass} m-0`}>Clube</label>
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/65">
                Courts ativos: {padelCourts?.items?.filter((c) => c.isActive).length ?? "—"} · Selecionados: {selectedPadelCourtIds.length || "—"}
              </span>
            </div>
            <select
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
              value={selectedPadelClubId ?? ""}
              onChange={(e) => {
                setLocationManuallySet(false);
                setSelectedPadelClubId(Number(e.target.value) || null);
              }}
            >
              <option value="">Escolhe um clube</option>
              {(padelClubs?.items || [])
                .filter((c) => c.isActive)
                .map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} {club.city ? `— ${club.city}` : ""}
                  </option>
                ))}
            </select>
            {!padelClubs?.items?.length && (
              <p className="text-[12px] text-white/60">Adiciona um clube em Padel → Clubes para continuar.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Courts (ativos)</label>
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 max-h-56 overflow-auto space-y-2 shadow-inner">
              {(padelCourts?.items || [])
                .filter((c) => c.isActive)
                .map((ct) => {
                  const checked = selectedPadelCourtIds.includes(ct.id);
                  return (
                    <label
                      key={ct.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                        checked
                          ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
                          : "border-white/15 bg-black/30 text-white/80"
                      } transition hover:border-[var(--orya-cyan)]/50`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedPadelCourtIds((prev) =>
                            e.target.checked ? [...prev, ct.id] : prev.filter((id) => id !== ct.id),
                          )
                        }
                        className="accent-white"
                      />
                      <span>{ct.name}</span>
                      <span className="text-[10px] text-white/50">#{ct.displayOrder}</span>
                    </label>
                  );
                })}
              {!padelCourts?.items?.length && (
                <p className="text-[12px] text-white/60">Sem courts ativos neste clube.</p>
              )}
              {selectedPadelCourtIds.length === 0 && (padelCourts?.items?.length || 0) > 0 && (
                <p className="text-[11px] text-red-200">Seleciona pelo menos um court.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Staff herdado</label>
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 max-h-48 overflow-auto space-y-2 shadow-inner">
            {(padelStaff?.items || []).map((member) => {
              const checked = selectedPadelStaffIds.includes(member.id);
              return (
                <label
                  key={member.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                    checked ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50" : "border-white/15 bg-black/30 text-white/80"
                  } transition hover:border-[var(--orya-cyan)]/50`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSelectedPadelStaffIds((prev) =>
                        e.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                      )
                    }
                    className="accent-white"
                  />
                  <span>{member.fullName || member.email || "Staff"}</span>
                  {member.inheritToEvents && <span className="text-[10px] text-emerald-300">herdado</span>}
                </label>
              );
            })}
            {!padelStaff?.items?.length && (
              <p className="text-[12px] text-white/60">Sem staff para herdar. Adiciona em Padel → Clubes.</p>
            )}
          </div>
        </div>
      </div>
    )}

      <div className="space-y-1">
        <label className={labelClass}>Rua / morada (opcional)</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass(false)}
          placeholder="Rua, número ou complemento"
        />
      </div>
    </div>
  );

  const renderTicketsStep = () => (
    <div ref={ticketsRef} className="space-y-5 animate-fade-slide">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Modelo</p>
            <p className="text-[12px] text-white/65">Escolhe se é pago ou gratuito. Copy adapta-se.</p>
          </div>
          <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[13px]">
            <button
              type="button"
              onClick={() => setIsFreeEvent(false)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                !isFreeEvent ? "bg-white text-black shadow" : "text-white/70"
              }`}
            >
              Evento pago
            </button>
            <button
              type="button"
              onClick={() => setIsFreeEvent(true)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                isFreeEvent ? "bg-white text-black shadow" : "text-white/70"
              }`}
            >
              Evento grátis
            </button>
          </div>
        </div>
        <p className="text-[12px] text-white/55">
          Eventos pagos precisam de Stripe ligado e email oficial definido e verificado. Eventos grátis focam-se em inscrições e vagas.
        </p>
        {fieldErrors.tickets && (
          <p className={errorTextClass}>
            <span aria-hidden>⚠️</span>
            {fieldErrors.tickets}
          </p>
        )}
        {paidTicketsBlocked && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-[12px] text-amber-50 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden>⚠️</span>
              <span>Só podes criar eventos gratuitos para já</span>
            </div>
            <p className="text-amber-50/90">
              {paidTicketsBlockedMessage ??
                "Liga o Stripe e verifica o email oficial da organização para vender bilhetes pagos. Até lá, cria eventos gratuitos (preço = 0 €)."}
            </p>
            <div className="flex flex-wrap gap-2">
              {stripeNotReady && (
                <button
                  type="button"
                  onClick={() => router.push("/organizador?tab=finance")}
                  className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-white/10"
                >
                  Abrir Finanças & Payouts
                </button>
              )}
              {needsOfficialEmailVerification && (
                <button
                  type="button"
                  onClick={() => router.push("/organizador/settings")}
                  className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-amber-50 hover:bg-white/10"
                >
                  Definir / verificar email oficial
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isFreeEvent ? (
        <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1426]/65 to-[#050a14]/88 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between">
            <p className={labelClass}>Inscrições gratuitas</p>
            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[12px] text-emerald-50">
              Sem taxas
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClass}>Nome da inscrição</label>
              <input
                type="text"
                value={freeTicketName}
                onChange={(e) => setFreeTicketName(e.target.value)}
                className={inputClass(false)}
                placeholder="Inscrição geral, equipa…"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Capacidade (opcional)</label>
              <input
                type="number"
                min={0}
                value={freeCapacity}
                onChange={(e) => setFreeCapacity(e.target.value)}
                className={inputClass(false)}
                placeholder="Ex.: 64"
              />
            </div>
          </div>
          <p className="text-[12px] text-white/60">
            Só precisas disto para registar vagas. Podes abrir inscrições avançadas (equipas, rankings) no passo Padel.
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1426]/65 to-[#050a14]/88 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={labelClass}>Bilhetes</h2>
            <button
              type="button"
              onClick={handleAddTicketType}
              className="inline-flex items-center rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[13px] font-semibold hover:border-white/35 hover:bg-white/5 transition"
            >
              + Adicionar bilhete
            </button>
          </div>

          <div className="grid gap-3">
            {ticketTypes.map((row, idx) => {
              const parsed = Number((row.price ?? "0").toString().replace(",", "."));
              const priceEuro = Number.isFinite(parsed) ? parsed : 0;
              const preview = computeFeePreview(priceEuro, feeMode, platformFees, stripeFees);
              const combinedFeeCents = preview.feeCents + preview.stripeFeeCents;
              return (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1728]/60 to-[#050912]/85 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] animate-step-pop"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/75">
                      <span aria-hidden className="text-[#6BFFFF]">🎟️</span>
                      Bilhete {idx + 1}
                    </span>
                    {ticketTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTicketType(idx)}
                        className="text-[11px] text-white/60 hover:text-white/90"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 flex-1">
                      <label className={labelClass}>
                        Nome do bilhete <span aria-hidden>*</span>
                      </label>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleTicketChange(idx, "name", e.target.value)}
                        className={inputClass(false)}
                        placeholder="Early bird, Geral, VIP"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className={labelClass}>
                        Preço (€) <span aria-hidden>*</span>
                      </label>
                      <input
                        type="number"
                        min={isFreeEvent ? 0 : 1}
                        step="0.01"
                        value={row.price}
                        onChange={(e) => handleTicketChange(idx, "price", e.target.value)}
                        className={inputClass(false)}
                        placeholder="Ex.: 12.50"
                      />
                      <p className="text-[12px] text-white/55">Em eventos pagos, o preço mínimo é 1,00 €.</p>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Capacidade (opcional)</label>
                      <input
                        type="number"
                        min={0}
                        value={row.totalQuantity}
                        onChange={(e) => handleTicketChange(idx, "totalQuantity", e.target.value)}
                        className={inputClass(false)}
                        placeholder="Ex.: 100"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[12px] font-semibold text-white/75">Pré-visualização</p>
                      <div className="text-[12px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-white/85">
                        <p>Cliente: {(preview.totalCliente / 100).toFixed(2)} €</p>
                        <p>Recebes: {(preview.recebeOrganizador / 100).toFixed(2)} €</p>
                        <p className="text-white/50">Taxa ORYA: {(combinedFeeCents / 100).toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Modo de taxas</p>
            <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[13px]">
              <button
                type="button"
                onClick={() => setFeeMode("ON_TOP")}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  feeMode === "ON_TOP" ? "bg-white text-black shadow" : "text-white/70"
                }`}
              >
                Cliente paga taxa
              </button>
              <button
                type="button"
                onClick={() => setFeeMode("INCLUDED")}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  feeMode === "INCLUDED" ? "bg-white text-black shadow" : "text-white/70"
                }`}
              >
                Preço inclui taxas
              </button>
            </div>
            <p className="text-[12px] text-white/55">
              Podes ajustar depois no resumo. Para eventos de plataforma, a taxa ORYA é zero.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => {
    const previewTickets = buildTicketsPayload();
    const presetLabel = selectedPreset === "padel" ? "Padel / Torneio" : "Evento padrão";
    const presetDesc = selectedPreset === "padel" ? "Wizard Padel ativo" : "Fluxo base sem extras";
    const pendingIssues = collectStepErrors("all");
    const pendingLabel = pendingIssues.length === 0 ? "Campos ok" : `Falta corrigir ${pendingIssues.length}`;
    return (
      <div className="space-y-4 animate-fade-slide">
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1426]/65 to-[#050912]/88 p-4 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className={labelClass}>Revisão final</p>
              <p className="text-white/70 text-sm">Tudo pronto. Revê os detalhes antes de publicar.</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">Passo 5/5</span>
              <span className="btn-chip bg-white/10 text-white/90">{pendingLabel}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`${labelClass} gap-2`}>
                    <span aria-hidden className="text-[#6BFFFF]">✨</span>
                    Essenciais
                  </p>
                  <p className="font-semibold text-white">{title || "Sem título"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => focusField("title")}
                  className="btn-chip"
                >
                  Editar
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-16 w-24 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-[#161623] via-[#0c0c18] to-[#241836] text-[11px] text-white/60">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-white/60">
                      Sem imagem
                    </div>
                  )}
                </div>
                <p className="text-sm text-white/70 line-clamp-3">{description || "Sem descrição"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`${labelClass} gap-2`}>
                    <span aria-hidden className="text-[#AEE4FF]">📅</span>
                    Datas
                  </p>
                  <p className="font-semibold text-white">
                    {locationName || "Local a definir"} · {locationCity || "Cidade a definir"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => focusField("startsAt")}
                  className="btn-chip"
                >
                  Editar
                </button>
              </div>
              <p className="text-sm text-white/70">
                {startsAt ? new Date(startsAt).toLocaleString() : "Início por definir"}{" "}
                {endsAt ? `→ ${new Date(endsAt).toLocaleString()}` : ""}
              </p>
              {address && (
                <p className="text-[12px] text-white/60 flex items-center gap-2">
                  <span aria-hidden className="text-white/60">📍</span>
                  {address}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`${labelClass} gap-2`}>
                    <span aria-hidden className="text-[#6BFFFF]">🎟️</span>
                    Bilhetes
                  </p>
                  <p className="font-semibold text-white">
                    {isFreeEvent
                      ? `Vagas: ${freeCapacity ? freeCapacity : "sem limite"}`
                      : `${previewTickets.length} tipo${previewTickets.length === 1 ? "" : "s"} de bilhete`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => focusField("tickets")}
                  className="btn-chip"
                >
                  Editar
                </button>
              </div>
              {!isFreeEvent && (
                <ul className="mt-2 space-y-1 text-sm text-white/70">
                  {previewTickets.map((t) => (
                    <li key={`${t.name}-${t.price}`} className="flex items-center justify-between gap-2">
                      <span>{t.name}</span>
                      <span className="text-white/60">{t.price.toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
              {isFreeEvent && <p className="text-sm text-white/70">Entrada gratuita com inscrições simples.</p>}
            </div>

            <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1020]/65 to-[#060912]/85 p-3 shadow-[0_12px_38px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`${labelClass} gap-2`}>
                    <span aria-hidden className="text-[#AEE4FF]">🛡️</span>
                    Modelo
                  </p>
                  <p className="font-semibold text-white">{isFreeEvent ? "Evento grátis" : "Evento pago"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => focusField("preset")}
                  className="btn-chip"
                >
                  Editar
                </button>
              </div>
              <p className="text-sm text-white/70">Formato: {presetLabel}</p>
              <p className="text-[12px] text-white/60">{presetDesc}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        goNext();
      }}
      className="relative mx-auto max-w-5xl space-y-6 px-4 py-8 text-white md:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 p-5 shadow-[0_32px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_35%),linear-gradient(225deg,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
              <span aria-hidden className="text-[#6BFFFF]">✨</span>
              Novo evento
            </div>
            <h1 className="text-3xl font-semibold tracking-tight drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">Cria o teu evento</h1>
            <p className="text-sm text-white/70">Fluxo premium com autosave, feedback imediato e vidro colorido.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Link
              href="/organizador"
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/10"
            >
              Voltar
            </Link>
            <button
              type="button"
              onClick={saveDraft}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/10"
            >
              Guardar rascunho
            </button>
            {draftSavedAt && (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white/75">
                Guardado há pouco
              </span>
            )}
          </div>
        </div>
      </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b0f1f]/82 to-[#05070f]/94 p-5 md:p-6 space-y-6 shadow-[0_32px_110px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_32%),linear-gradient(240deg,rgba(255,255,255,0.06),transparent_36%)]" />
        <div className="relative pb-2">
          <StepperDots
            steps={wizardSteps}
            current={currentWizardStepId}
            maxUnlockedIndex={Math.max(maxStepReached, currentStep)}
            onGoTo={(id) => {
              const idx = wizardSteps.findIndex((s) => s.id === id);
              const maxClickable = Math.max(maxStepReached, currentStep);
              if (idx >= 0 && idx <= maxClickable) setCurrentStep(idx);
            }}
          />
        </div>

        {errorSummary.length > 0 && (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
            aria-live="assertive"
          >
            <div className="flex items-center gap-2 font-semibold">
              <span aria-hidden>⚠️</span>
              <span>Revê estes campos antes de continuar</span>
            </div>
            <ul className="mt-2 space-y-1 text-[13px]">
              {errorSummary.map((err) => (
                <li key={`${err.field}-${err.message}`}>
                  <button
                    type="button"
                    onClick={() => focusField(err.field)}
                    className="inline-flex items-center gap-2 text-left font-semibold text-white underline decoration-pink-200 underline-offset-4 hover:text-pink-50"
                  >
                    <span aria-hidden>↘</span>
                    <span>{err.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b1224]/70 to-[#04060f]/90 p-4 md:p-5 min-h-[420px] md:min-h-[460px] shadow-[0_18px_70px_rgba(0,0,0,0.5)]">
          <section
            key={activeStepKey}
            className={direction === "right" ? "wizard-step-in-right" : "wizard-step-in-left"}
          >
            {activeStepKey === "preset" && renderPresetStep()}
            {activeStepKey === "details" && renderDetailsStep()}
            {activeStepKey === "schedule" && renderScheduleStep()}
            {activeStepKey === "tickets" && renderTicketsStep()}
            {activeStepKey === "review" && renderReviewStep()}
          </section>
        </div>

        <div ref={ctaAlertRef} className="space-y-3">
          {stripeAlert && (
            <FormAlert
              variant={hasPaidTicket ? "error" : "warning"}
              title="Conclui os passos para vender"
              message={stripeAlert}
              actionLabel="Abrir Finanças & Payouts"
              onAction={() => router.push("/organizador?tab=finance")}
            />
          )}
          {validationAlert && <FormAlert variant="warning" message={validationAlert} />}
          {errorMessage && <FormAlert variant="error" message={errorMessage} />}
          {backendAlert && (
            <FormAlert
              variant="error"
              title="Algo correu mal ao guardar o evento"
              message={backendAlert}
            />
          )}
        </div>

        <FlowStickyFooter
          backLabel="Anterior"
          nextLabel={currentStep === stepOrder.length - 1 ? "Criar evento" : "Continuar"}
          helper={
            activeStepKey === "tickets"
              ? isFreeEvent
                ? "Inscrições sem taxas; capacidade é opcional."
                : paidTicketsBlocked
                  ? paidTicketsBlockedMessage ??
                    "Eventos pagos precisam de Stripe ligado e email oficial verificado."
                  : "Define preços, taxas e capacidade dos bilhetes."
              : activeStepKey === "review"
                ? "Confirma blocos, edita no passo certo e cria com confiança."
                : "Navega sem perder contexto; feedback sempre visível."
          }
          disabledReason={nextDisabledReason}
          loading={isSubmitting}
          loadingLabel={currentStep === stepOrder.length - 1 ? "A criar..." : "A processar..."}
          showLoadingHint={showLoadingHint}
          disableBack={currentStep === 0}
          onBack={goPrev}
          onNext={goNext}
        />
      </div>

      {creationSuccess && (
        <div className="fixed bottom-6 left-6 z-40 w-[320px] max-w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)] text-emerald-50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Evento criado</p>
              <p className="text-[13px] text-emerald-50/85">Escolhe o próximo passo ou cria outro.</p>
            </div>
            <button
              type="button"
              onClick={() => setCreationSuccess(null)}
              className="text-[12px] text-emerald-50/80 hover:text-white"
              aria-label="Fechar alerta de criação"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            {creationSuccess.slug && (
              <Link
                href={`/eventos/${creationSuccess.slug}`}
                className="rounded-full border border-emerald-200/60 bg-emerald-500/15 px-3 py-1 font-semibold text-white hover:bg-emerald-500/25"
              >
                Ver página pública
              </Link>
            )}
            {creationSuccess.eventId && (
              <Link
                href={`/organizador/eventos/${creationSuccess.eventId}`}
                className="rounded-full border border-emerald-200/60 bg-emerald-500/15 px-3 py-1 font-semibold text-white hover:bg-emerald-500/25"
              >
                Editar evento
              </Link>
            )}
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/25 px-3 py-1 font-semibold text-white hover:bg-white/10"
            >
              Criar outro
            </button>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto min-w-[240px] rounded-lg border px-4 py-3 text-sm shadow-lg ${
                toast.tone === "success"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50"
                  : "border-red-400/50 bg-red-500/15 text-red-50"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
