"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { getEventCoverUrl } from "@/lib/eventCover";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripePublic";

type Service = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode: "FIXED" | "CHOOSE_AT_BOOKING";
  defaultLocationText?: string | null;
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
  startsAt: string;
  durationMinutes: number;
  status: string;
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
};

type ReservationStep = 1 | 2 | 3 | 4;
type PaymentMethod = "mbway" | "card";

type ReservasBookingClientProps = {
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    timezone: string | null;
    address: string | null;
    reservationAssignmentMode: "PROFESSIONAL" | "RESOURCE";
  };
  services: Service[];
  professionals: Professional[];
  resources: Resource[];
  initialServiceId?: number | null;
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

const capacityOptions = [
  { label: "1-2", value: 2 },
  { label: "3-4", value: 4 },
  { label: "5-6", value: 6 },
  { label: "7+", value: 8 },
];
const CARD_FEE_BPS = 100;

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function formatLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveServiceCover(coverImageUrl: string | null | undefined, seed: string | number) {
  return getEventCoverUrl(coverImageUrl, { seed, width: 900, quality: 72 });
}

function getMonthLabel(date: Date) {
  return date.toLocaleString("pt-PT", { month: "long", year: "numeric" });
}

function buildMonthDays(date: Date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days: Array<{ date: Date | null }> = [];
  for (let i = 0; i < startWeekday; i += 1) days.push({ date: null });
  for (let d = 1; d <= daysInMonth; d += 1) {
    days.push({ date: new Date(date.getFullYear(), date.getMonth(), d) });
  }
  return { days, daysInMonth };
}

