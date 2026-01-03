"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { PT_CITIES, type PTCity } from "@/lib/constants/ptCities";
import {
  getEventCoverSuggestionIds,
  getEventCoverUrl,
  listEventCoverFallbacks,
  parseEventCoverToken,
} from "@/lib/eventCover";
import { getOrganizationRoleFlags } from "@/lib/organizationUiPermissions";

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
  publicAccess?: boolean;
  participantAccess?: boolean;
};

type PublicAccessMode = "OPEN" | "TICKET" | "INVITE";
type ParticipantAccessMode = "NONE" | "TICKET" | "INSCRIPTION" | "INVITE";
type TicketScope = "ALL" | "SPECIFIC";
type LiveHubVisibility = "PUBLIC" | "PRIVATE" | "DISABLED";

const DRAFT_KEY = "orya-organization-new-event-draft";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
type FieldKey =
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

const normalizeIntegerInput = (value: string) => {
  const match = value.trim().match(/^\d+/);
  return match ? match[0] : "";
};

const formatShortDateTime = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateLabel = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  });
};

const formatTimeLabel = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatInputDate = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildLocalDateTime = (date: string, time: string) => {
  if (!date || !time) return "";
  return `${date}T${time}`;
};

export default function NewOrganizationEventPage() {
  const router = useRouter();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const { data: organizationStatus } = useSWR<{
    ok?: boolean;
    organization?: {
      id?: number | null;
      status?: string | null;
      officialEmail?: string | null;
      officialEmailVerifiedAt?: string | null;
      organizationCategory?: string | null;
    } | null;
    membershipRole?: string | null;
    paymentsStatus?: string;
    profileStatus?: string;
  }>(
    user ? "/api/organizacao/me" : null,
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
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showPadelModal, setShowPadelModal] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [coverSearch, setCoverSearch] = useState("");
  const [coverCategory, setCoverCategory] =
    useState<"SUGESTOES" | "ALL" | "EVENTOS" | "PADEL" | "RESERVAS" | "GERAL">("SUGESTOES");
  const [isFreeEvent, setIsFreeEvent] = useState(false);
  const [advancedAccessEnabled, setAdvancedAccessEnabled] = useState(false);
  const [publicAccessMode, setPublicAccessMode] = useState<PublicAccessMode>("OPEN");
  const [participantAccessMode, setParticipantAccessMode] = useState<ParticipantAccessMode>("NONE");
  const [publicTicketScope, setPublicTicketScope] = useState<TicketScope>("ALL");
  const [participantTicketScope, setParticipantTicketScope] = useState<TicketScope>("ALL");
  const [liveHubVisibility, setLiveHubVisibility] = useState<LiveHubVisibility>("PUBLIC");
  const [freeTicketName, setFreeTicketName] = useState("Inscrição");
  const [freeCapacity, setFreeCapacity] = useState("");
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [errorSummary, setErrorSummary] = useState<{ field: FieldKey; message: string }[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [pendingFocusField, setPendingFocusField] = useState<FieldKey | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<{ eventId?: number; slug?: string } | null>(null);

  const ctaAlertRef = useRef<HTMLDivElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const scheduleModalRef = useRef<HTMLDivElement | null>(null);
  const locationModalRef = useRef<HTMLDivElement | null>(null);
  const descriptionModalRef = useRef<HTMLDivElement | null>(null);
  const coverModalRef = useRef<HTMLDivElement | null>(null);
  const ticketsModalRef = useRef<HTMLDivElement | null>(null);
  const suggestionBlurTimeout = useRef<NodeJS.Timeout | null>(null);

  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const membershipRole = organizationStatus?.membershipRole ?? null;
  const roleFlags = useMemo(() => getOrganizationRoleFlags(membershipRole), [membershipRole]);
  const isOrganization =
    roles.includes("organization") ||
    Boolean(organizationStatus?.organization?.id) ||
    Boolean(organizationStatus?.membershipRole);
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const organizationCategory =
    (organizationStatus?.organization as { organizationCategory?: string | null } | null)?.organizationCategory ??
    null;
  const isPadelOrg = organizationCategory === "PADEL";
  const coverLibrary = useMemo(() => listEventCoverFallbacks(), []);
  const templateHint = selectedPreset === "padel" ? "PADEL" : "OTHER";
  const coverSuggestions = useMemo(
    () => getEventCoverSuggestionIds({ templateType: templateHint, organizationCategory }),
    [templateHint, organizationCategory],
  );
  const coverContextLabel =
    templateHint === "PADEL" ? "Padel" : organizationCategory === "RESERVAS" ? "Reservas" : "Eventos";
  const suggestedCovers = useMemo(
    () =>
      coverSuggestions
        .map((id) => coverLibrary.find((cover) => cover.id === id))
        .filter((cover): cover is (typeof coverLibrary)[number] => Boolean(cover)),
    [coverSuggestions, coverLibrary],
  );
  const coverCategoryOptions = [
    { value: "SUGESTOES", label: "Destaque" },
    { value: "EVENTOS", label: "Eventos" },
    { value: "PADEL", label: "Padel" },
    { value: "RESERVAS", label: "Reservas" },
    { value: "GERAL", label: "Geral" },
    { value: "ALL", label: "Todas" },
  ] as const;
  const coverCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      SUGESTOES: suggestedCovers.length,
      ALL: coverLibrary.length,
      EVENTOS: 0,
      PADEL: 0,
      RESERVAS: 0,
      GERAL: 0,
    };
    coverLibrary.forEach((cover) => {
      if (cover.category && counts[cover.category] !== undefined) {
        counts[cover.category] += 1;
      }
    });
    return counts;
  }, [coverLibrary, suggestedCovers.length]);
  const filteredCoverLibrary = useMemo(() => {
    const query = coverSearch.trim().toLowerCase();
    return coverLibrary.filter((cover) => {
      if (coverCategory === "SUGESTOES") return false;
      if (coverCategory !== "ALL" && cover.category !== coverCategory) return false;
      if (!query) return true;
      const labelMatch = cover.label.toLowerCase().includes(query);
      const tagMatch = (cover.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
      return labelMatch || tagMatch;
    });
  }, [coverCategory, coverLibrary, coverSearch]);
  const coverGridItems = coverCategory === "SUGESTOES" ? suggestedCovers : filteredCoverLibrary;
  const selectedCoverToken = parseEventCoverToken(coverUrl);
  const selectedCoverLabel = selectedCoverToken
    ? coverLibrary.find((cover) => cover.id === selectedCoverToken)?.label ?? selectedCoverToken
    : null;
  const coverPreviewUrl = coverUrl
    ? getEventCoverUrl(coverUrl, {
        seed: title.trim() || "novo-evento",
        suggestedIds: coverSuggestions,
        width: 1200,
        quality: 72,
        format: "webp",
      })
    : null;
  const hasActiveOrganization = Boolean(organizationStatus?.organization?.id);
  const organizationStatusValue = organizationStatus?.organization?.status ?? null;
  const organizationInactive = Boolean(organizationStatusValue && organizationStatusValue !== "ACTIVE");
  const canCreateEvents = Boolean(roleFlags?.canManageEvents);
  const paymentsStatus = isAdmin ? "READY" : organizationStatus?.paymentsStatus ?? "NO_STRIPE";
  const hasPaidTicket = useMemo(
    () => !isFreeEvent && ticketTypes.some((t) => Number(t.price.replace(",", ".")) > 0),
    [isFreeEvent, ticketTypes],
  );
  const publicAccessLabel =
    publicAccessMode === "OPEN" ? "Aberto" : publicAccessMode === "TICKET" ? "Por bilhete" : "Por convite";
  const participantAccessLabel =
    participantAccessMode === "NONE"
      ? "Sem participantes"
      : participantAccessMode === "TICKET"
        ? "Por bilhete"
        : participantAccessMode === "INSCRIPTION"
        ? "Por inscrição"
        : "Por convite";
  const publicAccessDescription =
    publicAccessMode === "OPEN"
      ? "Qualquer pessoa pode ver o evento e comprar bilhete/inscrever-se."
      : publicAccessMode === "TICKET"
        ? "Qualquer bilhete criado dá acesso ao público (podes refinar depois)."
        : "Apenas convidados conseguem aceder ao checkout e ao LiveHub.";
  const participantAccessDescription =
    participantAccessMode === "NONE"
      ? "Não existe distinção de participantes."
      : participantAccessMode === "INSCRIPTION"
        ? "Participantes são definidos por inscrição/torneio."
        : participantAccessMode === "TICKET"
          ? "Qualquer bilhete criado marca o utilizador como participante."
          : "Participantes são escolhidos por convite.";
  const organizationOfficialEmail =
    (organizationStatus?.organization as { officialEmail?: string | null } | null)?.officialEmail ?? null;
  const organizationOfficialEmailVerified = Boolean(
    (organizationStatus?.organization as { officialEmailVerifiedAt?: string | null } | null)?.officialEmailVerifiedAt,
  );
  const needsOfficialEmailVerification = !isAdmin && (!organizationOfficialEmail || !organizationOfficialEmailVerified);
  const stripeNotReady = !isAdmin && paymentsStatus !== "READY";
  const paidTicketsBlocked = stripeNotReady || needsOfficialEmailVerification;
  const paidTicketsBlockedMessage = useMemo(() => {
    if (!paidTicketsBlocked) return null;
    const reasons: string[] = [];
    if (stripeNotReady) reasons.push("ligares o Stripe em Finanças & Payouts");
    if (needsOfficialEmailVerification) {
      reasons.push(
        organizationOfficialEmail
          ? "verificares o email oficial da organização em Definições"
          : "definires o email oficial da organização e o verificares em Definições",
      );
    }
    const reasonsText = reasons.join(" e ");
    return `Eventos pagos só ficam ativos depois de ${reasonsText}. Até lá podes criar eventos gratuitos (preço = 0 €).`;
  }, [paidTicketsBlocked, stripeNotReady, needsOfficialEmailVerification, organizationOfficialEmail]);

  const accessBlocker = useMemo(() => {
    if (!user) return null;
    if (!organizationStatus) return "A carregar dados da organização…";
    if (!hasActiveOrganization) {
      return "Seleciona uma organização ativa antes de criares eventos.";
    }
    if (organizationInactive) {
      return "A tua organização ainda não está ativa.";
    }
    if (!canCreateEvents) {
      return "Sem permissões para criar eventos nesta organização.";
    }
    return null;
  }, [user, organizationStatus, hasActiveOrganization, organizationInactive, canCreateEvents]);

  useEffect(() => {
    if (advancedAccessEnabled) return;
    setPublicAccessMode("OPEN");
    setParticipantAccessMode("NONE");
    setPublicTicketScope("ALL");
    setParticipantTicketScope("ALL");
    setTicketTypes((prev) =>
      prev.map((row) => ({ ...row, publicAccess: undefined, participantAccess: undefined })),
    );
  }, [advancedAccessEnabled]);

  useEffect(() => {
    if (!advancedAccessEnabled) return;
    if (publicAccessMode !== "TICKET" || publicTicketScope !== "SPECIFIC") {
      setTicketTypes((prev) => prev.map((row) => ({ ...row, publicAccess: undefined })));
      return;
    }
    setTicketTypes((prev) =>
      prev.map((row) => ({ ...row, publicAccess: row.publicAccess ?? true })),
    );
  }, [advancedAccessEnabled, publicAccessMode, publicTicketScope]);

  useEffect(() => {
    if (!advancedAccessEnabled) return;
    if (participantAccessMode !== "TICKET" || participantTicketScope !== "SPECIFIC") {
      setTicketTypes((prev) => prev.map((row) => ({ ...row, participantAccess: undefined })));
      return;
    }
    setTicketTypes((prev) =>
      prev.map((row) => ({ ...row, participantAccess: row.participantAccess ?? true })),
    );
  }, [advancedAccessEnabled, participantAccessMode, participantTicketScope]);

  const { data: recentVenues } = useSWR<RecentVenuesResponse>(
    user ? `/api/organizacao/venues/recent?q=${encodeURIComponent(locationName.trim())}` : null,
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
        coverUrl: string | null;
        selectedPreset: string | null;
        isFreeEvent: boolean;
        advancedAccessEnabled: boolean;
        publicAccessMode: PublicAccessMode;
        participantAccessMode: ParticipantAccessMode;
        publicTicketScope: TicketScope;
        participantTicketScope: TicketScope;
        liveHubVisibility: LiveHubVisibility;
        freeTicketName: string;
        freeCapacity: string;
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
      const draftTicketTypes =
        Array.isArray(draft.ticketTypes) && draft.ticketTypes.length > 0
          ? draft.ticketTypes
          : [];
      setTicketTypes(
        draftTicketTypes.map((row) => ({
          ...row,
          totalQuantity: normalizeIntegerInput(
            typeof row.totalQuantity === "string" ? row.totalQuantity : String(row.totalQuantity ?? ""),
          ),
        })),
      );
      setCoverUrl(draft.coverUrl ?? null);
      setSelectedPreset(draft.selectedPreset ?? null);
      setIsFreeEvent(Boolean(draft.isFreeEvent));
      setAdvancedAccessEnabled(Boolean(draft.advancedAccessEnabled));
      setPublicAccessMode(draft.publicAccessMode ?? "OPEN");
      setParticipantAccessMode(draft.participantAccessMode ?? "NONE");
      setPublicTicketScope(draft.publicTicketScope ?? "ALL");
      setParticipantTicketScope(draft.participantTicketScope ?? "ALL");
      setLiveHubVisibility(draft.liveHubVisibility ?? "PUBLIC");
      setFreeTicketName(draft.freeTicketName || "Inscrição");
      setFreeCapacity(normalizeIntegerInput(draft.freeCapacity || ""));
    } catch (err) {
      console.warn("Falha ao carregar rascunho local", err);
    } finally {
      setDraftLoaded(true);
    }
  }, [draftLoaded]);

  useEffect(() => {
    if (!draftLoaded) return;
    const nextPreset = isPadelOrg ? "padel" : "default";
    if (selectedPreset !== nextPreset) {
      setSelectedPreset(nextPreset);
    }
  }, [draftLoaded, isPadelOrg, selectedPreset]);

  useEffect(() => {
    if (!draftLoaded || coverUrl || coverLibrary.length === 0) return;
    const randomCover = coverLibrary[Math.floor(Math.random() * coverLibrary.length)];
    if (randomCover?.token) {
      setCoverUrl(randomCover.token);
    }
  }, [coverLibrary, coverUrl, draftLoaded]);

  useEffect(() => {
    if (!startsAt) {
      setStartDateInput("");
      setStartTimeInput("");
      return;
    }
    const [date, time] = startsAt.split("T");
    setStartDateInput(date ?? "");
    setStartTimeInput(time ? time.slice(0, 5) : "");
  }, [startsAt]);

  useEffect(() => {
    if (!endsAt) {
      setEndDateInput("");
      setEndTimeInput("");
      return;
    }
    const [date, time] = endsAt.split("T");
    setEndDateInput(date ?? "");
    setEndTimeInput(time ? time.slice(0, 5) : "");
  }, [endsAt]);

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
      setShowPadelModal(false);
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

  const baseInputClasses =
    "w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/90 placeholder:text-white/45 outline-none transition backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.35)] focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)] focus:ring-offset-0 focus:ring-offset-transparent";
  const errorInputClasses =
    "border-[rgba(255,0,200,0.45)] focus:border-[rgba(255,0,200,0.6)] focus:ring-[rgba(255,0,200,0.4)]";
  const inputClass = (errored?: boolean) => `${baseInputClasses} ${errored ? errorInputClasses : ""}`;
  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 flex items-center gap-1";
  const errorTextClass = "flex items-center gap-2 text-[12px] font-semibold text-pink-200 min-h-[18px]";
  const dateOrderWarning = startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime();
  const selectedPadelClub =
    selectedPreset === "padel"
      ? padelClubs?.items?.find((c) => c.id === selectedPadelClubId) ?? null
      : null;

  const padelExtrasContent =
    selectedPreset === "padel" ? (
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0c1224]/88 via-[#0a0f1d]/90 to-[#0b1224]/88 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-5 transition-all">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Opções Padel</p>
            <p className="text-[12px] text-white/70">
              Liga clube, courts e staff herdado sem sair do fluxo. Ajusta detalhes no hub quando quiseres.
            </p>
          </div>
          <Link
            href="/organizacao?tab=manage&section=padel-hub"
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
    ) : null;

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: "/organizacao/(dashboard)/eventos/novo",
    });
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
    setTicketTypes((prev) => [
      ...prev,
      {
        name: "",
        price: "",
        totalQuantity: "",
        publicAccess:
          advancedAccessEnabled && publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC"
            ? true
            : undefined,
        participantAccess:
          advancedAccessEnabled && participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC"
            ? true
            : undefined,
      },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTicketChange = (index: number, field: keyof TicketTypeRow, value: string) => {
    const nextValue = field === "totalQuantity" ? normalizeIntegerInput(value) : value;
    setTicketTypes((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: nextValue } : row)));
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
  };

  const toggleTicketFlag = (index: number, field: "publicAccess" | "participantAccess") => {
    setTicketTypes((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: !row[field] } : row)),
    );
  };

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploadingCover(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/upload?scope=event-cover", {
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

  const handleCoverCropCancel = () => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
  };

  const handleCoverCropConfirm = async (file: File) => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
    await uploadCoverFile(file);
  };

  const buildTicketsPayload = () => {
    if (isFreeEvent) {
      const totalQuantityRaw = freeCapacity ? Number(freeCapacity) : null;
      const parsedQuantity =
        typeof totalQuantityRaw === "number" && Number.isFinite(totalQuantityRaw) && totalQuantityRaw > 0
          ? Math.floor(totalQuantityRaw)
          : null;
      return [
        {
          name: freeTicketName.trim() || "Inscrição",
          price: 0,
          totalQuantity: parsedQuantity,
          publicAccess:
            advancedAccessEnabled &&
            publicAccessMode === "TICKET" &&
            publicTicketScope === "SPECIFIC"
              ? true
              : undefined,
          participantAccess:
            advancedAccessEnabled &&
            participantAccessMode === "TICKET" &&
            participantTicketScope === "SPECIFIC"
              ? true
              : undefined,
        },
      ];
    }

    return ticketTypes
      .map((row) => {
        const parsedPrice = Number(row.price.replace(",", "."));
        const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
        const totalQuantityRaw = row.totalQuantity ? Number(row.totalQuantity) : null;
        const totalQuantity =
          typeof totalQuantityRaw === "number" && Number.isFinite(totalQuantityRaw) && totalQuantityRaw > 0
            ? Math.floor(totalQuantityRaw)
            : null;
        return {
          name: row.name.trim(),
          price,
          totalQuantity,
          publicAccess:
            advancedAccessEnabled &&
            publicAccessMode === "TICKET" &&
            publicTicketScope === "SPECIFIC"
              ? Boolean(row.publicAccess)
              : undefined,
          participantAccess:
            advancedAccessEnabled &&
            participantAccessMode === "TICKET" &&
            participantTicketScope === "SPECIFIC"
              ? Boolean(row.participantAccess)
              : undefined,
        };
      })
      .filter((t) => t.name);
  };

  const preparedTickets = useMemo(
    () => buildTicketsPayload(),
    [
      isFreeEvent,
      freeTicketName,
      freeCapacity,
      ticketTypes,
      advancedAccessEnabled,
      publicAccessMode,
      participantAccessMode,
      publicTicketScope,
      participantTicketScope,
    ],
  );

  const accessNotes = useMemo(() => {
    const notes: string[] = [];
    if (!advancedAccessEnabled) {
      return notes;
    }
    if (publicAccessMode === "TICKET" && preparedTickets.length === 0) {
      notes.push("Define pelo menos um bilhete para controlar o acesso do público.");
    }
    if (participantAccessMode === "TICKET" && preparedTickets.length === 0) {
      notes.push("Define bilhetes para marcar participantes.");
    }
    if (publicAccessMode === "INVITE" || participantAccessMode === "INVITE") {
      notes.push("Convites são adicionados depois de criares o evento.");
    }
    return notes;
  }, [advancedAccessEnabled, publicAccessMode, participantAccessMode, preparedTickets.length]);

  const ticketsSummary = useMemo(() => {
    if (preparedTickets.length === 0) {
      return "Sem bilhetes (entrada gratuita automática)";
    }
    if (isFreeEvent) {
      const cap = freeCapacity ? `${freeCapacity} vagas` : "Sem limite";
      return `Grátis · ${cap}`;
    }
    const minPrice = Math.min(...preparedTickets.map((t) => t.price));
    const countLabel = `${preparedTickets.length} bilhete${preparedTickets.length === 1 ? "" : "s"}`;
    return `${countLabel} · desde ${minPrice.toFixed(2)} €`;
  }, [preparedTickets, isFreeEvent, freeCapacity]);

  const accessSummary = advancedAccessEnabled
    ? `${publicAccessLabel} · ${participantAccessLabel}`
    : "Simples (público aberto)";
  const liveHubSummary =
    liveHubVisibility === "PUBLIC"
      ? "LiveHub público"
      : liveHubVisibility === "PRIVATE"
        ? "LiveHub privado"
        : "LiveHub desativado";
  const scheduleSummary = useMemo(() => {
    if (!startsAt) return "Definir data e hora";
    const startLabel = formatShortDateTime(startsAt);
    if (!endsAt) return startLabel;
    const endLabel = formatShortDateTime(endsAt);
    return `${startLabel} → ${endLabel}`;
  }, [startsAt, endsAt]);
  const locationSummary = useMemo(() => {
    const parts = [locationName.trim(), locationCity.trim(), address.trim()].filter(Boolean);
    if (parts.length === 0) return "Adicionar localização";
    return parts.join(" · ");
  }, [locationName, locationCity, address]);
  const descriptionSummary = useMemo(() => {
    const trimmed = description.trim();
    if (!trimmed) return "Adicionar descrição";
    const short = trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
    return short;
  }, [description]);
  const scheduleError = fieldErrors.startsAt ?? fieldErrors.endsAt ?? (dateOrderWarning ? "Fim antes do início." : null);
  const locationError = fieldErrors.locationCity ?? fieldErrors.locationName ?? null;

  function collectFormErrors() {
    const issues: { field: FieldKey; message: string }[] = [];
    if (!title.trim()) {
      issues.push({ field: "title", message: "Título obrigatório." });
    }
    if (!startsAt) {
      issues.push({ field: "startsAt", message: "Data/hora de início obrigatória." });
    }
    if (!locationCity.trim()) {
      issues.push({ field: "locationCity", message: "Cidade obrigatória." });
    }
    if (endsAt && startsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      issues.push({ field: "endsAt", message: "A data/hora de fim tem de ser depois do início." });
    }

    const currentTickets = buildTicketsPayload();
    if (advancedAccessEnabled && publicAccessMode === "TICKET" && currentTickets.length === 0) {
      issues.push({ field: "tickets", message: "Define bilhetes para controlar o acesso do público." });
    }
    if (advancedAccessEnabled && participantAccessMode === "TICKET" && currentTickets.length === 0) {
      issues.push({ field: "tickets", message: "Define bilhetes para marcar participantes." });
    }
    if (
      advancedAccessEnabled &&
      publicAccessMode === "TICKET" &&
      publicTicketScope === "SPECIFIC" &&
      !currentTickets.some((t) => t.publicAccess)
    ) {
      issues.push({ field: "tickets", message: "Seleciona pelo menos um bilhete para o público." });
    }
    if (
      advancedAccessEnabled &&
      participantAccessMode === "TICKET" &&
      participantTicketScope === "SPECIFIC" &&
      !currentTickets.some((t) => t.participantAccess)
    ) {
      issues.push({ field: "tickets", message: "Seleciona pelo menos um bilhete para participantes." });
    }

    if (currentTickets.length > 0) {
      if (!isFreeEvent) {
        const hasNegativePrice = currentTickets.some((t) => t.price < 0);
        const hasBelowMinimum = currentTickets.some((t) => t.price >= 0 && t.price < 1);
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

    return issues;
  }

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

  const focusField = useCallback((field: FieldKey) => {
    if (field === "tickets") {
      setShowTicketsModal(true);
      setPendingFocusField(field);
      return;
    }
    if (field === "description") {
      setShowDescriptionModal(true);
      setPendingFocusField(field);
      return;
    }
    if (field === "startsAt" || field === "endsAt") {
      setShowScheduleModal(true);
      setPendingFocusField(field);
      return;
    }
    if (field === "locationName" || field === "locationCity" || field === "address") {
      setShowLocationModal(true);
      setPendingFocusField(field);
      return;
    }
    if (field === "title") {
      if (titleRef.current) {
        titleRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        titleRef.current.focus({ preventScroll: true });
      }
    }
  }, []);

  useEffect(() => {
    if (!pendingFocusField) return;

    if (pendingFocusField === "tickets" && showTicketsModal) {
      const focusable = ticketsModalRef.current?.querySelector("input,button,select,textarea") as HTMLElement | null;
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
      setPendingFocusField(null);
      return;
    }

    if ((pendingFocusField === "startsAt" || pendingFocusField === "endsAt") && showScheduleModal) {
      const container = scheduleModalRef.current?.querySelector(`[data-field="${pendingFocusField}"]`);
      const focusable = container?.querySelector("input,button,select,textarea") as HTMLElement | null;
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
      setPendingFocusField(null);
      return;
    }

    if (
      (pendingFocusField === "locationName" ||
        pendingFocusField === "locationCity" ||
        pendingFocusField === "address") &&
      showLocationModal
    ) {
      const container = locationModalRef.current?.querySelector(`[data-field="${pendingFocusField}"]`);
      const focusable = container?.querySelector("input,button,select,textarea") as HTMLElement | null;
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
      setPendingFocusField(null);
      return;
    }

    if (pendingFocusField === "description" && showDescriptionModal) {
      const focusable = descriptionModalRef.current?.querySelector("textarea,input,button,select") as HTMLElement | null;
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
      setPendingFocusField(null);
    }
  }, [
    pendingFocusField,
    showTicketsModal,
    showScheduleModal,
    showLocationModal,
    showDescriptionModal,
  ]);

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

  const submitDisabledReason = (() => {
    if (isSubmitting) return "A criar evento…";
    if (accessBlocker) return accessBlocker;
    return null;
  })();

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

  const handleSubmit = async () => {
    setStripeAlert(null);
    setValidationAlert(null);
    setBackendAlert(null);
    setErrorMessage(null);

    const issues = collectFormErrors();
    const paidAlert = !isFreeEvent && hasPaidTicket && paidTicketsBlocked ? paidTicketsBlockedMessage : null;
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos obrigatórios antes de criar o evento.");
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

    if (!isOrganization) {
      setErrorMessage("Ainda não és organização. Vai à área de organização para ativares essa função.");
      return;
    }

    if (accessBlocker) {
      setErrorMessage(accessBlocker);
      setValidationAlert(accessBlocker);
      return;
    }

    const activeOrganizationId = organizationStatus?.organization?.id ?? null;
    if (!activeOrganizationId) {
      setErrorMessage("Seleciona uma organização ativa antes de criares eventos.");
      setValidationAlert("Falta selecionar a organização.");
      return;
    }

    setIsSubmitting(true);

    try {
      const templateToSend = selectedPreset === "padel" ? "PADEL" : "OTHER";
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startsAt,
        endsAt,
        locationName: locationName.trim() || null,
        locationCity: locationCity.trim() || null,
        templateType: templateToSend,
        address: address.trim() || null,
        ticketTypes: preparedTickets,
        coverImageUrl: coverUrl,
        inviteOnly: publicAccessMode === "INVITE",
        publicAccessMode,
        participantAccessMode,
        publicTicketScope,
        participantTicketScope,
        liveHubVisibility,
        padel:
          selectedPreset === "padel"
            ? {
                padelClubId: selectedPadelClubId,
                courtIds: selectedPadelCourtIds,
                staffIds: selectedPadelStaffIds,
                numberOfCourts: selectedPadelCourtIds.length || 1,
                padelV2Enabled: true,
              }
            : undefined,
    };

      const res = await fetch(`/api/organizacao/events/create?organizationId=${activeOrganizationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        const friendly =
          data?.error === "FORBIDDEN"
            ? "Sem permissões para criar eventos nesta organização."
            : data?.error;
        throw new Error(friendly || "Erro ao criar evento.");
      }

      const event = data.event;
      if (event?.id || event?.slug) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DRAFT_KEY);
        }
        setCreationSuccess({ eventId: event.id, slug: event.slug });
        setErrorSummary([]);
        setFieldErrors({});
      }
    } catch (err) {
      console.error("Erro ao criar evento de organização:", err);
      const message = err instanceof Error ? err.message : null;
      setBackendAlert(message || "Algo correu mal ao guardar o evento. Tenta novamente em segundos.");
      scrollTo(ctaAlertRef.current);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedPreset(null);
    setShowPadelModal(false);
    setShowTicketsModal(false);
    setShowAccessModal(false);
    setShowScheduleModal(false);
    setShowLocationModal(false);
    setShowDescriptionModal(false);
    setShowCoverModal(false);
    setShowLocationSuggestions(false);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setLocationName("");
    setLocationCity(PT_CITIES[0]);
    setAddress("");
    setTicketTypes([]);
    setIsFreeEvent(false);
    setFreeTicketName("Inscrição");
    setFreeCapacity("");
    setCoverUrl(null);
    setCoverCropFile(null);
    setShowCoverCropModal(false);
    setCreationSuccess(null);
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
      <div className="w-full px-4 py-8 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          A carregar a tua conta…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
          <h1 className="text-2xl font-semibold">Criar novo evento</h1>
          <p className="text-white/70">Precisas de iniciar sessão para criar eventos como organização.</p>
          <button
            type="button"
            onClick={handleRequireLogin}
            className={CTA_PRIMARY}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  if (!isOrganization) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
          <h1 className="text-2xl font-semibold">Criar novo evento</h1>
          <p className="text-white/70">Ainda não és organização. Vai à área de organização para ativar essa função.</p>
          <Link
            href="/organizacao"
            className={CTA_PRIMARY}
          >
            Ir para área de organização
          </Link>
        </div>
      </div>
    );
  }

  const renderCoverPanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.72)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Escolher capa</p>
            <p className="text-[12px] text-white/60">Sugestões reais e biblioteca completa.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-white/70">
            <div className="h-8 w-10 overflow-hidden rounded-md border border-white/15 bg-white/5">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt="Capa selecionada" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#12121f] via-[#0b0b18] to-[#1f1630]" />
              )}
            </div>
            <span>{selectedCoverLabel ?? "Sem capa escolhida"}</span>
          </div>
        </div>

        <label className="block rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-[12px] text-white/65 hover:border-white/40 hover:bg-white/10">
          <span className="block text-[11px] uppercase tracking-[0.2em] text-white/60">
            Arrasta e solta ou clica para carregar
          </span>
          <span className="mt-2 block text-[12px] text-white/60">Proporção ideal 1:1</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              handleCoverUpload(e.target.files?.[0] ?? null);
            }}
            className="hidden"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[180px]">
            <input
              value={coverSearch}
              onChange={(e) => setCoverSearch(e.target.value)}
              placeholder="Procurar mais fotos"
              className="w-full rounded-full border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/85 placeholder:text-white/45 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
            />
          </div>
          {coverUrl && (
            <button
              type="button"
              onClick={() => setCoverUrl(null)}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50 px-2 py-2">Categorias</p>
          <div className="space-y-1">
            {coverCategoryOptions.map((option) => {
              const isActive = coverCategory === option.value;
              const count = coverCategoryCounts[option.value] ?? 0;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCoverCategory(option.value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] transition ${
                    isActive
                      ? "border border-white/25 bg-white/10 text-white"
                      : "border border-transparent text-white/60 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <span>{option.label}</span>
                  <span className="text-[11px] text-white/45">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                {coverCategory === "SUGESTOES" ? "Destaque" : "Biblioteca"}
              </p>
              <p className="text-[12px] text-white/60">
                {coverCategory === "SUGESTOES"
                  ? `Sugestões para ${coverContextLabel.toLowerCase()}.`
                  : "Explora covers reais da biblioteca."}
              </p>
            </div>
            {coverCategory === "SUGESTOES" && suggestedCovers[0] && (
              <button
                type="button"
                onClick={() => setCoverUrl(suggestedCovers[0]?.token ?? null)}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/75 hover:bg-white/10"
              >
                Usar sugestão
              </button>
            )}
          </div>

          {coverGridItems.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/60">
              Sem resultados para a tua pesquisa.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {coverGridItems.map((cover) => {
                const isSelected = selectedCoverToken === cover.id;
                return (
                  <button
                    key={cover.id}
                    type="button"
                    onClick={() => setCoverUrl(cover.token)}
                    className={`group text-left rounded-xl border p-2 transition ${
                      isSelected ? "border-emerald-400/70 bg-emerald-500/10" : "border-white/12 hover:border-white/30"
                    }`}
                  >
                    <div className="relative w-full overflow-hidden rounded-lg aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover.thumbUrl ?? cover.url}
                        alt={cover.label}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      {isSelected && (
                        <span className="absolute right-2 top-2 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                          Selecionado
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-white/80">{cover.label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDescriptionPanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 space-y-2 shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        <label className={labelClass}>Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className={inputClass(false)}
          placeholder="Sobre o evento, convidados, regras…"
        />
      </div>
    </div>
  );

  const handleStartDateChange = (value: string) => {
    setStartDateInput(value);
    setStartsAt(buildLocalDateTime(value, startTimeInput));
  };

  const handleStartTimeChange = (value: string) => {
    setStartTimeInput(value);
    setStartsAt(buildLocalDateTime(startDateInput, value));
  };

  const handleEndDateChange = (value: string) => {
    setEndDateInput(value);
    setEndsAt(buildLocalDateTime(value, endTimeInput));
  };

  const handleEndTimeChange = (value: string) => {
    setEndTimeInput(value);
    setEndsAt(buildLocalDateTime(endDateInput, value));
  };

  const renderSchedulePanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        <div className="grid gap-5">
          <div data-field="startsAt" className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClass}>
                Data de início <span aria-hidden>*</span>
              </label>
              <input
                type="date"
                value={startDateInput}
                min={formatInputDate(new Date())}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={inputClass(Boolean(fieldErrors.startsAt))}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>
                Hora de início <span aria-hidden>*</span>
              </label>
              <input
                type="time"
                step={900}
                value={startTimeInput}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={inputClass(Boolean(fieldErrors.startsAt))}
              />
            </div>
            {fieldErrors.startsAt && (
              <p className={`${errorTextClass} sm:col-span-2`}>
                <span aria-hidden>⚠️</span>
                {fieldErrors.startsAt}
              </p>
            )}
          </div>

          <div data-field="endsAt" className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClass}>Data de fim</label>
              <input
                type="date"
                value={endDateInput}
                min={startDateInput || formatInputDate(new Date())}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={inputClass(Boolean(fieldErrors.endsAt || dateOrderWarning))}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Hora de fim</label>
              <input
                type="time"
                step={900}
                value={endTimeInput}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className={inputClass(Boolean(fieldErrors.endsAt || dateOrderWarning))}
              />
            </div>
            {(fieldErrors.endsAt || dateOrderWarning) && (
              <p className={`${errorTextClass} sm:col-span-2`}>
                <span aria-hidden>⚠️</span>
                {fieldErrors.endsAt ?? "Fim antes do início."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLocationPanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/12 bg-[rgba(14,14,20,0.7)] p-4 space-y-3 shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        <div data-field="locationName" className="space-y-1">
          <label className={labelClass}>Local (opcional)</label>
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
                      <span className="text-[11px] text-white/50">Usado recentemente</span>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div data-field="locationCity" className="space-y-1">
            <label className={labelClass}>
              Cidade <span aria-hidden>*</span>
            </label>
            <select
              value={locationCity}
              onChange={(e) => {
                setLocationManuallySet(true);
                const nextCity = e.target.value as PTCity;
                if (PT_CITIES.includes(nextCity)) {
                  setLocationCity(nextCity);
                }
                setShowLocationSuggestions(true);
              }}
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
          </div>

          <div data-field="address" className="space-y-1">
            <label className={labelClass}>Morada (opcional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass(false)}
              placeholder="Rua, número ou complemento"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTicketsPanel = () => (
    <div className="space-y-5 animate-fade-slide">
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
        {ticketTypes.length === 0 && !isFreeEvent && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
            Se não adicionares bilhetes, criamos automaticamente uma entrada gratuita.
          </div>
        )}
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
                  onClick={() => router.push("/organizacao?tab=analyze&section=financas")}
                  className={`${CTA_PRIMARY} px-3 py-1 text-[11px]`}
                >
                  Abrir Finanças & Payouts
                </button>
              )}
              {needsOfficialEmailVerification && (
                <button
                  type="button"
                  onClick={() => router.push("/organizacao/settings")}
                  className={`${CTA_PRIMARY} px-3 py-1 text-[11px]`}
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
              Grátis
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
                step="1"
                inputMode="numeric"
                value={freeCapacity}
                onChange={(e) => setFreeCapacity(normalizeIntegerInput(e.target.value))}
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
              className={`${CTA_PRIMARY} px-3 py-1 text-[13px]`}
            >
              + Adicionar bilhete
            </button>
          </div>

          <div className="grid gap-3">
            {ticketTypes.map((row, idx) => {
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
                      <p className="text-[12px] text-white/55">
                        Preço público final (taxas incluídas). Em eventos pagos, o mínimo é 1,00 €.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Capacidade (opcional)</label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        inputMode="numeric"
                        value={row.totalQuantity}
                        onChange={(e) => handleTicketChange(idx, "totalQuantity", e.target.value)}
                        className={inputClass(false)}
                        placeholder="Ex.: 100"
                      />
                    </div>
                  </div>

                  {advancedAccessEnabled &&
                    ((publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC") ||
                      (participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC")) && (
                      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/75">
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                          Este bilhete dá acesso a
                        </span>
                        {publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" && (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(row.publicAccess)}
                              onChange={() => toggleTicketFlag(idx, "publicAccess")}
                            />
                            <span>Público</span>
                          </label>
                        )}
                        {participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC" && (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(row.participantAccess)}
                              onChange={() => toggleTicketFlag(idx, "participantAccess")}
                            />
                            <span>Participante</span>
                          </label>
                        )}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderAccessPanel = () => (
    <div className="space-y-5 animate-fade-slide">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[rgba(14,14,20,0.6)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={labelClass}>Acesso & participantes</p>
            <p className="text-[12px] text-white/60">Define quem entra e quem participa.</p>
          </div>
          <button
            type="button"
            onClick={() => setAdvancedAccessEnabled((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/75"
          >
            <span>Avançado</span>
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                advancedAccessEnabled ? "bg-emerald-400/80" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform ${
                  advancedAccessEnabled ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
        </div>

        {!advancedAccessEnabled ? (
          <p className="text-[12px] text-white/60">Modo simples: público aberto e sem distinção de participantes.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[12px] text-white/70">
                {publicAccessLabel} · {participantAccessLabel}
              </span>
              <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[12px] text-white/70">
                LiveHub {liveHubVisibility === "PUBLIC" ? "Público" : liveHubVisibility === "PRIVATE" ? "Privado" : "Desativado"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className={labelClass}>Público</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "OPEN", label: "Aberto" },
                    { value: "TICKET", label: "Por bilhete" },
                    { value: "INVITE", label: "Por convite" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPublicAccessMode(opt.value)}
                      className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                        publicAccessMode === opt.value
                          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                          : "border-white/20 bg-black/40 text-white/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {publicAccessMode === "TICKET" && (
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: "ALL", label: "Todos os bilhetes" },
                      { value: "SPECIFIC", label: "Tipos específicos" },
                    ] as const).map((opt) => (
                      <button
                        key={`pub-scope-${opt.value}`}
                        type="button"
                        onClick={() => setPublicTicketScope(opt.value)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                          publicTicketScope === opt.value
                            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                            : "border-white/20 bg-black/40 text-white/70"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                {publicAccessMode === "INVITE" && (
                  <p className="text-[12px] text-white/60">
                    A lista de convites do público é adicionada depois de criares o evento.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className={labelClass}>Participantes</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "NONE", label: "Sem participantes" },
                    { value: "INSCRIPTION", label: "Por inscrição" },
                    { value: "TICKET", label: "Por bilhete" },
                    { value: "INVITE", label: "Por convite" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setParticipantAccessMode(opt.value)}
                      className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                        participantAccessMode === opt.value
                          ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                          : "border-white/20 bg-black/40 text-white/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {participantAccessMode === "TICKET" && (
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: "ALL", label: "Todos os bilhetes" },
                      { value: "SPECIFIC", label: "Tipos específicos" },
                    ] as const).map((opt) => (
                      <button
                        key={`part-scope-${opt.value}`}
                        type="button"
                        onClick={() => setParticipantTicketScope(opt.value)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                          participantTicketScope === opt.value
                            ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                            : "border-white/20 bg-black/40 text-white/70"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                {participantAccessMode === "INVITE" && (
                  <p className="text-[12px] text-white/60">
                    A lista de convites de participantes é adicionada depois de criares o evento.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className={labelClass}>LiveHub</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "PUBLIC", label: "Público" },
                  { value: "PRIVATE", label: "Privado" },
                  { value: "DISABLED", label: "Desativado" },
                ] as const).map((opt) => (
                  <button
                    key={`livehub-${opt.value}`}
                    type="button"
                    onClick={() => setLiveHubVisibility(opt.value)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                      liveHubVisibility === opt.value
                        ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100"
                        : "border-white/20 bg-black/40 text-white/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-white/60">
                Público fica sempre acessível; privado mostra só a participantes; desativado oculta o LiveHub.
              </p>
            </div>

            <div className="rounded-xl border border-white/12 bg-black/40 px-3 py-3 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Resumo rápido</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Público</p>
                  <p className="mt-1 text-sm font-semibold text-white">{publicAccessLabel}</p>
                  <p className="text-[12px] text-white/60">{publicAccessDescription}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Participantes</p>
                  <p className="mt-1 text-sm font-semibold text-white">{participantAccessLabel}</p>
                  <p className="text-[12px] text-white/60">{participantAccessDescription}</p>
                </div>
              </div>
              {accessNotes.length > 0 && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-50">
                  <p className="font-semibold">Notas</p>
                  <div className="mt-1 space-y-1 text-amber-50/90">
                    {accessNotes.map((note) => (
                      <p key={note}>• {note}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const ticketsModal = showTicketsModal ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setShowTicketsModal(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Bilhetes</p>
            <p className="text-sm font-semibold text-white">Preço, capacidade e inscrições</p>
          </div>
          <button
            type="button"
            onClick={() => setShowTicketsModal(false)}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
        </div>
        <div ref={ticketsModalRef}>{renderTicketsPanel()}</div>
      </div>
    </div>
  ) : null;

  const accessModal = showAccessModal ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setShowAccessModal(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Acesso</p>
            <p className="text-sm font-semibold text-white">Público, participantes e LiveHub</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAccessModal(false)}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
        </div>
        {renderAccessPanel()}
      </div>
    </div>
  ) : null;

  const scheduleModal = showScheduleModal ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setShowScheduleModal(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Agenda</p>
            <p className="text-sm font-semibold text-white">Data e hora</p>
          </div>
          <button
            type="button"
            onClick={() => setShowScheduleModal(false)}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
        </div>
        <div ref={scheduleModalRef}>{renderSchedulePanel()}</div>
      </div>
    </div>
  ) : null;

  const closeLocationModal = () => {
    setShowLocationModal(false);
    setShowLocationSuggestions(false);
  };

  const locationModal = showLocationModal ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={closeLocationModal}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Localização</p>
            <p className="text-sm font-semibold text-white">Cidade e morada</p>
          </div>
          <button
            type="button"
            onClick={closeLocationModal}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
        </div>
        <div ref={locationModalRef}>{renderLocationPanel()}</div>
      </div>
    </div>
  ) : null;

  const descriptionModal = showDescriptionModal ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setShowDescriptionModal(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Descrição</p>
            <p className="text-sm font-semibold text-white">Detalhes do evento</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDescriptionModal(false)}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
        </div>
        <div ref={descriptionModalRef}>{renderDescriptionPanel()}</div>
      </div>
    </div>
  ) : null;

  const coverModal = showCoverModal ? (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setShowCoverModal(false)}
        aria-hidden
      />
      <div className="relative z-10 flex w-full max-w-3xl max-h-[calc(100vh-120px)] flex-col">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Capa</p>
            <p className="text-sm font-semibold text-white">Imagem do evento</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCoverModal(false)}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
        </div>
        <div
          ref={coverModalRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2"
        >
          {renderCoverPanel()}
        </div>
      </div>
    </div>
  ) : null;

  const padelModal =
    showPadelModal && selectedPreset === "padel" ? (
      <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-6">
        <div
          className="absolute inset-0 bg-black/70"
          onClick={() => setShowPadelModal(false)}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-5xl">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Padel</p>
              <p className="text-sm font-semibold text-white">Configuração extra</p>
            </div>
          <button
            type="button"
            onClick={() => setShowPadelModal(false)}
            className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
          >
            Concluir
          </button>
          </div>
          {padelExtrasContent}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-[#05070f]" />
        {coverPreviewUrl ? (
          <>
            <div
              className="absolute inset-0 opacity-85"
              style={{
                backgroundImage: `url(${coverPreviewUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(46px) saturate(1.15) brightness(0.85)",
                transform: "scale(1.08)",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.16),transparent_55%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/55 to-black/85" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.12),transparent_55%)]" />
        )}
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="relative z-10 w-full space-y-6 py-6 text-white"
      >
      <div className="relative overflow-hidden rounded-[32px] bg-white/4 p-5 md:p-6 space-y-6 shadow-[0_32px_110px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {coverPreviewUrl && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-75"
              style={{
                backgroundImage: `url(${coverPreviewUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(34px) saturate(1.15) brightness(0.85)",
                transform: "scale(1.08)",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#05070f]/35 via-[#05070f]/65 to-[#05070f]/90" />
          </div>
        )}

        <div className="relative space-y-6">
          {errorSummary.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
              aria-live="assertive"
            >
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>⚠️</span>
                <span>Revê estes campos antes de publicar</span>
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

          <section className="space-y-6">
            <div className="rounded-[28px] bg-white/5 p-5 md:p-6">
              <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
                <div className="space-y-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Capa</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverCategory("SUGESTOES");
                      setShowCoverModal(true);
                    }}
                    className="group relative aspect-square w-full max-w-[360px] overflow-hidden rounded-[28px] border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.4)] transition hover:border-white/35"
                  >
                    {coverPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreviewUrl} alt="Capa do evento" className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#12121f] via-[#0b0b18] to-[#1f1630]" />
                    )}
                    <div className="absolute inset-0 bg-black/25 opacity-0 transition group-hover:opacity-100" />
                    <span className="absolute bottom-3 right-3 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-[11px] text-white/85 opacity-0 transition group-hover:opacity-100">
                      Alterar capa
                    </span>
                    {!coverPreviewUrl && (
                      <span className="absolute inset-0 flex items-center justify-center text-[12px] text-white/70">
                        Escolher capa
                      </span>
                    )}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={labelClass}>
                      Título <span aria-hidden>*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      ref={titleRef}
                      aria-invalid={Boolean(fieldErrors.title)}
                      className={`${inputClass(Boolean(fieldErrors.title))} text-2xl font-semibold`}
                      placeholder="Nome do evento"
                    />
                    {fieldErrors.title && (
                      <p className={errorTextClass}>
                        <span aria-hidden>⚠️</span>
                        {fieldErrors.title}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="group w-full border-b border-white/10 pb-4 text-left transition hover:border-white/25"
                  >
                    <div className="flex items-center justify-between gap-3 text-[13px] text-white/70">
                      <span>Início</span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-white/85">
                          {startsAt ? formatDateLabel(startsAt) : "Data"}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-white/85">
                          {startsAt ? formatTimeLabel(startsAt) : "Hora"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-white/70">
                      <span>Fim</span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-white/80">
                          {endsAt ? formatDateLabel(endsAt) : "Data"}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-white/80">
                          {endsAt ? formatTimeLabel(endsAt) : "Hora"}
                        </span>
                      </div>
                    </div>
                    {scheduleError && <p className="mt-2 text-[11px] text-pink-200">{scheduleError}</p>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="group w-full border-b border-white/10 pb-4 text-left transition hover:border-white/25"
                  >
                    <p className="text-[13px] text-white/80">Localização</p>
                    <p className="mt-1 text-[12px] text-white/55">{locationSummary}</p>
                    {locationError && <p className="mt-2 text-[11px] text-pink-200">{locationError}</p>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDescriptionModal(true)}
                    className="group w-full border-b border-white/10 pb-4 text-left transition hover:border-white/25"
                  >
                    <p className="text-[13px] text-white/80">Descrição</p>
                    <p className="mt-1 text-[12px] text-white/55">{descriptionSummary}</p>
                  </button>

                  <div className="pt-2 space-y-2">
                    <p className={labelClass}>Opções do evento</p>
                    <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10">
                      <button
                        type="button"
                        onClick={() => setShowTicketsModal(true)}
                        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/8"
                      >
                        <div className="space-y-1">
                          <p className={labelClass}>Bilhetes</p>
                          <p className="text-sm text-white/80">{ticketsSummary}</p>
                          {paidTicketsBlocked && !isFreeEvent && (
                            <p className="text-[11px] text-amber-200/90">Eventos pagos precisam de Stripe + email oficial.</p>
                          )}
                        </div>
                        <span className="text-[12px] text-white/60 group-hover:text-white/85">Abrir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAccessModal(true)}
                        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/8"
                      >
                        <div className="space-y-1">
                          <p className={labelClass}>Acesso & participantes</p>
                          <p className="text-sm text-white/80">{accessSummary}</p>
                          <p className="text-[11px] text-white/60">{liveHubSummary}</p>
                        </div>
                        <span className="text-[12px] text-white/60 group-hover:text-white/85">Abrir</span>
                      </button>

                      {selectedPreset === "padel" && (
                        <button
                          type="button"
                          onClick={() => setShowPadelModal(true)}
                          className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/8"
                        >
                          <div className="space-y-1">
                            <p className={labelClass}>Padel extra</p>
                            <p className="text-sm text-white/80">
                              Clube: {selectedPadelClub?.name ?? "por definir"} · Courts: {selectedPadelCourtIds.length || "—"}
                            </p>
                            <p className="text-[11px] text-white/60">Staff: {selectedPadelStaffIds.length || "—"}</p>
                          </div>
                          <span className="text-[12px] text-white/60 group-hover:text-white/85">Abrir</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div ref={ctaAlertRef} className="space-y-3">
            {stripeAlert && (
              <FormAlert
                variant={hasPaidTicket ? "error" : "warning"}
                title="Conclui os passos para vender"
                message={stripeAlert}
                actionLabel="Abrir Finanças & Payouts"
                onAction={() => router.push("/organizacao?tab=analyze&section=financas")}
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
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 z-[var(--z-footer)] pt-4">
        <div className="relative overflow-hidden border-t border-white/10 bg-black/30 px-4 py-3 md:px-5 md:py-4 backdrop-blur-xl shadow-[0_-18px_45px_rgba(0,0,0,0.45)]">
          {isSubmitting && showLoadingHint && (
            <div className="absolute left-0 right-0 top-0 h-[3px] overflow-hidden">
              <div className="h-full w-full animate-pulse bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
            </div>
          )}
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] text-white/70 leading-snug">
              <p>Obrigatório: título, data/hora, cidade.</p>
              {submitDisabledReason && <p className="text-white/55">{submitDisabledReason}</p>}
            </div>
            <button
              type="submit"
              disabled={Boolean(submitDisabledReason)}
              className={`${CTA_PRIMARY} disabled:opacity-60`}
              title={submitDisabledReason ?? ""}
            >
              {isSubmitting ? "A criar evento..." : "Criar evento"}
            </button>
          </div>
        </div>
      </div>

      {creationSuccess && (
        <div className="fixed bottom-6 right-6 z-[var(--z-popover)] w-[320px] max-w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)] text-emerald-50">
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
                href={`/organizacao/eventos/${creationSuccess.eventId}`}
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

      {ticketsModal}
      {accessModal}
      {scheduleModal}
      {locationModal}
      {descriptionModal}
      {coverModal}
      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />
      {padelModal}
      </form>
    </>
  );
}
