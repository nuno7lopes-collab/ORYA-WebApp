"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import styles from "./page.module.css";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { PT_CITIES } from "@/lib/constants/ptCities";
import {
  getEventCoverSuggestionIds,
  getEventCoverUrl,
  listEventCoverFallbacks,
  parseEventCoverToken,
} from "@/lib/eventCover";
import { resolveMemberModuleAccess } from "@/lib/organizationRbac";
import { OrganizationMemberRole, OrganizationModule, OrganizationRolePack } from "@prisma/client";
import { parseOrganizationModules, resolvePrimaryModule } from "@/lib/organizationCategories";
import { fetchGeoAutocomplete, fetchGeoDetails } from "@/lib/geo/client";
import { AppleMapsLoader } from "@/app/components/maps/AppleMapsLoader";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmail";
import type { GeoAutocompleteItem, GeoDetailsItem } from "@/lib/geo/provider";

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
  publicAccess?: boolean;
  padelCategoryId?: number | null;
};

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
  | "tickets"
  | "padel";

type LocationMode = "OSM" | "MANUAL";
type LocationSource = "OSM" | "MANUAL";

type PadelClubSummary = {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
  locationFormattedAddress?: string | null;
  kind?: "OWN" | "PARTNER" | null;
  sourceClubId?: number | null;
  isActive: boolean;
  courtsCount?: number | null;
};
type PadelCourtSummary = {
  id: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
  indoor?: boolean | null;
  surface?: string | null;
};
type PadelStaffSummary = { id: number; fullName?: string | null; email?: string | null; inheritToEvents?: boolean | null };
type PadelCategorySummary = {
  id: number;
  label: string;
  genderRestriction?: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
};
type PadelRuleSetSummary = { id: number; name: string; season?: string | null; year?: number | null };
type PadelCategoriesResponse = { ok: boolean; items?: PadelCategorySummary[] };
type PadelRuleSetsResponse = { ok: boolean; items?: PadelRuleSetSummary[] };
type PadelCategoryConfig = { capacityTeams: string; format: string | null };
type PadelPublicClub = {
  id: number;
  name: string;
  shortName?: string | null;
  city?: string | null;
  address?: string | null;
  courtsCount?: number | null;
  organizationName?: string | null;
  organizationUsername?: string | null;
  courts?: Array<{ id: number; name: string; indoor: boolean; surface: string | null }>;
};
type PadelPublicClubsResponse = { ok: boolean; items?: PadelPublicClub[]; error?: string };

const normalizeIntegerInput = (value: string) => {
  const match = value.trim().match(/^\d+/);
  return match ? match[0] : "";
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

const formatMonthLabel = (value: Date) =>
  value.toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });

const formatInputDate = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatInputTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseInputDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const roundToNextHour = (base: Date) => {
  const next = new Date(base);
  const hasMinutes = next.getMinutes() > 0 || next.getSeconds() > 0 || next.getMilliseconds() > 0;
  next.setMinutes(0, 0, 0);
  if (hasMinutes) next.setHours(next.getHours() + 1);
  return next;
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const toMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const isBeforeDay = (a: Date, b: Date) => startOfDay(a).getTime() < startOfDay(b).getTime();

const buildCalendarCells = (viewDate: Date) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = 0; i < 42; i += 1) {
    const dayIndex = i - firstWeekday + 1;
    if (dayIndex <= 0) {
      cells.push({
        date: new Date(year, month - 1, daysInPrevMonth + dayIndex),
        inMonth: false,
      });
    } else if (dayIndex > daysInMonth) {
      cells.push({
        date: new Date(year, month + 1, dayIndex - daysInMonth),
        inMonth: false,
      });
    } else {
      cells.push({
        date: new Date(year, month, dayIndex),
        inMonth: true,
      });
    }
  }
  return cells;
};

const buildTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

const buildLocalDateTime = (date: string, time: string) => {
  if (!date || !time) return "";
  return `${date}T${time}`;
};

const MODAL_OVERLAY_CLASS = "fixed inset-0 bg-black/75 backdrop-blur-sm";
const MODAL_SHELL_CLASS = "fixed inset-0 z-[var(--z-modal)]";
const MODAL_CONTENT_WRAP_CLASS =
  "relative z-10 flex h-full w-full items-start justify-center overflow-y-auto overscroll-contain px-4 py-6 sm:py-10";
const MODAL_PANEL_CLASS =
  "rounded-[28px] border border-white/15 bg-[rgba(10,12,18,0.85)] backdrop-blur-2xl shadow-[0_26px_80px_rgba(0,0,0,0.6)]";
const MODAL_HEADER_CLASS = "flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4";
const MAX_ITEMS_UI = 1111;
const COVER_PAGE_SIZE = 40;

type NewOrganizationEventPageProps = {
  forcePreset?: "padel" | "default";
};

