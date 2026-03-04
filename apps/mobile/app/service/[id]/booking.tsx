import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  addMonthsToIsoYearMonth,
  formatIsoDateLabel,
  formatIsoYearMonthLabel,
  getIsoYearMonthInTimeZone,
  monthKeyFromIsoYearMonth,
  tokens,
} from "@orya/shared";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../components/liquid/GlassCard";
import {
  AddressPicker,
  type AddressSelection,
} from "../../../components/address/AddressPicker";
import { useServiceDetail } from "../../../features/services/hooks";
import type { ServiceResource } from "../../../features/services/types";
import {
  useCheckoutStore,
  buildCheckoutIdempotencyKey,
} from "../../../features/checkout/store";
import {
  buildAddonPayload,
  buildBookingPayload,
} from "../../../features/services/bookingPayload";
import { useAuth } from "../../../lib/auth";
import { safeBack, safePush } from "../../../lib/navigation";
import { TAB_PATHNAMES } from "../../../lib/tabRoutes";
import { getUserFacingError } from "../../../lib/errors";
import { trackEvent } from "../../../lib/analytics";
import { api } from "../../../lib/api";

type AvailabilityDay = {
  date: string;
  hasAvailability: boolean;
  slots: number;
};

type AvailabilitySlot = {
  slotKey: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
};

type BookingPolicy = {
  durationCatalog?: number[];
  activeDurations?: number[];
  allowedDurations?: number[];
};

type CalendarResponse = {
  ok: boolean;
  timezone?: string | null;
  month?: string | null;
  days?: AvailabilityDay[];
  bookingPolicy?: BookingPolicy;
  error?: string;
};

type SlotsResponse = {
  ok: boolean;
  items?: AvailabilitySlot[];
  bookingPolicy?: BookingPolicy;
  error?: string;
};

const formatMoney = (cents: number, currency: string) => {
  if (!Number.isFinite(cents)) return "-";
  if (cents <= 0) return "Grátis";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDayLabel = (date: string) =>
  formatIsoDateLabel(date, {
    locale: "pt-PT",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

const formatTime = (date: string, timeZone: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
};

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const RESERVE_RETRY_DELAY_MS = 350;
const RESERVE_RETRY_ATTEMPTS = 2;

const isReserveTransportError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return (
    message.includes("api timeout") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("offline")
  );
};

const resolveReserveErrorCode = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.errorCode === "string" && record.errorCode.trim()) {
    return record.errorCode.trim().toUpperCase();
  }
  if (typeof record.error === "string" && record.error.trim()) {
    const normalized = record.error.trim().toUpperCase();
    if (/^[A-Z0-9_]+$/.test(normalized)) return normalized;
  }
  return null;
};

const buildBookingClientRequestId = () => {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `reserve_${random}`;
};

const resolveAssignmentMode = (
  service?: {
    kind?: string | null;
    assignmentMode?: string | null;
    organization?: { reservationAssignmentMode?: string | null } | null;
    assignment?: {
      requiresProfessional?: boolean;
      requiresResource?: boolean;
      availabilityMode?: string | null;
    } | null;
    selectionRules?: {
      requiresProfessional?: boolean;
      requiresResource?: boolean;
    } | null;
  } | null,
) => {
  const requiresProfessional = Boolean(
    service?.selectionRules?.requiresProfessional ??
      service?.assignment?.requiresProfessional,
  );
  const requiresResource = Boolean(
    service?.selectionRules?.requiresResource ??
      service?.assignment?.requiresResource,
  );
  if (requiresResource && !requiresProfessional) return "RESOURCE";
  if (requiresResource && requiresProfessional) return "RESOURCE";

  const assignmentModeRaw = service?.assignmentMode?.trim().toUpperCase();
  if (
    assignmentModeRaw === "RESOURCE_ONLY" ||
    assignmentModeRaw === "RESOURCE" ||
    assignmentModeRaw === "PROFESSIONAL_AND_RESOURCE"
  ) {
    return "RESOURCE";
  }

  if (service?.kind === "COURT") return "RESOURCE";
  const orgMode = service?.organization?.reservationAssignmentMode;
  if (orgMode === "RESOURCE" || orgMode === "RESOURCE_ONLY") return "RESOURCE";
  return "PROFESSIONAL";
};