function formatDayLabel(iso: string, timezone: string) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    weekday: "short",
    timeZone: timezone,
  });
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
  initialServiceId,
  fixedServiceId,
  fixedProfessionalId,
  mode = "inline",
  onClose,
}: ReservasBookingClientProps) {
  const { user } = useUser();
  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const mountedRef = useRef(true);
  const allowServiceSelection = fixedServiceId == null;

  const activeServices = services.filter((service) => service.isActive);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    fixedServiceId && activeServices.some((s) => s.id === fixedServiceId)
      ? fixedServiceId
      : initialServiceId && activeServices.some((s) => s.id === initialServiceId)
        ? initialServiceId
        : activeServices[0]?.id ?? null,
  );
  const [activeStep, setActiveStep] = useState<ReservationStep>(allowServiceSelection ? 1 : 2);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Record<number, number>>({});
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
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
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("");
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

  const selectedService = activeServices.find((service) => service.id === selectedServiceId) ?? null;
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
        serviceKind: selectedService?.kind ?? null,
      }),
    [organization.reservationAssignmentMode, selectedService?.kind],
  );
  const assignmentMode = assignmentConfig.mode;
  const timezone = organization.timezone || "Europe/Lisbon";
  const selectedProfessional =
    selectedProfessionalId != null
      ? availableProfessionals.find((pro) => pro.id === selectedProfessionalId) ?? null
      : null;
  const monthLabel = getMonthLabel(calendarMonth);
  const { days: calendarDays } = buildMonthDays(calendarMonth);
  const calendarMonthParam = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
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
  const packageOptions = useMemo(
    () => (selectedService?.packages ?? []).slice().sort((a, b) => b.recommended - a.recommended || a.sortOrder - b.sortOrder || a.id - b.id),
    [selectedService?.packages],
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
  const baseDurationMinutes = selectedPackage?.durationMinutes ?? selectedService?.durationMinutes ?? 0;
  const basePriceCents = selectedPackage?.priceCents ?? baseServiceCents;
  const effectiveDurationMinutes = Math.max(0, baseDurationMinutes + addonsDeltaMinutes);
  const effectiveBaseCents = Math.max(0, basePriceCents + addonsDeltaCents);
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
  const canAccessStep2 = Boolean(selectedService);
  const canAccessStep3 = assignmentMode === "RESOURCE" ? Boolean(selectedPartySize) : Boolean(selectedService);
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedService) {
      setLocationText("");
      setSelectedAddons({});
      setSelectedPackageId(null);
      return;
    }
    if (selectedService.locationMode === "CHOOSE_AT_BOOKING") {
      setLocationText(selectedService.defaultLocationText ?? "");
      setSelectedAddons({});
      setSelectedPackageId(null);
      return;
    }
    setLocationText("");
    setSelectedAddons({});
    setSelectedPackageId(null);
  }, [selectedServiceId]);

  useEffect(() => {
    if (fixedServiceId && fixedServiceId !== selectedServiceId) {
      setSelectedServiceId(fixedServiceId);
    }
  }, [fixedServiceId, selectedServiceId]);

  useEffect(() => {
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
    setBookingSuccess(null);
    setPhoneRequired(false);
    setPhoneError(null);
    setPendingSlot(null);
    setPaymentMethod("mbway");
  }, [selectedServiceId, allowServiceSelection]);

  useEffect(() => {
    if (assignmentMode !== "PROFESSIONAL") return;
    if (!selectedService) return;
    if (
      selectedProfessionalId &&
      !availableProfessionals.some((professional) => professional.id === selectedProfessionalId)
    ) {
      setSelectedProfessionalId(null);
    }
  }, [assignmentMode, availableProfessionals, selectedProfessionalId, selectedService?.id]);

  const autoAdvanceRef = useRef(false);

  useEffect(() => {
    if (assignmentMode !== "PROFESSIONAL") return;
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
    assignmentMode,
    availableProfessionals,
    fixedProfessionalId,
    selectedProfessionalId,
    allowServiceSelection,
    activeStep,
  ]);

  useEffect(() => {
    autoAdvanceRef.current = false;
  }, [selectedServiceId]);

  useEffect(() => {
    setSelectedDay(null);
    setDaySlots([]);
    setSelectedSlot(null);
    setBookingPending(null);
    setCheckout(null);
    setCheckoutError(null);
    setCheckoutLoading(false);
    setPaymentMessage(null);
    setBookingError(null);
    setBookingSuccess(null);
    setPendingSlot(null);
  }, [assignmentMode, selectedProfessionalId, selectedPartySize, addonsParam]);

  useEffect(() => {
    if (assignmentMode === "RESOURCE" && !selectedPartySize && activeStep > 2) {
      setActiveStep(2);
    }
  }, [assignmentMode, selectedPartySize, activeStep]);

  useEffect(() => {
    if (activeStep === 4 && !canAccessStep4) {
      setActiveStep(3);
    }
  }, [activeStep, canAccessStep4]);

  useEffect(() => {
    if (!selectedServiceId) return;
    if (assignmentMode === "RESOURCE" && !selectedPartySize) {
      setAvailabilityDays([]);
      return;
    }

    const controller = new AbortController();
    setCalendarLoading(true);
    setCalendarError(null);

    const params = new URLSearchParams({ month: calendarMonthParam });
    if (assignmentMode === "PROFESSIONAL" && selectedProfessionalId) {
      params.set("professionalId", String(selectedProfessionalId));
    }
    if (assignmentMode === "RESOURCE" && selectedPartySize) {
      params.set("partySize", String(selectedPartySize));
    }
    if (selectedPackageId) {
      params.set("packageId", String(selectedPackageId));
    }
    if (addonsParam) {
      params.set("addons", addonsParam);
    }

    fetch(`/api/servicos/${selectedServiceId}/calendario?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) {
          throw new Error(data?.message || data?.error || "Erro ao carregar calendário.");
        }
        setAvailabilityDays(Array.isArray(data.days) ? data.days : []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setCalendarError(err instanceof Error ? err.message : "Erro ao carregar calendário.");
      })
      .finally(() => setCalendarLoading(false));

    return () => controller.abort();
  }, [selectedServiceId, assignmentMode, selectedProfessionalId, selectedPartySize, calendarMonthParam, addonsParam, selectedPackageId]);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    availabilityDays.forEach((day) => map.set(day.date, day));
    return map;
  }, [availabilityDays]);

  const loadDaySlots = (iso: string) => {
    if (!selectedServiceId) return;
    if (assignmentMode === "RESOURCE" && !selectedPartySize) return;

    setSelectedDay(iso);
    if (!bookingPending) {
      setSelectedSlot(null);
    }
    setSlotsLoading(true);
    setSlotsError(null);
    setDaySlots([]);

    const params = new URLSearchParams({ day: iso });
    if (assignmentMode === "PROFESSIONAL" && selectedProfessionalId) {
      params.set("professionalId", String(selectedProfessionalId));
    }
    if (assignmentMode === "RESOURCE" && selectedPartySize) {
      params.set("partySize", String(selectedPartySize));
    }
    if (selectedPackageId) {
      params.set("packageId", String(selectedPackageId));
    }
    if (addonsParam) {
      params.set("addons", addonsParam);
    }

    fetch(`/api/servicos/${selectedServiceId}/slots?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) {
          throw new Error(data?.message || data?.error || "Erro ao carregar horários.");
        }
        setDaySlots(Array.isArray(data.items) ? data.items : []);
      })
      .catch((err) => setSlotsError(err instanceof Error ? err.message : "Erro ao carregar horários."))
      .finally(() => setSlotsLoading(false));
  };

  const startBookingCheckout = async (bookingId: number, method?: PaymentMethod) => {
    if (!selectedServiceId) return;
    if (!ensureAuth(redirectPath)) return;

    const resolvedMethod = method ?? paymentMethod;
    setActiveStep(4);
    setCheckoutLoading(true);
    setCheckoutError(null);
    setPaymentMessage(null);

    try {
      const res = await fetch(`/api/servicos/${selectedServiceId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, paymentMethod: resolvedMethod }),
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
        }
        throw new Error(json?.message || json?.error || "Erro ao iniciar pagamento.");
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
    setBookingPending(null);
    setCheckout(null);
    setCheckoutError(null);
    setCheckoutLoading(false);
    setPaymentMessage(null);
    setBookingError(null);
    setBookingSuccess(null);
    setPendingSlot(null);
    setSelectedSlot(null);
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
  };

  const pollBookingStatus = async (bookingId: number, startsAtIso: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (!mountedRef.current) return;
      try {
        const res = await fetch(`/api/me/reservas/${bookingId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const status = json?.booking?.status as string | undefined;
        if (status === "CONFIRMED") {
          setBookingSuccess("Agendamento confirmado.");
          setBookingPending(null);
          setCheckout(null);
          loadDaySlots(startsAtIso.slice(0, 10));
          return;
        }
        if (status && ["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(status)) {
          setBookingError("Esta reserva foi cancelada.");
          setBookingPending(null);
          setCheckout(null);
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
    if (!selectedServiceId || !selectedService) return;
    if (!ensureAuth(redirectPath)) return;

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

    try {
      if (selectedService.locationMode === "CHOOSE_AT_BOOKING" && !locationText.trim()) {
        setBookingError("Indica o local antes de reservar.");
        return;
      }
      const res = await fetch(`/api/servicos/${selectedServiceId}/reservar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: slot.startsAt,
          professionalId: assignmentMode === "PROFESSIONAL" ? selectedProfessionalId : null,
          partySize: assignmentMode === "RESOURCE" ? selectedPartySize : null,
          locationText:
            selectedService.locationMode === "CHOOSE_AT_BOOKING" ? locationText.trim() : null,
          selectedAddons: selectedAddonsPayload,
          packageId: selectedPackageId,
        }),
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
        throw new Error(json?.message || json?.error || "Não foi possível criar a pré-reserva.");
      }
      setBookingPending({
        id: json.booking.id,
        status: json.booking.status,
        pendingExpiresAt: json.booking.pendingExpiresAt ?? null,
        startsAt: slot.startsAt,
      });
      setActiveStep(4);
      await startBookingCheckout(json.booking.id, paymentMethod);
    } catch (err) {
      setSelectedSlot(null);
      setBookingError(err instanceof Error ? err.message : "Não foi possível criar a pré-reserva.");
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
  const stepItems = allowServiceSelection
    ? ([
        { id: 1, title: "Serviço", index: 1 },
        {
          id: 2,
          title: assignmentMode === "RESOURCE" ? "Capacidade" : "Profissional",
          index: 2,
        },
        { id: 3, title: "Data & hora", index: 3 },
        { id: 4, title: "Pagamento", index: 4 },
      ] as const)
    : ([
        {
          id: 2,
          title: assignmentMode === "RESOURCE" ? "Capacidade" : "Profissional",
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
  const selectedCapacityLabel =
    selectedPartySize != null
      ? capacityOptions.find((opt) => opt.value === selectedPartySize)?.label ?? null
      : null;
  const locationLabel =
    selectedService?.locationMode === "CHOOSE_AT_BOOKING"
      ? locationText.trim() || "Local por definir"
      : selectedService?.defaultLocationText ?? organization.address ?? "Local por definir";
  const professionalLabel =
    assignmentMode === "RESOURCE"
      ? selectedCapacityLabel
        ? `${selectedCapacityLabel} pessoas`
        : "Capacidade por definir"
      : selectedProfessional?.name ?? "Qualquer profissional";

  const shellHeightClass =
    mode === "modal"
      ? "h-[100svh] sm:h-[min(90svh,820px)]"
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
              {selectedService.durationMinutes} min · {formatMoney(selectedService.unitPriceCents, selectedService.currency)}
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
                  {pkg.durationMinutes} min · {formatMoney(pkg.priceCents, selectedService.currency)}
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
              +{addonsDeltaMinutes} min · +{formatMoney(addonsDeltaCents, selectedService.currency)}
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
        <div className="pointer-events-none absolute -left-24 -top-28 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,0,200,0.25),_transparent_65%)] blur-2xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-28 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,_rgba(107,255,255,0.28),_transparent_65%)] blur-2xl" />
        <div className="relative flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6 lg:overflow-hidden">
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
              {bookingPending && pendingExpiryLabel && (
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70">
                  Pré-reserva até {pendingExpiryLabel}
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
              {stepItems.map((step) => {
                const isActive = activeStep === step.id;
                const enabled = stepEnabled(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!enabled}
                    onClick={() => enabled && goToStep(step.id)}
                    className={`flex min-w-[130px] items-center gap-2 rounded-full border px-3 py-2 text-left transition sm:min-w-0 ${
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
                      const isActive = service.id === selectedServiceId;
                      const coverUrl = resolveServiceCover(service.coverImageUrl, `service-${service.id}`);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => setSelectedServiceId(service.id)}
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
                                  {service.durationMinutes} min · {formatMoney(service.unitPriceCents, service.currency)}
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
                                {service.categoryTag && (
                                  <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/75">
                                    {service.categoryTag}
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

              {!allowServiceSelection && activeStep === 2 && packagesPanel}
              {!allowServiceSelection && activeStep === 2 && addonsPanel}

              {activeStep === 2 && assignmentMode === "PROFESSIONAL" && (
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
                  <button type="button" className={primaryButtonClass} onClick={() => goToStep(3)}>
                    Continuar
                  </button>
                </div>
              </div>
            )}

              {activeStep === 2 && assignmentMode === "RESOURCE" && (
                <div className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Capacidade</p>
                    <h3 className="text-lg font-semibold text-white">Seleciona a capacidade</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {capacityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${selectableCardBase} ${selectedPartySize === opt.value ? selectableCardActive : ""}`}
                      onClick={() => setSelectedPartySize(opt.value)}
                    >
                      <p className="text-sm font-semibold text-white">{opt.label} pessoas</p>
                      <p className="mt-1 text-[12px] text-white/60">Capacidade sugerida.</p>
                    </button>
                  ))}
                </div>
                {!selectedPartySize && (
                  <p className="mt-3 text-[12px] text-white/60">Escolhe a capacidade para ver horários.</p>
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
                    disabled={!selectedPartySize}
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
                  <div className="flex items-center gap-2 text-[12px] text-white/60">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = new Date(calendarMonth);
                        prev.setMonth(prev.getMonth() - 1);
                        setCalendarMonth(prev);
                      }}
                      className={ghostButtonClass}
                    >
                      ←
                    </button>
                    <span className="font-semibold capitalize">{monthLabel}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Date(calendarMonth);
                        next.setMonth(next.getMonth() + 1);
                        setCalendarMonth(next);
                      }}
                      className={ghostButtonClass}
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div>
                    <div className="grid grid-cols-7 gap-2 text-[10px] text-white/50">
                      {["D", "S", "T", "Q", "Q", "S", "S"].map((d, idx) => (
                        <span key={`${d}-${idx}`} className="text-center uppercase tracking-wide">
                          {d}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-2 text-[12px]">
                      {calendarDays.map((day, idx) => {
                        if (!day.date) return <span key={`blank-${idx}`} />;
                        const iso = formatLocalISODate(day.date);
                        const availability = availabilityMap.get(iso);
                        const isAvailable = availability?.hasAvailability;
                        const isSelected = selectedDay === iso;
                        return (
                          <button
                            key={`${iso}-${idx}`}
                            type="button"
                            onClick={() => loadDaySlots(iso)}
                            className={`h-11 w-11 rounded-2xl border text-center text-white/80 transition ${
                              isSelected
                                ? "border-white/60 bg-white/15"
                                : isAvailable
                                  ? "border-white/20 bg-white/5 hover:bg-white/10"
                                  : "border-white/5 bg-white/5 opacity-40"
                            }`}
                          >
                            <div className="text-[12px] font-semibold">{day.date.getDate()}</div>
                            {isAvailable && <div className="mx-auto mt-1 h-1 w-1 rounded-full bg-[#6BFFFF]" />}
                          </button>
                        );
                      })}
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
                    </div>

                    {selectedService?.locationMode === "CHOOSE_AT_BOOKING" && (
                      <div className={panelSoftClass}>
                        <label className="text-[11px] uppercase tracking-[0.2em] text-white/60">Local</label>
                        <input
                          value={locationText}
                          onChange={(e) => setLocationText(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          placeholder="Indica o local"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      {slotsLoading && <p className="text-[12px] text-white/60">A carregar horários...</p>}
                      {slotsError && <p className="text-[12px] text-red-200">{slotsError}</p>}
                      {!slotsLoading && !selectedDay && (
                        <p className="text-[12px] text-white/60">Escolhe um dia para ver horários.</p>
                      )}
                      {!slotsLoading && selectedDay && slotGroups.length === 0 && (
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
                                const isSelected = selectedSlot?.slotKey === slot.slotKey;
                                return (
                                  <button
                                    key={slot.slotKey}
                                    type="button"
                                    onClick={() => reserveSlot(slot)}
                                    className={`snap-start rounded-full border px-4 py-2 text-[12px] font-semibold text-white/85 transition ${
                                      isSelected
                                        ? "border-white/60 bg-white/15"
                                        : "border-white/15 bg-white/5 hover:border-white/35 hover:bg-white/10"
                                    }`}
                                  >
                                    {timeLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3 text-[12px] text-white/60">
                      <button type="button" className={ghostButtonClass} onClick={() => goToStep(2)}>
                        Voltar
                      </button>
                      {bookingPending || checkout ? (
                        <button
                          type="button"
                          className={primaryButtonClass}
                          onClick={() => goToStep(4)}
                        >
                          Continuar
                        </button>
                      ) : (
                        <span>Escolhe um horário.</span>
                      )}
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
                        {pendingExpiryLabel ? `Expira às ${pendingExpiryLabel}.` : "Expira em breve."}
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

            <aside className="min-h-0 space-y-4 lg:overflow-y-auto lg:pr-1">
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
                          {effectiveDurationMinutes} min ·{" "}
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
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Profissional</p>
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
