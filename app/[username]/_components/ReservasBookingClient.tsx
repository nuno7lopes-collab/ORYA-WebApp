"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import {
  getServicePartySizeOptions,
  resolveServicePartySizeRules,
} from "@/lib/reservas/servicePartySize";
import { getEventCoverUrl } from "@/lib/eventCover";
import { Avatar } from "@/components/ui/avatar";
import { OryaDateField } from "@/components/ui/datetime";
import { cn } from "@/lib/utils";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripePublic";
import {
  buildHoldSubjectFingerprint,
  formatIsoDateLabel,
  parseIsoDateStrict,
} from "@orya/shared";

type ReservationAssignmentMode =
  | "PROFESSIONAL_ONLY"
  | "RESOURCE_ONLY"
  | "PROFESSIONAL_AND_RESOURCE";

type Service = {
  id: number;
  selectionKey?: string | null;
  courtId?: number | null;
  backingServiceId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  bookingVertical?: "COURT" | "CLASS" | "SERVICE" | null;
  assignmentMode?: ReservationAssignmentMode | null;
  partySizeRequired?: boolean;
  partySizeMin?: number;
  partySizeMax?: number;
  partySizeStep?: number;
  category?: {
    id: number;
    slug: string;
    label: string;
    domain: "COURT" | "CLASS" | "SERVICE";
  } | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode: "FIXED" | "CHOOSE_AT_BOOKING";
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null } | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
  addons?: Array<{
    id: number;
    label: string;
    description: string | null;
    deltaMinutes: number;
    deltaPriceCents: number;
    maxQty: number | null;
    category: string | null;
    sortOrder: number;
  }>;
  packages?: Array<{
    id: number;
    label: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    recommended: boolean;
    sortOrder: number;
  }>;
  durationPrices?: Array<{
    durationMinutes: number;
    priceCents: number;
    isActive: boolean;
  }>;
};

type Professional = {
  id: number;
  name: string;
  roleTitle: string | null;
  avatarUrl: string | null;
  username: string | null;
};

type Resource = {
  id: number;
  label: string;
  capacity: number;
};

type AvailabilityDay = {
  date: string;
  hasAvailability: boolean;
  slots: number;
};

type AvailabilitySlot = {
  slotKey: string;
  sessionId?: number;
  startsAt: string;
  endsAt?: string;
  durationMinutes: number;
  status: string;
  capacity?: number;
  enrolledCount?: number;
  isFull?: boolean;
  trainer?: {
    id: number;
    name: string;
    avatarUrl: string | null;
    username: string | null;
    fullName?: string | null;
  } | null;
  court?: {
    id: number;
    name: string | null;
    isActive?: boolean | null;
  } | null;
};

type BookingPolicy = {
  gridMinutes: number;
  durationCatalog?: number[];
  activeDurations?: number[];
  allowedDurations: number[];
  allowCustomDuration: boolean;
  presetDurations: number[];
};

type BookingCheckout = {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  bookingId: number;
  paymentMethod?: PaymentMethod;
  cardPlatformFeeCents?: number | null;
  cardPlatformFeeBps?: number | null;
};

type BookingPending = {
  id: number;
  status: string;
  pendingExpiresAt: string | null;
  startsAt: string;
  durationMinutes?: number | null;
  professionalId?: number | null;
  resourceId?: number | null;
};

type CheckoutHoldSession = {
  holdId: string;
  clientSessionId: string;
  expiresAt: string;
  subjectFingerprint: string;
  subjectLabel: string;
  subjectType: "SERVICE";
  orgId: number;
  serviceId: number;
  bookingId: number;
  bookingStartsAt: string;
  durationMinutes?: number | null;
  professionalId?: number | null;
  resourceId?: number | null;
};

type ReservationStep = 1 | 2 | 3 | 4;
type PaymentMethod = "mbway" | "card";

type ReservasBookingClientProps = {
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    username: string | null;
    timezone: string | null;
    addressId?: string | null;
    addressRef?: { formattedAddress?: string | null } | null;
    reservationAssignmentMode: ReservationAssignmentMode;
  };
  services: Service[];
  professionals: Professional[];
  resources: Resource[];
  initialServiceKey?: string | null;
  initialServiceId?: number | null;
  fixedServiceKey?: string | null;
  fixedServiceId?: number | null;
  fixedProfessionalId?: number | null;
  mode?: "inline" | "modal";
  onClose?: () => void;
};

const shellClass =
  "relative border border-white/12 bg-white/[0.05] shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden";

const panelClass =
  "rounded-3xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(7,10,18,0.92))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5";

const panelSoftClass =
  "rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4";

const selectableCardBase =
  "group rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/35 hover:bg-white/10 sm:p-4";

const selectableCardActive =
  "border-white/40 bg-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_24px_50px_rgba(0,0,0,0.45)]";

const primaryButtonClass =
  "rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)] transition hover:translate-y-[-1px] hover:shadow-[0_14px_40px_rgba(255,255,255,0.28)] disabled:opacity-60 disabled:hover:translate-y-0 sm:px-5";

const ghostButtonClass =
  "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60 sm:px-4";

const CARD_FEE_BPS = 100;
const HOLD_STORAGE_KEY = "orya.checkout.hold.v1";
const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  gridMinutes: 30,
  durationCatalog: [30, 60, 90, 120],
  activeDurations: [60, 90],
  allowedDurations: [60, 90],
  allowCustomDuration: false,
  presetDurations: [60, 90],
};

const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  RESERVAS_OPERATIONAL_OFF: "Reservas temporariamente indisponíveis.",
  SLOT_NOT_AVAILABLE: "Este horário já não está disponível. Escolhe outro.",
  PENDING_LIMIT_REACHED: "Já tens uma pré-reserva ativa. Termina-a antes de avançar.",
  PHONE_REQUIRED: "Precisas de adicionar telemóvel para concluir a reserva.",
  RANGE_NOT_ALLOWED: "A disponibilidade só está aberta para os próximos meses.",
  DURATION_NOT_PRICED: "Esta duração não está disponível para este campo.",
  INVALID_COURT: "Campo inválido para esta reserva.",
  AUTH_REQUIRED: "Inicia sessão para reservar.",
  PAYMENTS_NOT_READY: "Pagamentos indisponíveis neste momento.",
  RESERVA_EXPIRADA: "A pré-reserva expirou. Escolhe novo horário.",
};

function resolveBookingApiErrorMessage(
  payload: { error?: string; errorCode?: string; message?: string } | null,
  fallback: string,
) {
  const codeRaw = payload?.errorCode ?? payload?.error;
  const code =
    typeof codeRaw === "string"
      ? codeRaw
          .trim()
          .toUpperCase()
      : null;
  if (payload?.message) {
    return payload.message;
  }
  if (code && BOOKING_ERROR_MESSAGES[code]) {
    return BOOKING_ERROR_MESSAGES[code];
  }
  if (payload?.error) {
    return payload.error;
  }
  return fallback;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDateInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = map.get("year");
  const month = map.get("month");
  const day = map.get("day");
  if (!year || !month || !day) return formatLocalISODate(date);
  return `${year}-${month}-${day}`;
}

function formatRemainingCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readStoredHold(): CheckoutHoldSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutHoldSession>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.holdId !== "string" ||
      typeof parsed.clientSessionId !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.subjectFingerprint !== "string" ||
      typeof parsed.orgId !== "number" ||
      typeof parsed.serviceId !== "number" ||
      typeof parsed.bookingId !== "number" ||
      typeof parsed.bookingStartsAt !== "string"
    ) {
      return null;
    }
    return {
      holdId: parsed.holdId,
      clientSessionId: parsed.clientSessionId,
      expiresAt: parsed.expiresAt,
      subjectFingerprint: parsed.subjectFingerprint,
      subjectLabel: typeof parsed.subjectLabel === "string" ? parsed.subjectLabel : "Reserva",
      subjectType: "SERVICE",
      orgId: parsed.orgId,
      serviceId: parsed.serviceId,
      bookingId: parsed.bookingId,
      bookingStartsAt: parsed.bookingStartsAt,
      durationMinutes: typeof parsed.durationMinutes === "number" ? parsed.durationMinutes : null,
      professionalId: typeof parsed.professionalId === "number" ? parsed.professionalId : null,
      resourceId: typeof parsed.resourceId === "number" ? parsed.resourceId : null,
    };
  } catch {
    return null;
  }
}

function persistStoredHold(value: CheckoutHoldSession | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.sessionStorage.removeItem(HOLD_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(value));
}

function resolveServiceCover(coverImageUrl: string | null | undefined, seed: string | number) {
  return getEventCoverUrl(coverImageUrl, { seed, width: 900, quality: 72 });
}