export default function ServiceBookingScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    orgUsername?: string | string[];
    bookingVertical?: string | string[];
    courtId?: string | string[];
    checkoutError?: string | string[];
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const serviceId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id]);
  const {
    data: service,
    isLoading,
    isError,
    error,
    refetch,
  } = useServiceDetail(serviceId ? String(serviceId) : "");
  const setCheckoutDraft = useCheckoutStore((state) => state.setDraft);
  const setCheckoutIntent = useCheckoutStore((state) => state.setIntent);
  const checkoutDraft = useCheckoutStore((state) => state.draft);
  const bookingVerticalParam = useMemo(() => {
    const raw = Array.isArray(params.bookingVertical) ? params.bookingVertical[0] : params.bookingVertical;
    return String(raw ?? "")
      .trim()
      .toUpperCase();
  }, [params.bookingVertical]);
  const orgUsernameParam = useMemo(() => {
    const raw = Array.isArray(params.orgUsername) ? params.orgUsername[0] : params.orgUsername;
    const value = String(raw ?? "").trim();
    return value || null;
  }, [params.orgUsername]);
  const courtIdParam = useMemo(() => {
    const raw = Array.isArray(params.courtId) ? params.courtId[0] : params.courtId;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }, [params.courtId]);
  const checkoutErrorParam = useMemo(() => {
    const raw = Array.isArray(params.checkoutError) ? params.checkoutError[0] : params.checkoutError;
    return String(raw ?? "")
      .trim()
      .toLowerCase();
  }, [params.checkoutError]);

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null,
  );
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy>({
    durationCatalog: [30, 60, 90, 120],
    activeDurations: [60, 90],
    allowedDurations: [60, 90],
  });
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number | null>(null);
  const [addonQuantities, setAddonQuantities] = useState<
    Record<number, number>
  >({});
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<
    number | null
  >(null);
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(
    null,
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(
    null,
  );
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getIsoYearMonthInTimeZone(new Date(), "Europe/Lisbon"),
  );
  const [calendarDays, setCalendarDays] = useState<AvailabilityDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [addressSelection, setAddressSelection] =
    useState<AddressSelection | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  const [resumeCheckoutCountdown, setResumeCheckoutCountdown] = useState<string | null>(null);
  const reserveClientRequestIdRef = useRef<string | null>(null);

  const assignmentMode = useMemo(
    () => resolveAssignmentMode(service ?? null),
    [service],
  );
  const selectedServiceApiId = service?.backingServiceId ?? serviceId;
  const resolvedBookingVertical = useMemo(() => {
    if (bookingVerticalParam === "COURT" || bookingVerticalParam === "CLASS" || bookingVerticalParam === "SERVICE") {
      return bookingVerticalParam;
    }
    const byVertical = String(service?.bookingVertical ?? "")
      .trim()
      .toUpperCase();
    if (byVertical === "COURT" || byVertical === "CLASS" || byVertical === "SERVICE") {
      return byVertical;
    }
    const byKind = String(service?.kind ?? "")
      .trim()
      .toUpperCase();
    if (byKind === "COURT") return "COURT";
    if (byKind === "CLASS") return "CLASS";
    return "SERVICE";
  }, [bookingVerticalParam, service?.bookingVertical, service?.kind]);
  const resolvedOrgUsername = orgUsernameParam ?? service?.organization?.username ?? null;
  const resolvedCourtId = courtIdParam ?? service?.courtId ?? null;
  const publicCourtFlowEnabled = Boolean(
    resolvedBookingVertical === "COURT" && resolvedOrgUsername && resolvedCourtId && selectedServiceApiId,
  );
  const publicClassFlowEnabled = Boolean(
    resolvedBookingVertical === "CLASS" && resolvedOrgUsername && selectedServiceApiId,
  );
  const serviceTimezone = service?.organization?.timezone?.trim() || "Europe/Lisbon";
  const isAuthenticated = Boolean(session?.user?.id);

  const availableProfessionals = useMemo(() => {
    const professionals = service?.professionals ?? [];
    const allowedIds = new Set(
      service?.professionalLinks?.map((link) => link.professionalId) ?? [],
    );
    if (allowedIds.size === 0) return professionals;
    return professionals.filter((professional) =>
      allowedIds.has(professional.id),
    );
  }, [service?.professionals, service?.professionalLinks]);

  const availableResources = useMemo<ServiceResource[]>(() => {
    const resources = service?.resources ?? [];
    const allowedIds = new Set(
      service?.resourceLinks?.map((link) => link.resourceId) ?? [],
    );
    if (allowedIds.size === 0) return resources;
    return resources.filter((resource) => allowedIds.has(resource.id));
  }, [service?.resources, service?.resourceLinks]);

  const capacityOptions = useMemo<number[]>(() => {
    const capacities = Array.from(
      new Set(availableResources.map((resource) => resource.capacity)),
    )
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    return capacities;
  }, [availableResources]);

  useEffect(() => {
    if (assignmentMode !== "RESOURCE") return;
    if (selectedPartySize) return;
    if (capacityOptions.length > 0) {
      setSelectedPartySize(capacityOptions[0]);
    }
  }, [assignmentMode, capacityOptions, selectedPartySize]);

  useEffect(() => {
    if (assignmentMode !== "PROFESSIONAL") return;
    if (selectedProfessionalId !== null) return;
    if (availableProfessionals.length === 1) {
      setSelectedProfessionalId(availableProfessionals[0].id);
    }
  }, [assignmentMode, availableProfessionals, selectedProfessionalId]);

  const selectedPackage = useMemo(() => {
    if (service?.kind === "COURT") return null;
    return (
      (service?.packages ?? []).find((pkg) => pkg.id === selectedPackageId) ??
      null
    );
  }, [service?.kind, service?.packages, selectedPackageId]);

  const selectedAddonsPayload = useMemo(
    () => buildAddonPayload(addonQuantities),
    [addonQuantities],
  );
  const addonsParam =
    selectedAddonsPayload.length > 0
      ? JSON.stringify(selectedAddonsPayload)
      : null;

  const addonsDeltaMinutes = useMemo(() => {
    const addons = service?.addons ?? [];
    return selectedAddonsPayload.reduce((total, selected) => {
      const addon = addons.find((item) => item.id === selected.addonId);
      if (!addon) return total;
      return total + addon.deltaMinutes * selected.quantity;
    }, 0);
  }, [selectedAddonsPayload, service?.addons]);

  const addonsDeltaCents = useMemo(() => {
    const addons = service?.addons ?? [];
    return selectedAddonsPayload.reduce((total, selected) => {
      const addon = addons.find((item) => item.id === selected.addonId);
      if (!addon) return total;
      return total + addon.deltaPriceCents * selected.quantity;
    }, 0);
  }, [selectedAddonsPayload, service?.addons]);

  const isCourtService = service?.kind === "COURT";
  const activeDurationOptions = useMemo(() => {
    const fromPolicy = Array.isArray(bookingPolicy.activeDurations)
      ? bookingPolicy.activeDurations
      : Array.isArray(bookingPolicy.allowedDurations)
        ? bookingPolicy.allowedDurations
        : [];
    const unique = Array.from(
      new Set(
        fromPolicy
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
          .map((value) => Math.round(value)),
      ),
    ).sort((a, b) => a - b);
    return unique.length > 0 ? unique : [60, 90];
  }, [bookingPolicy.activeDurations, bookingPolicy.allowedDurations]);
  const durationPriceMap = useMemo(() => {
    const map = new Map<number, number>();
    (service?.durationPrices ?? []).forEach((item) => {
      if (item.isActive === false) return;
      map.set(item.durationMinutes, item.priceCents);
    });
    return map;
  }, [service?.durationPrices]);
  const baseDurationMinutes = isCourtService
    ? selectedDurationMinutes ?? service?.durationMinutes ?? activeDurationOptions[0] ?? 0
    : selectedPackage?.durationMinutes ?? service?.durationMinutes ?? 0;
  const effectiveDurationMinutes = isCourtService
    ? Math.max(0, baseDurationMinutes)
    : Math.max(0, baseDurationMinutes + addonsDeltaMinutes);
  const basePriceCents = isCourtService
    ? durationPriceMap.get(effectiveDurationMinutes) ?? service?.unitPriceCents ?? 0
    : selectedPackage?.priceCents ?? service?.unitPriceCents ?? 0;
  const totalCents = Math.max(0, basePriceCents + addonsDeltaCents);

  const canFetchCalendar =
    Boolean(selectedServiceApiId) &&
    (assignmentMode !== "RESOURCE" || Boolean(selectedPartySize));

  const buildAvailabilityParams = useCallback(
    (params: URLSearchParams) => {
      if (assignmentMode === "PROFESSIONAL" && selectedProfessionalId) {
        params.set("professionalId", String(selectedProfessionalId));
      }
      if (assignmentMode === "RESOURCE" && selectedPartySize) {
        params.set("partySize", String(selectedPartySize));
      }
      if (!isCourtService && selectedPackageId) {
        params.set("packageId", String(selectedPackageId));
      }
      if (addonsParam) {
        params.set("addons", addonsParam);
      }
      if (isCourtService && effectiveDurationMinutes > 0) {
        params.set("durationMinutes", String(effectiveDurationMinutes));
      }
    },
    [
      addonsParam,
      assignmentMode,
      effectiveDurationMinutes,
      isCourtService,
      selectedPackageId,
      selectedPartySize,
      selectedProfessionalId,
    ],
  );

  const buildCalendarUrl = useCallback(
    (params: URLSearchParams) => {
      if (publicCourtFlowEnabled && resolvedOrgUsername && resolvedCourtId) {
        const query = new URLSearchParams(params);
        query.set("courtId", String(resolvedCourtId));
        return `/api/public/org/${encodeURIComponent(resolvedOrgUsername)}/reservas/campos/calendario?${query.toString()}`;
      }
      if (publicClassFlowEnabled && resolvedOrgUsername && selectedServiceApiId) {
        const query = new URLSearchParams(params);
        query.set("serviceId", String(selectedServiceApiId));
        return `/api/public/org/${encodeURIComponent(resolvedOrgUsername)}/reservas/aulas/calendario?${query.toString()}`;
      }
      return `/api/servicos/${selectedServiceApiId}/calendario?${params.toString()}`;
    },
    [
      publicCourtFlowEnabled,
      publicClassFlowEnabled,
      resolvedOrgUsername,
      resolvedCourtId,
      selectedServiceApiId,
    ],
  );

  const buildReserveRequest = useCallback(
    (payload: Record<string, unknown>) => {
      if (publicCourtFlowEnabled && resolvedOrgUsername && resolvedCourtId) {
        return {
          url: `/api/public/org/${encodeURIComponent(resolvedOrgUsername)}/reservas/campos/reservar`,
          body: {
            ...payload,
            courtId: resolvedCourtId,
          },
        } as const;
      }
      if (publicClassFlowEnabled && resolvedOrgUsername && selectedServiceApiId) {
        return {
          url: `/api/public/org/${encodeURIComponent(resolvedOrgUsername)}/reservas/aulas/reservar`,
          body: {
            ...payload,
            serviceId: selectedServiceApiId,
          },
        } as const;
      }
      return {
        url: `/api/servicos/${selectedServiceApiId}/reservar`,
        body: payload,
      } as const;
    },
    [
      publicCourtFlowEnabled,
      publicClassFlowEnabled,
      resolvedOrgUsername,
      resolvedCourtId,
      selectedServiceApiId,
    ],
  );

  const loadCalendar = useCallback(async () => {
    if (!selectedServiceApiId || !canFetchCalendar) return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const params = new URLSearchParams({ month: calendarMonth });
      buildAvailabilityParams(params);
      const result = await api.requestRaw<CalendarResponse>(
        buildCalendarUrl(params),
        { cache: "no-store" },
      );
      const json: CalendarResponse = result.data ?? { ok: false };
      if (!result.ok || !json.ok) {
        throw new Error(
          json.error || "Não foi possível carregar o calendário.",
        );
      }
      if (json.bookingPolicy) {
        setBookingPolicy((prev) => ({ ...prev, ...json.bookingPolicy }));
      }
      setCalendarDays(json.days ?? []);
    } catch (err) {
      setCalendarError(
        getUserFacingError(err, "Não foi possível carregar o calendário."),
      );
    } finally {
      setCalendarLoading(false);
    }
  }, [buildAvailabilityParams, buildCalendarUrl, calendarMonth, canFetchCalendar, selectedServiceApiId]);

  const loadSlots = useCallback(async () => {
    if (!selectedServiceApiId || !selectedDay || !canFetchCalendar) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const params = new URLSearchParams({ day: selectedDay });
      buildAvailabilityParams(params);
      const result = await api.requestRaw<SlotsResponse>(
        buildCalendarUrl(params),
        {
          cache: "no-store",
        },
      );
      const json: SlotsResponse = result.data ?? { ok: false };
      if (!result.ok || !json.ok) {
        throw new Error(json.error || "Não foi possível carregar horários.");
      }
      if (json.bookingPolicy) {
        setBookingPolicy((prev) => ({ ...prev, ...json.bookingPolicy }));
      }
      setSlots(json.items ?? []);
    } catch (err) {
      setSlotsError(
        getUserFacingError(err, "Não foi possível carregar horários."),
      );
    } finally {
      setSlotsLoading(false);
    }
  }, [buildAvailabilityParams, buildCalendarUrl, canFetchCalendar, selectedDay, selectedServiceApiId]);

  useEffect(() => {
    if (!canFetchCalendar) return;
    loadCalendar();
  }, [canFetchCalendar, loadCalendar]);

  useEffect(() => {
    const zonedMonth = getIsoYearMonthInTimeZone(new Date(), serviceTimezone);
    if (!zonedMonth) return;
    if (selectedDay) return;
    setCalendarMonth((current) => (current === zonedMonth ? current : zonedMonth));
  }, [serviceTimezone, selectedDay]);

  useEffect(() => {
    if (!service) return;
    if (!isCourtService) {
      if (selectedDurationMinutes !== null) setSelectedDurationMinutes(null);
      return;
    }
    if (activeDurationOptions.length === 0) return;
    const current = selectedDurationMinutes ?? service.durationMinutes ?? activeDurationOptions[0];
    if (activeDurationOptions.includes(current)) {
      if (selectedDurationMinutes == null) {
        setSelectedDurationMinutes(current);
      }
      return;
    }
    setSelectedDurationMinutes(activeDurationOptions[0]);
  }, [
    activeDurationOptions,
    isCourtService,
    selectedDurationMinutes,
    service,
  ]);

  useEffect(() => {
    setSelectedDay(null);
    setSelectedSlot(null);
  }, [
    selectedPackageId,
    selectedDurationMinutes,
    addonsParam,
    assignmentMode,
    selectedProfessionalId,
    selectedPartySize,
  ]);

  useEffect(() => {
    if (!selectedDay) return;
    loadSlots();
  }, [loadSlots, selectedDay]);

  useEffect(() => {
    reserveClientRequestIdRef.current = null;
  }, [
    addonsParam,
    addressSelection?.addressId,
    effectiveDurationMinutes,
    selectedDay,
    selectedPackageId,
    selectedPartySize,
    selectedProfessionalId,
    selectedServiceApiId,
    selectedSlot?.slotKey,
  ]);

  useEffect(() => {
    if (checkoutErrorParam !== "slot_unavailable") return;
    setBookingError("O horário deixou de estar disponível. Escolhe outro para continuar.");
    if (selectedDay) {
      void loadSlots();
    }
  }, [checkoutErrorParam, loadSlots, selectedDay]);

  const openAuth = useCallback(() => {
    if (!serviceId) return;
    safePush(router, {
      pathname: "/auth",
      params: { next: `/service/${serviceId}/booking` },
    });
  }, [router, serviceId]);

  const handleBack = () => {
    safeBack(
      router,
      navigation,
      serviceId ? `/service/${serviceId}` : TAB_PATHNAMES.inicio,
    );
  };

  const reserveSlot = useCallback(
    async (slotOverride?: AvailabilitySlot) => {
      const slot = slotOverride ?? selectedSlot;
      if (!selectedServiceApiId || !service || !slot) return;
      if (!isAuthenticated) {
        openAuth();
        return;
      }
      setBookingError(null);
      setBookingLoading(true);
      try {
        if (
          service.locationMode === "CHOOSE_AT_BOOKING" &&
          !addressSelection?.addressId
        ) {
          throw new Error("Seleciona uma morada antes de reservar.");
        }
        const payload = buildBookingPayload({
          startsAt: slot.startsAt,
          durationMinutes: isCourtService ? effectiveDurationMinutes : null,
          professionalId:
            assignmentMode === "PROFESSIONAL" ? selectedProfessionalId : null,
          partySize: assignmentMode === "RESOURCE" ? selectedPartySize : null,
          addressId: addressSelection?.addressId ?? null,
          selectedAddons: selectedAddonsPayload,
          packageId: isCourtService ? null : selectedPackageId,
        });
        const reserveRequest = buildReserveRequest(payload as Record<string, unknown>);
        const clientRequestId =
          reserveClientRequestIdRef.current ?? buildBookingClientRequestId();
        reserveClientRequestIdRef.current = clientRequestId;

        let result: Awaited<
          ReturnType<
            typeof api.requestRaw<{
              ok: boolean;
              booking?: {
                id?: number;
                organizationId?: number;
                startsAt?: string;
                pendingExpiresAt?: string | null;
                professionalId?: number | null;
                resourceId?: number | null;
              };
              deduped?: boolean;
              error?: string;
              errorCode?: string;
              message?: string;
            }>
          >
        > | null = null;
        for (let attempt = 0; attempt < RESERVE_RETRY_ATTEMPTS; attempt += 1) {
          try {
            result = await api.requestRaw<{
              ok: boolean;
              booking?: {
                id?: number;
                organizationId?: number;
                startsAt?: string;
                pendingExpiresAt?: string | null;
                professionalId?: number | null;
                resourceId?: number | null;
              };
              deduped?: boolean;
              error?: string;
              errorCode?: string;
              message?: string;
            }>(reserveRequest.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...reserveRequest.body,
                clientRequestId,
              }),
            });

            if (!result.ok && result.status >= 500 && attempt < RESERVE_RETRY_ATTEMPTS - 1) {
              await new Promise((resolve) => setTimeout(resolve, RESERVE_RETRY_DELAY_MS));
              continue;
            }
            break;
          } catch (requestError) {
            if (attempt < RESERVE_RETRY_ATTEMPTS - 1 && isReserveTransportError(requestError)) {
              await new Promise((resolve) => setTimeout(resolve, RESERVE_RETRY_DELAY_MS));
              continue;
            }
            throw requestError;
          }
        }

        if (!result) {
          throw new Error("Não foi possível criar a pré-reserva.");
        }
        const json = result.data;
        if (!result.ok || !json?.ok) {
          const errorCode = resolveReserveErrorCode(json);
          if (errorCode === "PHONE_REQUIRED") {
            reserveClientRequestIdRef.current = null;
            setPhoneRequired(true);
            setPendingSlot(slot);
            throw new Error(
              json?.message || "Telemóvel obrigatório para reservar.",
            );
          }
          if (errorCode === "SLOT_NOT_AVAILABLE" || errorCode === "AGENDA_CONFLICT") {
            reserveClientRequestIdRef.current = null;
            await loadSlots();
            throw new Error("O horário deixou de estar disponível. Escolhe outro para continuar.");
          }
          reserveClientRequestIdRef.current = null;
          throw new Error(
            json?.message ||
              json?.error ||
              "Não foi possível criar a pré-reserva.",
          );
        }
        reserveClientRequestIdRef.current = null;
        trackEvent("booking_hold_created", {
          serviceId: selectedServiceApiId,
          bookingId: json.booking?.id ?? null,
          deduped: Boolean(json.deduped),
        });
        const idempotencyKey = buildCheckoutIdempotencyKey();
        const holdSubjectLabel = `${service.title} · ${new Date(
          json.booking?.startsAt ?? slot.startsAt,
        ).toLocaleString("pt-PT", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`;
        setCheckoutDraft({
          organizationId:
            (typeof json.booking?.organizationId === "number"
              ? json.booking.organizationId
              : null) ??
            (typeof service.organization?.id === "number"
              ? service.organization.id
              : null),
          serviceId: selectedServiceApiId,
          serviceTitle: service.title,
          bookingId: json.booking?.id ?? null,
          bookingStartsAt: json.booking?.startsAt ?? slot.startsAt,
          bookingDurationMinutes: effectiveDurationMinutes,
          bookingProfessionalId:
            typeof json.booking?.professionalId === "number"
              ? json.booking.professionalId
              : assignmentMode === "PROFESSIONAL"
                ? selectedProfessionalId
                : null,
          bookingResourceIds:
            typeof json.booking?.resourceId === "number"
              ? [json.booking.resourceId]
              : [],
          pendingExpiresAt: json.booking?.pendingExpiresAt ?? null,
          bookingExpiresAt: json.booking?.pendingExpiresAt ?? null,
          sourceType: "SERVICE_BOOKING",
          ticketName: "Reserva",
          quantity: 1,
          unitPriceCents: basePriceCents,
          totalCents,
          currency: service.currency ?? "EUR",
          paymentMethod: "card",
          idempotencyKey,
          holdSubjectLabel,
        });
        setCheckoutIntent({
          clientSecret: null,
          paymentIntentId: null,
          purchaseId: null,
          breakdown: null,
          freeCheckout: false,
        });
        trackEvent("checkout_started", {
          sourceType: "SERVICE_BOOKING",
          serviceId: selectedServiceApiId,
          bookingId: json.booking?.id ?? null,
        });
        safePush(router, "/checkout");
      } catch (err) {
        setBookingError(
          getUserFacingError(err, "Não foi possível criar a pré-reserva."),
        );
      } finally {
        setBookingLoading(false);
      }
    },
    [
      addressSelection?.addressId,
      assignmentMode,
      basePriceCents,
      buildReserveRequest,
      effectiveDurationMinutes,
      isCourtService,
      isAuthenticated,
      loadSlots,
      openAuth,
      router,
      selectedAddonsPayload,
      selectedPackageId,
      selectedPartySize,
      selectedProfessionalId,
      selectedSlot,
      service,
      selectedServiceApiId,
      setCheckoutDraft,
      setCheckoutIntent,
      totalCents,
    ],
  );

  const savePhone = useCallback(async () => {
    const value = phoneDraft.trim();
    if (!value) {
      setBookingError("Indica o número de telemóvel.");
      return;
    }
    setPhoneSaving(true);
    setBookingError(null);
    try {
      const result = await api.requestRaw<{
        ok: boolean;
        error?: string;
        message?: string;
      }>("/api/me/contact-phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactPhone: value }),
      });
      const json = result.data;
      if (!result.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível guardar o telemóvel.");
      }
      setPhoneRequired(false);
      setPhoneDraft("");
      if (pendingSlot) {
        const slot = pendingSlot;
        setPendingSlot(null);
        setSelectedSlot(slot);
        await reserveSlot(slot);
      }
    } catch (err) {
      setBookingError(
        getUserFacingError(err, "Não foi possível guardar o telemóvel."),
      );
    } finally {
      setPhoneSaving(false);
    }
  }, [pendingSlot, phoneDraft, reserveSlot]);

  const canReserve =
    Boolean(selectedSlot) &&
    !phoneRequired &&
    (!service ||
      service.locationMode !== "CHOOSE_AT_BOOKING" ||
      Boolean(addressSelection?.addressId));

  const resumableCheckoutDraft = useMemo(() => {
    if (!checkoutDraft) return null;
    if (checkoutDraft.sourceType !== "SERVICE_BOOKING") return null;
    if (!checkoutDraft.holdExpiresAt) return null;
    if (!selectedServiceApiId || checkoutDraft.serviceId !== selectedServiceApiId) return null;
    const expiresAtMs = new Date(checkoutDraft.holdExpiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
    return checkoutDraft;
  }, [checkoutDraft, selectedServiceApiId]);

  useEffect(() => {
    if (!resumableCheckoutDraft?.holdExpiresAt) {
      setResumeCheckoutCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = new Date(resumableCheckoutDraft.holdExpiresAt ?? "").getTime() - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setResumeCheckoutCountdown(null);
        return;
      }
      setResumeCheckoutCountdown(formatCountdown(remaining));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resumableCheckoutDraft?.holdExpiresAt]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LiquidBackground>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="white" />
          </View>
        </LiquidBackground>
      </>
    );
  }

  if (isError || !service) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LiquidBackground>
          <View className="px-5 pt-12 pb-6">
            <Pressable
              onPress={handleBack}
              style={{
                width: tokens.layout.touchTarget,
                height: tokens.layout.touchTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={tokens.colors.text}
              />
            </Pressable>
          </View>
          <View className="px-5">
            <GlassCard intensity={52}>
              <Text className="text-white text-sm">
                {error ? String(error) : "Não foi possível carregar o serviço."}
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="mt-3 rounded-xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Tentar novamente"
              >
                <Text className="text-white text-sm font-semibold text-center">
                  Tentar novamente
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        </LiquidBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground>
        <View className="px-5 pt-12 pb-4">
          <Pressable
            onPress={handleBack}
            style={{
              width: tokens.layout.touchTarget,
              height: tokens.layout.touchTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={tokens.colors.text}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4">
            <GlassCard intensity={60} highlight>
              <View className="gap-2">
                <Text className="text-white text-lg font-semibold">
                  {service.title}
                </Text>
                <Text className="text-white/60 text-sm">
                  {formatMoney(basePriceCents, service.currency)} ·{" "}
                  {effectiveDurationMinutes} min
                </Text>
                {service.organization?.publicName ||
                service.organization?.businessName ? (
                  <Text className="text-white/50 text-xs">
                    {service.organization.publicName ??
                      service.organization.businessName}
                  </Text>
                ) : null}
              </View>
            </GlassCard>

            {!isCourtService && service.packages && service.packages.length > 0 ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">
                    Pacotes
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {service.packages.map((pkg) => {
                      const active = pkg.id === selectedPackageId;
                      return (
                        <Pressable
                          key={pkg.id}
                          onPress={() =>
                            setSelectedPackageId(active ? null : pkg.id)
                          }
                          className={
                            active
                              ? "rounded-full bg-white/20 px-4 py-2"
                              : "rounded-full border border-white/10 bg-white/5 px-4 py-2"
                          }
                          style={{ minHeight: tokens.layout.touchTarget }}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar pacote ${pkg.label}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            className={
                              active
                                ? "text-white text-sm font-semibold"
                                : "text-white/70 text-sm"
                            }
                          >
                            {pkg.label}
                          </Text>
                          <Text className="text-white/60 text-[11px]">
                            {formatMoney(pkg.priceCents, service.currency)} ·{" "}
                            {pkg.durationMinutes} min
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </GlassCard>
            ) : null}

            {isCourtService ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">
                    Duração
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {activeDurationOptions.map((duration) => {
                      const active = effectiveDurationMinutes === duration;
                      const price = durationPriceMap.get(duration);
                      return (
                        <Pressable
                          key={`duration-${duration}`}
                          onPress={() => setSelectedDurationMinutes(duration)}
                          className={
                            active
                              ? "rounded-full bg-white/20 px-4 py-2"
                              : "rounded-full border border-white/10 bg-white/5 px-4 py-2"
                          }
                          style={{ minHeight: tokens.layout.touchTarget }}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar duração ${duration} minutos`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            className={
                              active
                                ? "text-white text-sm font-semibold"
                                : "text-white/70 text-sm"
                            }
                          >
                            {duration} min
                          </Text>
                          {Number.isFinite(price) ? (
                            <Text className="text-white/60 text-[11px]">
                              {formatMoney(price ?? 0, service.currency)}
                            </Text>
                          ) : (
                            <Text className="text-amber-200 text-[11px]">
                              Sem preço
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </GlassCard>
            ) : null}

            {service.addons && service.addons.length > 0 ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">
                    Extras
                  </Text>
                  {service.addons.map((addon) => {
                    const quantity = addonQuantities[addon.id] ?? 0;
                    return (
                      <View
                        key={addon.id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                      >
                        <View className="flex-row items-center justify-between">
                          <View>
                            <Text className="text-white text-sm">
                              {addon.label}
                            </Text>
                            <Text className="text-white/60 text-xs">
                              +{addon.deltaMinutes} min · +
                              {formatMoney(
                                addon.deltaPriceCents,
                                service.currency,
                              )}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Pressable
                              onPress={() =>
                                setAddonQuantities((prev) => {
                                  const next = { ...prev };
                                  next[addon.id] = Math.max(
                                    0,
                                    (next[addon.id] ?? 0) - 1,
                                  );
                                  return next;
                                })
                              }
                              className="h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10"
                              accessibilityRole="button"
                              accessibilityLabel={`Diminuir extra ${addon.label}`}
                            >
                              <Ionicons
                                name="remove"
                                size={14}
                                color="rgba(255,255,255,0.7)"
                              />
                            </Pressable>
                            <Text className="text-white text-sm">
                              {quantity}
                            </Text>
                            <Pressable
                              onPress={() =>
                                setAddonQuantities((prev) => {
                                  const next = { ...prev };
                                  const maxQty = addon.maxQty ?? 10;
                                  next[addon.id] = Math.min(
                                    maxQty,
                                    (next[addon.id] ?? 0) + 1,
                                  );
                                  return next;
                                })
                              }
                              className="h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10"
                              accessibilityRole="button"
                              accessibilityLabel={`Aumentar extra ${addon.label}`}
                            >
                              <Ionicons
                                name="add"
                                size={14}
                                color="rgba(255,255,255,0.7)"
                              />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            ) : null}

            <GlassCard intensity={50}>
              <View className="gap-3">
                <Text className="text-white text-sm font-semibold">
                  {assignmentMode === "RESOURCE"
                    ? "Capacidade"
                    : "Profissional"}
                </Text>
                {assignmentMode === "RESOURCE" ? (
                  <View className="flex-row flex-wrap gap-2">
                    {capacityOptions.map((capacity) => {
                      const active = selectedPartySize === capacity;
                      return (
                        <Pressable
                          key={capacity}
                          onPress={() => setSelectedPartySize(capacity)}
                          className={
                            active
                              ? "rounded-full bg-white/20 px-4 py-2"
                              : "rounded-full border border-white/10 bg-white/5 px-4 py-2"
                          }
                          style={{ minHeight: tokens.layout.touchTarget }}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${capacity} pessoas`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            className={
                              active
                                ? "text-white text-sm font-semibold"
                                : "text-white/70 text-sm"
                            }
                          >
                            {capacity} pessoas
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View className="gap-2">
                    <Pressable
                      onPress={() => setSelectedProfessionalId(null)}
                      className={
                        selectedProfessionalId === null
                          ? "rounded-2xl bg-white/15 px-3 py-3"
                          : "rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Qualquer profissional"
                      accessibilityState={{
                        selected: selectedProfessionalId === null,
                      }}
                    >
                      <Text className="text-white text-sm">
                        Qualquer profissional
                      </Text>
                    </Pressable>
                    {availableProfessionals.map((professional) => {
                      const active = selectedProfessionalId === professional.id;
                      return (
                        <Pressable
                          key={professional.id}
                          onPress={() =>
                            setSelectedProfessionalId(professional.id)
                          }
                          className={
                            active
                              ? "rounded-2xl bg-white/15 px-3 py-3"
                              : "rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${professional.name}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text className="text-white text-sm">
                            {professional.name}
                          </Text>
                          {professional.roleTitle ? (
                            <Text className="text-white/60 text-xs">
                              {professional.roleTitle}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </GlassCard>

            <GlassCard intensity={50}>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-sm font-semibold">
                    Agenda
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => {
                        const prevMonth = addMonthsToIsoYearMonth(calendarMonth, -1);
                        if (!prevMonth) return;
                        const minMonth = getIsoYearMonthInTimeZone(new Date(), serviceTimezone);
                        const minKey = monthKeyFromIsoYearMonth(minMonth);
                        const prevKey = monthKeyFromIsoYearMonth(prevMonth);
                        if (minKey == null || prevKey == null) return;
                        if (prevKey >= minKey) setCalendarMonth(prevMonth);
                      }}
                      className="rounded-full border border-white/10 px-2 py-1"
                      accessibilityRole="button"
                      accessibilityLabel="Mês anterior"
                    >
                      <Ionicons
                        name="chevron-back"
                        size={14}
                        color="rgba(255,255,255,0.7)"
                      />
                    </Pressable>
                    <Text className="text-white/70 text-xs">
                      {formatIsoYearMonthLabel(calendarMonth, { locale: "pt-PT" })}
                    </Text>
                    <Pressable
                      onPress={() => {
                        const nextMonth = addMonthsToIsoYearMonth(calendarMonth, 1);
                        if (!nextMonth) return;
                        const minMonth = getIsoYearMonthInTimeZone(new Date(), serviceTimezone);
                        const minKey = monthKeyFromIsoYearMonth(minMonth);
                        const nextKey = monthKeyFromIsoYearMonth(nextMonth);
                        if (nextKey == null || minKey == null) return;
                        const maxKey = minKey + 3;
                        if (nextKey <= maxKey) {
                          setCalendarMonth(nextMonth);
                        }
                      }}
                      className="rounded-full border border-white/10 px-2 py-1"
                      accessibilityRole="button"
                      accessibilityLabel="Mês seguinte"
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="rgba(255,255,255,0.7)"
                      />
                    </Pressable>
                  </View>
                </View>
                {!canFetchCalendar ? (
                  <Text className="text-white/60 text-xs">
                    Seleciona a capacidade para ver horários.
                  </Text>
                ) : calendarLoading ? (
                  <ActivityIndicator color="white" />
                ) : calendarError ? (
                  <Text className="text-rose-200 text-xs">{calendarError}</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {calendarDays
                      .filter((day) => day.hasAvailability)
                      .slice(0, 21)
                      .map((day) => {
                        const active = selectedDay === day.date;
                        return (
                          <Pressable
                            key={day.date}
                            onPress={() => {
                              setSelectedDay(day.date);
                              setSelectedSlot(null);
                            }}
                            className={
                              active
                                ? "rounded-xl bg-white/20 px-3 py-2"
                                : "rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar dia ${formatDayLabel(day.date)}`}
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              className={
                                active
                                  ? "text-white text-xs font-semibold"
                                  : "text-white/70 text-xs"
                              }
                            >
                              {formatDayLabel(day.date)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    {calendarDays.filter((day) => day.hasAvailability)
                      .length === 0 ? (
                      <Text className="text-white/60 text-xs">
                        Sem disponibilidade neste mês.
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </GlassCard>

            {selectedDay ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">
                    Horários
                  </Text>
                  {slotsLoading ? (
                    <ActivityIndicator color="white" />
                  ) : slotsError ? (
                    <Text className="text-rose-200 text-xs">{slotsError}</Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {slots.map((slot) => {
                        const active = selectedSlot?.slotKey === slot.slotKey;
                        return (
                          <Pressable
                            key={slot.slotKey}
                            onPress={() => setSelectedSlot(slot)}
                            className={
                              active
                                ? "rounded-full bg-white/20 px-3 py-2"
                                : "rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar horário ${formatTime(slot.startsAt, serviceTimezone)}`}
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              className={
                                active
                                  ? "text-white text-xs font-semibold"
                                  : "text-white/70 text-xs"
                              }
                            >
                              {formatTime(slot.startsAt, serviceTimezone)}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {slots.length === 0 ? (
                        <Text className="text-white/60 text-xs">
                          Sem horários para este dia.
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </GlassCard>
            ) : null}

            {service.locationMode === "CHOOSE_AT_BOOKING" ? (
              <GlassCard intensity={50}>
                <AddressPicker
                  label="Morada da reserva"
                  value={addressSelection}
                  onSelect={setAddressSelection}
                  onClear={() => setAddressSelection(null)}
                  placeholder="Seleciona uma morada"
                />
              </GlassCard>
            ) : null}

            {phoneRequired ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">
                    Telemóvel obrigatório
                  </Text>
                  <Text className="text-white/60 text-xs">
                    Precisamos do teu número para confirmar a reserva.
                  </Text>
                  <TextInput
                    value={phoneDraft}
                    onChangeText={setPhoneDraft}
                    keyboardType="phone-pad"
                    placeholder="Telemóvel"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm"
                    accessibilityLabel="Telemóvel"
                  />
                  <Pressable
                    onPress={savePhone}
                    disabled={phoneSaving}
                    className="rounded-xl bg-white/10 px-4 py-3"
                    accessibilityRole="button"
                    accessibilityLabel="Guardar telemóvel"
                    accessibilityState={{ disabled: phoneSaving }}
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      {phoneSaving ? "A guardar..." : "Guardar telemóvel"}
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>
            ) : null}

            {resumableCheckoutDraft ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Checkout em pausa</Text>
                  <Text className="text-white/65 text-xs">
                    {resumableCheckoutDraft.holdSubjectLabel ??
                      resumableCheckoutDraft.serviceTitle ??
                      "Reserva"}
                    {resumeCheckoutCountdown ? ` · ${resumeCheckoutCountdown}` : ""}
                  </Text>
                  <Pressable
                    onPress={() => safePush(router, "/checkout")}
                    className="rounded-xl bg-white/12 px-4 py-3"
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel="Retomar checkout"
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      Retomar checkout
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>
            ) : null}

            {bookingError ? (
              <GlassCard intensity={50}>
                <Text className="text-rose-200 text-sm">{bookingError}</Text>
              </GlassCard>
            ) : null}

            <GlassCard intensity={60} highlight>
              <View className="gap-2">
                <Text className="text-white text-sm font-semibold">Resumo</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-white/60 text-xs">Total</Text>
                  <Text className="text-white text-lg font-semibold">
                    {formatMoney(totalCents, service.currency)}
                  </Text>
                </View>
                <Pressable
                  disabled={!canReserve || bookingLoading}
                  onPress={() => reserveSlot()}
                  className={
                    canReserve
                      ? "rounded-2xl bg-white/15 px-4 py-4"
                      : "rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  }
                  style={{
                    minHeight: tokens.layout.touchTarget,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Reservar e pagar"
                  accessibilityState={{
                    disabled: !canReserve || bookingLoading,
                  }}
                >
                  {bookingLoading ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="white" />
                      <Text className="text-white text-sm font-semibold">
                        A reservar...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      className={
                        canReserve
                          ? "text-white text-sm font-semibold"
                          : "text-white/50 text-sm font-semibold"
                      }
                    >
                      Reservar e pagar
                    </Text>
                  )}
                </Pressable>
                {!session?.user?.id ? (
                  <Text className="text-white/60 text-xs text-center">
                    Inicia sessão para concluir.
                  </Text>
                ) : null}
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </LiquidBackground>
    </>
  );
}