export default function NewOrganizationEventPage({
  forcePreset,
}: NewOrganizationEventPageProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const organizationId = organizationIdParam ? Number(organizationIdParam) : null;
  const orgMeUrl =
    user && organizationId && Number.isFinite(organizationId)
      ? `/api/organizacao/me?organizationId=${organizationId}`
      : null;
  const { data: organizationStatus } = useSWR<{
    ok?: boolean;
    organization?: {
      id?: number | null;
      status?: string | null;
      officialEmail?: string | null;
      officialEmailVerifiedAt?: string | null;
      primaryModule?: string | null;
      modules?: string[] | null;
      padelDefaults?: {
        ruleSetId?: number | null;
        favoriteCategories?: number[];
      } | null;
    } | null;
    membershipRole?: string | null;
    membershipRolePack?: string | null;
    paymentsStatus?: string;
    paymentsMode?: "PLATFORM" | "CONNECT";
    profileStatus?: string;
  }>(
    orgMeUrl,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState<string>(PT_CITIES[0]);
  const [address, setAddress] = useState("");
  const [locationManuallySet, setLocationManuallySet] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>("OSM");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [locationDetailsLoading, setLocationDetailsLoading] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationProviderId, setLocationProviderId] = useState<string | null>(null);
  const [locationFormattedAddress, setLocationFormattedAddress] = useState<string | null>(null);
  const [locationComponents, setLocationComponents] = useState<Record<string, unknown> | null>(null);
  const [locationHouseNumber, setLocationHouseNumber] = useState("");
  const [locationPostalCode, setLocationPostalCode] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationTbd, setLocationTbd] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [showLiveHubModal, setShowLiveHubModal] = useState(false);
  const [schedulePopover, setSchedulePopover] = useState<
    "startDate" | "startTime" | "endDate" | "endTime" | null
  >(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [padelFormat, setPadelFormat] = useState("TODOS_CONTRA_TODOS");
  const [padelEligibility, setPadelEligibility] = useState("OPEN");
  const [padelRuleSetId, setPadelRuleSetId] = useState<number | null>(null);
  const [padelCategoryIds, setPadelCategoryIds] = useState<number[]>([]);
  const [padelDefaultCategoryId, setPadelDefaultCategoryId] = useState<number | null>(null);
  const [padelCategoryConfigs, setPadelCategoryConfigs] = useState<Record<number, PadelCategoryConfig>>({});
  const [padelSplitDeadlineHours, setPadelSplitDeadlineHours] = useState("48");
  const [padelWaitlistEnabled, setPadelWaitlistEnabled] = useState(false);
  const [padelRegistrationStartsAt, setPadelRegistrationStartsAt] = useState("");
  const [padelRegistrationEndsAt, setPadelRegistrationEndsAt] = useState("");
  const [padelAllowSecondCategory, setPadelAllowSecondCategory] = useState(true);
  const [padelMaxEntriesTotal, setPadelMaxEntriesTotal] = useState("");
  const [padelAdvancedOpen, setPadelAdvancedOpen] = useState(false);
  const [padelRulesOpen, setPadelRulesOpen] = useState(false);
  const [startCalendarView, setStartCalendarView] = useState(() => toMonthStart(new Date()));
  const [endCalendarView, setEndCalendarView] = useState(() => toMonthStart(new Date()));
  const [coverSearch, setCoverSearch] = useState("");
  const [coverCategory, setCoverCategory] =
    useState<"SUGESTOES" | "ALL" | "EVENTOS" | "PADEL" | "RESERVAS" | "GERAL">("SUGESTOES");
  const [coverPage, setCoverPage] = useState(1);
  const [isGratisEvent, setIsFreeEvent] = useState(false);
  const [liveHubVisibility, setLiveHubVisibility] = useState<LiveHubVisibility>("PUBLIC");
  const [freeTicketName, setFreeTicketName] = useState("Inscrição");
  const [freeTicketPublicAccess, setFreeTicketPublicAccess] = useState(true);
  const [freeCapacity, setFreeCapacity] = useState("");
  const [selectedPadelClubId, setSelectedPadelClubId] = useState<number | null>(null);
  const [selectedPadelCourtIds, setSelectedPadelCourtIds] = useState<number[]>([]);
  const [selectedPadelStaffIds, setSelectedPadelStaffIds] = useState<number[]>([]);
  const [padelClubMode, setPadelClubMode] = useState<"OWN" | "PARTNER">("OWN");
  const [padelClubSource, setPadelClubSource] = useState<"ORG" | "DIRECTORY">("ORG");
  const [padelClubSourceTouched, setPadelClubSourceTouched] = useState(false);
  const [padelDirectoryQuery, setPadelDirectoryQuery] = useState("");
  const [padelDirectoryError, setPadelDirectoryError] = useState<string | null>(null);
  const [creatingPartnerClubId, setCreatingPartnerClubId] = useState<number | null>(null);

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const isPadelPreset = selectedPreset === "padel" || forcePreset === "padel";

  const ctaAlertRef = useRef<HTMLDivElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const padelSectionRef = useRef<HTMLDivElement | null>(null);
  const padelCategoriesRef = useRef<HTMLDivElement | null>(null);
  const padelTicketsRef = useRef<HTMLDivElement | null>(null);
  const padelOperationRef = useRef<HTMLDivElement | null>(null);
  const scheduleInitializedRef = useRef(false);
  const startDatePopoverRef = useRef<HTMLDivElement | null>(null);
  const startTimePopoverRef = useRef<HTMLDivElement | null>(null);
  const endDatePopoverRef = useRef<HTMLDivElement | null>(null);
  const endTimePopoverRef = useRef<HTMLDivElement | null>(null);
  const startDateInputRef = useRef<HTMLDivElement | null>(null);
  const startTimeInputRef = useRef<HTMLDivElement | null>(null);
  const endDateInputRef = useRef<HTMLDivElement | null>(null);
  const endTimeInputRef = useRef<HTMLDivElement | null>(null);
  const locationModalRef = useRef<HTMLDivElement | null>(null);
  const descriptionModalRef = useRef<HTMLDivElement | null>(null);
  const coverModalRef = useRef<HTMLDivElement | null>(null);
  const ticketsModalRef = useRef<HTMLDivElement | null>(null);
  const modalOverflowRef = useRef<{ body: string; html: string } | null>(null);
  const suggestionBlurTimeout = useRef<NodeJS.Timeout | null>(null);
  const locationSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const locationSearchSeq = useRef(0);
  const locationDetailsSeq = useRef(0);
  const activeProviderRef = useRef<string | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (isPadelPreset && showTicketsModal) {
      setShowTicketsModal(false);
    }
  }, [isPadelPreset, showTicketsModal]);

  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const membershipRole = organizationStatus?.membershipRole ?? null;
  const membershipRolePack = organizationStatus?.membershipRolePack ?? null;
  const moduleAccess = useMemo(
    () =>
      resolveMemberModuleAccess({
        role: membershipRole as OrganizationMemberRole | null,
        rolePack: membershipRolePack as OrganizationRolePack | null,
        overrides: [],
      }),
    [membershipRole, membershipRolePack],
  );
  const isOrganization =
    roles.includes("organization") ||
    Boolean(organizationStatus?.organization?.id) ||
    Boolean(organizationStatus?.membershipRole);
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const normalizedModules = useMemo(
    () => parseOrganizationModules(organizationStatus?.organization?.modules) ?? [],
    [organizationStatus?.organization?.modules],
  );
  const primaryModule = resolvePrimaryModule(
    organizationStatus?.organization?.primaryModule ?? null,
    normalizedModules,
  );
  const hasEventosModule = normalizedModules.includes("EVENTOS") || primaryModule === "EVENTOS";
  const hasTorneiosModule = normalizedModules.includes("TORNEIOS") || primaryModule === "TORNEIOS";
  const hasCurrentModule = isPadelPreset ? hasTorneiosModule : hasEventosModule;
  const canSwitchPreset = !forcePreset && hasEventosModule && hasTorneiosModule;
  const isPadelPaid = isPadelPreset && !isGratisEvent;
  const isTicketsModalOpen = showTicketsModal && !isPadelPreset;
  const coverLibrary = useMemo(() => listEventCoverFallbacks(), []);
  const templateHint = isPadelPreset ? "PADEL" : "OTHER";
  const primaryLabel = isPadelPreset ? "torneio" : "evento";
  const primaryLabelTitle = isPadelPreset ? "Torneio" : "Evento";
  const primaryLabelPlural = isPadelPreset ? "torneios" : "eventos";
  const ticketLabel = isPadelPreset ? "inscrição" : "bilhete";
  const ticketLabelCap = isPadelPreset ? "Inscrição" : "Bilhete";
  const ticketLabelPlural = isPadelPreset ? "inscrições" : "bilhetes";
  const ticketLabelPluralCap = isPadelPreset ? "Inscrições" : "Bilhetes";
  const ticketLabelArticle = isPadelPreset ? "da" : "do";
  const ticketLabelIndefinite = isPadelPreset ? "uma" : "um";
  const freeTicketPlaceholder = isPadelPreset ? "Inscrição" : "Entrada";
  const freeTicketLabel = isPadelPreset ? "Inscrição grátis" : "Entrada grátis";
  const detailBasePath = isPadelPreset ? "/organizacao/torneios" : "/organizacao/eventos";
  const coverSuggestions = useMemo(
    () => getEventCoverSuggestionIds({ templateType: templateHint, primaryModule }),
    [templateHint, primaryModule],
  );
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
  const sortCoverList = (items: typeof coverLibrary) =>
    [...items].sort((a, b) => {
      const activeA = a.active !== false ? 1 : 0;
      const activeB = b.active !== false ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;
      const priorityA = a.priority ?? 100;
      const priorityB = b.priority ?? 100;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return a.label.localeCompare(b.label);
    });
  const filteredCoverLibrary = useMemo(() => {
    const query = coverSearch.trim().toLowerCase();
    const filtered = coverLibrary.filter((cover) => {
      if (coverCategory === "SUGESTOES") return false;
      if (coverCategory !== "ALL" && cover.category !== coverCategory) return false;
      if (!query) return true;
      const labelMatch = cover.label.toLowerCase().includes(query);
      const tagMatch = (cover.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
      const scenarioMatch = cover.scenario?.toLowerCase().includes(query) ?? false;
      const businessMatch = cover.businessType?.toLowerCase().includes(query) ?? false;
      const useCaseMatch = (cover.useCase ?? []).some((useCase) => useCase.toLowerCase().includes(query));
      const categoryMatch = cover.category?.toLowerCase().includes(query) ?? false;
      return labelMatch || tagMatch || scenarioMatch || businessMatch || useCaseMatch || categoryMatch;
    });
    return sortCoverList(filtered);
  }, [coverCategory, coverLibrary, coverSearch]);
  const coverGridItems = coverCategory === "SUGESTOES" ? suggestedCovers : filteredCoverLibrary;
  const selectedCoverToken = parseEventCoverToken(coverUrl);
  const selectedCoverLabel = selectedCoverToken
    ? coverLibrary.find((cover) => cover.id === selectedCoverToken)?.label ?? selectedCoverToken
    : null;
  const coverPreviewUrl = coverUrl
    ? getEventCoverUrl(coverUrl, {
        seed: title.trim() || `novo-${primaryLabel}`,
        suggestedIds: coverSuggestions,
        width: 1200,
        quality: 72,
        format: "webp",
      })
    : null;
  const hasActiveOrganization = Boolean(organizationStatus?.organization?.id);
  const organizationStatusValue = organizationStatus?.organization?.status ?? null;
  const organizationInactive = Boolean(organizationStatusValue && organizationStatusValue !== "ACTIVE");
  const canCreateEvents = moduleAccess[OrganizationModule.EVENTOS] === "EDIT";
  const paymentsMode = organizationStatus?.paymentsMode ?? "CONNECT";
  const isPlatformPayout = paymentsMode === "PLATFORM";
  const paymentsStatusRaw = isAdmin ? "READY" : organizationStatus?.paymentsStatus ?? "NO_STRIPE";
  const paymentsStatus = isPlatformPayout ? "READY" : paymentsStatusRaw;
  const hasPaidTicket = useMemo(
    () => !isGratisEvent && ticketTypes.some((t) => Number(t.price.replace(",", ".")) > 0),
    [isGratisEvent, ticketTypes],
  );
  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const startCalendarCells = useMemo(() => buildCalendarCells(startCalendarView), [startCalendarView]);
  const endCalendarCells = useMemo(() => buildCalendarCells(endCalendarView), [endCalendarView]);
  const organizationOfficialEmailNormalized = normalizeOfficialEmail(
    (organizationStatus?.organization as { officialEmail?: string | null } | null)?.officialEmail ?? null,
  );
  const organizationOfficialEmailVerifiedAt =
    (organizationStatus?.organization as { officialEmailVerifiedAt?: string | null } | null)?.officialEmailVerifiedAt ??
    null;
  const organizationOfficialEmailVerified = Boolean(
    organizationOfficialEmailNormalized && organizationOfficialEmailVerifiedAt,
  );
  const needsOfficialEmailVerification = !isAdmin && !organizationOfficialEmailVerified;
  const stripeNotReady = !isAdmin && paymentsStatus !== "READY";
  const paidTicketsBlocked = stripeNotReady || needsOfficialEmailVerification;
  const paidTicketsBlockedMessage = useMemo(() => {
    if (!paidTicketsBlocked) return null;
    const actions: string[] = [];
    if (stripeNotReady) actions.push("liga o Stripe");
    if (needsOfficialEmailVerification) {
      actions.push(
        organizationOfficialEmailNormalized ? "verifica o email oficial" : "define e verifica o email oficial",
      );
    }
    const actionsText = actions.join(" e ");
    return `Para vender ${ticketLabelPlural} pagos, ${actionsText}.`;
  }, [paidTicketsBlocked, stripeNotReady, needsOfficialEmailVerification, organizationOfficialEmail, ticketLabelPlural]);

  useEffect(() => {
    if (!paidTicketsBlocked) return;
    setIsFreeEvent(true);
  }, [paidTicketsBlocked]);

  const accessBlocker = useMemo(() => {
    if (!user) return null;
    if (!organizationStatus) return "A carregar dados da organização…";
    if (!hasActiveOrganization) {
      return `Seleciona uma organização ativa antes de criares ${primaryLabelPlural}.`;
    }
    if (organizationInactive) {
      return "A tua organização ainda não está ativa.";
    }
    if (!hasCurrentModule) {
      return `Ativa o módulo de ${primaryLabelPlural} nas apps da organização.`;
    }
    if (!canCreateEvents) {
      return `Sem permissões para criar ${primaryLabelPlural} nesta organização.`;
    }
    return null;
  }, [
    user,
    organizationStatus,
    hasActiveOrganization,
    organizationInactive,
    hasCurrentModule,
    canCreateEvents,
    primaryLabelPlural,
  ]);
  const organizationId = organizationStatus?.organization?.id ?? null;

  const { data: padelClubs, mutate: mutatePadelClubs } = useSWR<{ ok: boolean; items?: PadelClubSummary[] }>(
    selectedPreset === "padel" ? "/api/padel/clubs" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelDirectoryRes, isLoading: padelDirectoryLoading } = useSWR<PadelPublicClubsResponse>(
    selectedPreset === "padel" && padelClubSource === "DIRECTORY"
      ? `/api/padel/public/clubs?limit=8&includeCourts=1&q=${encodeURIComponent(padelDirectoryQuery.trim())}`
      : null,
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
  const { data: padelCategories } = useSWR<PadelCategoriesResponse>(
    selectedPreset === "padel" && organizationId
      ? `/api/padel/categories/my?organizationId=${organizationId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelRuleSets } = useSWR<PadelRuleSetsResponse>(
    selectedPreset === "padel" && organizationId
      ? `/api/padel/rulesets?organizationId=${organizationId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const padelCategoryItems = padelCategories?.items ?? [];
  const padelDirectoryClubs = padelDirectoryRes?.items ?? [];
  const padelClubItems = padelClubs?.items ?? [];
  const ownPadelClubs = useMemo(
    () => padelClubItems.filter((club) => club.kind !== "PARTNER"),
    [padelClubItems],
  );
  const partnerPadelClubs = useMemo(
    () => padelClubItems.filter((club) => club.kind === "PARTNER"),
    [padelClubItems],
  );
  const orgPadelClubs = padelClubMode === "PARTNER" ? partnerPadelClubs : ownPadelClubs;
  const selectedPadelClub =
    selectedPreset === "padel"
      ? padelClubs?.items?.find((c) => c.id === selectedPadelClubId) ?? null
      : null;

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
        isGratisEvent: boolean;
        liveHubVisibility: LiveHubVisibility;
        freeTicketName: string;
        freeTicketPublicAccess: boolean;
        freeCapacity: string;
        savedAt: number;
      }>;
      setTitle(draft.title ?? "");
      setDescription(draft.description ?? "");
      setStartsAt(draft.startsAt ?? "");
      setEndsAt(draft.endsAt ?? "");
      setLocationName(draft.locationName ?? "");
      setLocationCity(draft.locationCity ?? PT_CITIES[0]);
      setAddress(draft.address ?? "");
      if (draft.locationName || draft.locationCity || draft.address) {
        setLocationMode("MANUAL");
        setLocationManuallySet(true);
        setLocationQuery(
          [draft.locationName, draft.locationCity, draft.address].filter(Boolean).join(", ")
        );
      }
      const draftTicketTypes =
        Array.isArray(draft.ticketTypes) && draft.ticketTypes.length > 0
          ? draft.ticketTypes
          : [];
      setTicketTypes(
        draftTicketTypes.map((row) => ({
          ...row,
          publicAccess: row.publicAccess ?? true,
          totalQuantity: normalizeIntegerInput(
            typeof row.totalQuantity === "string" ? row.totalQuantity : String(row.totalQuantity ?? ""),
          ),
        })),
      );
      setCoverUrl(draft.coverUrl ?? null);
      setSelectedPreset(draft.selectedPreset ?? null);
      setIsFreeEvent(Boolean(draft.isGratisEvent));
      setLiveHubVisibility(draft.liveHubVisibility ?? "PUBLIC");
      setFreeTicketName(draft.freeTicketName || freeTicketPlaceholder);
      setFreeTicketPublicAccess(draft.freeTicketPublicAccess ?? true);
      setFreeCapacity(normalizeIntegerInput(draft.freeCapacity || ""));
    } catch (err) {
      console.warn("Falha ao carregar rascunho local", err);
    } finally {
      setDraftLoaded(true);
    }
  }, [draftLoaded, freeTicketPlaceholder]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (forcePreset) {
      if (selectedPreset !== forcePreset) {
        setSelectedPreset(forcePreset);
      }
      return;
    }
    if (!selectedPreset) {
      const nextPreset = hasEventosModule ? "default" : "padel";
      setSelectedPreset(nextPreset);
    }
  }, [draftLoaded, forcePreset, hasEventosModule, selectedPreset]);

  useEffect(() => {
    if (!draftLoaded) return;
    setFreeTicketName((prev) => {
      const normalized = prev?.trim();
      if (!normalized || normalized === "Inscrição" || normalized === "Entrada") {
        return freeTicketPlaceholder;
      }
      return prev;
    });
  }, [draftLoaded, freeTicketPlaceholder]);

  useEffect(() => {
    if (!draftLoaded || coverUrl || coverLibrary.length === 0) return;
    const randomCover = coverLibrary[Math.floor(Math.random() * coverLibrary.length)];
    if (randomCover?.token) {
      setCoverUrl(randomCover.token);
    }
  }, [coverLibrary, coverUrl, draftLoaded]);

  useEffect(() => {
    setCoverPage(1);
  }, [coverCategory, coverSearch]);

  useEffect(() => {
    if (!draftLoaded || scheduleInitializedRef.current) return;
    if (startsAt || endsAt) {
      scheduleInitializedRef.current = true;
      return;
    }
    const start = roundToNextHour(new Date());
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    setStartsAt(buildLocalDateTime(formatInputDate(start), formatInputTime(start)));
    setEndsAt(buildLocalDateTime(formatInputDate(end), formatInputTime(end)));
    scheduleInitializedRef.current = true;
  }, [draftLoaded, startsAt, endsAt]);

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
    const parsed = startDateInput ? parseInputDate(startDateInput) : null;
    if (parsed) setStartCalendarView(toMonthStart(parsed));
  }, [startDateInput]);

  useEffect(() => {
    const parsed = endDateInput ? parseInputDate(endDateInput) : null;
    if (parsed) setEndCalendarView(toMonthStart(parsed));
  }, [endDateInput]);

  useEffect(() => {
    if (!isGratisEvent) return;
    setTicketTypes([
      {
        name: freeTicketName.trim() || freeTicketPlaceholder,
        price: "0",
        totalQuantity: freeCapacity,
      },
    ]);
  }, [isGratisEvent, freeTicketName, freeCapacity, freeTicketPlaceholder]);

  useEffect(() => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
  }, [isGratisEvent]);

  useEffect(() => {
    if (selectedPreset === "padel") return;
    setSelectedPadelClubId(null);
    setSelectedPadelCourtIds([]);
    setSelectedPadelStaffIds([]);
    setPadelClubMode("OWN");
    setPadelClubSource("ORG");
    setPadelClubSourceTouched(false);
    setPadelDirectoryQuery("");
    setPadelDirectoryError(null);
    setLocationManuallySet(false);
    setPadelFormat("TODOS_CONTRA_TODOS");
    setPadelEligibility("OPEN");
    setPadelRuleSetId(null);
    setPadelCategoryIds([]);
    setPadelDefaultCategoryId(null);
    setPadelCategoryConfigs({});
    setPadelSplitDeadlineHours("48");
    setPadelWaitlistEnabled(false);
    setPadelRegistrationStartsAt("");
    setPadelRegistrationEndsAt("");
    setPadelAllowSecondCategory(true);
    setPadelMaxEntriesTotal("");
    setPadelAdvancedOpen(false);
    setPadelRulesOpen(false);
  }, [selectedPreset]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    if (!selectedPadelClubId) {
      const preferredList = padelClubMode === "PARTNER" ? partnerPadelClubs : ownPadelClubs;
      if (preferredList.length > 0) {
        const firstActive = preferredList.find((c) => c.isActive) ?? preferredList[0];
        setSelectedPadelClubId(firstActive.id);
      }
    }
  }, [selectedPreset, selectedPadelClubId, padelClubMode, ownPadelClubs, partnerPadelClubs]);

  useEffect(() => {
    if (padelClubSourceTouched || selectedPreset !== "padel") return;
    const hasOwnClubs = ownPadelClubs.length > 0;
    setPadelClubMode(hasOwnClubs ? "OWN" : "PARTNER");
    setPadelClubSource(hasOwnClubs ? "ORG" : "DIRECTORY");
  }, [padelClubSourceTouched, ownPadelClubs.length, selectedPreset]);

  useEffect(() => {
    if (!padelCourts?.items) return;
    if (padelCourts.items.length === 0) {
      if (selectedPadelCourtIds.length > 0) setSelectedPadelCourtIds([]);
      return;
    }
    const activeCourts = padelCourts.items.filter((c) => c.isActive).map((c) => c.id);
    if (activeCourts.length > 0) setSelectedPadelCourtIds(activeCourts);
  }, [padelCourts]);

  useEffect(() => {
    if (!selectedPadelClub) return;
    if (selectedPadelClub.kind === "PARTNER" && padelClubMode !== "PARTNER") {
      setPadelClubMode("PARTNER");
    }
    if (selectedPadelClub.kind !== "PARTNER" && padelClubMode !== "OWN") {
      setPadelClubMode("OWN");
    }
  }, [selectedPadelClub?.id, selectedPadelClub?.kind, padelClubMode]);

  useEffect(() => {
    if (!padelStaff?.items) return;
    if (padelStaff.items.length === 0) {
      if (selectedPadelStaffIds.length > 0) setSelectedPadelStaffIds([]);
      return;
    }
    const inherited = padelStaff.items.filter((s) => s.inheritToEvents).map((s) => s.id);
    if (inherited.length > 0) setSelectedPadelStaffIds(inherited);
  }, [padelStaff]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    const items = padelCategories?.items ?? [];
    if (!items.length) {
      if (padelCategoryIds.length > 0) setPadelCategoryIds([]);
      if (padelDefaultCategoryId !== null) setPadelDefaultCategoryId(null);
      return;
    }
    if (padelCategoryIds.length > 0) return;
    const defaults = organizationStatus?.organization?.padelDefaults?.favoriteCategories ?? [];
    const allowedDefaults = defaults.filter((id) => items.some((c) => c.id === id));
    if (allowedDefaults.length > 0) {
      setPadelCategoryIds(allowedDefaults);
      return;
    }
    if (items.length === 1) {
      setPadelCategoryIds([items[0].id]);
    }
  }, [
    selectedPreset,
    padelCategories?.items,
    padelCategoryIds.length,
    padelDefaultCategoryId,
    organizationStatus?.organization?.padelDefaults?.favoriteCategories,
  ]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    if (padelCategoryIds.length === 0) {
      if (padelDefaultCategoryId !== null) setPadelDefaultCategoryId(null);
      return;
    }
    if (!padelDefaultCategoryId || !padelCategoryIds.includes(padelDefaultCategoryId)) {
      setPadelDefaultCategoryId(padelCategoryIds[0]);
    }
  }, [selectedPreset, padelCategoryIds, padelDefaultCategoryId]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    setPadelCategoryConfigs((prev) => {
      const next: Record<number, PadelCategoryConfig> = {};
      padelCategoryIds.forEach((id) => {
        const existing = prev[id];
        next[id] = {
          capacityTeams: existing?.capacityTeams ?? "",
          format: existing?.format ?? null,
        };
      });
      return next;
    });
  }, [selectedPreset, padelCategoryIds]);

  const resolvePadelCategoryLabel = (categoryId: number) =>
    padelCategoryItems.find((cat) => cat.id === categoryId)?.label?.trim() || `Categoria ${categoryId}`;

  const normalizePadelTicketBaseName = (name: string) => {
    const base = name.split("·")[0]?.trim();
    return base || freeTicketPlaceholder;
  };

  const getPadelCategoryTag = (categoryId: number) => {
    const cat = padelCategoryItems.find((item) => item.id === categoryId);
    if (!cat) return `CAT${categoryId}`;
    const genderCode =
      cat.genderRestriction === "MALE" ? "M" : cat.genderRestriction === "FEMALE" ? "F" : "MX";
    const levelSource = cat.minLevel || cat.maxLevel || "";
    const level = levelSource || (cat.label.match(/\d+/)?.[0] ?? "");
    if (level) return `${genderCode}${level}`;
    return cat.label.trim();
  };

  const getPadelCategoryDescriptor = (categoryId: number) => {
    const cat = padelCategoryItems.find((item) => item.id === categoryId);
    const tag = getPadelCategoryTag(categoryId);
    if (!cat) return { tag, detail: "" };
    const genderLabel =
      cat.genderRestriction === "MALE"
        ? "Masculino"
        : cat.genderRestriction === "FEMALE"
          ? "Feminino"
          : cat.genderRestriction
            ? "Misto"
            : "";
    const levelLabel =
      cat.minLevel && cat.maxLevel
        ? `Nível ${cat.minLevel}-${cat.maxLevel}`
        : cat.minLevel
          ? `Nível ${cat.minLevel}+`
          : cat.maxLevel
            ? `Nível até ${cat.maxLevel}`
            : "";
    const detail = [genderLabel, levelLabel].filter(Boolean).join(" · ");
    return { tag, detail };
  };

  const buildPadelTicketNameForCategory = (name: string, categoryId: number | null) => {
    if (!categoryId) return name.trim();
    const baseName = normalizePadelTicketBaseName(name);
    const tag = getPadelCategoryTag(categoryId);
    return `${baseName} · ${tag}`;
  };

  const getPadelTicketTemplate = (rows: TicketTypeRow[]) => {
    const candidate = rows.find((row) => row.name || row.price || row.totalQuantity) ?? rows[0];
    const baseName = normalizePadelTicketBaseName(candidate?.name ?? "");
    return {
      name: baseName,
      price: candidate?.price ?? "",
      totalQuantity: candidate?.totalQuantity ?? "",
      publicAccess: candidate?.publicAccess ?? true,
    };
  };

  useEffect(() => {
    if (!isPadelPaid) return;
    if (padelCategoryIds.length === 0) {
      if (ticketTypes.length > 0) setTicketTypes([]);
      return;
    }
    setTicketTypes((prev) => {
      const template = getPadelTicketTemplate(prev);
      return padelCategoryIds.map((categoryId) => {
        const existing = prev.find((row) => row.padelCategoryId === categoryId);
        if (existing) return existing;
        return {
          name: buildPadelTicketNameForCategory(template.name, categoryId),
          price: template.price,
          totalQuantity: template.totalQuantity,
          publicAccess: template.publicAccess ?? true,
          padelCategoryId: categoryId,
        };
      });
    });
  }, [
    isPadelPaid,
    padelCategoryIds,
    padelCategoryItems,
  ]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    if (padelRuleSetId) return;
    const defaultRuleSetId = organizationStatus?.organization?.padelDefaults?.ruleSetId ?? null;
    if (!defaultRuleSetId) return;
    if (!padelRuleSets?.items?.some((r) => r.id === defaultRuleSetId)) return;
    setPadelRuleSetId(defaultRuleSetId);
  }, [selectedPreset, padelRuleSetId, padelRuleSets?.items, organizationStatus?.organization?.padelDefaults?.ruleSetId]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    if (!selectedPadelClubId) return;
    const club = padelClubs?.items?.find((c) => c.id === selectedPadelClubId);
    if (!club) return;
    const composed =
      club.locationFormattedAddress?.trim() ||
      [club.address?.trim(), club.city?.trim()].filter(Boolean).join(", ");
    if (!locationManuallySet) {
      if (composed) setLocationName(composed);
      else if (!locationName) setLocationName(club.name ?? "");
    }
    if (club.city) {
      // Preenche cidade a partir do clube, mas não sobrepõe escolha manual já feita.
      if (!locationManuallySet || !locationCity) {
        setLocationCity(club.city);
      }
    }
    if (!locationManuallySet) {
      setLocationMode("MANUAL");
      setLocationProviderId(null);
      setLocationFormattedAddress(null);
      setLocationComponents(null);
      setLocationLat(null);
      setLocationLng(null);
      setLocationQuery(composed || club.name || "");
    }
  }, [selectedPreset, selectedPadelClubId, padelClubs?.items, locationManuallySet, locationName]);

  useEffect(() => {
    if (locationMode !== "OSM") {
      setLocationSuggestions([]);
      setLocationSearchLoading(false);
      setLocationSearchError(null);
      return;
    }
    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError(null);
      return;
    }
    if (locationSearchTimeout.current) {
      clearTimeout(locationSearchTimeout.current);
    }
    setLocationSearchError(null);
    const seq = ++locationSearchSeq.current;
    locationSearchTimeout.current = setTimeout(async () => {
      setLocationSearchLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        if (locationSearchSeq.current === seq) {
          setLocationSuggestions(items);
        }
      } catch (err) {
        console.warn("[eventos/novo] autocomplete falhou", err);
        if (locationSearchSeq.current === seq) {
          setLocationSuggestions([]);
          setLocationSearchError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
        }
      } finally {
        if (locationSearchSeq.current === seq) {
          setLocationSearchLoading(false);
        }
      }
    }, 280);

    return () => {
      if (locationSearchTimeout.current) {
        clearTimeout(locationSearchTimeout.current);
      }
    };
  }, [locationMode, locationQuery]);

  const applyGeoDetails = (details: GeoDetailsItem | null, fallbackName?: string | null) => {
    if (!details) return;
    const nextName = details.name || fallbackName || locationName;
    const nextCity = details.city || locationCity;
    const nextAddress = details.address || address;
    setLocationFormattedAddress(details.formattedAddress || locationFormattedAddress);
    setLocationComponents(details.components ?? null);
    const detailsHouse =
      details.components && typeof (details.components as { houseNumber?: unknown }).houseNumber === "string"
        ? ((details.components as { houseNumber?: string }).houseNumber ?? "")
        : "";
    const detailsPostal =
      details.components && typeof (details.components as { postalCode?: unknown }).postalCode === "string"
        ? ((details.components as { postalCode?: string }).postalCode ?? "")
        : "";
    setLocationHouseNumber(detailsHouse);
    setLocationPostalCode(detailsPostal);
    if (Number.isFinite(details.lat ?? NaN) && Number.isFinite(details.lng ?? NaN)) {
      setLocationLat(details.lat);
      setLocationLng(details.lng);
    }
    if (nextName) setLocationName(nextName);
    if (nextCity) setLocationCity(nextCity);
    if (nextAddress) setAddress(nextAddress);
  };

  const handleSelectGeoSuggestion = async (item: GeoAutocompleteItem) => {
    setLocationMode("OSM");
    setLocationManuallySet(true);
    setLocationTbd(false);
    setLocationProviderId(item.providerId);
    activeProviderRef.current = item.providerId;
    setLocationLat(item.lat);
    setLocationLng(item.lng);
    setLocationQuery(item.label);
    setLocationName(item.name || item.label);
    setLocationCity(item.city || "");
    setAddress(item.address || "");
    setLocationFormattedAddress(item.label);
    setLocationComponents(null);
    setLocationHouseNumber("");
    setLocationPostalCode("");
    setLocationSearchError(null);
    setShowLocationSuggestions(false);
    setLocationConfirmed(false);

    const seq = ++locationDetailsSeq.current;
    setLocationDetailsLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId);
      if (locationDetailsSeq.current !== seq) return;
      if (activeProviderRef.current !== item.providerId) return;
      applyGeoDetails(details, item.name || item.label);
      if (details?.formattedAddress) {
        setLocationQuery(details.formattedAddress);
      }
    } catch (err) {
      console.warn("[eventos/novo] detalhes falharam", err);
    } finally {
      if (locationDetailsSeq.current === seq) {
        setLocationDetailsLoading(false);
      }
    }
  };

  const enableManualLocation = () => {
    setLocationMode("MANUAL");
    setLocationManuallySet(true);
    setLocationProviderId(null);
    activeProviderRef.current = null;
    setLocationFormattedAddress(null);
    setLocationComponents(null);
    setLocationHouseNumber("");
    setLocationPostalCode("");
    setLocationLat(null);
    setLocationLng(null);
    setLocationSuggestions([]);
    setLocationSearchLoading(false);
    setLocationSearchError(null);
    setLocationConfirmed(true);
  };

  const enableOsmLocation = () => {
    setLocationMode("OSM");
    setLocationTbd(false);
    setLocationProviderId(null);
    activeProviderRef.current = null;
    setLocationFormattedAddress(null);
    setLocationComponents(null);
    setLocationHouseNumber("");
    setLocationPostalCode("");
    setLocationLat(null);
    setLocationLng(null);
    setLocationSearchError(null);
    setLocationConfirmed(false);
    if (!locationQuery) {
      const fallback = [locationName, locationCity, address].filter(Boolean).join(", ");
      if (fallback) setLocationQuery(fallback);
    }
  };

  const markLocationTbd = () => {
    setLocationMode("MANUAL");
    setLocationManuallySet(true);
    setLocationTbd(true);
    setLocationName("");
    setLocationCity("");
    setAddress("");
    setLocationProviderId(null);
    activeProviderRef.current = null;
    setLocationFormattedAddress(null);
    setLocationComponents(null);
    setLocationHouseNumber("");
    setLocationPostalCode("");
    setLocationLat(null);
    setLocationLng(null);
    setLocationQuery("");
    setLocationSuggestions([]);
    setLocationSearchLoading(false);
    setLocationSearchError(null);
    setLocationConfirmed(true);
  };

  const baseInputClasses =
    "w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-sm text-white/90 placeholder:text-white/45 outline-none transition backdrop-blur-sm focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)] focus:ring-offset-0 focus:ring-offset-transparent";
  const errorInputClasses =
    "border-[rgba(255,0,200,0.45)] focus:border-[rgba(255,0,200,0.6)] focus:ring-[rgba(255,0,200,0.4)]";
  const inputClass = (errored?: boolean) => `${baseInputClasses} ${errored ? errorInputClasses : ""}`;
  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 flex items-center gap-1";
  const errorTextClass = "flex items-center gap-2 text-[12px] font-semibold text-pink-200 min-h-[18px]";
  const padelFormatOptions = [
    { value: "TODOS_CONTRA_TODOS", label: "Todos vs todos" },
    { value: "QUADRO_ELIMINATORIO", label: "Eliminatório" },
    { value: "GRUPOS_ELIMINATORIAS", label: "Grupos + KO" },
    { value: "QUADRO_AB", label: "Quadro A/B" },
    { value: "DUPLA_ELIMINACAO", label: "Dupla eliminação" },
    { value: "NON_STOP", label: "Non-stop" },
    { value: "CAMPEONATO_LIGA", label: "Campeonato/Liga" },
  ];
  const normalizeRegistrationValue = (value: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };
  const dateOrderWarning = startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime();
  const today = startOfDay(new Date());
  const selectedStartDate = startDateInput ? parseInputDate(startDateInput) : null;
  const selectedEndDate = endDateInput ? parseInputDate(endDateInput) : null;
  const minEndDate = selectedStartDate ?? today;

  const createPartnerCourts = async (clubId: number, club: PadelPublicClub) => {
    const courtsSource =
      Array.isArray(club.courts) && club.courts.length > 0
        ? club.courts.map((court, idx) => ({
            name: court.name || `Court ${idx + 1}`,
            indoor: Boolean(court.indoor),
            surface: court.surface ?? "",
            displayOrder: idx + 1,
          }))
        : Array.from({ length: Math.max(1, club.courtsCount ?? 1) }).map((_, idx) => ({
            name: `Court ${idx + 1}`,
            indoor: false,
            surface: "",
            displayOrder: idx + 1,
          }));

    const createdIds: number[] = [];
    for (const court of courtsSource) {
      const res = await fetch(`/api/padel/clubs/${clubId}/courts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: court.name,
          description: "",
          surface: court.surface,
          indoor: court.indoor,
          isActive: true,
          displayOrder: court.displayOrder,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.court?.id) {
        createdIds.push(json.court.id);
      }
    }
    return createdIds;
  };

  const createPartnerClubFromDirectory = async (club: PadelPublicClub) => {
    if (!organizationId) {
      setPadelDirectoryError("Seleciona uma organização antes de adicionar o clube.");
      return;
    }
    const existingPartner = partnerPadelClubs.find(
      (item) => item.sourceClubId === club.id || (item.name === club.name && item.city === club.city),
    );
    if (existingPartner) {
      setPadelClubMode("PARTNER");
      setPadelClubSource("DIRECTORY");
      setPadelClubSourceTouched(true);
      setSelectedPadelClubId(existingPartner.id);
      clearErrorsForFields(["padel"]);
      return;
    }
    setPadelDirectoryError(null);
    setCreatingPartnerClubId(club.id);
    try {
      const formattedAddress = [club.address, club.city].filter(Boolean).join(", ");
      const res = await fetch("/api/padel/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: club.name,
          city: club.city ?? "",
          address: club.address ?? "",
          kind: "PARTNER",
          sourceClubId: club.id,
          locationSource: "MANUAL",
          locationFormattedAddress: formattedAddress || null,
          courtsCount: club.courtsCount ?? 1,
          isActive: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.club) {
        setPadelDirectoryError(json?.error || "Nao foi possivel criar o clube parceiro.");
        return;
      }
      const savedClub = json.club as { id?: number };
      if (!savedClub.id) {
        setPadelDirectoryError("Erro ao criar clube parceiro.");
        return;
      }
      await mutatePadelClubs();
      setPadelClubMode("PARTNER");
      setPadelClubSource("DIRECTORY");
      setPadelClubSourceTouched(true);
      setSelectedPadelClubId(savedClub.id);
      clearErrorsForFields(["padel"]);
      setLocationManuallySet(false);
      const createdCourtIds = await createPartnerCourts(savedClub.id, club);
      if (createdCourtIds.length > 0) {
        setSelectedPadelCourtIds(createdCourtIds);
      }
    } catch (err) {
      setPadelDirectoryError("Erro ao criar clube parceiro.");
    } finally {
      setCreatingPartnerClubId(null);
    }
  };

  const padelExtrasContent =
    selectedPreset === "padel" ? (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <label className={`${labelClass} m-0`}>Clube</label>
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/65">
                Courts: {padelCourts?.items?.filter((c) => c.isActive).length ?? "—"} · Sel: {selectedPadelCourtIds.length || "—"}
              </span>
            </div>
              <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                {[
                  { key: "ORG" as const, label: "Meus clubes" },
                  { key: "DIRECTORY" as const, label: "Parceiros" },
                ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setPadelClubMode(opt.key === "DIRECTORY" ? "PARTNER" : "OWN");
                    setPadelClubSource(opt.key);
                    setPadelClubSourceTouched(true);
                    setPadelDirectoryError(null);
                    clearErrorsForFields(["padel"]);
                  }}
                  className={`rounded-full px-3 py-1 transition ${
                    padelClubSource === opt.key
                      ? "bg-white text-black font-semibold shadow"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {padelClubSource === "ORG" ? (
              <>
                <select
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                  value={selectedPadelClubId ?? ""}
                  onChange={(e) => {
                    setLocationManuallySet(false);
                    setSelectedPadelClubId(Number(e.target.value) || null);
                    clearErrorsForFields(["padel"]);
                  }}
                >
                  <option value="">Clube</option>
                  {orgPadelClubs
                    .filter((c) => c.isActive)
                    .map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name} {club.city ? `— ${club.city}` : ""}
                      </option>
                    ))}
                </select>
                {orgPadelClubs.length === 0 && (
                  <div ref={padelCategoriesRef} className="space-y-2">
                    <p className="text-[12px] text-white/60">Sem clubes na tua organizacao.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPadelClubMode("PARTNER");
                          setPadelClubSource("DIRECTORY");
                          setPadelClubSourceTouched(true);
                          setPadelDirectoryError(null);
                          clearErrorsForFields(["padel"]);
                        }}
                        className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                      >
                        Procurar no diretorio
                      </button>
                      <Link
                        href="/organizacao/torneios?section=padel-hub&padel=clubs"
                        className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/30"
                      >
                        Criar clube rapido
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {partnerPadelClubs.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-white/12 bg-black/35 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Parceiros já adicionados</p>
                    <div className="space-y-2">
                      {partnerPadelClubs.map((club) => (
                        <div
                          key={`partner-${club.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px]"
                        >
                          <div>
                            <p className="font-semibold text-white">{club.name}</p>
                            <p className="text-white/60">{[club.city, club.address].filter(Boolean).join(" · ")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPadelClubId(club.id);
                              setPadelClubMode("PARTNER");
                              setPadelClubSource("DIRECTORY");
                              setPadelClubSourceTouched(true);
                              clearErrorsForFields(["padel"]);
                            }}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                          >
                            Selecionar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  value={padelDirectoryQuery}
                  onChange={(e) => setPadelDirectoryQuery(e.target.value)}
                  placeholder="Pesquisar clube, cidade, organizacao"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                />
                {padelDirectoryError && (
                  <p className="text-[12px] text-rose-200">{padelDirectoryError}</p>
                )}
                {padelDirectoryLoading ? (
                  <p className="text-[12px] text-white/60">A procurar clubes...</p>
                ) : padelDirectoryClubs.length === 0 ? (
                  <p className="text-[12px] text-white/60">Sem resultados no diretorio.</p>
                ) : (
                  <div className="space-y-2">
                    {padelDirectoryClubs.map((club) => {
                      const isBusy = creatingPartnerClubId === club.id;
                      return (
                        <div
                          key={`dir-${club.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-white">{club.name}</p>
                            <p className="text-[11px] text-white/60">
                              {[club.city, club.address].filter(Boolean).join(" · ") || "Local por definir"}
                            </p>
                            {club.organizationName && (
                              <p className="text-[10px] text-white/45">{club.organizationName}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => createPartnerClubFromDirectory(club)}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-white/40 disabled:opacity-60"
                          >
                            {isBusy ? "A adicionar..." : "Adicionar parceiro"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Courts</label>
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 max-h-56 overflow-auto space-y-2">
              {!selectedPadelClubId && (
                <p className="text-[12px] text-white/60">Seleciona um clube para carregar courts.</p>
              )}
              {selectedPadelClubId &&
                (padelCourts?.items || [])
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
                          onChange={(e) => {
                            clearErrorsForFields(["padel"]);
                            setSelectedPadelCourtIds((prev) =>
                              e.target.checked ? [...prev, ct.id] : prev.filter((id) => id !== ct.id),
                            );
                          }}
                          className="accent-white"
                        />
                        <span>{ct.name}</span>
                        <span className="text-[10px] text-white/50">#{ct.displayOrder}</span>
                      </label>
                    );
                  })}
              {selectedPadelClubId && !padelCourts?.items?.length && (
                <p className="text-[12px] text-white/60">Sem courts.</p>
              )}
              {selectedPadelCourtIds.length === 0 && (padelCourts?.items?.length || 0) > 0 && (
                <p className="text-[11px] text-red-200">Seleciona 1 court.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Staff</label>
          {padelClubMode === "PARTNER" && (
            <p className="text-[11px] text-amber-200">Obrigatório para clubes parceiros.</p>
          )}
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 max-h-48 overflow-auto space-y-2">
            {!selectedPadelClubId && (
              <p className="text-[12px] text-white/60">Seleciona um clube para carregar staff.</p>
            )}
            {selectedPadelClubId &&
              (padelStaff?.items || []).map((member) => {
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
                      onChange={(e) => {
                        clearErrorsForFields(["padel"]);
                        setSelectedPadelStaffIds((prev) =>
                          e.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                        );
                      }}
                      className="accent-white"
                    />
                    <span>{member.fullName || member.email || "Staff"}</span>
                    {member.inheritToEvents && <span className="text-[10px] text-emerald-300">auto</span>}
                  </label>
                );
              })}
            {selectedPadelClubId && !padelStaff?.items?.length && (
              <p className="text-[12px] text-white/60">Sem staff.</p>
            )}
          </div>
        </div>
      </div>
    ) : null;

  const scrollToPadelTarget = (ref: RefObject<HTMLElement | null>) => {
    const target = ref.current ?? padelSectionRef.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const openPadelOperation = () => {
    setPadelAdvancedOpen(true);
    setTimeout(() => {
      scrollToPadelTarget(padelOperationRef);
    }, 80);
  };

  const handlePadelClubModeChange = (mode: "OWN" | "PARTNER") => {
    clearErrorsForFields(["padel"]);
    setPadelClubMode(mode);
    setPadelClubSourceTouched(true);
    if (!selectedPadelClubId) {
      setPadelClubSource(mode === "PARTNER" ? "DIRECTORY" : "ORG");
    } else if (mode === "OWN" && padelClubSource !== "ORG") {
      setPadelClubSource("ORG");
    }
    setPadelDirectoryError(null);
    setPadelAdvancedOpen(true);
  };

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: `${detailBasePath}/novo`,
    });
  };

  const handleAddTicketType = () => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
    if (isPadelPaid) {
      return;
    }
    const padelCategoryId =
      selectedPreset === "padel" && padelCategoryIds.length === 1 ? padelCategoryIds[0] : null;
    setTicketTypes((prev) => [
      ...prev,
      {
        name: "",
        price: "",
        totalQuantity: "",
        publicAccess: true,
        padelCategoryId,
      },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
    if (isPadelPaid) return;
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTicketChange = (index: number, field: keyof TicketTypeRow, value: string) => {
    const nextValue = field === "totalQuantity" ? normalizeIntegerInput(value) : value;
    setTicketTypes((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field !== "name" || !isPadelPaid) {
          return { ...row, [field]: nextValue };
        }
        const name = buildPadelTicketNameForCategory(String(nextValue), row.padelCategoryId ?? null);
        return { ...row, name };
      }),
    );
    clearErrorsForFields(["tickets"]);
    setStripeAlert(null);
  };

  const handleTicketCategoryChange = (index: number, value: string) => {
    if (isPadelPaid) return;
    const parsed = value ? Number(value) : null;
    const nextValue = Number.isFinite(parsed) ? parsed : null;
    setTicketTypes((prev) => prev.map((row, i) => (i === index ? { ...row, padelCategoryId: nextValue } : row)));
    clearErrorsForFields(["tickets"]);
  };

  const setTicketPublicAccess = (index: number, isPublic: boolean) => {
    setTicketTypes((prev) => prev.map((row, i) => (i === index ? { ...row, publicAccess: isPublic } : row)));
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

  const shouldSplitFreeTickets =
    isGratisEvent && selectedPreset === "padel" && padelCategoryIds.length > 1;

  const parsePositiveInteger = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  };

  const getPadelTicketCapacityValue = (categoryId: number) => {
    const row = ticketTypes.find((ticket) => ticket.padelCategoryId === categoryId);
    return row?.totalQuantity ?? "";
  };

  const getPadelTicketCapacityNumber = (categoryId: number) =>
    parsePositiveInteger(getPadelTicketCapacityValue(categoryId));

  const buildTicketsPayload = () => {
    if (isGratisEvent) {
      const totalQuantityRaw = freeCapacity ? Number(freeCapacity) : null;
      const parsedQuantity =
        typeof totalQuantityRaw === "number" && Number.isFinite(totalQuantityRaw) && totalQuantityRaw > 0
          ? Math.floor(totalQuantityRaw)
          : null;
      const baseName = freeTicketName.trim() || freeTicketPlaceholder;

      if (shouldSplitFreeTickets) {
        return padelCategoryIds.map((categoryId) => {
          const config = padelCategoryConfigs[categoryId];
          const categoryCapacityRaw = config?.capacityTeams ? Number(config.capacityTeams) : null;
          const categoryCapacity =
            typeof categoryCapacityRaw === "number" && Number.isFinite(categoryCapacityRaw) && categoryCapacityRaw > 0
              ? Math.floor(categoryCapacityRaw)
              : null;
          return {
            name: `${baseName} · ${resolvePadelCategoryLabel(categoryId)}`,
            price: 0,
            totalQuantity: categoryCapacity ?? parsedQuantity,
            publicAccess: freeTicketPublicAccess,
            participantAccess: true,
            padelCategoryId: categoryId,
          };
        });
      }

      const singleCategoryId =
        selectedPreset === "padel" && padelCategoryIds.length === 1 ? padelCategoryIds[0] : null;
      return [
        {
          name: baseName,
          price: 0,
          totalQuantity: parsedQuantity,
          publicAccess: freeTicketPublicAccess,
          participantAccess: true,
          padelCategoryId: singleCategoryId ?? undefined,
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
        const resolvedPadelCategoryId =
          selectedPreset === "padel" &&
          typeof row.padelCategoryId === "number" &&
          padelCategoryIds.includes(row.padelCategoryId)
            ? row.padelCategoryId
            : null;
        const name =
          resolvedPadelCategoryId !== null
            ? buildPadelTicketNameForCategory(row.name, resolvedPadelCategoryId)
            : row.name.trim();
        return {
          name,
          price,
          totalQuantity,
          publicAccess: row.publicAccess ?? true,
          participantAccess: true,
          padelCategoryId: resolvedPadelCategoryId ?? undefined,
        };
      })
      .filter((t) => t.name);
  };

  const preparedTickets = useMemo(
    () => buildTicketsPayload(),
    [
      isGratisEvent,
      freeTicketName,
      freeTicketPublicAccess,
      freeCapacity,
      ticketTypes,
      selectedPreset,
      padelCategoryIds,
      padelCategoryConfigs,
      padelCategories?.items,
    ],
  );

  const ticketsSummary = useMemo(() => {
    if (isPadelPreset && padelCategoryIds.length === 0) {
      return "Sem categorias";
    }
    if (preparedTickets.length === 0) {
      return isPadelPreset ? "Sem inscrições (1 gratuita)" : "Sem bilhetes (1 gratuito)";
    }
    if (isGratisEvent) {
      if (shouldSplitFreeTickets) {
        return `Grátis · ${padelCategoryIds.length} categorias`;
      }
      const cap = freeCapacity ? `${freeCapacity} vagas` : "Sem limite";
      return `Grátis · ${cap}`;
    }
    if (isPadelPaid) {
      const minPrice = Math.min(...preparedTickets.map((t) => t.price));
      const countLabel = `${padelCategoryIds.length} categoria${padelCategoryIds.length === 1 ? "" : "s"}`;
      return `${countLabel} · desde ${minPrice.toFixed(2)} €`;
    }
    const minPrice = Math.min(...preparedTickets.map((t) => t.price));
    const countLabel = `${preparedTickets.length} ${preparedTickets.length === 1 ? ticketLabel : ticketLabelPlural}`;
    return `${countLabel} · desde ${minPrice.toFixed(2)} €`;
  }, [
    preparedTickets,
    isGratisEvent,
    freeCapacity,
    shouldSplitFreeTickets,
    padelCategoryIds.length,
    isPadelPaid,
    isPadelPreset,
    ticketLabel,
    ticketLabelPlural,
  ]);

  const liveHubSummary =
    liveHubVisibility === "PUBLIC" ? "Público" : liveHubVisibility === "PRIVATE" ? "Privado" : "Desativado";
  const hasPublicTickets = useMemo(() => {
    if (isGratisEvent) return freeTicketPublicAccess;
    if (ticketTypes.length === 0) return true;
    return ticketTypes.some((ticket) => ticket.publicAccess !== false);
  }, [isGratisEvent, freeTicketPublicAccess, ticketTypes]);
  const hasInviteRestrictedTickets = useMemo(() => {
    if (isGratisEvent) return !freeTicketPublicAccess;
    if (ticketTypes.length === 0) return false;
    return ticketTypes.some((ticket) => ticket.publicAccess === false);
  }, [isGratisEvent, freeTicketPublicAccess, ticketTypes]);
  const accessSummary = hasInviteRestrictedTickets
    ? hasPublicTickets
      ? "Misto"
      : "Convite"
    : "Público";

  const locationSummary = useMemo(() => {
    if (locationFormattedAddress) return locationFormattedAddress;
    const parts = [locationName.trim(), locationCity.trim(), address.trim()].filter(Boolean);
    if (parts.length === 0) return "Localização";
    return parts.join(" · ");
  }, [locationFormattedAddress, locationName, locationCity, address]);

  const buildLocationFormattedAddress = () => {
    const components = locationComponents as
      | {
          road?: string | null;
          houseNumber?: string | null;
          postalCode?: string | null;
          address?: Record<string, unknown>;
        }
      | null;
    const road =
      (typeof components?.road === "string" && components.road.trim()) ||
      (typeof components?.address?.road === "string" && components.address.road.trim()) ||
      null;
    const houseNumber = locationHouseNumber.trim() || (components?.houseNumber ?? "");
    const postalCode = locationPostalCode.trim() || (components?.postalCode ?? "");
    const country =
      (typeof components?.address?.country === "string" && components.address.country.trim()) || "";
    const line1 = [road, houseNumber].filter(Boolean).join(" ").trim();
    const line2 = [postalCode.trim(), locationCity.trim()].filter(Boolean).join(" ").trim();
    const parts = [line1, line2, country].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
    if (locationFormattedAddress) return locationFormattedAddress;
    return [locationName, locationCity, address].filter(Boolean).join(", ");
  };
  const descriptionSummary = useMemo(() => {
    const trimmed = description.trim();
    if (!trimmed) return "Descrição";
    const short = trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
    return short;
  }, [description]);
  const padelRuleSetItems = padelRuleSets?.items ?? [];
  const padelFormatLabel =
    padelFormatOptions.find((opt) => opt.value === padelFormat)?.label ?? "—";
  const padelRuleSetLabel = padelRuleSetId
    ? padelRuleSetItems.find((rs) => rs.id === padelRuleSetId)?.name ?? "Personalizado"
    : "Padrão";
  const padelCategoryCountLabel = padelCategoryIds.length
    ? `${padelCategoryIds.length} categoria${padelCategoryIds.length === 1 ? "" : "s"}`
    : "Sem categorias";
  const padelTicketCategoryIds = preparedTickets
    .map((ticket) => ticket.padelCategoryId)
    .filter((id): id is number => typeof id === "number");
  const padelTicketCategorySet = new Set(padelTicketCategoryIds);
  const padelTicketsCovered =
    padelCategoryIds.length > 0 && padelCategoryIds.every((id) => padelTicketCategorySet.has(id));
  const padelTicketsUnique = padelTicketCategoryIds.length === padelTicketCategorySet.size;
  const padelTicketsOk = padelTicketsCovered && (isGratisEvent || padelTicketsUnique);
  const padelClubOk = Boolean(selectedPadelClubId);
  const padelCourtsOk = selectedPadelCourtIds.length > 0;
  const padelCategoriesOk = padelCategoryIds.length > 0;
  const hasPadelStaff = (padelStaff?.items?.length ?? 0) > 0;
  const padelStaffStatus: "ok" | "missing" | "optional" =
    padelClubMode === "PARTNER"
      ? selectedPadelStaffIds.length > 0
        ? "ok"
        : hasPadelStaff
          ? "missing"
          : "optional"
      : selectedPadelStaffIds.length > 0
        ? "ok"
        : "optional";
  const padelChecklist = [
    {
      key: "club",
      label: "Clube",
      status: padelClubOk ? "ok" : "missing",
      detail: selectedPadelClub?.name ?? "Seleciona um clube.",
    },
    {
      key: "courts",
      label: "Courts",
      status: padelCourtsOk ? "ok" : "missing",
      detail: padelCourtsOk
        ? `${selectedPadelCourtIds.length} selecionado(s).`
        : selectedPadelClubId
          ? "Seleciona pelo menos 1 court."
          : "Seleciona um clube para carregar courts.",
    },
    {
      key: "categories",
      label: "Categorias",
      status: padelCategoriesOk ? "ok" : "missing",
      detail: padelCategoriesOk ? `${padelCategoryIds.length} escolhida(s).` : "Seleciona pelo menos 1 categoria.",
    },
    {
      key: "tickets",
      label: ticketLabelPluralCap,
      status: padelTicketsOk ? "ok" : "missing",
      detail: padelTicketsOk ? ticketsSummary : `Confirma ${ticketLabelPlural} por categoria.`,
    },
    {
      key: "staff",
      label: "Staff",
      status: padelStaffStatus,
      detail:
        padelStaffStatus === "ok"
          ? `${selectedPadelStaffIds.length} selecionado(s).`
          : padelStaffStatus === "missing"
            ? selectedPadelClubId
              ? "Seleciona staff local do clube parceiro."
              : "Seleciona um clube para carregar staff."
            : "Opcional (recomendado).",
    },
  ];
  const padelChecklistRequired = padelChecklist.filter((item) => item.status !== "optional");
  const padelChecklistComplete = padelChecklistRequired.filter((item) => item.status === "ok").length;
  const padelChecklistTotal = padelChecklistRequired.length;
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
    const requiresCity = !(locationMode === "MANUAL" && locationTbd);
    if (!locationCity.trim() && requiresCity) {
      issues.push({ field: "locationCity", message: "Cidade obrigatória." });
    }
    if (locationMode === "MANUAL" && !locationTbd && !locationName.trim()) {
      issues.push({ field: "locationName", message: "Local obrigatório." });
    }
    if (locationMode === "OSM" && !locationProviderId) {
      issues.push({ field: "locationName", message: "Seleciona uma sugestão de localização." });
    }
    if (locationMode === "OSM" && locationProviderId && !locationConfirmed) {
      issues.push({ field: "locationName", message: "Confirma a localização antes de guardar." });
    }
    if (endsAt && startsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      issues.push({ field: "endsAt", message: "A data/hora de fim tem de ser depois do início." });
    }

    const currentTickets = buildTicketsPayload();

    if (currentTickets.length > 0) {
      if (!isGratisEvent) {
        const hasNegativePrice = currentTickets.some((t) => t.price < 0);
        const hasBelowMinimum = currentTickets.some((t) => t.price >= 0 && t.price < 1);
        if (hasNegativePrice) {
          issues.push({ field: "tickets", message: "Preço tem de ser positivo." });
        }
        if (hasBelowMinimum) {
          issues.push({
            field: "tickets",
            message: `Para ${primaryLabelPlural} pagos, cada ${ticketLabel} tem de custar pelo menos 1 €.`,
          });
        }
      }
      if (!isGratisEvent && hasPaidTicket && paidTicketsBlocked) {
        issues.push({
          field: "tickets",
          message:
            paidTicketsBlockedMessage ??
            `Liga o Stripe e verifica o email oficial da organização para vender ${ticketLabelPlural} pagos.`,
        });
      }
    }

    if (selectedPreset === "padel") {
      if (!selectedPadelClubId) {
        issues.push({ field: "padel", message: "Seleciona um clube de padel para o torneio." });
      } else if (selectedPadelCourtIds.length === 0) {
        issues.push({ field: "padel", message: "Seleciona pelo menos 1 court para o torneio de padel." });
      }
      if (
        padelClubMode === "PARTNER" &&
        selectedPadelClubId &&
        selectedPadelStaffIds.length === 0 &&
        (padelStaff?.items?.length ?? 0) > 0
      ) {
        issues.push({ field: "padel", message: "Seleciona staff local para o clube parceiro." });
      }
    }

    if (selectedPreset === "padel" && padelCategoryIds.length === 0) {
      const message =
        padelCategoryItems.length > 0
          ? "Seleciona pelo menos uma categoria de padel."
          : "Cria pelo menos uma categoria de padel.";
      issues.push({ field: "padel", message });
    }
    if (selectedPreset === "padel" && !isGratisEvent) {
      const ticketCategoryIds = currentTickets
        .map((t) => t.padelCategoryId)
        .filter((id): id is number => typeof id === "number");
      const uniqueTicketCategories = new Set(ticketCategoryIds);
      const missingCategories = padelCategoryIds.filter((id) => !uniqueTicketCategories.has(id));
      if (missingCategories.length > 0) {
        issues.push({ field: "tickets", message: `Cria ${ticketLabelIndefinite} ${ticketLabel} por categoria de padel.` });
      }
      if (ticketCategoryIds.length !== uniqueTicketCategories.size) {
        issues.push({ field: "tickets", message: `Cada ${ticketLabel} deve apontar para uma categoria diferente.` });
      }
      const missingTag = currentTickets.some((ticket) => {
        if (typeof ticket.padelCategoryId !== "number") return false;
        const expectedTag = getPadelCategoryTag(ticket.padelCategoryId);
        return !ticket.name.includes(expectedTag);
      });
      if (missingTag) {
        issues.push({
          field: "tickets",
          message: `O nome ${ticketLabelArticle} ${ticketLabel} deve incluir o código da categoria (ex: M4).`,
        });
      }
    }
    if (selectedPreset === "padel" && padelRegistrationStartsAt && padelRegistrationEndsAt) {
      const start = new Date(padelRegistrationStartsAt);
      const end = new Date(padelRegistrationEndsAt);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) {
        issues.push({ field: "padel", message: "A data de fecho das inscrições deve ser depois da abertura." });
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
      if (isPadelPreset) {
        const target = padelTicketsRef.current ?? padelSectionRef.current;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      setShowTicketsModal(true);
      setPendingFocusField(field);
      return;
    }
    if (field === "padel") {
      if (padelSectionRef.current) {
        padelSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (field === "description") {
      setShowDescriptionModal(true);
      setPendingFocusField(field);
      return;
    }
    if (field === "startsAt" || field === "endsAt") {
      setSchedulePopover(field === "startsAt" ? "startDate" : "endDate");
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
  }, [isPadelPreset]);

  useEffect(() => {
    if (!pendingFocusField) return;

    if (pendingFocusField === "tickets" && isTicketsModalOpen) {
      const focusable = ticketsModalRef.current?.querySelector("input,button,select,textarea") as HTMLElement | null;
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
      setPendingFocusField(null);
      return;
    }

    if (pendingFocusField === "startsAt" && schedulePopover === "startDate") {
      startDateInputRef.current?.focus({ preventScroll: true });
      setPendingFocusField(null);
      return;
    }

    if (pendingFocusField === "endsAt" && schedulePopover === "endDate") {
      endDateInputRef.current?.focus({ preventScroll: true });
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
    isTicketsModalOpen,
    schedulePopover,
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

  const isAnyModalOpen =
    isTicketsModalOpen ||
    showLiveHubModal ||
    showLocationModal ||
    showDescriptionModal ||
    showCoverModal ||
    showCoverCropModal;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const body = document.body;
    const html = document.documentElement;
    if (isAnyModalOpen) {
      if (!modalOverflowRef.current) {
        modalOverflowRef.current = {
          body: body.style.overflow,
          html: html.style.overflow,
        };
      }
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";
      return () => {
        if (modalOverflowRef.current) {
          body.style.overflow = modalOverflowRef.current.body;
          html.style.overflow = modalOverflowRef.current.html;
          modalOverflowRef.current = null;
        }
      };
    }
    if (modalOverflowRef.current) {
      body.style.overflow = modalOverflowRef.current.body;
      html.style.overflow = modalOverflowRef.current.html;
      modalOverflowRef.current = null;
    }
    return undefined;
  }, [isAnyModalOpen]);

  const submitDisabledReason = (() => {
    if (isSubmitting) return `A criar ${primaryLabel}…`;
    if (accessBlocker) return accessBlocker;
    return null;
  })();

  useEffect(() => {
    if (title.trim()) clearErrorsForFields(["title"]);
  }, [title]);

  useEffect(() => {
    if (startsAt) clearErrorsForFields(["startsAt"]);
  }, [startsAt]);

  useEffect(() => {
    if (locationMode === "OSM") {
      if (locationProviderId && locationConfirmed) {
        clearErrorsForFields(["locationName"]);
      }
    } else if (locationName.trim()) {
      clearErrorsForFields(["locationName"]);
    }
  }, [locationMode, locationName, locationProviderId, locationConfirmed]);

  useEffect(() => {
    if (locationCity.trim() || (locationMode === "MANUAL" && locationTbd)) {
      clearErrorsForFields(["locationCity"]);
    }
  }, [locationCity, locationMode, locationTbd]);

  useEffect(() => {
    if (endsAt && startsAt && new Date(endsAt).getTime() > new Date(startsAt).getTime()) {
      clearErrorsForFields(["endsAt"]);
    }
  }, [endsAt, startsAt]);

  useEffect(() => {
    if (!schedulePopover) return;
    const refs: Record<NonNullable<typeof schedulePopover>, RefObject<HTMLDivElement | null>> = {
      startDate: startDatePopoverRef,
      startTime: startTimePopoverRef,
      endDate: endDatePopoverRef,
      endTime: endTimePopoverRef,
    };
    const activeRef = refs[schedulePopover];
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (activeRef?.current && target && !activeRef.current.contains(target)) {
        setSchedulePopover(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [schedulePopover]);

  useEffect(() => {
    if (schedulePopover === "startDate") {
      const base = startDateInput ? parseInputDate(startDateInput) : new Date();
      if (base) setStartCalendarView(toMonthStart(base));
    }
    if (schedulePopover === "endDate") {
      const base =
        (endDateInput ? parseInputDate(endDateInput) : null) ??
        (startDateInput ? parseInputDate(startDateInput) : null) ??
        new Date();
      if (base) setEndCalendarView(toMonthStart(base));
    }
  }, [schedulePopover, startDateInput, endDateInput]);

  useEffect(() => {
    if (schedulePopover === "startDate") startDateInputRef.current?.focus();
    if (schedulePopover === "startTime") startTimeInputRef.current?.focus();
    if (schedulePopover === "endDate") endDateInputRef.current?.focus();
    if (schedulePopover === "endTime") endTimeInputRef.current?.focus();
  }, [schedulePopover]);

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
    const paidAlert = !isGratisEvent && hasPaidTicket && paidTicketsBlocked ? paidTicketsBlockedMessage : null;
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert(`Revê os campos obrigatórios antes de criar o ${primaryLabel}.`);
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
      setErrorMessage(`Seleciona uma organização ativa antes de criares ${primaryLabelPlural}.`);
      setValidationAlert("Falta selecionar a organização.");
      return;
    }

    setIsSubmitting(true);

    try {
      const templateToSend = selectedPreset === "padel" ? "PADEL" : "OTHER";
      const resolvedPadelDefaultCategoryId =
        padelDefaultCategoryId && padelCategoryIds.includes(padelDefaultCategoryId)
          ? padelDefaultCategoryId
          : padelCategoryIds[0] ?? null;
      const padelCategoryConfigsPayload = padelCategoryIds.map((categoryId) => {
        const config = padelCategoryConfigs[categoryId];
        const capacityFromTickets = isPadelPaid ? getPadelTicketCapacityNumber(categoryId) : null;
        const capacityFromConfig = parsePositiveInteger(config?.capacityTeams);
        const capacityTeams = isPadelPaid ? capacityFromTickets : capacityFromConfig;
        return {
          padelCategoryId: categoryId,
          capacityTeams,
          format: config?.format || null,
        };
      });
      const hasTicketsPayload = preparedTickets.length > 0;
      const hasInviteRestrictedTickets =
        hasTicketsPayload && preparedTickets.some((ticket) => ticket.publicAccess === false);
      const accessMode = hasInviteRestrictedTickets ? "INVITE_ONLY" : "PUBLIC";
      const accessPolicy = {
        mode: accessMode,
        guestCheckoutAllowed: false,
        inviteTokenAllowed: accessMode === "INVITE_ONLY",
        inviteIdentityMatch: "BOTH",
        inviteTokenTtlSeconds: accessMode === "INVITE_ONLY" ? 60 * 60 * 24 * 7 : null,
        requiresEntitlementForEntry: false,
        checkinMethods: selectedPreset === "padel" ? ["QR_REGISTRATION"] : ["QR_TICKET"],
      };
      const resolvedLocationSource: LocationSource =
        locationMode === "OSM" && locationProviderId ? "OSM" : "MANUAL";
      const resolvedLocationOverrides =
        resolvedLocationSource === "OSM"
          ? {
              houseNumber: locationHouseNumber.trim() || null,
              postalCode: locationPostalCode.trim() || null,
            }
          : null;
      const resolvedFormattedAddress =
        resolvedLocationSource === "OSM" ? buildLocationFormattedAddress() : null;
      const selectedCourtsPayload =
        selectedPadelClubId && padelCourts?.items
          ? padelCourts.items.filter((court) => selectedPadelCourtIds.includes(court.id))
          : [];
      const courtsFromClubs = selectedCourtsPayload.map((court) => ({
        id: court.id,
        clubId: selectedPadelClubId,
        clubName: selectedPadelClub?.name ?? null,
        name: court.name,
        indoor: court.indoor ?? null,
        displayOrder: court.displayOrder ?? null,
      }));
      const staffFromClubs =
        selectedPadelClubId && padelStaff?.items
          ? padelStaff.items
              .filter((member) => selectedPadelStaffIds.includes(member.id))
              .map((member) => ({
                clubName: selectedPadelClub?.name ?? null,
                email: member.email ?? null,
                role: member.fullName ?? null,
              }))
          : [];

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startsAt,
        endsAt,
        locationName: locationName.trim() || null,
        locationCity: locationCity.trim() || null,
        templateType: templateToSend,
        address: address.trim() || null,
        locationSource: resolvedLocationSource,
        locationProviderId: resolvedLocationSource === "OSM" ? locationProviderId : null,
        locationFormattedAddress:
          resolvedLocationSource === "OSM" ? resolvedFormattedAddress : null,
        locationComponents: resolvedLocationSource === "OSM" ? locationComponents : null,
        locationOverrides: resolvedLocationOverrides,
        latitude: resolvedLocationSource === "OSM" ? locationLat : null,
        longitude: resolvedLocationSource === "OSM" ? locationLng : null,
        ticketTypes: preparedTickets,
        coverImageUrl: coverUrl,
        accessPolicy,
        liveHubVisibility,
        payoutMode: isPlatformPayout || (stripeNotReady && hasPaidTicket) ? "PLATFORM" : "ORGANIZATION",
        padel:
          selectedPreset === "padel"
            ? {
                padelClubId: selectedPadelClubId,
                courtIds: selectedPadelCourtIds,
                staffIds: selectedPadelStaffIds,
                numberOfCourts: selectedPadelCourtIds.length || 1,
                format: padelFormat,
                ruleSetId: padelRuleSetId,
                defaultCategoryId: resolvedPadelDefaultCategoryId,
                eligibilityType: padelEligibility,
                categoryIds: padelCategoryIds,
                categoryConfigs: padelCategoryConfigsPayload,
                splitDeadlineHours: padelSplitDeadlineHours ? Number(padelSplitDeadlineHours) : null,
                padelV2Enabled: true,
                advancedSettings: {
                  courtsFromClubs: courtsFromClubs.length > 0 ? courtsFromClubs : null,
                  staffFromClubs: staffFromClubs.length > 0 ? staffFromClubs : null,
                  waitlistEnabled: padelWaitlistEnabled,
                  registrationStartsAt: normalizeRegistrationValue(padelRegistrationStartsAt),
                  registrationEndsAt: normalizeRegistrationValue(padelRegistrationEndsAt),
                  allowSecondCategory: padelAllowSecondCategory,
                  maxEntriesTotal:
                    padelMaxEntriesTotal && Number(padelMaxEntriesTotal) > 0
                      ? Math.floor(Number(padelMaxEntriesTotal))
                      : null,
                },
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
            ? `Sem permissões para criar ${primaryLabelPlural} nesta organização.`
            : data?.error;
        throw new Error(friendly || `Erro ao criar ${primaryLabel}.`);
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
      console.error(`Erro ao criar ${primaryLabel} de organização:`, err);
      const message = err instanceof Error ? err.message : null;
      setBackendAlert(message || `Algo correu mal ao guardar o ${primaryLabel}. Tenta novamente em segundos.`);
      scrollTo(ctaAlertRef.current);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedPreset(null);
    setShowTicketsModal(false);
    setShowLiveHubModal(false);
    setSchedulePopover(null);
    setShowLocationModal(false);
    setShowDescriptionModal(false);
    setShowCoverModal(false);
    setShowLocationSuggestions(false);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setStartDateInput("");
    setStartTimeInput("");
    setEndDateInput("");
    setEndTimeInput("");
    setLocationName("");
    setLocationCity(PT_CITIES[0]);
    setAddress("");
    setLocationMode("OSM");
    setLocationQuery("");
    setLocationSuggestions([]);
    setLocationSearchLoading(false);
    setLocationDetailsLoading(false);
    setLocationProviderId(null);
    activeProviderRef.current = null;
    setLocationFormattedAddress(null);
    setLocationComponents(null);
    setLocationLat(null);
    setLocationLng(null);
    setLocationTbd(false);
    setLocationManuallySet(false);
    setLocationConfirmed(false);
    setLocationHouseNumber("");
    setLocationPostalCode("");
    setTicketTypes([]);
    setIsFreeEvent(false);
    setFreeTicketName(freeTicketPlaceholder);
    setFreeTicketPublicAccess(true);
    setFreeCapacity("");
    setCoverUrl(null);
    setCoverCropFile(null);
    setShowCoverCropModal(false);
    setPadelFormat("TODOS_CONTRA_TODOS");
    setPadelEligibility("OPEN");
    setPadelRuleSetId(null);
    setPadelCategoryIds([]);
    setPadelDefaultCategoryId(null);
    setPadelCategoryConfigs({});
    setPadelSplitDeadlineHours("48");
    setPadelAdvancedOpen(false);
    setPadelRulesOpen(false);
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
      <div className="w-full py-8">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          A carregar a tua conta…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full py-8">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
          <h1 className="text-2xl font-semibold">Criar novo {primaryLabel}</h1>
          <p className="text-white/70">Inicia sessão para criar {primaryLabelPlural}.</p>
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
      <div className="w-full py-8">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
          <h1 className="text-2xl font-semibold">Criar novo {primaryLabel}</h1>
          <p className="text-white/70">Ativa o perfil para criar {primaryLabelPlural}.</p>
          <Link
            href="/organizacao"
            className={CTA_PRIMARY}
          >
            Ir para organização
          </Link>
        </div>
      </div>
    );
  }

  const renderCoverPanel = () => {
    const isSuggestions = coverCategory === "SUGESTOES";
    const activeCategory = coverCategoryOptions.find((option) => option.value === coverCategory);
    const categoryTitle = isSuggestions ? "Destaque" : activeCategory?.label ?? "Biblioteca";
    const searchPlaceholder = "Procurar mais fotos";
    const searchValue = coverSearch.trim();
    const hasSearch = searchValue.length > 0;
    const titleLabel = isSuggestions
      ? categoryTitle
      : hasSearch
        ? `Resultados: ${searchValue}`
        : categoryTitle;
    const activeCollectionCovers = isSuggestions ? suggestedCovers : coverGridItems;
    const totalAvailable = activeCollectionCovers.length;
    const limitedCollectionCovers = activeCollectionCovers.slice(0, MAX_ITEMS_UI);
    const coverCount = limitedCollectionCovers.length;
    const pageLimit = Math.min(coverPage * COVER_PAGE_SIZE, coverCount);
    const pagedCovers = limitedCollectionCovers.slice(0, pageLimit);
    const hasOverflow = totalAvailable > MAX_ITEMS_UI;
    const showCapNotice = !isSuggestions && !hasSearch && coverCategory === "ALL" && hasOverflow;
    const hasMoreCovers = coverCount > pagedCovers.length;
    const featuredCover = activeCollectionCovers[0] ?? null;
    const featuredCoverUrl = featuredCover?.url ?? featuredCover?.thumbUrl ?? null;
    const featuredTitle = hasSearch ? titleLabel : categoryTitle;
    const featuredPreviewCovers = activeCollectionCovers.slice(0, 3);
    const emptyMessage = isSuggestions ? "Sem sugestões." : hasSearch ? "Sem resultados." : "Sem imagens.";
    const renderCoverGrid = (covers: typeof coverGridItems) => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {covers.map((cover) => {
          const isSelected = selectedCoverToken === cover.id;
          return (
            <button
              key={cover.id}
              type="button"
              onClick={() => setCoverUrl(cover.token)}
              aria-pressed={isSelected}
              className={`group relative overflow-hidden rounded-xl border bg-white/[0.03] p-1 text-left transition ${
                isSelected
                  ? "border-emerald-300/70 bg-emerald-500/12 shadow-[0_18px_45px_rgba(16,185,129,0.25)]"
                  : "border-white/10 hover:border-white/35 hover:bg-white/[0.08]"
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover.thumbUrl ?? cover.url}
                  alt={cover.label}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                <span className="absolute left-2 bottom-2 max-w-[140px] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/80 opacity-0 transition group-hover:opacity-100">
                  {cover.label}
                </span>
                {isSelected && (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-black shadow-[0_10px_22px_rgba(16,185,129,0.35)]">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5-5L12.5 5l-6.1 6.2Z"
                      />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );

    return (
      <div className="flex h-full min-h-0 flex-col gap-5 animate-fade-slide">
        <div className="grid min-h-0 h-full flex-1 grid-rows-[minmax(0,1fr)] gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="hidden md:block">
            <div className="rounded-2xl border border-white/10 bg-[#0a0f18]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sticky top-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Coleções</p>
              <div className="mt-2 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
                {coverCategoryOptions.map((option) => {
                  const isActive = coverCategory === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setCoverCategory(option.value);
                        if (option.value === "SUGESTOES") setCoverSearch("");
                      }}
                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] transition ${
                        isActive
                          ? "bg-white/12 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-[var(--orya-cyan)]" : "bg-white/30 group-hover:bg-white/60"
                          }`}
                        />
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 h-full min-w-0 space-y-5 overflow-y-auto overscroll-contain pr-1">
            <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
              {coverCategoryOptions.map((option) => {
                const isActive = coverCategory === option.value;
                return (
                  <button
                    key={`mobile-${option.value}`}
                    type="button"
                    onClick={() => {
                      setCoverCategory(option.value);
                      if (option.value === "SUGESTOES") setCoverSearch("");
                    }}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] transition ${
                      isActive
                        ? "border-white/45 bg-white/20 text-white"
                        : "border-white/10 text-white/60 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0a0f18]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-white/55">Escolher imagem</p>
                  <p className="text-[12px] text-white/70">
                    Arraste ou clique. Proporção 1:1.
                  </p>
                </div>
                {selectedCoverLabel && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/12 px-3 py-1 text-[11px] text-emerald-100">
                    Selecionada: {selectedCoverLabel}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <label
                  className={`group relative flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-3 text-center transition ${
                    coverDragActive
                      ? "border-[var(--orya-cyan)] bg-[rgba(107,255,255,0.12)] shadow-[0_0_0_1px_rgba(107,255,255,0.4)]"
                      : "border-white/20 bg-black/30 hover:border-white/35 hover:bg-black/40"
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setCoverDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setCoverDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setCoverDragActive(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setCoverDragActive(false);
                    const file = event.dataTransfer.files?.[0] ?? null;
                    handleCoverUpload(file);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleCoverUpload(e.target.files?.[0] ?? null);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Carregar imagem de capa"
                  />
                  {uploadingCover ? (
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                      A carregar...
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-white">Arraste ou clique</p>
                      <p className="text-[11px] text-white/55">PNG/JPG/WebP · 1:1</p>
                    </>
                  )}
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/55">
                    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M12 7A5 5 0 1 1 2 7a5 5 0 0 1 10 0m-.965 5.096a6.5 6.5 0 1 1 1.06-1.06l2.935 2.934a.75.75 0 1 1-1.06 1.06z"
                      />
                    </svg>
                  </span>
                  <input
                    value={coverSearch}
                    onChange={(e) => setCoverSearch(e.target.value)}
                    onFocus={() => {
                      if (isSuggestions) setCoverCategory("ALL");
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-2xl border border-white/15 bg-black/40 px-10 py-3 text-[13px] text-white/95 placeholder:text-white/45 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                  />
                  {coverSearch && (
                    <button
                      type="button"
                      onClick={() => setCoverSearch("")}
                      aria-label="Limpar pesquisa"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/10 p-1 text-white/70 transition hover:border-white/30 hover:bg-white/15"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M8 15.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15M5.53 4.47a.75.75 0 1 0-1.06 1.06L6.94 8l-2.47 2.47a.749.749 0 1 0 1.06 1.06L8 9.06l2.47 2.47a.75.75 0 1 0 1.06-1.06L9.06 8l2.47-2.47a.75.75 0 1 0-1.06-1.06L8 6.94z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f18]/90">
              <div className="absolute inset-0">
                {featuredCoverUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${featuredCoverUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a2133] via-[#0b1222] to-[#050810]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/20" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/20 to-black/70" />
              </div>

              <div className="relative z-10 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Coleção</p>
                    <p className="text-lg font-semibold text-white">{featuredTitle}</p>
                    <p className="text-[12px] text-white/70">{coverCount} imagens</p>
                  </div>
                </div>

                {featuredPreviewCovers.length > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    {featuredPreviewCovers.map((cover) => (
                      <div
                        key={`featured-${cover.id}`}
                        className="h-14 w-14 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover.thumbUrl ?? cover.url}
                          alt={cover.label}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
              <span>Galeria</span>
              <span>{coverCount} imagens</span>
            </div>
            <p className="text-[11px] text-white/50">
              A mostrar {coverCount === 0 ? 0 : 1}–{pageLimit} de {coverCount}
              {showCapNotice ? " (filtra para ver mais relevante)" : ""}
            </p>

            {coverCount === 0 ? (
              <div className="rounded-xl border border-white/12 bg-white/[0.06] p-4 text-[12px] text-white/65">
                {emptyMessage}
              </div>
            ) : (
              <>
                {renderCoverGrid(pagedCovers)}
                {hasMoreCovers && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setCoverPage((prev) => prev + 1)}
                      className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Mostrar mais
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDescriptionPanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-2">
        <label className={labelClass}>Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className={inputClass(false)}
          placeholder={`Descrição do ${primaryLabel}`}
        />
      </div>
    </div>
  );

  const resolveStartFallback = () => {
    const base = startsAt ? new Date(startsAt) : roundToNextHour(new Date());
    return Number.isNaN(base.getTime()) ? roundToNextHour(new Date()) : base;
  };

  const resolveEndFallback = () => {
    const baseStart = resolveStartFallback();
    const base = endsAt ? new Date(endsAt) : new Date(baseStart.getTime() + 60 * 60 * 1000);
    return Number.isNaN(base.getTime()) ? new Date(baseStart.getTime() + 60 * 60 * 1000) : base;
  };

  const handleStartDateChange = (value: string) => {
    if (!value) {
      setStartDateInput("");
      setStartsAt("");
      return;
    }
    const fallbackTime = startTimeInput || formatInputTime(resolveStartFallback());
    setStartDateInput(value);
    setStartTimeInput(fallbackTime);
    setStartsAt(buildLocalDateTime(value, fallbackTime));
  };

  const handleStartTimeChange = (value: string) => {
    if (!value) {
      setStartTimeInput("");
      setStartsAt("");
      return;
    }
    const fallbackDate = startDateInput || formatInputDate(resolveStartFallback());
    setStartDateInput(fallbackDate);
    setStartTimeInput(value);
    setStartsAt(buildLocalDateTime(fallbackDate, value));
  };

  const handleEndDateChange = (value: string) => {
    if (!value) {
      setEndDateInput("");
      setEndsAt("");
      return;
    }
    const fallbackTime = endTimeInput || formatInputTime(resolveEndFallback());
    setEndDateInput(value);
    setEndTimeInput(fallbackTime);
    setEndsAt(buildLocalDateTime(value, fallbackTime));
  };

  const handleEndTimeChange = (value: string) => {
    if (!value) {
      setEndTimeInput("");
      setEndsAt("");
      return;
    }
    const fallbackDate = endDateInput || startDateInput || formatInputDate(resolveEndFallback());
    setEndDateInput(fallbackDate);
    setEndTimeInput(value);
    setEndsAt(buildLocalDateTime(fallbackDate, value));
  };

  const applyPadelFormatToAll = () => {
    if (padelCategoryIds.length === 0) return;
    setPadelCategoryConfigs((prev) => {
      const next = { ...prev };
      padelCategoryIds.forEach((id) => {
        next[id] = {
          capacityTeams: prev[id]?.capacityTeams ?? "",
          format: padelFormat || null,
        };
      });
      return next;
    });
  };

  const applyPadelCapacityToAll = () => {
    if (padelCategoryIds.length === 0) return;
    const firstId = padelCategoryIds[0];
    const capacity = firstId ? padelCategoryConfigs[firstId]?.capacityTeams ?? "" : "";
    if (!capacity) return;
    setPadelCategoryConfigs((prev) => {
      const next = { ...prev };
      padelCategoryIds.forEach((id) => {
        next[id] = {
          capacityTeams: capacity,
          format: prev[id]?.format ?? null,
        };
      });
      return next;
    });
  };

  const applyPadelTicketPriceToAll = () => {
    setTicketTypes((prev) => {
      if (prev.length === 0) return prev;
      const basePrice = prev[0].price;
      if (!basePrice) return prev;
      return prev.map((row) => ({ ...row, price: basePrice }));
    });
  };

  const applyPadelTicketCapacityToAll = () => {
    setTicketTypes((prev) => {
      if (prev.length === 0) return prev;
      const baseCapacity = prev[0].totalQuantity;
      if (!baseCapacity) return prev;
      return prev.map((row) => ({ ...row, totalQuantity: baseCapacity }));
    });
  };

  const applyPadelTicketNameToAll = () => {
    setTicketTypes((prev) => {
      if (prev.length === 0) return prev;
      const baseName = normalizePadelTicketBaseName(prev[0].name || freeTicketPlaceholder);
      return prev.map((row) => {
        if (typeof row.padelCategoryId !== "number") return row;
        return {
          ...row,
          name: buildPadelTicketNameForCategory(baseName, row.padelCategoryId),
        };
      });
    });
  };

  const renderLocationPanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className={labelClass}>Local / Morada</label>
          <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
            {locationMode === "OSM" ? (
              <button
                type="button"
                onClick={enableManualLocation}
                className="rounded-full border border-white/15 px-3 py-1 hover:border-white/40"
              >
                Modo manual
              </button>
            ) : (
              <button
                type="button"
                onClick={enableOsmLocation}
                className="rounded-full border border-white/15 px-3 py-1 hover:border-white/40"
              >
                Pesquisar local
              </button>
            )}
            <button
              type="button"
              onClick={markLocationTbd}
              className="rounded-full border border-white/15 px-3 py-1 hover:border-white/40"
            >
              Local a anunciar
            </button>
          </div>
        </div>

        {locationMode === "OSM" ? (
          <div className="space-y-3">
            <div className="relative overflow-visible">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLocationQuery(next);
                    setLocationTbd(false);
                    setLocationSearchError(null);
                    if (locationProviderId) {
                      setLocationProviderId(null);
                      activeProviderRef.current = null;
                      setLocationFormattedAddress(null);
                      setLocationComponents(null);
                      setLocationLat(null);
                      setLocationLng(null);
                      setLocationConfirmed(false);
                    }
                    setShowLocationSuggestions(true);
                  }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => {
                  if (suggestionBlurTimeout.current) clearTimeout(suggestionBlurTimeout.current);
                  suggestionBlurTimeout.current = setTimeout(() => setShowLocationSuggestions(false), 120);
                }}
                aria-invalid={Boolean(fieldErrors.locationName)}
                className={inputClass(Boolean(fieldErrors.locationName))}
                placeholder="Procura um local ou morada"
              />
              {showLocationSuggestions && (
                <div className="mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl">
                  {locationSearchLoading ? (
                    <div className="px-3 py-2 text-sm text-white/70 animate-pulse">A procurar…</div>
                    ) : locationSearchError ? (
                      <div className="px-3 py-2 text-sm text-amber-100">{locationSearchError}</div>
                    ) : locationSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-white/60">Sem sugestões.</div>
                    ) : (
                    locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.providerId}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectGeoSuggestion(suggestion)}
                        className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="font-semibold text-white">{suggestion.label}</span>
                          <span className="text-[12px] text-white/65">{suggestion.city || "—"}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {locationProviderId && (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                <div className="flex items-center justify-between gap-3">
                  <span>{locationFormattedAddress || locationQuery || "Local selecionado"}</span>
                  {locationDetailsLoading && <span className="text-[10px] uppercase tracking-[0.2em]">A validar…</span>}
                </div>
                {locationLat !== null && locationLng !== null && (
                  <p className="mt-1 text-[11px] text-white/55">
                    {locationLat.toFixed(5)}, {locationLng.toFixed(5)}
                  </p>
                )}
              </div>
            )}
            {locationProviderId && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {locationConfirmed ? (
                  <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-emerald-50">
                    Local confirmado
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-amber-50">
                    Confirmação pendente
                  </span>
                )}
                {!locationConfirmed && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationFormattedAddress(buildLocationFormattedAddress());
                      setLocationConfirmed(true);
                    }}
                    disabled={locationDetailsLoading}
                    className="rounded-full border border-white/15 px-3 py-1 text-white/80 hover:border-white/40 disabled:opacity-60"
                  >
                    Confirmar local
                  </button>
                )}
                <button
                  type="button"
                  onClick={enableManualLocation}
                  className="rounded-full border border-white/15 px-3 py-1 text-white/60 hover:border-white/40"
                >
                  Ajustar manualmente
                </button>
              </div>
            )}
            {locationProviderId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-white/60">Nº porta (opcional)</label>
                  <input
                    value={locationHouseNumber}
                    onChange={(e) => {
                      setLocationHouseNumber(e.target.value);
                      setLocationConfirmed(false);
                    }}
                    className={inputClass(false)}
                    placeholder="Ex.: 123"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-white/60">Código‑postal (opcional)</label>
                  <input
                    value={locationPostalCode}
                    onChange={(e) => {
                      setLocationPostalCode(e.target.value);
                      setLocationConfirmed(false);
                    }}
                    className={inputClass(false)}
                    placeholder="Ex.: 4000-123"
                  />
                </div>
                <div className="sm:col-span-2 text-[11px] text-white/60">
                  {locationConfirmed ? "Confirmado" : "Confirma o endereço antes de guardar."}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div data-field="locationName" className="space-y-1">
              <label className={labelClass}>Local</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => {
                  setLocationManuallySet(true);
                  setLocationName(e.target.value);
                  setLocationTbd(false);
                }}
                aria-invalid={Boolean(fieldErrors.locationName)}
                className={inputClass(Boolean(fieldErrors.locationName))}
                placeholder="Local"
              />
            </div>

            <div data-field="locationCity" className="space-y-1">
              <label className={labelClass}>
                Cidade <span aria-hidden>*</span>
              </label>
              <input
                type="text"
                value={locationCity}
                onChange={(e) => {
                  setLocationManuallySet(true);
                  setLocationCity(e.target.value);
                  setLocationTbd(false);
                }}
                aria-invalid={Boolean(fieldErrors.locationCity)}
                className={inputClass(Boolean(fieldErrors.locationCity))}
                placeholder="Cidade"
              />
            </div>

            <div data-field="address" className="space-y-1 sm:col-span-2">
              <label className={labelClass}>Morada</label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setLocationTbd(false);
                }}
                className={inputClass(false)}
                placeholder="Rua e número"
              />
            </div>
          </div>
        )}

        {locationError && (
          <p className={errorTextClass}>
            <span aria-hidden>⚠️</span>
            {locationError}
          </p>
        )}
      </div>
    </div>
  );

  const renderTicketsPanel = () => (
    <div className="space-y-5 animate-fade-slide">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={labelClass}>Modelo</p>
            <p className="text-[11px] text-white/60">Pago ou grátis</p>
          </div>
          <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[13px]">
            <button
              type="button"
              onClick={() => setIsFreeEvent(false)}
              disabled={paidTicketsBlocked}
              title={paidTicketsBlockedMessage ?? `Ativa o Stripe e o email oficial para vender ${ticketLabelPlural} pagos.`}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                !isGratisEvent && !paidTicketsBlocked ? "bg-white text-black shadow" : "text-white/70"
              } ${paidTicketsBlocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {primaryLabelTitle} pago
            </button>
            <button
              type="button"
              onClick={() => setIsFreeEvent(true)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                isGratisEvent ? "bg-white text-black shadow" : "text-white/70"
              }`}
            >
              {primaryLabelTitle} grátis
            </button>
          </div>
        </div>
        {isPadelPreset && (
          <p className="text-[11px] text-white/55">
            Pago: 1 {ticketLabel} por categoria. Grátis: capacidade definida nas categorias.
          </p>
        )}
        {paidTicketsBlocked && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-[12px] text-amber-50 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Pagamentos</p>
                <p className="text-amber-50/85">
                  {paidTicketsBlockedMessage ?? "Ativa o Stripe e valida o email oficial."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stripeNotReady && (
                  <button
                    type="button"
                    onClick={() => router.push("/organizacao?tab=analyze&section=financas")}
                    className={`${CTA_PRIMARY} px-3 py-1 text-[11px]`}
                  >
                    Ligar Stripe
                  </button>
                )}
                {needsOfficialEmailVerification && (
                  <button
                    type="button"
                    onClick={() => router.push("/organizacao/settings")}
                    className={`${CTA_PRIMARY} px-3 py-1 text-[11px]`}
                  >
                    {organizationOfficialEmail ? "Verificar email oficial" : "Definir email oficial"}
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-amber-50/70">Agora: grátis.</p>
          </div>
        )}
        {ticketTypes.length === 0 && !isGratisEvent && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
            {isPadelPaid
              ? "Seleciona categorias."
              : isPadelPreset
                ? "Sem inscrições, criamos 1 gratuita."
                : "Sem bilhetes, criamos 1 gratuito."}
          </div>
        )}
        {fieldErrors.tickets && (
          <p className={errorTextClass}>
            <span aria-hidden>⚠️</span>
            {fieldErrors.tickets}
          </p>
        )}
      </div>

      {isGratisEvent ? (
        <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className={labelClass}>{freeTicketLabel}</p>
            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[12px] text-emerald-50">
              Grátis
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClass}>Nome</label>
              <input
                type="text"
                value={freeTicketName}
                onChange={(e) => setFreeTicketName(e.target.value)}
                className={inputClass(false)}
                placeholder={freeTicketPlaceholder}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Capacidade</label>
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
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass}>Visibilidade</label>
              <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                <button
                  type="button"
                  onClick={() => setFreeTicketPublicAccess(true)}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    freeTicketPublicAccess ? "bg-white text-black shadow" : "text-white/70"
                  }`}
                >
                  Público
                </button>
                <button
                  type="button"
                  onClick={() => setFreeTicketPublicAccess(false)}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    !freeTicketPublicAccess ? "bg-white text-black shadow" : "text-white/70"
                  }`}
                >
                  Por convite
                </button>
              </div>
              {!freeTicketPublicAccess && (
                <p className="text-[11px] text-white/55">Convites são adicionados depois.</p>
              )}
            </div>
          </div>
          {shouldSplitFreeTickets && (
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
              Criamos {ticketLabelIndefinite} {ticketLabel} {isPadelPreset ? "gratuita" : "gratuito"} por categoria.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={labelClass}>
              {isPadelPaid ? `${ticketLabelPluralCap} por categoria` : ticketLabelPluralCap}
            </h2>
            {!isPadelPaid && (
              <button
                type="button"
                onClick={handleAddTicketType}
                className={`${CTA_PRIMARY} px-3 py-1 text-[13px]`}
              >
                + Adicionar {ticketLabel}
              </button>
            )}
          </div>
          {isPadelPaid && <p className="text-[12px] text-white/70">1 por categoria. Ajusta preço e capacidade.</p>}
          {isPadelPaid && ticketTypes.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
              <button
                type="button"
                onClick={applyPadelTicketPriceToAll}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10"
              >
                Replicar preço
              </button>
              <button
                type="button"
                onClick={applyPadelTicketCapacityToAll}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10"
              >
                Replicar capacidade
              </button>
              <button
                type="button"
                onClick={applyPadelTicketNameToAll}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10"
              >
                Replicar nome base
              </button>
            </div>
          )}

          <div className="grid gap-3">
            {ticketTypes.map((row, idx) => {
              const categoryId = typeof row.padelCategoryId === "number" ? row.padelCategoryId : null;
              const categoryLabel = categoryId ? resolvePadelCategoryLabel(categoryId) : null;
              const categoryTag = categoryId ? getPadelCategoryTag(categoryId) : null;
              return (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border border-white/12 bg-white/5 p-3 animate-step-pop"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/75">
                      <span aria-hidden className="text-[#6BFFFF]">🎟️</span>
                      {isPadelPaid && categoryLabel ? (
                        <>
                          <span>{categoryLabel}</span>
                          {categoryTag && (
                            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                              {categoryTag}
                            </span>
                          )}
                        </>
                      ) : (
                        `${ticketLabelCap} ${idx + 1}`
                      )}
                    </span>
                    {!isPadelPaid && ticketTypes.length > 1 && (
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
                        Nome {ticketLabelArticle} {ticketLabel} <span aria-hidden>*</span>
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
                        min={isGratisEvent ? 0 : 1}
                        step="0.01"
                        value={row.price}
                        onChange={(e) => handleTicketChange(idx, "price", e.target.value)}
                        className={inputClass(false)}
                        placeholder="Ex.: 12.50"
                      />
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
                  {selectedPreset === "padel" && padelCategoryIds.length > 0 && !isPadelPaid && (
                    <div className="space-y-1">
                      <label className={labelClass}>Categoria de Padel</label>
                      <select
                        value={row.padelCategoryId ?? ""}
                        onChange={(e) => handleTicketCategoryChange(idx, e.target.value)}
                        className={inputClass(false)}
                      >
                        {padelCategoryIds.length > 1 && <option value="">Categoria</option>}
                        {padelCategoryIds.map((id) => {
                          const cat = padelCategoryItems.find((item) => item.id === id);
                          return (
                            <option key={`padel-ticket-cat-${id}`} value={id}>
                              {cat?.label || `Categoria ${id}`}
                            </option>
                          );
                        })}
                      </select>
                      {padelCategoryIds.length > 1 && !row.padelCategoryId && (
                        <p className="text-[11px] text-amber-200">Seleciona categoria.</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/75">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Visibilidade</span>
                    <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setTicketPublicAccess(idx, true)}
                        className={`rounded-full px-3 py-1 font-semibold transition ${
                          row.publicAccess !== false ? "bg-white text-black shadow" : "text-white/70"
                        }`}
                      >
                        Público
                      </button>
                      <button
                        type="button"
                        onClick={() => setTicketPublicAccess(idx, false)}
                        className={`rounded-full px-3 py-1 font-semibold transition ${
                          row.publicAccess === false ? "bg-white text-black shadow" : "text-white/70"
                        }`}
                      >
                        Por convite
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasInviteRestrictedTickets && (
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
          {ticketLabelPluralCap} por convite exigem convites adicionados depois de criares o {primaryLabel}.
        </div>
      )}
    </div>
  );

  const ticketsModal =
    isTicketsModalOpen && portalRoot
      ? createPortal(
          <div className={MODAL_SHELL_CLASS}>
            <div
              className={MODAL_OVERLAY_CLASS}
              onClick={() => setShowTicketsModal(false)}
              aria-hidden
            />
            <div
              className={MODAL_CONTENT_WRAP_CLASS}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowTicketsModal(false);
                }
              }}
            >
              <div
                className={`flex w-full max-w-4xl max-h-[calc(100vh-6rem)] flex-col ${MODAL_PANEL_CLASS}`}
                role="dialog"
                aria-modal="true"
                aria-label={ticketLabelPluralCap}
              >
                <div className={MODAL_HEADER_CLASS}>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{ticketLabelPluralCap}</p>
                    <p className="text-sm font-semibold text-white">Preço & capacidade</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTicketsModal(false)}
                    className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                  >
                    Concluir
                  </button>
                </div>
                <div ref={ticketsModalRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
                  {renderTicketsPanel()}
                </div>
              </div>
            </div>
          </div>,
          portalRoot,
        )
      : null;

  const renderLiveHubPanel = () => (
    <div className="space-y-4 animate-fade-slide">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div>
          <p className={labelClass}>LiveHub</p>
          <p className="text-[12px] text-white/60">Visibilidade do LiveHub.</p>
        </div>
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
        {liveHubVisibility === "PRIVATE" && (
          <p className="text-[11px] text-white/55">Privado: apenas participantes e organização.</p>
        )}
      </div>
    </div>
  );

  const liveHubModal =
    showLiveHubModal && portalRoot
      ? createPortal(
          <div className={MODAL_SHELL_CLASS}>
            <div
              className={MODAL_OVERLAY_CLASS}
              onClick={() => setShowLiveHubModal(false)}
              aria-hidden
            />
            <div
              className={MODAL_CONTENT_WRAP_CLASS}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowLiveHubModal(false);
                }
              }}
            >
              <div
                className={`flex w-full max-w-3xl max-h-[calc(100vh-6rem)] flex-col ${MODAL_PANEL_CLASS}`}
                role="dialog"
                aria-modal="true"
                aria-label="LiveHub"
              >
                <div className={MODAL_HEADER_CLASS}>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">LiveHub</p>
                    <p className="text-sm font-semibold text-white">Visibilidade</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLiveHubModal(false)}
                    className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                  >
                    Concluir
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
                  {renderLiveHubPanel()}
                </div>
              </div>
            </div>
          </div>,
          portalRoot,
        )
      : null;

  const closeLocationModal = () => {
    setShowLocationModal(false);
    setShowLocationSuggestions(false);
  };

  const locationModal =
    showLocationModal && portalRoot
      ? createPortal(
          <div className={MODAL_SHELL_CLASS}>
            <div
              className={MODAL_OVERLAY_CLASS}
              onClick={closeLocationModal}
              aria-hidden
            />
            <div
              className={MODAL_CONTENT_WRAP_CLASS}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeLocationModal();
                }
              }}
            >
              <div
                className={`flex w-full max-w-3xl max-h-[calc(100vh-6rem)] flex-col ${MODAL_PANEL_CLASS}`}
                role="dialog"
                aria-modal="true"
                aria-label="Localização"
              >
                <div className={MODAL_HEADER_CLASS}>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Localização</p>
                    <p className="text-sm font-semibold text-white">Cidade & morada</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeLocationModal}
                    className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                  >
                    Concluir
                  </button>
                </div>
                <div ref={locationModalRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
                  {renderLocationPanel()}
                </div>
              </div>
            </div>
          </div>,
          portalRoot,
        )
      : null;

  const descriptionModal =
    showDescriptionModal && portalRoot
      ? createPortal(
          <div className={MODAL_SHELL_CLASS}>
            <div
              className={MODAL_OVERLAY_CLASS}
              onClick={() => setShowDescriptionModal(false)}
              aria-hidden
            />
            <div
              className={MODAL_CONTENT_WRAP_CLASS}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowDescriptionModal(false);
                }
              }}
            >
              <div
                className={`flex w-full max-w-2xl max-h-[calc(100vh-6rem)] flex-col ${MODAL_PANEL_CLASS}`}
                role="dialog"
                aria-modal="true"
                aria-label="Descrição"
              >
                <div className={MODAL_HEADER_CLASS}>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Descrição</p>
                    <p className="text-sm font-semibold text-white">Detalhes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDescriptionModal(false)}
                    className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                  >
                    Concluir
                  </button>
                </div>
                <div ref={descriptionModalRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
                  {renderDescriptionPanel()}
                </div>
              </div>
            </div>
          </div>,
          portalRoot,
        )
      : null;

  const coverModal =
    showCoverModal && portalRoot
      ? createPortal(
          <div className={MODAL_SHELL_CLASS}>
            <div
              className={MODAL_OVERLAY_CLASS}
              onClick={() => setShowCoverModal(false)}
              aria-hidden
            />
            <div
              className={MODAL_CONTENT_WRAP_CLASS}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowCoverModal(false);
                }
              }}
            >
              <div
                className={`flex w-full max-w-[980px] h-[720px] max-h-[calc(100vh-6rem)] flex-col ${MODAL_PANEL_CLASS} border-white/20 bg-[rgba(14,20,30,0.78)]`}
                role="dialog"
                aria-modal="true"
                aria-label="Biblioteca de capas"
              >
                <div className={`${MODAL_HEADER_CLASS} flex-wrap`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70">
                      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v8A1.5 1.5 0 0 1 12 13.5H4A1.5 1.5 0 0 1 2.5 12V4Zm1.5-.5a.5.5 0 0 0-.5.5v6.5l2.55-2.55a1 1 0 0 1 1.41 0L11 11.5V4a.5.5 0 0 0-.5-.5H4Zm7.44 8.08-3.09-3.1-2.86 2.87h4.45c.59 0 1.14.08 1.5.23Z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Biblioteca</p>
                      <p className="text-sm font-semibold text-white">Escolher capa</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCoverLabel && (
                      <span className="hidden sm:inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                        Selecionada: {selectedCoverLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCoverModal(false)}
                      className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                    >
                      Concluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCoverModal(false)}
                      aria-label="Fechar"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="m3.582 2.52 4.42 4.418L12.42 2.52a.75.75 0 0 1 1.06 1.06L9.064 8l4.419 4.42a.75.75 0 1 1-1.061 1.06L8 9.06l-4.419 4.42a.75.75 0 0 1-1.06-1.06L6.94 8 2.52 3.58a.75.75 0 0 1 1.061-1.06Z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  ref={coverModalRef}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-4"
                >
                  {renderCoverPanel()}
                </div>
              </div>
            </div>
          </div>,
          portalRoot,
        )
      : null;

  return (
    <>
      <AppleMapsLoader />
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
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
        <div className="relative w-full rounded-[22px] border border-white/8 bg-white/[0.04] p-5 space-y-5 backdrop-blur-lg sm:p-6">
          <div className="space-y-6">
          {errorSummary.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
              aria-live="assertive"
            >
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>⚠️</span>
                <span>Revê estes campos antes de criar</span>
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

          <section className={styles.eventCreateGrid}>
            <div className="flex w-full flex-col items-start gap-3 max-[650px]:items-center">
              <span className="text-[10px] uppercase tracking-[0.32em] text-white/45">Capa</span>
              <button
                type="button"
                onClick={() => {
                  setCoverCategory("SUGESTOES");
                  setShowCoverModal(true);
                }}
                className={`relative ${styles.eventCover} overflow-hidden rounded-[16px] border border-white/12 bg-black/25 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition hover:border-white/25`}
              >
                {coverPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreviewUrl} alt={`Capa do ${primaryLabel}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0f111b] via-[#0a0b14] to-[#1f1a2d]" />
                )}
                {!coverPreviewUrl && (
                  <span className="absolute inset-0 flex items-center justify-center text-[12px] text-white/70">
                    Escolher capa
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoverCategory("SUGESTOES");
                  setShowCoverModal(true);
                }}
                className="text-left text-[11px] text-white/60 transition hover:text-white"
              >
                Abrir biblioteca de capas
              </button>
            </div>

            <div className="min-w-0 space-y-4">
              {canSwitchPreset && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={labelClass}>Tipo</p>
                    <p className="text-[11px] text-white/60">Evento clássico ou torneio Padel.</p>
                  </div>
                  <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setSelectedPreset("default")}
                      className={`rounded-full px-3 py-1 font-semibold transition ${
                        selectedPreset === "default" ? "bg-white text-black shadow" : "text-white/70"
                      }`}
                    >
                      Evento
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPreset("padel")}
                      className={`rounded-full px-3 py-1 font-semibold transition ${
                        selectedPreset === "padel" ? "bg-white text-black shadow" : "text-white/70"
                      }`}
                    >
                      Torneio
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[10px] font-medium text-white/75"
                >
                  Calendário
                </button>
                <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[10px] font-medium text-white/80">
                  Acesso: {accessSummary}
                </span>
              </div>

              <div className="space-y-2">
                <label className="sr-only">
                  Título <span aria-hidden>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  ref={titleRef}
                  aria-invalid={Boolean(fieldErrors.title)}
                  className={`${inputClass(Boolean(fieldErrors.title))} px-3 py-2 text-[22px] font-semibold leading-tight tracking-tight md:text-[28px]`}
                  placeholder={`Nome do ${primaryLabel}`}
                />
                {fieldErrors.title && (
                  <p className={errorTextClass}>
                    <span aria-hidden>⚠️</span>
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3 text-[11px] text-white/70">
                  <span>Início</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <div ref={startDatePopoverRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setSchedulePopover((prev) => (prev === "startDate" ? null : "startDate"))
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                          schedulePopover === "startDate"
                            ? "border-white/40 bg-white/15 text-white"
                            : "border-white/15 bg-white/5 text-white/85 hover:border-white/35"
                        }`}
                      >
                        {startsAt ? formatDateLabel(startsAt) : "Data"}
                      </button>
                      {schedulePopover === "startDate" && (
                        <div className="absolute right-0 z-[var(--z-popover)] mt-2 w-[280px] rounded-2xl orya-menu-surface p-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                              Data de início
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setStartCalendarView(toMonthStart(today));
                                handleStartDateChange(formatInputDate(today));
                                setSchedulePopover(null);
                              }}
                              className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10"
                            >
                              Hoje
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setStartCalendarView(
                                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                                )
                              }
                              className="h-8 w-8 rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                              aria-label="Mês anterior"
                            >
                              ‹
                            </button>
                            <span className="text-[13px] font-semibold text-white/85 capitalize">
                              {formatMonthLabel(startCalendarView)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setStartCalendarView(
                                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                                )
                              }
                              className="h-8 w-8 rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                              aria-label="Mês seguinte"
                            >
                              ›
                            </button>
                          </div>
                          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                            <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.2em] text-white/45">
                              {WEEKDAY_LABELS.map((label) => (
                                <span key={label} className="text-center">
                                  {label}
                                </span>
                              ))}
                            </div>
                            <div
                              ref={startDateInputRef}
                              tabIndex={-1}
                              className="mt-2 grid grid-cols-7 gap-1"
                            >
                              {startCalendarCells.map((cell, index) => {
                                const isDisabled = isBeforeDay(cell.date, today);
                                const isSelected = selectedStartDate
                                  ? isSameDay(cell.date, selectedStartDate)
                                  : false;
                                const isToday = isSameDay(cell.date, today);
                                return (
                                  <button
                                    key={`${cell.date.toISOString()}-${index}`}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      handleStartDateChange(formatInputDate(cell.date));
                                      setSchedulePopover(null);
                                    }}
                                    className={`h-8 rounded-lg text-[12px] font-medium transition ${
                                      isSelected
                                        ? "bg-[var(--orya-cyan)] text-black shadow-[0_8px_18px_rgba(107,255,255,0.35)]"
                                        : isToday
                                          ? "border border-[var(--orya-cyan)] bg-white/5 text-white"
                                          : cell.inMonth
                                            ? "bg-white/[0.04] text-white/85 hover:bg-white/12"
                                            : "text-white/35 hover:bg-white/8 hover:text-white/60"
                                    } ${isDisabled ? "cursor-not-allowed text-white/20 hover:bg-transparent" : ""}`}
                                  >
                                    {cell.date.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={startTimePopoverRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setSchedulePopover((prev) => (prev === "startTime" ? null : "startTime"))
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                          schedulePopover === "startTime"
                            ? "border-white/40 bg-white/15 text-white"
                            : "border-white/15 bg-white/5 text-white/85 hover:border-white/35"
                        }`}
                      >
                        {startsAt ? formatTimeLabel(startsAt) : "Hora"}
                      </button>
                      {schedulePopover === "startTime" && (
                        <div className="absolute right-0 z-[var(--z-popover)] mt-2 w-[210px] rounded-2xl orya-menu-surface p-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                              Hora de início
                            </span>
                            <span className="text-[10px] text-white/40">00:00 → 23:30</span>
                          </div>
                          <div
                            ref={startTimeInputRef}
                            tabIndex={-1}
                            className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/12 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          >
                            {timeSlots.map((slot) => {
                              const isSelected = slot === startTimeInput;
                              return (
                                <button
                                  key={`start-${slot}`}
                                  type="button"
                                  onClick={() => {
                                    handleStartTimeChange(slot);
                                    setSchedulePopover(null);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12px] transition ${
                                    isSelected
                                      ? "bg-[var(--orya-cyan)] text-black shadow-[0_6px_14px_rgba(107,255,255,0.35)]"
                                      : "text-white/80 hover:bg-white/10"
                                  }`}
                                >
                                  <span>{slot}</span>
                                  {isSelected && <span className="text-[10px] font-semibold">Selecionado</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] text-white/70">
                  <span>Fim</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <div ref={endDatePopoverRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setSchedulePopover((prev) => (prev === "endDate" ? null : "endDate"))
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                          schedulePopover === "endDate"
                            ? "border-white/40 bg-white/15 text-white"
                            : "border-white/15 bg-white/5 text-white/80 hover:border-white/35"
                        }`}
                      >
                        {endsAt ? formatDateLabel(endsAt) : "Data"}
                      </button>
                      {schedulePopover === "endDate" && (
                        <div className="absolute right-0 z-[var(--z-popover)] mt-2 w-[280px] rounded-2xl orya-menu-surface p-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                              Data de fim
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEndCalendarView(toMonthStart(minEndDate));
                                handleEndDateChange(formatInputDate(minEndDate));
                                setSchedulePopover(null);
                              }}
                              className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10"
                            >
                              {isSameDay(minEndDate, today) ? "Hoje" : "Igual ao início"}
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setEndCalendarView(
                                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                                )
                              }
                              className="h-8 w-8 rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                              aria-label="Mês anterior"
                            >
                              ‹
                            </button>
                            <span className="text-[13px] font-semibold text-white/85 capitalize">
                              {formatMonthLabel(endCalendarView)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEndCalendarView(
                                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                                )
                              }
                              className="h-8 w-8 rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:bg-white/10"
                              aria-label="Mês seguinte"
                            >
                              ›
                            </button>
                          </div>
                          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                            <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.2em] text-white/45">
                              {WEEKDAY_LABELS.map((label) => (
                                <span key={label} className="text-center">
                                  {label}
                                </span>
                              ))}
                            </div>
                            <div ref={endDateInputRef} tabIndex={-1} className="mt-2 grid grid-cols-7 gap-1">
                              {endCalendarCells.map((cell, index) => {
                                const isDisabled = isBeforeDay(cell.date, minEndDate);
                                const isSelected = selectedEndDate ? isSameDay(cell.date, selectedEndDate) : false;
                                const isToday = isSameDay(cell.date, today);
                                return (
                                  <button
                                    key={`${cell.date.toISOString()}-${index}`}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      handleEndDateChange(formatInputDate(cell.date));
                                      setSchedulePopover(null);
                                    }}
                                    className={`h-8 rounded-lg text-[12px] font-medium transition ${
                                      isSelected
                                        ? "bg-[var(--orya-cyan)] text-black shadow-[0_8px_18px_rgba(107,255,255,0.35)]"
                                        : isToday
                                          ? "border border-[var(--orya-cyan)] bg-white/5 text-white"
                                          : cell.inMonth
                                            ? "bg-white/[0.04] text-white/85 hover:bg-white/12"
                                            : "text-white/35 hover:bg-white/8 hover:text-white/60"
                                    } ${isDisabled ? "cursor-not-allowed text-white/20 hover:bg-transparent" : ""}`}
                                  >
                                    {cell.date.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={endTimePopoverRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setSchedulePopover((prev) => (prev === "endTime" ? null : "endTime"))
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                          schedulePopover === "endTime"
                            ? "border-white/40 bg-white/15 text-white"
                            : "border-white/15 bg-white/5 text-white/80 hover:border-white/35"
                        }`}
                      >
                        {endsAt ? formatTimeLabel(endsAt) : "Hora"}
                      </button>
                      {schedulePopover === "endTime" && (
                        <div className="absolute right-0 z-[var(--z-popover)] mt-2 w-[210px] rounded-2xl orya-menu-surface p-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                              Hora de fim
                            </span>
                            <span className="text-[10px] text-white/40">00:00 → 23:30</span>
                          </div>
                          <div
                            ref={endTimeInputRef}
                            tabIndex={-1}
                            className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/12 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          >
                            {timeSlots.map((slot) => {
                              const isSelected = slot === endTimeInput;
                              return (
                                <button
                                  key={`end-${slot}`}
                                  type="button"
                                  onClick={() => {
                                    handleEndTimeChange(slot);
                                    setSchedulePopover(null);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12px] transition ${
                                    isSelected
                                      ? "bg-[var(--orya-cyan)] text-black shadow-[0_6px_14px_rgba(107,255,255,0.35)]"
                                      : "text-white/80 hover:bg-white/10"
                                  }`}
                                >
                                  <span>{slot}</span>
                                  {isSelected && <span className="text-[10px] font-semibold">Selecionado</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {scheduleError && <p className="text-[10px] text-pink-200">{scheduleError}</p>}
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="group flex w-full items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/25 hover:bg-white/8"
                >
                  <div className="space-y-1">
                    <p className="text-[12px] text-white/80">Localização</p>
                    <p className="text-[11px] text-white/55">{locationSummary}</p>
                    {locationError && <p className="text-[10px] text-pink-200">{locationError}</p>}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDescriptionModal(true)}
                  className="group flex w-full items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/25 hover:bg-white/8"
                >
                  <div className="space-y-1">
                    <p className="text-[12px] text-white/80">Descrição</p>
                    <p className="text-[11px] text-white/55">{descriptionSummary}</p>
                  </div>
                </button>
              </div>

              <div className="space-y-1.5">
                <p className={labelClass}>Opções do {primaryLabel}</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/8">
                  {isPadelPreset ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (padelSectionRef.current) {
                          padelSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                      className="group flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition hover:bg-white/6"
                    >
                      <div className="space-y-1">
                        <p className={labelClass}>Categorias & {ticketLabelPlural}</p>
                        <p className="text-[12px] text-white/75">{ticketsSummary}</p>
                        {paidTicketsBlocked && !isGratisEvent && (
                          <p className="text-[11px] text-amber-200/90">Stripe + email oficial.</p>
                        )}
                      </div>
                      <span className="text-[12px] text-white/60 group-hover:text-white/85">Ver</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTicketsModal(true)}
                      className="group flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition hover:bg-white/6"
                    >
                      <div className="space-y-1">
                        <p className={labelClass}>{ticketLabelPluralCap}</p>
                        <p className="text-[12px] text-white/75">{ticketsSummary}</p>
                        {paidTicketsBlocked && !isGratisEvent && (
                          <p className="text-[11px] text-amber-200/90">Stripe + email oficial.</p>
                        )}
                      </div>
                      <span className="text-[12px] text-white/60 group-hover:text-white/85">Abrir</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowLiveHubModal(true)}
                    className="group flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition hover:bg-white/6"
                  >
                    <div className="space-y-1">
                      <p className={labelClass}>LiveHub</p>
                      <p className="text-[12px] text-white/75">{liveHubSummary}</p>
                    </div>
                    <span className="text-[12px] text-white/60 group-hover:text-white/85">Abrir</span>
                  </button>
                </div>
              </div>

              {selectedPreset === "padel" && (
                <section
                  ref={padelSectionRef}
                  className="space-y-4 rounded-2xl border border-white/12 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/55">Padel</p>
                      <p className="text-[12px] text-white/70">Configuração</p>
                    </div>
                    <Link
                      href="/organizacao/torneios?section=padel-hub"
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:border-white/30 hover:bg-white/15"
                    >
                      Hub
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                    <span className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-1">
                      Formato: {padelFormatLabel}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-1">
                      {padelCategoryCountLabel}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-1">
                      RuleSet: {padelRuleSetLabel}
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className={labelClass}>Tipo de clube</p>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/65">
                          {padelClubMode === "PARTNER" ? "Parceiro" : "Próprio"}
                        </span>
                      </div>
                      <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                        {[
                          { key: "OWN" as const, label: "Tenho clube" },
                          { key: "PARTNER" as const, label: "Clube parceiro" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handlePadelClubModeChange(opt.key)}
                            className={`rounded-full px-3 py-1 transition ${
                              padelClubMode === opt.key
                                ? "bg-white text-black font-semibold shadow"
                                : "text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-white/60">
                        {padelClubMode === "PARTNER"
                          ? "Usa um clube de terceiros. Procura no diretorio e confirma o staff local."
                          : "Usa um clube da tua organização para gerir courts e staff."}
                      </p>
                      {padelClubMode === "PARTNER" && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              clearErrorsForFields(["padel"]);
                              setPadelClubSource("DIRECTORY");
                              setPadelClubSourceTouched(true);
                              setPadelDirectoryError(null);
                              openPadelOperation();
                            }}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                          >
                            Abrir diretorio
                          </button>
                          <Link
                            href="/organizacao/torneios?section=padel-hub&padel=clubs"
                            className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/30"
                          >
                            Criar clube rapido
                          </Link>
                        </div>
                      )}
                      {padelClubMode === "OWN" && !padelClubs?.items?.length && (
                        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50">
                          <p className="font-semibold">Sem clubes ativos</p>
                          <p className="text-amber-50/80">Adiciona um clube ou muda para clube parceiro.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className={labelClass}>Checklist</p>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/65">
                          {padelChecklistComplete}/{padelChecklistTotal}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {padelChecklist.map((item) => {
                          const statusLabel =
                            item.status === "ok" ? "OK" : item.status === "optional" ? "Opcional" : "Em falta";
                          const statusClass =
                            item.status === "ok"
                              ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
                              : item.status === "optional"
                                ? "border-white/15 bg-white/5 text-white/65"
                                : "border-amber-400/40 bg-amber-500/10 text-amber-50";
                          return (
                            <div
                              key={item.key}
                              className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                            >
                              <div>
                                <p className="text-[12px] font-semibold text-white">{item.label}</p>
                                <p className="text-[11px] text-white/60">{item.detail}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => scrollToPadelTarget(padelCategoriesRef)}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/30"
                        >
                          Categorias
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToPadelTarget(padelTicketsRef)}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/30"
                        >
                          Inscrições
                        </button>
                        <button
                          type="button"
                          onClick={openPadelOperation}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/30"
                        >
                          Operação
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className={labelClass}>Formato</p>
                        <div className="flex flex-wrap gap-2">
                          {padelFormatOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPadelFormat(opt.value)}
                              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                                padelFormat === opt.value
                                  ? "border-[var(--orya-cyan)] bg-[rgba(107,255,255,0.16)] text-white"
                                  : "border-white/20 bg-black/30 text-white/70 hover:border-white/35"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className={labelClass}>RuleSet</label>
                        <select
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                          value={padelRuleSetId ?? ""}
                          onChange={(e) => setPadelRuleSetId(Number(e.target.value) || null)}
                        >
                          <option value="">Padrão</option>
                          {padelRuleSetItems.map((rs) => (
                            <option key={rs.id} value={rs.id}>
                              {rs.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className={labelClass}>Categorias</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {padelCategoryIds.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={applyPadelFormatToAll}
                              className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10"
                            >
                              Aplicar formato do torneio
                            </button>
                            {!isPadelPaid && (
                              <button
                                type="button"
                                onClick={applyPadelCapacityToAll}
                                disabled={!padelCategoryConfigs[padelCategoryIds[0]]?.capacityTeams}
                                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
                              >
                                Replicar capacidade
                              </button>
                            )}
                          </>
                        )}
                        {padelCategoryIds.length > 0 && (
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
                            {padelCategoryIds.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {isPadelPaid && (
                      <p className="text-[11px] text-white/55">
                        Capacidade e preço são definidos nas {ticketLabelPlural} por categoria.
                      </p>
                    )}
                    <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
                      {padelCategoryItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {padelCategoryItems.map((cat) => {
                            const selected = padelCategoryIds.includes(cat.id);
                            const descriptor = getPadelCategoryDescriptor(cat.id);
                            const chipTitle = [descriptor.tag, descriptor.detail].filter(Boolean).join(" · ");
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                title={chipTitle || cat.label}
                                onClick={() => {
                                  clearErrorsForFields(["padel"]);
                                  setPadelCategoryIds((prev) =>
                                    prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id],
                                  );
                                }}
                                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                                  selected
                                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-50"
                                    : "border-white/20 bg-black/30 text-white/70 hover:border-white/35"
                                }`}
                              >
                                {cat.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[12px] text-white/60">Sem categorias</p>
                      )}
                    </div>
                    {padelCategoryIds.length > 0 && (
                      <div className="rounded-2xl border border-white/12 bg-white/5">
                        <div className="hidden grid-cols-[1.2fr_0.9fr_0.7fr] gap-2 border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/45 sm:grid">
                          <span>Categoria</span>
                          <span>Formato</span>
                          <span>{isPadelPaid ? `Capacidade (${ticketLabelPlural})` : "Capacidade"}</span>
                        </div>
                        <div className="divide-y divide-white/10">
                          {padelCategoryIds.map((categoryId) => {
                            const cat = padelCategoryItems.find((c) => c.id === categoryId);
                            if (!cat) return null;
                            const config = padelCategoryConfigs[categoryId];
                            const descriptor = getPadelCategoryDescriptor(categoryId);
                            return (
                              <div
                                key={categoryId}
                                className="grid gap-2 px-4 py-3 sm:grid-cols-[1.2fr_0.9fr_0.7fr] sm:items-center"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[12px] font-semibold text-white">{cat.label}</span>
                                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                      {descriptor.tag}
                                    </span>
                                  </div>
                                  {descriptor.detail && (
                                    <div className="text-[11px] text-white/55">{descriptor.detail}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/45 sm:hidden">
                                    Formato
                                  </span>
                                  <select
                                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                                    value={config?.format ?? ""}
                                    onChange={(e) =>
                                      setPadelCategoryConfigs((prev) => ({
                                        ...prev,
                                        [categoryId]: {
                                          capacityTeams: prev[categoryId]?.capacityTeams ?? "",
                                          format: e.target.value || null,
                                        },
                                      }))
                                    }
                                  >
                                    <option value="">Formato (torneio)</option>
                                    {padelFormatOptions.map((opt) => (
                                      <option key={`cat-format-${categoryId}-${opt.value}`} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/45 sm:hidden">
                                    {isPadelPaid ? `Capacidade (${ticketLabelPlural})` : "Capacidade"}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    inputMode="numeric"
                                    placeholder="Capacidade"
                                    value={
                                      isPadelPaid ? getPadelTicketCapacityValue(categoryId) : config?.capacityTeams ?? ""
                                    }
                                    onChange={(e) => {
                                      if (isPadelPaid) return;
                                      setPadelCategoryConfigs((prev) => ({
                                        ...prev,
                                        [categoryId]: {
                                          capacityTeams: normalizeIntegerInput(e.target.value),
                                          format: prev[categoryId]?.format ?? null,
                                        },
                                      }));
                                    }}
                                    disabled={isPadelPaid}
                                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)] disabled:opacity-65"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {fieldErrors.padel && <p className="text-[11px] text-pink-200">{fieldErrors.padel}</p>}
                  </div>

                  <div ref={padelTicketsRef} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className={labelClass}>{ticketLabelPluralCap}</p>
                        <p className="text-[12px] text-white/70">
                          {padelCategoryIds.length === 0 ? ticketsSummary : `${ticketsSummary} · ${accessSummary}`}
                        </p>
                      </div>
                    </div>
                    {renderTicketsPanel()}
                  </div>

                  <div ref={padelOperationRef} className="rounded-2xl border border-white/12 bg-white/5">
                    <button
                      type="button"
                      onClick={() => setPadelRulesOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/8"
                    >
                      <div className="space-y-1">
                        <p className={labelClass}>Inscrições</p>
                        <p className="text-sm text-white/80">
                          Split {padelSplitDeadlineHours || "48"}h · Total {padelMaxEntriesTotal || "—"}
                        </p>
                      </div>
                      <span className="text-[12px] text-white/60">
                        {padelRulesOpen ? "Fechar" : "Editar"}
                      </span>
                    </button>
                    {padelRulesOpen && (
                      <div className="space-y-3 px-4 pb-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-[11px] text-white/70">
                            Split (h)
                            <input
                              type="number"
                              min={48}
                              max={168}
                              step="1"
                              inputMode="numeric"
                              value={padelSplitDeadlineHours}
                              onChange={(e) => setPadelSplitDeadlineHours(normalizeIntegerInput(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                            />
                          </label>
                          <label className="text-[11px] text-white/70">
                            Total
                            <input
                              type="number"
                              min={0}
                              step="1"
                              inputMode="numeric"
                              value={padelMaxEntriesTotal}
                              onChange={(e) => setPadelMaxEntriesTotal(normalizeIntegerInput(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                            />
                          </label>
                          <label className="text-[11px] text-white/70">
                            Abertura
                            <input
                              type="datetime-local"
                              value={padelRegistrationStartsAt}
                              onChange={(e) => setPadelRegistrationStartsAt(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                            />
                          </label>
                          <label className="text-[11px] text-white/70">
                            Fecho
                            <input
                              type="datetime-local"
                              value={padelRegistrationEndsAt}
                              onChange={(e) => setPadelRegistrationEndsAt(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/90 outline-none transition focus:border-[var(--orya-cyan)] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)]"
                            />
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white/80">
                            <span>Espera</span>
                            <button
                              type="button"
                              onClick={() => setPadelWaitlistEnabled((prev) => !prev)}
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                padelWaitlistEnabled ? "bg-white text-black" : "border border-white/20 text-white/80"
                              }`}
                            >
                              {padelWaitlistEnabled ? "Ativa" : "Inativa"}
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white/80">
                            <span>Por jogador</span>
                            <button
                              type="button"
                              onClick={() => setPadelAllowSecondCategory((prev) => !prev)}
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                padelAllowSecondCategory ? "bg-white text-black" : "border border-white/20 text-white/80"
                              }`}
                            >
                              {padelAllowSecondCategory ? "2 categorias" : "1 categoria"}
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-white/50">Vazio = sem limite.</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-white/5">
                    <button
                      type="button"
                      onClick={() => setPadelAdvancedOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/8"
                    >
                      <div className="space-y-1">
                        <p className={labelClass}>Operação</p>
                        <p className="text-sm text-white/80">
                          Clube: {selectedPadelClub?.name ?? "—"} · Courts: {selectedPadelCourtIds.length || "—"}
                        </p>
                        <p className="text-[11px] text-white/60">Staff: {selectedPadelStaffIds.length || "—"}</p>
                      </div>
                      <span className="text-[12px] text-white/60">
                        {padelAdvancedOpen ? "Fechar" : "Editar"}
                      </span>
                    </button>
                    {padelAdvancedOpen && <div className="px-4 pb-4">{padelExtrasContent}</div>}
                  </div>
                </section>
              )}
            </div>
          </section>

          <div className="flex flex-col items-center gap-2 pt-2">
            <p className="text-[11px] text-white/60">Obrigatório: título, data, cidade.</p>
            {submitDisabledReason && (
              <p className="text-[10px] text-white/45">{submitDisabledReason}</p>
            )}
            <div className="flex w-full max-w-[420px]">
              <button
                type="submit"
                disabled={Boolean(submitDisabledReason)}
                className={`${CTA_PRIMARY} flex-1 disabled:opacity-60`}
                title={submitDisabledReason ?? ""}
              >
                {isSubmitting ? `A criar ${primaryLabel}...` : `Criar ${primaryLabel}`}
              </button>
            </div>
          </div>

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
                title={`Algo correu mal ao guardar o ${primaryLabel}`}
                message={backendAlert}
              />
            )}
          </div>

        {ticketsModal}
        {liveHubModal}
        {locationModal}
        {descriptionModal}
        {coverModal}
      </div>
    </div>

    {creationSuccess && (
        <div className="fixed bottom-6 right-6 z-[var(--z-popover)] w-[320px] max-w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)] text-emerald-50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{primaryLabelTitle} criado</p>
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
                href={`${detailBasePath}/${creationSuccess.eventId}`}
                className="rounded-full border border-emerald-200/60 bg-emerald-500/15 px-3 py-1 font-semibold text-white hover:bg-emerald-500/25"
              >
                Editar {primaryLabel}
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

      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />
      </form>
    </>
  );
}