function getServiceSelectionKey(service: Service) {
  return service.selectionKey?.trim() || `service-${service.id}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(base: Date, months: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return startOfMonth(next);
}

function formatDayLabel(iso: string, _timezone: string) {
  return formatIsoDateLabel(iso, {
    locale: "pt-PT",
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

function isWeekendIsoDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getSlotHour(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "");
  if (!Number.isFinite(hour)) return date.getHours();
  return hour;
}

function groupSlotsByPeriod(slots: AvailabilitySlot[], timeZone: string) {
  const groups: Array<{ label: string; slots: AvailabilitySlot[] }> = [
    { label: "Manhã", slots: [] },
    { label: "Tarde", slots: [] },
    { label: "Noite", slots: [] },
  ];

  slots.forEach((slot) => {
    const date = new Date(slot.startsAt);
    const hour = getSlotHour(date, timeZone);
    if (hour < 12) {
      groups[0].slots.push(slot);
    } else if (hour < 18) {
      groups[1].slots.push(slot);
    } else {
      groups[2].slots.push(slot);
    }
  });

  return groups.filter((group) => group.slots.length > 0);
}

function resolveServiceVertical(service: Service | null | undefined): "COURT" | "CLASS" | "SERVICE" {
  if (!service) return "SERVICE";
  const byVertical = String(service.bookingVertical ?? "")
    .trim()
    .toUpperCase();
  if (byVertical === "COURT" || byVertical === "CLASS" || byVertical === "SERVICE") {
    return byVertical;
  }
  const byDomain = String(service.category?.domain ?? "")
    .trim()
    .toUpperCase();
  if (byDomain === "COURT" || byDomain === "CLASS" || byDomain === "SERVICE") {
    return byDomain;
  }
  const byKind = String(service.kind ?? "")
    .trim()
    .toUpperCase();
  if (byKind === "COURT") return "COURT";
  if (byKind === "CLASS") return "CLASS";
  return "SERVICE";
}

function BookingPaymentForm({
  amountCents,
  currency,
  onConfirmed,
  onError,
  disabled = false,
}: {
  amountCents: number;
  currency: string;
  onConfirmed: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || submitting || disabled) return;
    setSubmitting(true);
    onError("");

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Não foi possível processar o pagamento.");
        return;
      }

      if (!paymentIntent) {
        onError("Pagamento não confirmado.");
        return;
      }

      if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
        onConfirmed(paymentIntent.id);
        return;
      }

      onError("Pagamento não concluído.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Total</p>
        <p className="mt-1 text-xl font-semibold text-white">{formatMoney(amountCents, currency)}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <PaymentElement />
      </div>
      <button
        type="button"
        className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-black shadow-[0_12px_36px_rgba(255,255,255,0.25)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_50px_rgba(255,255,255,0.3)] disabled:opacity-60 disabled:hover:translate-y-0"
        onClick={handleSubmit}
        disabled={!stripe || !elements || submitting || disabled}
      >
        {submitting ? "A processar..." : "Pagar agora"}
      </button>
    </div>
  );
}

export default function ReservasBookingClient({
  organization,
  services,
  professionals,
  resources,
  initialServiceKey,
  initialServiceId,
  fixedServiceKey,
  fixedServiceId,
  fixedProfessionalId,
  mode = "inline",
  onClose,
}: ReservasBookingClientProps) {
  const { user } = useUser();
  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const mountedRef = useRef(true);
  const calendarRequestRef = useRef(0);
  const slotsRequestRef = useRef(0);
  const slotsAbortRef = useRef<AbortController | null>(null);
  const allowServiceSelection = fixedServiceKey == null && fixedServiceId == null;

  const activeServices = services.filter((service) => service.isActive);
  const resolveServiceBySelectionKey = (selectionKey: string | null | undefined) => {
    const normalized = selectionKey?.trim();
    if (!normalized) return null;
    return activeServices.find((service) => getServiceSelectionKey(service) === normalized) ?? null;
  };
  const resolveServiceByLegacyId = (serviceId: number | null | undefined) => {
    if (!serviceId) return null;
    return activeServices.find((service) => service.id === serviceId) ?? null;
  };
  const initialSelectedService =
    resolveServiceBySelectionKey(fixedServiceKey) ??
    resolveServiceByLegacyId(fixedServiceId) ??
    resolveServiceBySelectionKey(initialServiceKey) ??
    resolveServiceByLegacyId(initialServiceId) ??
    activeServices[0] ??
    null;
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(
    initialSelectedService ? getServiceSelectionKey(initialSelectedService) : null,
  );
  const [activeStep, setActiveStep] = useState<ReservationStep>(allowServiceSelection ? 1 : 2);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Record<number, number>>({});
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy>(DEFAULT_BOOKING_POLICY);
  const [durationOverrideMinutes, setDurationOverrideMinutes] = useState<number | null>(null);
  const [customDurationDraft, setCustomDurationDraft] = useState("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [bookingPending, setBookingPending] = useState<BookingPending | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<BookingCheckout | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mbway");
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [slotSubmittingKey, setSlotSubmittingKey] = useState<string | null>(null);
  const [checkoutHold, setCheckoutHold] = useState<CheckoutHoldSession | null>(null);
  const [holdCountdownMs, setHoldCountdownMs] = useState<number | null>(null);
  const [resumeCheckoutVisible, setResumeCheckoutVisible] = useState(false);
  const holdExpiredHandledRef = useRef(false);
  const skipServiceResetRef = useRef(true);
  const skipSelectionResetRef = useRef(true);
  const autoSelectedDayRef = useRef(false);
  const autoAdvanceResourceStepRef = useRef(false);

  const selectedService =
    activeServices.find((service) => getServiceSelectionKey(service) === selectedServiceKey) ?? null;
  const selectedServiceVertical = resolveServiceVertical(selectedService);
  const selectedServiceApiId = selectedService?.backingServiceId ?? selectedService?.id ?? null;
  const normalizedOrganizationUsername = organization.username?.trim() ?? "";
  const publicCalendarsConfig = useMemo(() => {
    if (!normalizedOrganizationUsername) return null;
    const basePath = `/api/public/org/${encodeURIComponent(normalizedOrganizationUsername)}/reservas`;
    if (selectedServiceVertical === "COURT" && selectedService?.courtId) {
      return {
        calendarPath: `${basePath}/campos/calendario`,
        reservePath: `${basePath}/campos/reservar`,
        queryParams: { courtId: String(selectedService.courtId) },
        reservePayload: { courtId: selectedService.courtId },
      } as const;
    }
    if (selectedServiceVertical === "CLASS" && selectedServiceApiId) {
      return {
        calendarPath: `${basePath}/aulas/calendario`,
        reservePath: `${basePath}/aulas/reservar`,
        queryParams: { serviceId: String(selectedServiceApiId) },
        reservePayload: { serviceId: selectedServiceApiId },
      } as const;
    }
    return null;
  }, [normalizedOrganizationUsername, selectedService?.courtId, selectedServiceApiId, selectedServiceVertical]);
  const resolvedAddressId = selectedService?.addressId ?? organization.addressId ?? null;
  const resolvedAddressLabel =
    selectedService?.addressRef?.formattedAddress ??
    organization.addressRef?.formattedAddress ??
    null;
  const selectedServiceProfessionalIds =
    selectedService?.professionalLinks?.map((link) => link.professionalId) ?? [];
  const selectedServiceResourceIds =
    selectedService?.resourceLinks?.map((link) => link.resourceId) ?? [];
  const hasServiceProfessionalLinks = selectedServiceProfessionalIds.length > 0;
  const hasServiceResourceLinks = selectedServiceResourceIds.length > 0;
  const availableProfessionals = hasServiceProfessionalLinks
    ? professionals.filter((pro) => selectedServiceProfessionalIds.includes(pro.id))
    : professionals;
  const availableResources = hasServiceResourceLinks
    ? resources.filter((resource) => selectedServiceResourceIds.includes(resource.id))
    : resources;
  const assignmentConfig = useMemo(
    () =>
      resolveServiceAssignmentMode({
        organizationMode: organization.reservationAssignmentMode,
        serviceMode: selectedService?.assignmentMode ?? null,
        serviceKind: selectedService?.kind ?? null,
      }),
    [organization.reservationAssignmentMode, selectedService?.assignmentMode, selectedService?.kind],
  );
  const requiresProfessional = assignmentConfig.requiresProfessional;
  const requiresResource = assignmentConfig.requiresResource;
  const isHybridAssignment = assignmentConfig.isHybrid;
  const partySizeRules = useMemo(
    () =>
      resolveServicePartySizeRules({
        assignmentMode: assignmentConfig.assignmentMode,
        serviceKind: selectedService?.kind ?? null,
        partySizeRequired: selectedService?.partySizeRequired,
        partySizeMin: selectedService?.partySizeMin,
        partySizeMax: selectedService?.partySizeMax,
        partySizeStep: selectedService?.partySizeStep,
      }),
    [
      assignmentConfig.assignmentMode,
      selectedService?.kind,
      selectedService?.partySizeRequired,
      selectedService?.partySizeMin,
      selectedService?.partySizeMax,
      selectedService?.partySizeStep,
    ],
  );
  const partySizeOptions = useMemo(
    () => getServicePartySizeOptions(partySizeRules),
    [partySizeRules],
  );
  const timezone = organization.timezone || "Europe/Lisbon";
  const minCalendarMonth = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return startOfMonth(now);
  }, []);
  const maxCalendarMonth = useMemo(() => addMonths(minCalendarMonth, 3), [minCalendarMonth]);
  const selectedProfessional =
    selectedProfessionalId != null
      ? availableProfessionals.find((pro) => pro.id === selectedProfessionalId) ?? null
      : null;
  const calendarMonthParam = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
  const todayIso = useMemo(() => formatIsoDateInTimezone(new Date(), timezone), [timezone]);
  const maxSelectableIso = useMemo(() => {
    const end = new Date(maxCalendarMonth.getFullYear(), maxCalendarMonth.getMonth() + 1, 0);
    return formatIsoDateInTimezone(end, timezone);
  }, [maxCalendarMonth, timezone]);
  const tomorrowIso = useMemo(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return formatIsoDateInTimezone(next, timezone);
  }, [timezone]);
  const selectedStartsAt = bookingPending?.startsAt ?? selectedSlot?.startsAt ?? null;
  const selectedDate =
    selectedStartsAt && !Number.isNaN(new Date(selectedStartsAt).getTime())
      ? new Date(selectedStartsAt)
      : null;
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        weekday: "short",
        timeZone: timezone,
      })
    : null;
  const selectedTimeLabel = selectedDate
    ? selectedDate.toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      })
    : null;
  const baseServiceCents = selectedService?.unitPriceCents ?? 0;
  const isCourtService = selectedServiceVertical === "COURT";
  const packageOptions = useMemo(
    () =>
      (isCourtService ? [] : selectedService?.packages ?? [])
        .slice()
        .sort(
          (a, b) =>
            Number(b.recommended ?? 0) - Number(a.recommended ?? 0) ||
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            a.id - b.id,
        ),
    [isCourtService, selectedService?.packages],
  );
  const selectedPackage =
    selectedPackageId != null
      ? packageOptions.find((pkg) => pkg.id === selectedPackageId) ?? null
      : null;
  const addonOptions = useMemo(
    () => (selectedService?.addons ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [selectedService?.addons],
  );
  const selectedAddonItems = useMemo(() => {
    if (!addonOptions.length) return [];
    return addonOptions
      .map((addon) => {
        const quantity = selectedAddons[addon.id] ?? 0;
        if (quantity <= 0) return null;
        return { ...addon, quantity };
      })
      .filter((item): item is (typeof addonOptions)[number] & { quantity: number } => Boolean(item));
  }, [addonOptions, selectedAddons]);
  const selectedAddonsPayload = useMemo(
    () =>
      selectedAddonItems.map((addon) => ({
        addonId: addon.id,
        quantity: addon.quantity,
      })),
    [selectedAddonItems],
  );
  const addonsParam = selectedAddonsPayload.length > 0 ? JSON.stringify(selectedAddonsPayload) : null;
  const addonsDeltaMinutes = selectedAddonItems.reduce(
    (sum, addon) => sum + addon.deltaMinutes * addon.quantity,
    0,
  );
  const addonsDeltaCents = selectedAddonItems.reduce(
    (sum, addon) => sum + addon.deltaPriceCents * addon.quantity,
    0,
  );
  const durationPriceMap = useMemo(() => {
    const map = new Map<number, number>();
    (selectedService?.durationPrices ?? [])
      .filter((item) => item.isActive !== false)
      .forEach((item) => {
        map.set(item.durationMinutes, item.priceCents);
      });
    return map;
  }, [selectedService?.durationPrices]);
  const baseDurationMinutes = isCourtService
    ? selectedService?.durationMinutes ?? 0
    : selectedPackage?.durationMinutes ?? selectedService?.durationMinutes ?? 0;
  const basePriceCents = isCourtService
    ? durationPriceMap.get(baseDurationMinutes) ?? baseServiceCents
    : selectedPackage?.priceCents ?? baseServiceCents;
  const computedDurationMinutes = isCourtService
    ? Math.max(0, baseDurationMinutes)
    : Math.max(0, baseDurationMinutes + addonsDeltaMinutes);
  const effectiveDurationMinutes = durationOverrideMinutes ?? computedDurationMinutes;
  const effectiveDurationPriceCents = isCourtService
    ? durationPriceMap.get(effectiveDurationMinutes) ?? basePriceCents
    : basePriceCents;
  const effectiveBaseCents = Math.max(0, effectiveDurationPriceCents + addonsDeltaCents);
  const priceCurrency = checkout?.currency ?? selectedService?.currency ?? "EUR";
  const basePriceLabel = selectedService ? formatMoney(baseServiceCents, selectedService.currency) : null;
  const addonsPriceLabel =
    selectedService && addonsDeltaCents > 0 ? formatMoney(addonsDeltaCents, selectedService.currency) : null;
  const packagePriceLabel =
    selectedPackage && selectedService ? formatMoney(selectedPackage.priceCents, selectedService.currency) : null;
  const cardFeeBps =
    checkout?.paymentMethod === "card" && checkout.cardPlatformFeeBps != null
      ? checkout.cardPlatformFeeBps
      : CARD_FEE_BPS;
  const estimatedCardFeeCents =
    paymentMethod === "card" && selectedService
      ? Math.max(0, Math.round((effectiveBaseCents * cardFeeBps) / 10_000))
      : 0;
  const cardFeeCents =
    paymentMethod === "card"
      ? checkout?.cardPlatformFeeCents ?? estimatedCardFeeCents
      : 0;
  const totalEstimateCents = checkout?.amountCents ?? Math.max(0, effectiveBaseCents + cardFeeCents);
  const totalPriceLabel = selectedService ? formatMoney(totalEstimateCents, priceCurrency) : null;
  const cardFeeLabel = cardFeeBps ? `+${(cardFeeBps / 100).toFixed(0)}%` : "";
  const presetDurationOptions = bookingPolicy.activeDurations?.length
    ? bookingPolicy.activeDurations
    : bookingPolicy.allowedDurations?.length
      ? bookingPolicy.allowedDurations
      : DEFAULT_BOOKING_POLICY.activeDurations ?? DEFAULT_BOOKING_POLICY.allowedDurations;
  const canUseCustomDuration = false;
  const canAccessStep2 = Boolean(selectedService);
  const canAccessStep3 =
    Boolean(selectedService) &&
    (!requiresResource ||
      !partySizeRules.partySizeRequired ||
      Boolean(selectedPartySize));
  const canAccessStep4 = Boolean(
    bookingPending ||
      checkout ||
      checkoutLoading ||
      bookingSuccess ||
      bookingError ||
      paymentMessage ||
      phoneRequired,
  );
  const slotGroups = useMemo(() => groupSlotsByPeriod(daySlots, timezone), [daySlots, timezone]);

  const stripePromise = useMemo(() => {
    try {
      const key = getStripePublishableKey();
      return loadStripe(key);
    } catch {
      return null;
    }
  }, []);

  const elementsOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!checkout?.clientSecret) return null;
    return {
      clientSecret: checkout.clientSecret,
      appearance: {
        theme: "night",
        variables: {
          colorPrimary: "#6BFFFF",
          colorBackground: "#0B0D0F",
          colorText: "#F8FAFC",
          fontFamily: "inherit",
        },
      },
    };
  }, [checkout?.clientSecret]);

  const redirectPath =
    typeof window !== "undefined" ? window.location.pathname : "/";

  const ensureAuth = (redirectTo: string) => {
    if (!user && !isAuthOpen) {
      openAuthModal({ mode: "login", redirectTo, showGoogle: true });
      return false;
    }
    return true;
  };

  const applyBookingPolicyFromPayload = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const raw = value as Record<string, unknown>;
    const activeDurations = Array.isArray(raw.activeDurations)
      ? raw.activeDurations.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
      : null;
    const allowedDurations = Array.isArray(raw.allowedDurations)
      ? raw.allowedDurations.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
      : [];
    const resolvedActiveDurations = activeDurations && activeDurations.length > 0 ? activeDurations : allowedDurations;
    const nextPolicy: BookingPolicy = {
      gridMinutes:
        typeof raw.gridMinutes === "number" && Number.isFinite(raw.gridMinutes)
          ? raw.gridMinutes
          : DEFAULT_BOOKING_POLICY.gridMinutes,
      durationCatalog: Array.isArray(raw.durationCatalog)
        ? raw.durationCatalog.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
        : [...(DEFAULT_BOOKING_POLICY.durationCatalog ?? [])],
      activeDurations: resolvedActiveDurations.length > 0
        ? resolvedActiveDurations
        : [...(DEFAULT_BOOKING_POLICY.activeDurations ?? DEFAULT_BOOKING_POLICY.allowedDurations)],
      allowedDurations: resolvedActiveDurations.length > 0
        ? resolvedActiveDurations
        : [...DEFAULT_BOOKING_POLICY.allowedDurations],
      allowCustomDuration: false,
      presetDurations: resolvedActiveDurations.length > 0
        ? resolvedActiveDurations
        : [...DEFAULT_BOOKING_POLICY.presetDurations],
    };
    if (!nextPolicy.allowedDurations.length) {
      nextPolicy.allowedDurations = [...DEFAULT_BOOKING_POLICY.allowedDurations];
    }
    if (!nextPolicy.activeDurations?.length) {
      nextPolicy.activeDurations = [...(DEFAULT_BOOKING_POLICY.activeDurations ?? DEFAULT_BOOKING_POLICY.allowedDurations)];
    }
    if (!nextPolicy.presetDurations.length) {
      nextPolicy.presetDurations = [...DEFAULT_BOOKING_POLICY.presetDurations];
    }
    setBookingPolicy(nextPolicy);
  };

  const buildCalendarUrl = (params: URLSearchParams) => {
    if (publicCalendarsConfig) {
      const query = new URLSearchParams(params);
      Object.entries(publicCalendarsConfig.queryParams).forEach(([key, value]) => {
        query.set(key, value);
      });
      return `${publicCalendarsConfig.calendarPath}?${query.toString()}`;
    }
    return `/api/servicos/${selectedServiceApiId}/calendario?${params.toString()}`;
  };

  const buildReserveRequest = (
    payload: Record<string, unknown>,
  ): { url: string; body: Record<string, unknown> } => {
    if (publicCalendarsConfig) {
      return {
        url: publicCalendarsConfig.reservePath,
        body: {
          ...payload,
          ...publicCalendarsConfig.reservePayload,
        },
      };
    }
    return {
      url: `/api/servicos/${selectedServiceApiId}/reservar`,
      body: payload,
    };
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const stored = readStoredHold();
    if (!stored) return;
    const stillValid = new Date(stored.expiresAt).getTime() > Date.now();
    if (!stillValid) {
      persistStoredHold(null);
      return;
    }
    if (stored.orgId !== organization.id) {
      return;
    }
    if (selectedServiceApiId && stored.serviceId !== selectedServiceApiId) {
      return;
    }
    setCheckoutHold(stored);
    setResumeCheckoutVisible(true);
    if (!bookingPending) {
      setBookingPending({
        id: stored.bookingId,
        status: "PENDING_CONFIRMATION",
        pendingExpiresAt: stored.expiresAt,
        startsAt: stored.bookingStartsAt,
        durationMinutes: stored.durationMinutes ?? null,
        professionalId: stored.professionalId ?? null,
        resourceId: stored.resourceId ?? null,
      });
    }
  }, [organization.id, selectedServiceApiId]);

  useEffect(() => {
    if (!checkoutHold) {
      setHoldCountdownMs(null);
      holdExpiredHandledRef.current = false;
      return;
    }
    const tick = () => {
      const remaining = new Date(checkoutHold.expiresAt).getTime() - Date.now();
      setHoldCountdownMs(remaining);
      if (remaining > 0) return;
      if (holdExpiredHandledRef.current) return;
      holdExpiredHandledRef.current = true;
      setCheckout(null);
      setCheckoutLoading(false);
      setResumeCheckoutVisible(false);
      setBookingError("O bloqueio de checkout expirou. Continua para renovar o bloqueio.");
      persistStoredHold(null);
      setCheckoutHold(null);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [checkoutHold]);

  useEffect(() => {
    if (!checkoutHold) return;
    const interval = window.setInterval(() => {
      void fetch("/api/holds/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdId: checkoutHold.holdId,
          orgId: checkoutHold.orgId,
          subjectType: checkoutHold.subjectType,
          subjectFingerprint: checkoutHold.subjectFingerprint,
          clientSessionId: checkoutHold.clientSessionId,
        }),
      })
        .then((res) => res.json().catch(() => null).then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          if (!ok || !body?.ok || typeof body.expiresAt !== "string") return;
          setCheckoutHold((current) => {
            if (!current || current.holdId !== checkoutHold.holdId) return current;
            const next = { ...current, expiresAt: body.expiresAt };
            persistStoredHold(next);
            return next;
          });
        })
        .catch(() => {
          // ignore ping failures to avoid noisy UX
        });
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [checkoutHold]);

  useEffect(() => {
    if (!selectedService) {
      setSelectedAddons({});
      setSelectedPackageId(null);
      setDurationOverrideMinutes(null);
      setCustomDurationDraft("");
      autoSelectedDayRef.current = false;
      autoAdvanceResourceStepRef.current = false;
      return;
    }
    setSelectedAddons({});
    setSelectedPackageId(null);
    setDurationOverrideMinutes(null);
    setCustomDurationDraft("");
    autoSelectedDayRef.current = false;
    autoAdvanceResourceStepRef.current = false;
  }, [selectedServiceKey]);

  useEffect(() => {
    if (durationOverrideMinutes == null) return;
    const isPreset = presetDurationOptions.includes(durationOverrideMinutes);
    if (isPreset) return;
    if (canUseCustomDuration) return;
    setDurationOverrideMinutes(null);
    setCustomDurationDraft("");
  }, [durationOverrideMinutes, canUseCustomDuration, presetDurationOptions]);

  useEffect(() => {
    const forcedService =
      (fixedServiceKey
        ? activeServices.find((service) => getServiceSelectionKey(service) === fixedServiceKey)
        : null) ??
      (fixedServiceId
        ? activeServices.find((service) => service.id === fixedServiceId)
        : null);
    if (!forcedService) return;
    const forcedKey = getServiceSelectionKey(forcedService);
    if (forcedKey !== selectedServiceKey) {
      setSelectedServiceKey(forcedKey);
    }
  }, [activeServices, fixedServiceId, fixedServiceKey, selectedServiceKey]);

  useEffect(() => {
    if (skipServiceResetRef.current) {
      skipServiceResetRef.current = false;
      return;
    }
    const resetStep: ReservationStep = allowServiceSelection ? 1 : 2;
    setActiveStep(resetStep);
    setSelectedProfessionalId(null);
    setSelectedPartySize(null);
    setSelectedAddons({});
    setSelectedPackageId(null);
    setSelectedDay(null);
    setDaySlots([]);
    setSelectedSlot(null);
    setBookingPending(null);
    setCheckout(null);
    setCheckoutError(null);
    setCheckoutLoading(false);
    setPaymentMessage(null);
    setBookingError(null);
    setDurationError(null);
    setBookingSuccess(null);
    setPhoneRequired(false);
    setPhoneError(null);
    setPendingSlot(null);
    setSlotSubmittingKey(null);
    setPaymentMethod("mbway");
    void releaseHoldSession(checkoutHold, false);
  }, [selectedServiceKey, allowServiceSelection]);

  useEffect(() => {
    if (!requiresProfessional) return;
    if (!selectedService) return;
    if (
      selectedProfessionalId &&
      !availableProfessionals.some((professional) => professional.id === selectedProfessionalId)
    ) {
      setSelectedProfessionalId(null);
    }
  }, [requiresProfessional, availableProfessionals, selectedProfessionalId, selectedServiceKey]);

  const autoAdvanceRef = useRef(false);

  useEffect(() => {
    if (!requiresProfessional) return;
    if (!fixedProfessionalId) return;
    const isAvailable = availableProfessionals.some((professional) => professional.id === fixedProfessionalId);
    if (!isAvailable) {
      if (selectedProfessionalId && !availableProfessionals.some((pro) => pro.id === selectedProfessionalId)) {
        setSelectedProfessionalId(null);
      }
      return;
    }
    if (!selectedProfessionalId) {
      setSelectedProfessionalId(fixedProfessionalId);
    }
    if (!allowServiceSelection && activeStep === 2 && !autoAdvanceRef.current) {
      autoAdvanceRef.current = true;
      setActiveStep(3);
    }
  }, [
    requiresProfessional,
    availableProfessionals,
    fixedProfessionalId,
    selectedProfessionalId,
    allowServiceSelection,
    activeStep,
  ]);

  useEffect(() => {
    autoAdvanceRef.current = false;
  }, [selectedServiceKey]);

  useEffect(() => {
    if (skipSelectionResetRef.current) {
      skipSelectionResetRef.current = false;
      return;
    }
    setSelectedDay(null);
    setDaySlots([]);
    setSelectedSlot(null);
    setBookingPending(null);
    setCheckout(null);
    setCheckoutError(null);
    setCheckoutLoading(false);
    setPaymentMessage(null);
    setBookingError(null);
    setDurationError(null);
    setBookingSuccess(null);
    setPendingSlot(null);
    setSlotSubmittingKey(null);
    autoSelectedDayRef.current = false;
    void releaseHoldSession(checkoutHold, false);
  }, [assignmentConfig.assignmentMode, selectedProfessionalId, selectedPartySize, addonsParam, durationOverrideMinutes]);

  useEffect(() => {
    if (requiresResource && !selectedPartySize && activeStep > 2) {
      setActiveStep(2);
    }
  }, [requiresResource, selectedPartySize, activeStep]);

  useEffect(() => {
    if (selectedPartySize == null) return;
    const inRange =
      selectedPartySize >= partySizeRules.partySizeMin &&
      selectedPartySize <= partySizeRules.partySizeMax &&
      (selectedPartySize - partySizeRules.partySizeMin) % partySizeRules.partySizeStep === 0;
    if (!inRange) {
      setSelectedPartySize(null);
    }
  }, [selectedPartySize, partySizeRules]);

  useEffect(() => {
    if (!requiresResource || !partySizeRules.partySizeRequired) return;
    if (!isCourtService) return;
    if (selectedPartySize != null) return;
    if (!partySizeOptions.length) return;
    const preferred = partySizeOptions.includes(4) ? 4 : partySizeOptions[0] ?? null;
    if (preferred == null) return;
    setSelectedPartySize(preferred);
  }, [
    requiresResource,
    partySizeRules.partySizeRequired,
    isCourtService,
    selectedPartySize,
    partySizeOptions,
  ]);

  useEffect(() => {
    if (allowServiceSelection) return;
    if (activeStep !== 2) return;
    if (!isCourtService) return;
    if (!requiresResource || !partySizeRules.partySizeRequired || !selectedPartySize) return;
    if (autoAdvanceResourceStepRef.current) return;
    autoAdvanceResourceStepRef.current = true;
    setActiveStep(3);
  }, [
    allowServiceSelection,
    activeStep,
    isCourtService,
    requiresResource,
    partySizeRules.partySizeRequired,
    selectedPartySize,
  ]);

  useEffect(() => {
    if (activeStep === 4 && !canAccessStep4) {
      setActiveStep(3);
    }
  }, [activeStep, canAccessStep4]);

  useEffect(() => {
    if (!selectedServiceApiId) return;
    if (requiresResource && !selectedPartySize) {
      setAvailabilityDays([]);
      return;
    }

    const controller = new AbortController();
    const requestId = calendarRequestRef.current + 1;
    calendarRequestRef.current = requestId;
    setCalendarLoading(true);
    setCalendarError(null);

    const params = new URLSearchParams({ month: calendarMonthParam });
    if (requiresProfessional && selectedProfessionalId) {
      params.set("professionalId", String(selectedProfessionalId));
    }
    if (requiresResource && selectedPartySize != null) {
      params.set("partySize", String(selectedPartySize));
    }
    if (selectedPackageId) {
      params.set("packageId", String(selectedPackageId));
    }
    if (addonsParam) {
      params.set("addons", addonsParam);
    }
    if (isCourtService && effectiveDurationMinutes > 0) {
      params.set("durationMinutes", String(effectiveDurationMinutes));
    } else if (durationOverrideMinutes != null) {
      params.set("durationMinutes", String(durationOverrideMinutes));
    }

    fetch(buildCalendarUrl(params), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (calendarRequestRef.current !== requestId) return;
        if (!data?.ok) {
          throw new Error(resolveBookingApiErrorMessage(data, "Erro ao carregar calendário."));
        }
        applyBookingPolicyFromPayload(data?.bookingPolicy);
        setAvailabilityDays(Array.isArray(data.days) ? data.days : []);
      })
      .catch((err) => {
        if (calendarRequestRef.current !== requestId) return;
        if (err?.name === "AbortError") return;
        setCalendarError(err instanceof Error ? err.message : "Erro ao carregar calendário.");
      })
      .finally(() => {
        if (calendarRequestRef.current === requestId) {
          setCalendarLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    selectedServiceApiId,
    requiresProfessional,
    requiresResource,
    selectedProfessionalId,
    selectedPartySize,
    calendarMonthParam,
    addonsParam,
    selectedPackageId,
    durationOverrideMinutes,
    isCourtService,
    effectiveDurationMinutes,
    publicCalendarsConfig,
  ]);

  useEffect(
    () => () => {
      slotsAbortRef.current?.abort();
    },
    [],
  );

  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    availabilityDays.forEach((day) => map.set(day.date, day));
    return map;
  }, [availabilityDays]);
  const availableDays = useMemo(
    () => availabilityDays.filter((day) => day.hasAvailability),
    [availabilityDays],
  );
  const firstAvailableDayIso = availableDays[0]?.date ?? null;
  const weekendAvailableDayIso = useMemo(
    () => availableDays.find((day) => isWeekendIsoDate(day.date))?.date ?? null,
    [availableDays],
  );
  const availableDaysCount = availableDays.length;
  const availableSlotsCount = useMemo(
    () => availableDays.reduce((total, day) => total + Math.max(0, day.slots ?? 0), 0),
    [availableDays],
  );
  const selectedDayAvailability = selectedDay ? availabilityMap.get(selectedDay) ?? null : null;
  const recommendedDayPills = useMemo(
    () =>
      availableDays.slice(0, 7).map((day) => {
        const shortLabel =
          day.date === todayIso
            ? "Hoje"
            : day.date === tomorrowIso
              ? "Amanhã"
              : formatDayLabel(day.date, timezone);
        return {
          date: day.date,
          shortLabel,
          slots: Math.max(0, day.slots ?? 0),
        };
      }),
    [availableDays, timezone, todayIso, tomorrowIso],
  );
  const firstDaySlot =
    daySlots.find((slot) => !(slot.isFull || String(slot.status).toUpperCase() === "FULL")) ?? null;
  const afterWorkSlot =
    daySlots.find((slot) => {
      if (slot.isFull || String(slot.status).toUpperCase() === "FULL") return false;
      const hour = getSlotHour(new Date(slot.startsAt), timezone);
      return hour >= 18;
    }) ?? null;
  const highlightedSlotKeys = useMemo(
    () =>
      ({
        first: firstDaySlot?.slotKey ?? null,
        afterWork: afterWorkSlot?.slotKey ?? null,
      }) as const,
    [afterWorkSlot?.slotKey, firstDaySlot?.slotKey],
  );

  const loadDaySlots = (iso: string, options?: { force?: boolean }) => {
    if (!selectedServiceApiId) return;
    if (requiresResource && !selectedPartySize) return;
    const availability = availabilityMap.get(iso);
    if (!options?.force && availability && !availability.hasAvailability) return;

    setSelectedDay(iso);
    if (!bookingPending) {
      setSelectedSlot(null);
    }
    setSlotsLoading(true);
    setSlotsError(null);
    setDaySlots([]);
    slotsAbortRef.current?.abort();
    const controller = new AbortController();
    slotsAbortRef.current = controller;
    const requestId = slotsRequestRef.current + 1;
    slotsRequestRef.current = requestId;

    const params = new URLSearchParams({ day: iso });
    if (requiresProfessional && selectedProfessionalId) {
      params.set("professionalId", String(selectedProfessionalId));
    }
    if (requiresResource && selectedPartySize != null) {
      params.set("partySize", String(selectedPartySize));
    }
    if (selectedPackageId) {
      params.set("packageId", String(selectedPackageId));
    }
    if (addonsParam) {
      params.set("addons", addonsParam);
    }
    if (isCourtService && effectiveDurationMinutes > 0) {
      params.set("durationMinutes", String(effectiveDurationMinutes));
    } else if (durationOverrideMinutes != null) {
      params.set("durationMinutes", String(durationOverrideMinutes));
    }

    fetch(buildCalendarUrl(params), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (slotsRequestRef.current !== requestId) return;
        if (!data?.ok) {
          throw new Error(resolveBookingApiErrorMessage(data, "Erro ao carregar horários."));
        }
        applyBookingPolicyFromPayload(data?.bookingPolicy);
        setDaySlots(Array.isArray(data.items) ? data.items : []);
      })
      .catch((err) => {
        if (slotsRequestRef.current !== requestId) return;
        if (err?.name === "AbortError") return;
        setSlotsError(err instanceof Error ? err.message : "Erro ao carregar horários.");
      })
      .finally(() => {
        if (slotsRequestRef.current === requestId) {
          setSlotsLoading(false);
        }
      });
  };

  const jumpToDay = (iso: string) => {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return;
    const next = new Date(year, month - 1, day);
    if (Number.isNaN(next.getTime())) return;
    setCalendarMonth(startOfMonth(next));
    loadDaySlots(iso, { force: true });
  };

  useEffect(() => {
    if (activeStep !== 3) return;
    if (selectedDay) return;
    if (!firstAvailableDayIso) return;
    if (autoSelectedDayRef.current) return;
    autoSelectedDayRef.current = true;
    loadDaySlots(firstAvailableDayIso, { force: true });
  }, [activeStep, selectedDay, firstAvailableDayIso, loadDaySlots]);

  const clearDaySelection = () => {
    autoSelectedDayRef.current = true;
    setSelectedDay(null);
    setDaySlots([]);
    setSlotsError(null);
    if (!bookingPending) {
      setSelectedSlot(null);
    }
  };

  const clearHoldSession = () => {
    setCheckoutHold(null);
    setHoldCountdownMs(null);
    setResumeCheckoutVisible(false);
    holdExpiredHandledRef.current = false;
    persistStoredHold(null);
  };

  const releaseHoldSession = async (hold: CheckoutHoldSession | null, consumed = false) => {
    if (!hold) return;
    try {
      await fetch("/api/holds/release", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdId: hold.holdId,
          orgId: hold.orgId,
          subjectType: hold.subjectType,
          subjectFingerprint: hold.subjectFingerprint,
          clientSessionId: hold.clientSessionId,
          consumed,
        }),
      });
    } catch {
      // ignore release failures to keep UX responsive
    }
    clearHoldSession();
  };

  const buildHoldSubjectLabel = (startsAtIso: string) => {
    const date = new Date(startsAtIso);
    if (Number.isNaN(date.getTime())) {
      return selectedService?.title ?? "Reserva";
    }
    const dateLabel = date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      weekday: "short",
      timeZone: timezone,
    });
    const timeLabel = date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
    return `${selectedService?.title ?? "Reserva"} · ${dateLabel} ${timeLabel}`;
  };

  const ensureCheckoutHold = async (bookingId: number) => {
    if (!selectedServiceApiId) {
      throw new Error("Serviço inválido para checkout.");
    }
    const checkoutHoldForBooking =
      checkoutHold && checkoutHold.bookingId === bookingId ? checkoutHold : null;
    const bookingPendingForCheckout =
      bookingPending && bookingPending.id === bookingId ? bookingPending : null;
    let startsAtISO =
      bookingPendingForCheckout?.startsAt ??
      checkoutHoldForBooking?.bookingStartsAt ??
      selectedSlot?.startsAt ??
      null;
    let durationMinutesForHold =
      bookingPendingForCheckout?.durationMinutes ??
      checkoutHoldForBooking?.durationMinutes ??
      effectiveDurationMinutes;
    let professionalIdForHold =
      bookingPendingForCheckout?.professionalId ??
      checkoutHoldForBooking?.professionalId ??
      selectedProfessionalId ??
      null;
    let resourceIdForHold =
      bookingPendingForCheckout?.resourceId ?? checkoutHoldForBooking?.resourceId ?? null;
    const needsBookingRefresh =
      !startsAtISO ||
      durationMinutesForHold == null ||
      (requiresProfessional && professionalIdForHold == null) ||
      (requiresResource && resourceIdForHold == null);
    if (needsBookingRefresh) {
      const bookingRes = await fetch(`/api/me/reservas/${bookingId}`, {
        cache: "no-store",
      });
      const bookingJson = await bookingRes.json().catch(() => null);
      const bookingData =
        bookingJson?.booking && typeof bookingJson.booking === "object"
          ? (bookingJson.booking as Record<string, unknown>)
          : null;
      if (!bookingRes.ok || !bookingJson?.ok || !bookingData) {
        throw new Error("Não foi possível validar a pré-reserva.");
      }
      const bookingStatus =
        typeof bookingData.effectiveStatus === "string"
          ? bookingData.effectiveStatus
          : typeof bookingData.status === "string"
            ? bookingData.status
            : null;
      if (bookingStatus && ["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(bookingStatus)) {
        setBookingPending(null);
        setCheckout(null);
        clearHoldSession();
        throw new Error("Esta pré-reserva expirou.");
      }
      if (typeof bookingData.startsAt === "string") {
        startsAtISO = bookingData.startsAt;
      }
      if (typeof bookingData.durationMinutes === "number") {
        durationMinutesForHold = bookingData.durationMinutes;
      }
      if (typeof bookingData.professionalId === "number") {
        professionalIdForHold = bookingData.professionalId;
      }
      if (typeof bookingData.resourceId === "number") {
        resourceIdForHold = bookingData.resourceId;
      }
      if (startsAtISO) {
        const refreshedBookingPending: BookingPending = {
          id: bookingId,
          status: bookingPendingForCheckout?.status ?? "PENDING_CONFIRMATION",
          pendingExpiresAt: bookingPendingForCheckout?.pendingExpiresAt ?? null,
          startsAt: startsAtISO,
          durationMinutes: durationMinutesForHold ?? null,
          professionalId: professionalIdForHold,
          resourceId: resourceIdForHold,
        };
        setBookingPending((current) =>
          current && current.id === bookingId ? { ...current, ...refreshedBookingPending } : current,
        );
      }
    }
    if (!startsAtISO || durationMinutesForHold == null) {
      throw new Error("Slot indisponível para checkout.");
    }
    const resourceIdsForHold = resourceIdForHold != null ? [resourceIdForHold] : [];

    const subjectFingerprint = buildHoldSubjectFingerprint({
      orgId: organization.id,
      subjectType: "SERVICE",
      serviceId: selectedServiceApiId,
      startAtISO: new Date(startsAtISO).toISOString(),
      durationMinutes: durationMinutesForHold,
      resourceIds: resourceIdsForHold,
      professionalId: professionalIdForHold,
    });
    const nowMs = Date.now();
    if (
      checkoutHold &&
      checkoutHold.bookingId === bookingId &&
      checkoutHold.subjectFingerprint === subjectFingerprint &&
      new Date(checkoutHold.expiresAt).getTime() > nowMs
    ) {
      return checkoutHold;
    }

    const existing = readStoredHold();
    if (
      existing &&
      existing.bookingId === bookingId &&
      existing.serviceId === selectedServiceApiId &&
      existing.orgId === organization.id &&
      existing.subjectFingerprint === subjectFingerprint &&
      new Date(existing.expiresAt).getTime() > nowMs
    ) {
      setCheckoutHold(existing);
      persistStoredHold(existing);
      setResumeCheckoutVisible(false);
      return existing;
    }

    const clientSessionId = existing?.clientSessionId ?? crypto.randomUUID();
    const subjectLabel = buildHoldSubjectLabel(startsAtISO);
    const response = await fetch("/api/holds/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: organization.id,
        subjectType: "SERVICE",
        subjectFingerprint,
        clientSessionId,
        metadata: { subjectLabel },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const errorCode = payload?.errorCode ?? payload?.error ?? "SLOT_NOT_AVAILABLE";
      if (errorCode === "SLOT_NOT_AVAILABLE") {
        throw new Error("Slot indisponível para checkout.");
      }
      throw new Error(payload?.message || "Não foi possível criar bloqueio de checkout.");
    }
    const hold: CheckoutHoldSession = {
      holdId: String(payload.holdId),
      clientSessionId,
      expiresAt: String(payload.expiresAt),
      subjectFingerprint:
        typeof payload.subjectFingerprint === "string"
          ? payload.subjectFingerprint
          : subjectFingerprint,
      subjectLabel,
      subjectType: "SERVICE",
      orgId: organization.id,
      serviceId: selectedServiceApiId,
      bookingId,
      bookingStartsAt: startsAtISO,
      durationMinutes: durationMinutesForHold,
      professionalId: professionalIdForHold,
      resourceId: resourceIdForHold,
    };
    setCheckoutHold(hold);
    persistStoredHold(hold);
    setResumeCheckoutVisible(false);
    return hold;
  };

  const startBookingCheckout = async (
    bookingId: number,
    method?: PaymentMethod,
  ) => {
    if (!selectedServiceApiId) return;
    if (!ensureAuth(redirectPath)) return;

    const resolvedMethod = method ?? paymentMethod;
    setActiveStep(4);
    setCheckoutLoading(true);
    setCheckoutError(null);
    setPaymentMessage(null);

    try {
      const hold = await ensureCheckoutHold(bookingId);
      const res = await fetch(`/api/servicos/${selectedServiceApiId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          paymentMethod: resolvedMethod,
          holdId: hold.holdId,
          clientSessionId: hold.clientSessionId,
          subjectFingerprint: hold.subjectFingerprint,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (json?.error === "PHONE_REQUIRED") {
          setPhoneRequired(true);
          setPhoneError(json?.message || "Telemóvel obrigatório para reservar.");
          return;
        }
        if (json?.error === "RESERVA_EXPIRADA") {
          setBookingPending(null);
          await releaseHoldSession(hold, false);
          return;
        }
        throw new Error(resolveBookingApiErrorMessage(json, "Erro ao iniciar pagamento."));
      }
      setCheckout({
        clientSecret: json.clientSecret,
        paymentIntentId: json.paymentIntentId,
        amountCents: json.amountCents,
        currency: json.currency,
        bookingId,
        paymentMethod: resolvedMethod,
        cardPlatformFeeCents: typeof json.cardPlatformFeeCents === "number" ? json.cardPlatformFeeCents : null,
        cardPlatformFeeBps: typeof json.cardPlatformFeeBps === "number" ? json.cardPlatformFeeBps : null,
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erro ao iniciar pagamento.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSelectPaymentMethod = async (method: PaymentMethod) => {
    if (method === paymentMethod) return;
    setPaymentMethod(method);
    setCheckout(null);
    setCheckoutError(null);
    setPaymentMessage(null);
    if (bookingPending) {
      await startBookingCheckout(bookingPending.id, method);
    }
  };

  const cancelPendingBooking = async (reason: string) => {
    if (!bookingPending) return;
    const pendingId = bookingPending.id;
    const holdToRelease =
      checkoutHold && checkoutHold.bookingId === pendingId ? checkoutHold : null;
    setBookingPending(null);
    setCheckout(null);
    setCheckoutError(null);
    setCheckoutLoading(false);
    setPaymentMessage(null);
    setBookingError(null);
    setBookingSuccess(null);
    setPendingSlot(null);
    setSelectedSlot(null);
    setSlotSubmittingKey(null);
    setPhoneRequired(false);
    setPhoneError(null);
    try {
      await fetch(`/api/me/reservas/${pendingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // ignore cancel errors to keep UX responsive
    }
    if (holdToRelease) {
      await releaseHoldSession(holdToRelease, false);
    }
  };

  const goToStep = (step: ReservationStep) => {
    if (bookingPending && step < 4) {
      void cancelPendingBooking("CHANGE_FLOW");
    }
    if (!allowServiceSelection && step === 1) {
      setActiveStep(2);
      return;
    }
    setActiveStep(step);
    if (step === 3 && !selectedDay && firstAvailableDayIso) {
      autoSelectedDayRef.current = true;
      loadDaySlots(firstAvailableDayIso, { force: true });
    }
  };

  const resumeCheckoutFromHold = async () => {
    if (!checkoutHold) return;
    setResumeCheckoutVisible(false);
    if (!bookingPending) {
      setBookingPending({
        id: checkoutHold.bookingId,
        status: "PENDING_CONFIRMATION",
        pendingExpiresAt: checkoutHold.expiresAt,
        startsAt: checkoutHold.bookingStartsAt,
        durationMinutes: checkoutHold.durationMinutes ?? null,
        professionalId: checkoutHold.professionalId ?? null,
        resourceId: checkoutHold.resourceId ?? null,
      });
    }
    await startBookingCheckout(checkoutHold.bookingId, paymentMethod);
  };

  const pollBookingStatus = async (bookingId: number, startsAtIso: string) => {
    const holdToRelease =
      checkoutHold && checkoutHold.bookingId === bookingId ? checkoutHold : null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (!mountedRef.current) return;
      try {
        const res = await fetch(`/api/me/reservas/${bookingId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const status = (json?.booking?.effectiveStatus ?? json?.booking?.status) as string | undefined;
        const pendingState = json?.booking?.pendingState as string | undefined;
        if (status === "CONFIRMED") {
          setBookingSuccess("Agendamento confirmado.");
          setBookingPending(null);
          setCheckout(null);
          if (holdToRelease) {
            await releaseHoldSession(holdToRelease, true);
          } else {
            clearHoldSession();
          }
          loadDaySlots(startsAtIso.slice(0, 10), { force: true });
          return;
        }
        if (status && ["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(status)) {
          setBookingError(
            pendingState === "EXPIRED" || pendingState === "PAST_START"
              ? "Esta pré-reserva expirou."
              : "Esta reserva foi cancelada.",
          );
          setBookingPending(null);
          setCheckout(null);
          if (holdToRelease) {
            await releaseHoldSession(holdToRelease, false);
          } else {
            clearHoldSession();
          }
          return;
        }
      } catch {
        // ignore and retry
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setPaymentMessage("Pagamento confirmado. A confirmar agendamento.");
  };

  const handlePaymentConfirmed = async (paymentIntentId: string) => {
    setPaymentMessage("Pagamento confirmado. A validar agendamento...");
    if (!bookingPending) return;
    await pollBookingStatus(bookingPending.id, bookingPending.startsAt);
  };

  const reserveSlot = async (slot: AvailabilitySlot) => {
    if (!selectedServiceApiId || !selectedService) return;
    if (!ensureAuth(redirectPath)) return;
    if (slotSubmittingKey) return;

    if (bookingPending) {
      if (bookingPending.startsAt === slot.startsAt) {
        setActiveStep(4);
        return;
      }
      await cancelPendingBooking("CHANGE_SLOT");
    }

    setBookingError(null);
    setBookingSuccess(null);
    setCheckoutError(null);
    setPaymentMessage(null);
    setCheckout(null);
    setPendingSlot(null);
    setPhoneError(null);
    setSelectedSlot(slot);
    setSlotSubmittingKey(slot.slotKey);

    try {
      const slotIsFull = slot.isFull || String(slot.status).toUpperCase() === "FULL";
      if (slotIsFull) {
        setBookingError("Este horário está cheio.");
        return;
      }
      const requiresSessionId = selectedServiceVertical === "CLASS";
      if (requiresSessionId && !slot.sessionId) {
        setBookingError("Sessão inválida. Atualiza os horários e tenta novamente.");
        return;
      }
      if (selectedService.locationMode === "CHOOSE_AT_BOOKING" && !resolvedAddressId) {
        setBookingError("Seleciona uma morada antes de reservar.");
        return;
      }
      const reservePayload = {
        ...(requiresSessionId ? { sessionId: slot.sessionId } : {}),
        startsAt: slot.startsAt,
        professionalId: requiresProfessional ? selectedProfessionalId : null,
        partySize: requiresResource ? selectedPartySize : null,
        addressId: resolvedAddressId,
        selectedAddons: selectedAddonsPayload,
        packageId: isCourtService ? null : selectedPackageId,
        durationMinutes: isCourtService ? effectiveDurationMinutes : durationOverrideMinutes,
      } satisfies Record<string, unknown>;
      const reserveRequest = buildReserveRequest(reservePayload);
      const res = await fetch(reserveRequest.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reserveRequest.body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (json?.error === "PHONE_REQUIRED") {
          setPhoneRequired(true);
          setPhoneError(json?.message || "Telemóvel obrigatório para reservar.");
          setPendingSlot(slot);
          setActiveStep(4);
          return;
        }
        throw new Error(resolveBookingApiErrorMessage(json, "Não foi possível criar a pré-reserva."));
      }
      const bookingPayload =
        json?.booking && typeof json.booking === "object"
          ? (json.booking as Record<string, unknown>)
          : null;
      setBookingPending({
        id: json.booking.id,
        status: json.booking.status,
        pendingExpiresAt: json.booking.pendingExpiresAt ?? null,
        startsAt:
          typeof bookingPayload?.startsAt === "string"
            ? bookingPayload.startsAt
            : slot.startsAt,
        durationMinutes:
          typeof bookingPayload?.durationMinutes === "number"
            ? bookingPayload.durationMinutes
            : effectiveDurationMinutes,
        professionalId:
          typeof bookingPayload?.professionalId === "number"
            ? bookingPayload.professionalId
            : null,
        resourceId:
          typeof bookingPayload?.resourceId === "number"
            ? bookingPayload.resourceId
            : null,
      });
      setActiveStep(4);
      await startBookingCheckout(json.booking.id, paymentMethod);
    } catch (err) {
      setSelectedSlot(null);
      const message = err instanceof Error ? err.message : "Não foi possível criar a pré-reserva.";
      setBookingError(message);
      if (message.toLowerCase().includes("indispon")) {
        const slotDay = slot.startsAt.slice(0, 10);
        if (slotDay) {
          loadDaySlots(slotDay, { force: true });
        }
      }
    } finally {
      setSlotSubmittingKey(null);
    }
  };

  const savePhone = async () => {
    const value = phoneDraft.trim();
    if (!value) {
      setPhoneError("Indica o número de telemóvel.");
      return;
    }
    setActiveStep(4);
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const res = await fetch("/api/me/contact-phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactPhone: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível guardar o telemóvel.");
      }
      setPhoneRequired(false);
      setPhoneDraft("");
      if (pendingSlot) {
        const slot = pendingSlot;
        setPendingSlot(null);
        await reserveSlot(slot);
      } else if (bookingPending) {
        await startBookingCheckout(bookingPending.id, paymentMethod);
      }
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Não foi possível guardar o telemóvel.");
    } finally {
      setPhoneSaving(false);
    }
  };

  const pendingExpiryLabel = bookingPending?.pendingExpiresAt
    ? new Date(bookingPending.pendingExpiresAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : null;
  const holdExpiryLabel = checkoutHold?.expiresAt
    ? new Date(checkoutHold.expiresAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : null;
  const holdCountdownLabel =
    holdCountdownMs != null && holdCountdownMs > 0
      ? formatRemainingCountdown(holdCountdownMs)
      : null;
  const stepItems = allowServiceSelection
    ? ([
        { id: 1, title: "Serviço", index: 1 },
        {
          id: 2,
          title: isHybridAssignment
            ? "Profissional + capacidade"
            : requiresResource
              ? "Capacidade"
              : "Profissional",
          index: 2,
        },
        { id: 3, title: "Data & hora", index: 3 },
        { id: 4, title: "Pagamento", index: 4 },
      ] as const)
    : ([
        {
          id: 2,
          title: isHybridAssignment
            ? "Profissional + capacidade"
            : requiresResource
              ? "Capacidade"
              : "Profissional",
          index: 1,
        },
        { id: 3, title: "Data & hora", index: 2 },
        { id: 4, title: "Pagamento", index: 3 },
      ] as const);
  const stepEnabled = (stepId: ReservationStep) => {
    if (stepId === 1) return true;
    if (stepId === 2) return canAccessStep2;
    if (stepId === 3) return canAccessStep3;
    if (stepId === 4) return canAccessStep4;
    return false;
  };
  const currentStepIndex = Math.max(0, stepItems.findIndex((step) => step.id === activeStep));
  const progressPercent = Math.max(8, Math.round(((currentStepIndex + 1) / stepItems.length) * 100));
  const currentStepLabel = stepItems[currentStepIndex]?.title ?? "Fluxo";
  const currentStepGuidance =
    activeStep === 1
      ? "Escolhe o serviço para iniciar a reserva."
      : activeStep === 2
        ? requiresResource
          ? "Define capacidade para mostrar horários válidos."
          : "Escolhe o profissional ideal."
        : activeStep === 3
          ? "Seleciona dia e hora para criar a pré-reserva."
          : "Confirma os dados e finaliza o pagamento.";
  const canJumpToCheckoutFromStep3 = Boolean(bookingPending || checkout);
  const step3Summary = selectedDateLabel && selectedTimeLabel
    ? `${selectedDateLabel} · ${selectedTimeLabel}`
    : selectedDay
      ? `${formatDayLabel(selectedDay, timezone)} · escolhe um horário`
      : "Escolhe um dia para ver horários";
  const firstDaySlotLabel = firstDaySlot
    ? new Date(firstDaySlot.startsAt).toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      })
    : null;
  const weekendDayLabel = weekendAvailableDayIso ? formatDayLabel(weekendAvailableDayIso, timezone) : null;
  const step3LiveMessage = selectedDateLabel && selectedTimeLabel
    ? `Horário selecionado: ${selectedDateLabel} às ${selectedTimeLabel}.`
    : selectedDay
      ? `Dia selecionado ${formatDayLabel(selectedDay, timezone)} sem horário.`
      : "Nenhum dia selecionado.";
  const selectedCapacityLabel =
    selectedPartySize != null
      ? `${selectedPartySize}`
      : null;
  const locationLabel = resolvedAddressLabel ?? "Local por definir";
  const assignmentSummaryLabel = requiresResource ? "Capacidade" : "Profissional";
  const professionalLabel =
    requiresResource
      ? selectedCapacityLabel
        ? `${selectedCapacityLabel} pessoas`
        : "Capacidade por definir"
      : selectedProfessional?.name ?? "Qualquer profissional";

  const shellHeightClass =
    mode === "modal"
      ? "h-[100dvh] sm:h-[min(90dvh,820px)]"
      : "h-[min(84svh,760px)] sm:h-[min(86svh,760px)]";
  const shellRadiusClass = mode === "modal" ? "rounded-none sm:rounded-[28px]" : "rounded-3xl";

  const handleClose = () => {
    if (bookingPending) {
      void cancelPendingBooking("EXIT");
    }
    onClose?.();
  };

  const setAddonQuantity = (addonId: number, nextQty: number, maxQty: number | null) => {
    const upperBound = maxQty && maxQty > 0 ? maxQty : 1;
    const quantity = Math.max(0, Math.min(upperBound, Math.floor(nextQty)));
    setSelectedAddons((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[addonId];
      } else {
        next[addonId] = quantity;
      }
      return next;
    });
  };

  const selectPresetDuration = (minutes: number) => {
    setDurationError(null);
    setCustomDurationDraft("");
    setDurationOverrideMinutes(minutes);
  };

  const clearDurationOverride = () => {
    setDurationError(null);
    setCustomDurationDraft("");
    setDurationOverrideMinutes(null);
  };

  const applyCustomDuration = () => {
    if (!canUseCustomDuration) return;
    const parsed = Number(customDurationDraft.replace(",", "."));
    const duration = Number.isFinite(parsed) ? Math.floor(parsed) : NaN;
    if (!Number.isFinite(duration)) {
      setDurationError("Duração custom inválida.");
      return;
    }
    if (duration < 30 || duration > 240 || duration % 5 !== 0) {
      setDurationError("Duração custom deve ser múltipla de 5 (30-240 min).");
      return;
    }
    setDurationError(null);
    setDurationOverrideMinutes(duration);
  };

  const durationPolicyPanel = selectedService ? (
    <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Duração</p>
          <p className="text-sm font-semibold text-white">Durações disponíveis</p>
        </div>
        <span className="text-[11px] text-white/60">
          Atual: {effectiveDurationMinutes} min
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presetDurationOptions.map((minutes) => {
          const active = durationOverrideMinutes === minutes;
          const label = minutes === 60 ? "1h" : minutes === 90 ? "1h30" : `${minutes} min`;
          return (
            <button
              key={`preset-${minutes}`}
              type="button"
              onClick={() => selectPresetDuration(minutes)}
              className={active ? primaryButtonClass : ghostButtonClass}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={clearDurationOverride}
          className={durationOverrideMinutes == null ? primaryButtonClass : ghostButtonClass}
        >
          Serviço
        </button>
      </div>
      {canUseCustomDuration && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={customDurationDraft}
            onChange={(event) => setCustomDurationDraft(event.target.value)}
            placeholder="Duração custom (min)"
            className="w-48 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white outline-none focus:border-white/40"
          />
          <button type="button" className={ghostButtonClass} onClick={applyCustomDuration}>
            Aplicar
          </button>
        </div>
      )}
      {durationError && <p className="mt-2 text-[11px] text-red-200">{durationError}</p>}
    </div>
  ) : null;

  const packagesPanel =
    selectedService && packageOptions.length > 0 ? (
      <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Pacotes</p>
            <p className="text-sm font-semibold text-white">Escolhe um pacote</p>
          </div>
          <span className="text-[11px] text-white/50">Opcional</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelectedPackageId(null)}
            className={`${selectableCardBase} ${selectedPackageId === null ? selectableCardActive : ""}`}
          >
            <p className="text-sm font-semibold text-white">Sem pacote</p>
            <p className="mt-1 text-[12px] text-white/60">
              {selectedService.durationMinutes} min · Preço:{" "}
              {formatMoney(selectedService.unitPriceCents, selectedService.currency)}
            </p>
          </button>
          {packageOptions.map((pkg) => {
            const active = selectedPackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`${selectableCardBase} ${active ? selectableCardActive : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{pkg.label}</p>
                  {pkg.recommended && (
                    <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-100">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-white/60">
                  {pkg.durationMinutes} min · Preço: {formatMoney(pkg.priceCents, selectedService.currency)}
                </p>
                {pkg.description && (
                  <p className="mt-1 text-[11px] text-white/55 line-clamp-2">{pkg.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const addonsPanel =
    selectedService && addonOptions.length > 0 ? (
      <div className="mt-6 rounded-2xl border border-white/12 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Extras</p>
            <p className="text-sm font-semibold text-white">Personaliza o serviço</p>
          </div>
          {addonsDeltaCents > 0 || addonsDeltaMinutes > 0 ? (
            <span className="text-[11px] text-white/60">
              +{addonsDeltaMinutes} min · Preço extra: +{formatMoney(addonsDeltaCents, selectedService.currency)}
            </span>
          ) : (
            <span className="text-[11px] text-white/50">Opcional</span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {addonOptions.map((addon) => {
            const quantity = selectedAddons[addon.id] ?? 0;
            const maxQty = addon.maxQty ?? 1;
            const priceLabel = formatMoney(addon.deltaPriceCents, selectedService.currency);
            const durationLabel = addon.deltaMinutes ? `${addon.deltaMinutes} min` : "Tempo base";
            return (
              <div
                key={addon.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{addon.label}</p>
                  <p className="text-[12px] text-white/60">
                    {addon.description || `${durationLabel} · +${priceLabel}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {maxQty > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => setAddonQuantity(addon.id, quantity - 1, maxQty)}
                        disabled={quantity <= 0}
                      >
                        -
                      </button>
                      <span className="min-w-[24px] text-center text-[12px] text-white/80">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => setAddonQuantity(addon.id, quantity + 1, maxQty)}
                        disabled={quantity >= maxQty}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={quantity > 0 ? primaryButtonClass : ghostButtonClass}
                      onClick={() => setAddonQuantity(addon.id, quantity > 0 ? 0 : 1, maxQty)}
                    >
                      {quantity > 0 ? "Selecionado" : "Adicionar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <section className={mode === "modal" ? "h-full" : "space-y-5 sm:space-y-6"}>
      <div className={cn(shellClass, shellHeightClass, shellRadiusClass)}>
        <div className="relative flex h-full flex-col gap-5 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 lg:overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Agendar</h2>
                {selectedService && !allowServiceSelection && (
                  <p className="text-[12px] text-white/60">
                    {selectedService.title} · {effectiveDurationMinutes} min
                  </p>
                )}
              </div>
              {mode === "modal" && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/80 transition hover:border-white/35 hover:bg-white/10"
                >
                  Fechar
                </button>
              )}
              {checkoutHold && holdCountdownLabel && (
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70">
                  Hold checkout: {holdCountdownLabel}
                </div>
              )}
            </div>

            {resumeCheckoutVisible && checkoutHold && !checkout && (
              <div className={`${panelSoftClass} mt-2 flex flex-wrap items-center justify-between gap-3`}>
                <div className="space-y-1">
                  <p className="text-[12px] font-semibold text-white">Checkout em pausa</p>
                  <p className="text-[11px] text-white/65">
                    {checkoutHold.subjectLabel}
                    {holdCountdownLabel ? ` · ${holdCountdownLabel}` : ""}
                  </p>
                </div>
                <button type="button" className={primaryButtonClass} onClick={() => void resumeCheckoutFromHold()}>
                  Voltar ao checkout
                </button>
              </div>
            )}

            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1 sm:flex-wrap sm:overflow-visible">
              {stepItems.map((step) => {
                const isActive = activeStep === step.id;
                const enabled = stepEnabled(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!enabled}
                    aria-current={isActive ? "step" : undefined}
                    aria-disabled={!enabled}
                    onClick={() => enabled && goToStep(step.id)}
                    className={`flex min-w-[112px] items-center gap-2 rounded-full border px-3 py-2 text-left transition sm:min-w-0 ${
                      isActive
                        ? "border-white/40 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/75 hover:border-white/30 hover:bg-white/10"
                    } ${!enabled ? "opacity-40" : ""}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                        isActive ? "bg-white text-black" : "border border-white/20 text-white/70"
                      }`}
                    >
                      0{step.index}
                    </span>
                    <span className="text-[12px] font-semibold text-white/85">{step.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 rounded-2xl border border-white/12 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2 text-[11px] text-white/65">
                <span>Progresso: {currentStepLabel}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#6BFFFF,#8AB4FF)] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[12px] text-white/60">{currentStepGuidance}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[#090f1a]/80 p-3 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{selectedService?.title ?? "Serviço por definir"}</p>
              <p className="text-sm font-semibold text-white">{totalPriceLabel ?? "--"}</p>
            </div>
            <p className="mt-1 text-[12px] text-white/65">
              {selectedDateLabel && selectedTimeLabel ? `${selectedDateLabel} · ${selectedTimeLabel}` : "Data por definir"}
            </p>
          </div>

          <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-0 space-y-5 lg:overflow-y-auto lg:pr-1">
              {allowServiceSelection && activeStep === 1 && (
                <div className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Serviços</p>
                    <h3 className="text-lg font-semibold text-white">Seleciona o serviço</h3>
                  </div>
                  <span className="text-[12px] text-white/60">{activeServices.length} opções</span>
                </div>

                {activeServices.length === 0 ? (
                  <p className="mt-4 text-sm text-white/60">Sem serviços disponíveis.</p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {activeServices.map((service) => {
                      const serviceKey = getServiceSelectionKey(service);
                      const isActive = serviceKey === selectedServiceKey;
                      const coverUrl = resolveServiceCover(service.coverImageUrl, serviceKey);
                      return (
                        <button
                          key={serviceKey}
                          type="button"
                          onClick={() => setSelectedServiceKey(serviceKey)}
                          className={`relative min-h-[150px] overflow-hidden rounded-2xl border p-4 text-left transition sm:min-h-[170px] ${
                            isActive
                              ? "border-white/45 shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
                              : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <div className="absolute inset-0">
                            <Image
                              src={coverUrl}
                              alt={service.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 50vw"
                              className="object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />
                          <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{service.title}</p>
                                <p className="text-[12px] text-white/70">
                                  {service.durationMinutes} min · Preço:{" "}
                                  {formatMoney(service.unitPriceCents, service.currency)}
                                </p>
                              </div>
                              {isActive && (
                                <span className="rounded-full border border-white/30 bg-white/20 px-2 py-1 text-[10px] text-white">
                                  Selecionado
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {service.description && (
                                <p className="text-[12px] text-white/70 line-clamp-2">
                                  {service.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {(service.category?.label ?? service.categoryTag) && (
                                  <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/75">
                                    {service.category?.label ?? service.categoryTag}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {durationPolicyPanel}
                {packagesPanel}
                {addonsPanel}

                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => goToStep(2)}
                    disabled={!selectedService}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

              {!allowServiceSelection && activeStep === 2 && durationPolicyPanel}
              {!allowServiceSelection && activeStep === 2 && packagesPanel}
              {!allowServiceSelection && activeStep === 2 && addonsPanel}

              {activeStep === 2 && requiresProfessional && (
                <div className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Profissional</p>
                    <h3 className="text-lg font-semibold text-white">Seleciona o profissional</h3>
                  </div>
                  <span className="text-[12px] text-white/60">
                    {availableProfessionals.length} profissionais
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className={`${selectableCardBase} ${selectedProfessionalId === null ? selectableCardActive : ""}`}
                    onClick={() => setSelectedProfessionalId(null)}
                  >
                    <p className="text-sm font-semibold text-white">Qualquer profissional</p>
                    <p className="mt-1 text-[12px] text-white/60">Atribuição automática.</p>
                  </button>
                  {availableProfessionals.map((pro) => (
                    <div
                      key={pro.id}
                      className={`${selectableCardBase} ${selectedProfessionalId === pro.id ? selectableCardActive : ""}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedProfessionalId(pro.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={pro.avatarUrl}
                            name={pro.name}
                            className="h-10 w-10 border border-white/15"
                          />
                          <div>
                            <p className="text-sm font-semibold text-white">{pro.name}</p>
                            <p className="text-[12px] text-white/60">{pro.roleTitle || "Profissional"}</p>
                          </div>
                        </div>
                      </button>
                      {pro.username && (
                        <Link
                          href={`/${pro.username}`}
                          className="mt-3 inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white"
                        >
                          Ver perfil →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
                {availableProfessionals.length === 0 && (
                  <p className="mt-3 text-[12px] text-white/60">Sem profissionais disponíveis.</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  {allowServiceSelection ? (
                    <button type="button" className={ghostButtonClass} onClick={() => goToStep(1)}>
                      Voltar
                    </button>
                  ) : (
                    <button type="button" className={ghostButtonClass} onClick={handleClose}>
                      Sair
                    </button>
                  )}
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => goToStep(3)}
                    disabled={!canAccessStep3}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

              {activeStep === 2 && requiresResource && (
                <div className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Capacidade</p>
                    <h3 className="text-lg font-semibold text-white">Seleciona a capacidade</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {partySizeOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${selectableCardBase} ${selectedPartySize === value ? selectableCardActive : ""}`}
                      onClick={() => setSelectedPartySize(value)}
                    >
                      <p className="text-sm font-semibold text-white">{value} pessoas</p>
                      <p className="mt-1 text-[12px] text-white/60">Capacidade sugerida.</p>
                    </button>
                  ))}
                </div>
                {partySizeRules.partySizeRequired && !selectedPartySize && (
                  <p className="mt-3 text-[12px] text-white/60">
                    Escolhe a capacidade ({partySizeRules.partySizeMin}-{partySizeRules.partySizeMax}) para ver horários.
                  </p>
                )}
                {partySizeRules.partySizeRequired && selectedPartySize && (
                  <p className="mt-3 text-[12px] text-emerald-100/90">
                    Capacidade recomendada selecionada: {selectedPartySize} pessoas.
                  </p>
                )}
                {hasServiceResourceLinks && availableResources.length === 0 && (
                  <p className="mt-3 text-[12px] text-white/60">Sem recursos disponíveis para este serviço.</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  {allowServiceSelection ? (
                    <button type="button" className={ghostButtonClass} onClick={() => goToStep(1)}>
                      Voltar
                    </button>
                  ) : (
                    <button type="button" className={ghostButtonClass} onClick={handleClose}>
                      Sair
                    </button>
                  )}
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => goToStep(3)}
                    disabled={partySizeRules.partySizeRequired && !selectedPartySize}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

              {activeStep === 3 && (
                <div className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Agenda</p>
                    <h3 className="text-lg font-semibold text-white">Data e hora</h3>
                  </div>
                  <p className="text-[12px] capitalize text-white/60">{calendarMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => jumpToDay(todayIso)}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => jumpToDay(tomorrowIso)}
                    >
                      Amanhã
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => firstAvailableDayIso && jumpToDay(firstAvailableDayIso)}
                      disabled={!firstAvailableDayIso}
                    >
                      Primeiro disponível
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => weekendAvailableDayIso && jumpToDay(weekendAvailableDayIso)}
                      disabled={!weekendAvailableDayIso}
                    >
                      Fim de semana
                    </button>
                    {selectedDay ? (
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={clearDaySelection}
                      >
                        Limpar dia
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-white/60">
                    {selectedDay
                      ? `${formatDayLabel(selectedDay, timezone)} · ${selectedDayAvailability?.slots ?? 0} horários`
                      : `${availableDaysCount} dias com disponibilidade · ${availableSlotsCount} horários${
                          weekendDayLabel ? ` · fim de semana: ${weekendDayLabel}` : ""
                        }`}
                  </p>
                </div>
                {recommendedDayPills.length > 0 && (
                  <div className="mt-3 -mx-1 overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-2 px-1">
                      {recommendedDayPills.map((pill) => {
                        const active = selectedDay === pill.date;
                        return (
                          <button
                            key={`pill-${pill.date}`}
                            type="button"
                            onClick={() => jumpToDay(pill.date)}
                            className={`rounded-2xl border px-3 py-2 text-left transition ${
                              active
                                ? "border-white/45 bg-white/15 text-white"
                                : "border-white/15 bg-white/5 text-white/75 hover:border-white/30 hover:bg-white/10"
                            }`}
                          >
                            <p className="text-[11px] font-semibold">{pill.shortLabel}</p>
                            <p className="text-[10px] text-white/60">{pill.slots} horários</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div>
                    <div className={panelSoftClass}>
                      <OryaDateField
                        value={selectedDay ?? ""}
                        onChange={(next) => {
                          const parsed = parseIsoDateStrict(next);
                          if (!parsed) {
                            loadDaySlots(next);
                            return;
                          }
                          const monthDate = new Date(parsed.year, parsed.month - 1, parsed.day);
                          if (!Number.isNaN(monthDate.getTime())) {
                            setCalendarMonth(startOfMonth(monthDate));
                          }
                          const iso = `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
                          loadDaySlots(iso);
                        }}
                        minDate={todayIso}
                        maxDate={maxSelectableIso}
                        dayMeta={Object.fromEntries(
                          availabilityDays.map((day) => [day.date, { available: day.hasAvailability, badge: String(day.slots ?? 0) }]),
                        )}
                        disabledDates={(day) => {
                          const availability = availabilityMap.get(day);
                          return availability ? !availability.hasAvailability : false;
                        }}
                        placeholder="Selecionar dia"
                        className="w-full"
                        buttonClassName="h-11 w-full rounded-xl"
                      />
                    </div>

                    {calendarLoading && <p className="mt-3 text-[12px] text-white/60">A carregar disponibilidade...</p>}
                    {calendarError && <p className="mt-3 text-[12px] text-red-200">{calendarError}</p>}
                  </div>

                  <div className="space-y-3">
                    <div className={panelSoftClass}>
                      <div className="flex items-center justify-between text-[11px] text-white/60">
                        <span className="uppercase tracking-[0.2em]">Horários</span>
                        {selectedService && (
                          <span>{formatMoney(effectiveBaseCents, selectedService.currency)}</span>
                        )}
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-white">
                        {selectedDay
                          ? formatDayLabel(selectedDay, timezone)
                          : "Escolhe um dia"}
                      </h4>
                      {selectedDay && daySlots.length > 0 && !slotsLoading ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-[11px] text-white/60">
                            {daySlots.length} horários carregados
                            {firstDaySlotLabel ? ` · primeiro às ${firstDaySlotLabel}` : ""}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/35 hover:text-white disabled:opacity-50"
                              onClick={() => firstDaySlot && reserveSlot(firstDaySlot)}
                              disabled={Boolean(slotSubmittingKey) || !firstDaySlot}
                            >
                              Primeiro disponível
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/35 hover:text-white disabled:opacity-50"
                              onClick={() => afterWorkSlot && reserveSlot(afterWorkSlot)}
                              disabled={Boolean(slotSubmittingKey) || !afterWorkSlot}
                            >
                              Depois das 18h
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {selectedService?.locationMode === "CHOOSE_AT_BOOKING" && (
                      <div className={panelSoftClass}>
                        <label className="text-[11px] uppercase tracking-[0.2em] text-white/60">Morada</label>
                        <p className="mt-2 text-sm text-white/80">
                          {resolvedAddressLabel ?? "Seleciona uma morada antes de reservar."}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="sr-only" aria-live="polite">
                        {step3LiveMessage}
                      </p>
                      {slotsLoading && (
                        <p role="status" className="text-[12px] text-white/60">
                          A carregar horários...
                        </p>
                      )}
                      {slotsError && (
                        <p role="alert" className="text-[12px] text-red-200">
                          {slotsError}
                        </p>
                      )}
                      {!slotsLoading && !selectedDay && (
                        <p className="text-[12px] text-white/60">Escolhe um dia para ver horários.</p>
                      )}
                      {!slotsLoading && !slotsError && selectedDay && slotGroups.length === 0 && (
                        <p className="text-[12px] text-white/60">Sem horários disponíveis.</p>
                      )}
                      {slotGroups.map((group) => (
                        <div key={group.label} className={panelSoftClass}>
                          <div className="flex items-center justify-between text-[11px] text-white/60">
                            <span className="uppercase tracking-[0.2em]">{group.label}</span>
                            <span>{group.slots.length} horários</span>
                          </div>
                          <div className="mt-3 -mx-1 overflow-x-auto pb-2 snap-x snap-mandatory">
                            <div className="flex min-w-max gap-2 px-1">
                              {group.slots.map((slot) => {
                                const timeLabel = new Date(slot.startsAt).toLocaleTimeString("pt-PT", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: timezone,
                                });
                                const isFull = slot.isFull || String(slot.status).toUpperCase() === "FULL";
                                const isSelected = selectedSlot?.slotKey === slot.slotKey;
                                const isFirst = highlightedSlotKeys.first === slot.slotKey;
                                const isAfterWork = highlightedSlotKeys.afterWork === slot.slotKey && !isFirst;
                                const slotBadge = isFull ? "Cheio" : isFirst ? "Mais cedo" : isAfterWork ? "Pós-laboral" : null;
                                return (
                                  <button
                                    key={slot.slotKey}
                                    type="button"
                                    onClick={() => {
                                      if (isFull) return;
                                      reserveSlot(slot);
                                    }}
                                    disabled={Boolean(slotSubmittingKey) || isFull}
                                    className={`snap-start inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[12px] font-semibold text-white/85 transition ${
                                      isSelected
                                        ? "border-white/60 bg-white/15"
                                        : isFull
                                          ? "border-rose-300/30 bg-rose-500/10 text-rose-100/70"
                                          : "border-white/15 bg-white/5 hover:border-white/35 hover:bg-white/10"
                                    }`}
                                  >
                                    {timeLabel}
                                    {slotBadge && (
                                      <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/75">
                                        {slotBadge}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden items-center justify-between gap-3 text-[12px] text-white/60 lg:flex">
                      <button type="button" className={ghostButtonClass} onClick={() => goToStep(2)}>
                        Voltar
                      </button>
                      {canJumpToCheckoutFromStep3 ? (
                        <button
                          type="button"
                          className={primaryButtonClass}
                          onClick={() => goToStep(4)}
                        >
                          Continuar para pagamento
                        </button>
                      ) : (
                        <span>Escolhe um horário.</span>
                      )}
                    </div>
                    <div className="sticky bottom-0 z-20 rounded-2xl border border-white/12 bg-[#0b1220]/95 p-3 backdrop-blur lg:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Seleção atual</p>
                          <p className="text-[12px] text-white/80">{step3Summary}</p>
                        </div>
                        {canJumpToCheckoutFromStep3 ? (
                          <button
                            type="button"
                            className={primaryButtonClass}
                            onClick={() => goToStep(4)}
                          >
                            Pagamento
                          </button>
                        ) : (
                          <span className="text-[11px] text-white/60">Seleciona hora</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {activeStep === 4 && (
                <div className={panelClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Pagamento</p>
                      <h3 className="text-lg font-semibold text-white">Finaliza o agendamento</h3>
                    </div>
                    <button type="button" className={ghostButtonClass} onClick={() => goToStep(3)}>
                      Alterar horário
                    </button>
                  </div>

                  {!bookingPending &&
                    !checkout &&
                    !checkoutLoading &&
                    !bookingSuccess &&
                    !bookingError &&
                    !paymentMessage && (
                      <div className={`${panelSoftClass} mt-4`}>
                        <p className="text-sm font-semibold text-white">Escolhe um horário.</p>
                        <button type="button" className={`${primaryButtonClass} mt-3`} onClick={() => goToStep(3)}>
                          Ver horários
                        </button>
                      </div>
                    )}

                  {bookingPending && (
                    <div className={`${panelSoftClass} mt-4`}>
                      <p className="text-sm font-semibold text-white">Pré-reserva</p>
                      <p className="mt-1 text-[12px] text-white/60">
                        {holdCountdownLabel
                          ? `Bloqueio ativo (${holdCountdownLabel}) · expira às ${holdExpiryLabel ?? pendingExpiryLabel ?? "--:--"}.`
                          : pendingExpiryLabel
                            ? `Expira às ${pendingExpiryLabel}.`
                            : "Expira em breve."}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/70">
                        <span>
                          {selectedService ? `${effectiveDurationMinutes} min` : ""} ·{" "}
                          {selectedService ? formatMoney(effectiveBaseCents, selectedService.currency) : ""}
                        </span>
                      </div>
                      {!checkout && (
                        <button
                          type="button"
                          onClick={() => startBookingCheckout(bookingPending.id, paymentMethod)}
                          disabled={checkoutLoading}
                          className={`${primaryButtonClass} mt-3`}
                        >
                          {checkoutLoading ? "A preparar..." : "Continuar"}
                        </button>
                      )}
                    </div>
                  )}

                  {phoneRequired && (
                    <div className={`${panelSoftClass} mt-4`}>
                      <p className="text-[12px] text-white/70">Telemóvel obrigatório para confirmar a reserva.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                          className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          placeholder="+351 9xx xxx xxx"
                        />
                        <button
                          type="button"
                          onClick={savePhone}
                          disabled={phoneSaving}
                          className={primaryButtonClass}
                        >
                          {phoneSaving ? "A guardar..." : "Guardar telemóvel"}
                        </button>
                      </div>
                      {phoneError && <p className="mt-2 text-[12px] text-red-200">{phoneError}</p>}
                    </div>
                  )}

                  {(bookingPending || checkout || checkoutLoading) && (
                    <div className="mt-4 space-y-4">
                      <div className={`${panelSoftClass} space-y-3`}>
                        <div className="flex items-center justify-between text-[11px] text-white/70">
                          <span className="uppercase tracking-[0.16em]">Método de pagamento</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => handleSelectPaymentMethod("mbway")}
                            className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                              paymentMethod === "mbway"
                                ? "border-emerald-300/60 bg-emerald-400/10 text-white shadow-[0_18px_40px_rgba(16,185,129,0.18)]"
                                : "border-white/15 bg-white/5 text-white/75 hover:border-white/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">MB WAY</span>
                              <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                                Recomendado · 0€ taxas
                              </span>
                            </div>
                            <span className="text-[11px] text-white/60">No telemóvel.</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPaymentMethod("card")}
                            className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                              paymentMethod === "card"
                                ? "border-white/40 bg-white/10 text-white shadow-[0_18px_40px_rgba(255,255,255,0.14)]"
                                : "border-white/15 bg-white/5 text-white/75 hover:border-white/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">Cartão</span>
                              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                                {cardFeeLabel || "Taxa"}
                              </span>
                            </div>
                            <span className="text-[11px] text-white/60">Stripe Link disponível.</span>
                          </button>
                        </div>
                      </div>

                      <div className={panelSoftClass}>
                        <div className="flex items-center justify-between text-[11px] text-white/70">
                          <span className="uppercase tracking-[0.16em]">Resumo</span>
                        </div>
                        <div className="mt-3 space-y-2 text-[12px] text-white/70">
                          <div className="flex items-center justify-between">
                            <span>Valor base</span>
                            <span>{basePriceLabel ?? "--"}</span>
                          </div>
                          {addonsPriceLabel && (
                            <div className="flex items-center justify-between">
                              <span>Extras</span>
                              <span>+{addonsPriceLabel}</span>
                            </div>
                          )}
                          {paymentMethod === "card" && cardFeeCents > 0 && (
                            <div className="flex items-center justify-between">
                              <span>Taxa cartão</span>
                              <span>{formatMoney(cardFeeCents, priceCurrency)}</span>
                            </div>
                          )}
                          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <span className="text-[12px] text-white/70">Total a pagar</span>
                            <span className="text-lg font-semibold text-white">{totalPriceLabel ?? "--"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {checkout && stripePromise && elementsOptions && (
                    <div className="mt-4">
                      <Elements stripe={stripePromise} options={elementsOptions}>
                        <BookingPaymentForm
                          amountCents={checkout.amountCents}
                          currency={checkout.currency}
                          onConfirmed={handlePaymentConfirmed}
                          onError={(message) => setCheckoutError(message)}
                        />
                      </Elements>
                    </div>
                  )}

                  {!stripePromise && (
                    <p className="mt-4 text-[12px] text-red-200">Stripe indisponível neste momento.</p>
                  )}

                  {checkoutError && <p className="mt-4 text-[12px] text-red-200">{checkoutError}</p>}
                  {paymentMessage && <p className="mt-2 text-[12px] text-emerald-200">{paymentMessage}</p>}
                  {bookingError && <p className="mt-2 text-[12px] text-red-200">{bookingError}</p>}
                  {bookingSuccess && <p className="mt-2 text-[12px] text-emerald-200">{bookingSuccess}</p>}
                </div>
              )}
            </div>

            <aside className="hidden min-h-0 space-y-4 lg:block lg:overflow-y-auto lg:pr-1">
              <div className={panelClass}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Resumo</p>
                <div className="mt-3 divide-y divide-white/10">
                  <div className="flex items-start justify-between gap-2 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Serviço</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {selectedService?.title ?? "Por definir"}
                      </p>
                      {selectedService ? (
                        <p className="mt-1 text-[12px] text-white/60">
                          {effectiveDurationMinutes} min · Preço:{" "}
                          {formatMoney(effectiveBaseCents, selectedService.currency)}
                        </p>
                      ) : (
                        <p className="mt-1 text-[12px] text-white/60">Por definir.</p>
                      )}
                      {selectedPackage && (
                        <p className="mt-2 text-[11px] text-white/60">
                          Pacote: {selectedPackage.label} · {packagePriceLabel}
                        </p>
                      )}
                      {selectedAddonItems.length > 0 && (
                        <div className="mt-2 space-y-1 text-[11px] text-white/60">
                          {selectedAddonItems.map((addon) => (
                            <div key={addon.id} className="flex items-center justify-between gap-2">
                              <span>
                                {addon.label}
                                {addon.quantity > 1 ? ` x${addon.quantity}` : ""}
                              </span>
                              <span>+{formatMoney(addon.deltaPriceCents * addon.quantity, selectedService?.currency ?? "EUR")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {allowServiceSelection ? (
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="text-[11px] text-white/60 hover:text-white"
                      >
                        Editar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClose}
                        className="text-[11px] text-white/60 hover:text-white"
                      >
                        Trocar
                      </button>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{assignmentSummaryLabel}</p>
                      <p className="mt-1 text-sm text-white">{professionalLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="text-[11px] text-white/60 hover:text-white"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Data & hora</p>
                      <p className="mt-1 text-sm text-white">
                        {selectedDateLabel && selectedTimeLabel
                          ? `${selectedDateLabel} · ${selectedTimeLabel}`
                          : "Por definir"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(3)}
                      className="text-[11px] text-white/60 hover:text-white"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Local</p>
                      <p className="mt-1 text-sm text-white">{locationLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(3)}
                      className="text-[11px] text-white/60 hover:text-white"
                    >
                      Editar
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Total</p>
                  <p className="mt-1 text-lg font-semibold text-white">{totalPriceLabel ?? "--"}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
