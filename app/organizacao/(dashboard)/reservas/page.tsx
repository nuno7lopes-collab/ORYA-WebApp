"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripePublic";
import { cn } from "@/lib/utils";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { resolveServiceAssignmentMode, type ReservationAssignmentMode } from "@/lib/reservas/serviceAssignment";
import AvailabilityEditor from "@/app/organizacao/(dashboard)/reservas/_components/AvailabilityEditor";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CALENDAR_FULL_START_HOUR = 0;
const CALENDAR_FULL_END_HOUR = 24;
const DEFAULT_VIEW_START_HOUR = 9;
const DEFAULT_VIEW_END_HOUR = 19;
const DEFAULT_VIEW_HOURS = DEFAULT_VIEW_END_HOUR - DEFAULT_VIEW_START_HOUR;
const MIN_HOUR_HEIGHT = 36;
const MAX_HOUR_HEIGHT = 84;
const DEFAULT_HOUR_HEIGHT = 56;
const PLACEHOLDER_DAY = new Date(Date.UTC(2000, 0, 1));
const CHIP_BASE =
  "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-white/20 hover:bg-white/10 hover:text-white";
const CHIP_ACTIVE =
  "border-white/35 bg-white/18 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]";
const SERVICE_DURATION_OPTIONS = [30, 60, 90, 120];

const formatRangeDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(date);

const formatLongDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: timezone,
  }).format(date);

const formatTimeLabel = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);

const formatCurrency = (amountCents: number, currency: string) =>
  `${(amountCents / 100).toFixed(2)} ${currency}`;

const formatBookingStatus = (status: string) => {
  switch (status) {
    case "CONFIRMED":
      return "Confirmada";
    case "COMPLETED":
      return "Concluida";
    case "PENDING_CONFIRMATION":
    case "PENDING":
      return "Pendente";
    case "CANCELLED_BY_CLIENT":
      return "Cancelada pelo cliente";
    case "CANCELLED_BY_ORG":
      return "Cancelada pela organizacao";
    case "CANCELLED":
      return "Cancelada";
    case "DISPUTED":
      return "Em disputa";
    case "NO_SHOW":
      return "No-show";
    default:
      return status;
  }
};

const formatInviteStatus = (status: string) => {
  if (status === "ACCEPTED") return "Aceite";
  if (status === "DECLINED") return "Recusado";
  return "Pendente";
};

const formatParticipantStatus = (status: string) => {
  if (status === "CANCELLED") return "Cancelado";
  return "Confirmado";
};

const formatClientLabel = (client: ClientItem) =>
  client.fullName?.trim() ||
  (client.username ? `@${client.username}` : "") ||
  client.email?.trim() ||
  "Cliente";

function DashboardPaymentForm({
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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
        <p className="font-semibold text-white">Total</p>
        <p className="text-[12px] text-white/65">{formatCurrency(amountCents, currency)}</p>
      </div>
      <PaymentElement />
      <button
        type="button"
        className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-60"
        onClick={handleSubmit}
        disabled={!stripe || !elements || submitting || disabled}
      >
        {submitting ? "A processar..." : "Pagar e reservar"}
      </button>
    </div>
  );
}

const addDaysToParts = (parts: { year: number; month: number; day: number }, amount: number) => {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + amount);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
};

const buildZonedDate = (
  parts: { year: number; month: number; day: number },
  timezone: string,
  hour = 0,
  minute = 0,
) => makeUtcDateFromLocal({ ...parts, hour, minute }, timezone);

const getDayKey = (date: Date, timezone: string) => {
  const parts = getDateParts(date, timezone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
};

const isSameDay = (a: Date, b: Date, timezone: string) => {
  const aParts = getDateParts(a, timezone);
  const bParts = getDateParts(b, timezone);
  return aParts.year === bParts.year && aParts.month === bParts.month && aParts.day === bParts.day;
};

const getTimeParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return { hour: Number(map.get("hour") || 0), minute: Number(map.get("minute") || 0) };
};

const formatInputDate = (date: Date, timezone: string) => {
  const parts = getDateParts(date, timezone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
};

const formatInputTime = (date: Date, timezone: string) => {
  const parts = getTimeParts(date, timezone);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  return `${hour}:${minute}`;
};

const getWeekStart = (date: Date, timezone: string) => {
  const parts = getDateParts(date, timezone);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const diff = (weekday + 6) % 7;
  const startParts = addDaysToParts(parts, -diff);
  return buildZonedDate(startParts, timezone, 0, 0);
};

type ServiceItem = {
  id: number;
  title: string;
  description: string | null;
  kind?: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  categoryTag?: string | null;
  locationMode?: string | null;
  defaultLocationText?: string | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
  _count?: { bookings: number; availabilities: number };
};

type BookingItem = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
  estimatedStartsAt?: string | null;
  delayMinutes?: number | null;
  delayReason?: string | null;
  assignmentMode?: string | null;
  partySize?: number | null;
  inviteSummary?: { total: number; accepted: number; declined: number; pending: number };
  participantSummary?: { total: number; confirmed: number; cancelled: number };
  court?: { id: number; name: string | null } | null;
  professional?: { id: number; name: string; user?: { fullName?: string | null; avatarUrl?: string | null } | null } | null;
  resource?: { id: number; label: string; capacity: number } | null;
  service: { id: number; title: string | null; kind?: string | null } | null;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

const getBookingMode = (booking: BookingItem): ReservationAssignmentMode => {
  const serviceKind =
    typeof booking.service?.kind === "string" ? booking.service.kind.trim().toUpperCase() : "";
  if (serviceKind && serviceKind !== "COURT") return "PROFESSIONAL";
  const normalized = typeof booking.assignmentMode === "string" ? booking.assignmentMode.toUpperCase() : "";
  if (normalized === "RESOURCE") return "RESOURCE";
  if (booking.resource) return "RESOURCE";
  return "PROFESSIONAL";
};

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
  priority: number;
  user?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
  priority: number;
};

type ClientItem = {
  id: string;
  fullName: string | null;
  username: string | null;
  contactPhone: string | null;
  email: string | null;
};

type BookingCheckout = {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  bookingId: number;
};

type InviteItem = {
  id: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | string;
  targetName: string | null;
  targetContact: string | null;
  respondedAt: string | null;
  createdAt: string;
};

type ParticipantItem = {
  id: number;
  status: "CONFIRMED" | "CANCELLED" | string;
  name: string | null;
  contact: string | null;
  createdAt: string;
  inviteId: number | null;
};

type CalendarView = "day" | "week";
type CalendarTab = "agenda" | "availability";

type PositionedBooking = {
  booking: BookingItem;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
};

const buildBookingPositions = (
  bookings: BookingItem[],
  timezone: string,
  dayStartHour: number,
  dayEndHour: number,
  minuteHeight: number,
) => {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const positioned: Array<Omit<PositionedBooking, "laneCount"> & { groupId: number }> = [];
  const groupLaneCounts = new Map<number, number>();
  let currentGroupId = 0;
  let active: Array<{ end: Date; lane: number; groupId: number }> = [];

  sorted.forEach((booking) => {
    const start = new Date(booking.startsAt);
    const timeParts = getTimeParts(start, timezone);
    const startMinutes = timeParts.hour * 60 + timeParts.minute;
    const endMinutes = startMinutes + booking.durationMinutes;
    const dayStartMinutes = dayStartHour * 60;
    const dayEndMinutes = dayEndHour * 60;
    const clampedStart = Math.max(startMinutes, dayStartMinutes);
    const clampedEnd = Math.min(endMinutes, dayEndMinutes);

    if (clampedEnd <= clampedStart) return;

    const end = new Date(start.getTime() + booking.durationMinutes * 60000);
    active = active.filter((item) => item.end > start);
    if (active.length === 0) {
      currentGroupId += 1;
    }
    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    active.push({ end, lane, groupId: currentGroupId });

    const nextMax = Math.max(groupLaneCounts.get(currentGroupId) ?? 0, lane + 1);
    groupLaneCounts.set(currentGroupId, nextMax);

    positioned.push({
      booking,
      lane,
      groupId: currentGroupId,
      top: (clampedStart - dayStartMinutes) * minuteHeight,
      height: Math.max(12, (clampedEnd - clampedStart) * minuteHeight),
    });
  });

  return positioned.map((item) => ({
    booking: item.booking,
    lane: item.lane,
    top: item.top,
    height: item.height,
    laneCount: groupLaneCounts.get(item.groupId) ?? 1,
  }));
};

const normalizeHourHeight = (value: number) =>
  Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, Math.round(value / 4) * 4));

export default function ReservasDashboardPage() {
  const searchParams = useSearchParams();
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const organizationId = organizationIdParam ? Number(organizationIdParam) : null;
  const orgMeUrl =
    organizationId && Number.isFinite(organizationId)
      ? `/api/organizacao/me?organizationId=${organizationId}`
      : null;
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarTab, setCalendarTab] = useState<CalendarTab>("agenda");
  const [hourHeight, setHourHeight] = useState(() => normalizeHourHeight(DEFAULT_HOUR_HEIGHT));
  const minuteHeight = hourHeight / 60;
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [drawerBooking, setDrawerBooking] = useState<BookingItem | null>(null);
  const participantsKey = drawerBooking ? `/api/organizacao/reservas/${drawerBooking.id}/participants` : null;
  const { data: participantsData } = useSWR<{
    ok: boolean;
    invites: InviteItem[];
    participants: ParticipantItem[];
  }>(participantsKey, fetcher);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [noShowBusy, setNoShowBusy] = useState(false);
  const [modeSaving, setModeSaving] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const serviceInitRef = useRef(false);
  const [createSlot, setCreateSlot] = useState<Date | null>(null);
  const [createServiceId, setCreateServiceId] = useState<number | null>(null);
  const [createClient, setCreateClient] = useState<ClientItem | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientItem[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [createProfessionalId, setCreateProfessionalId] = useState<number | null>(null);
  const [createResourceId, setCreateResourceId] = useState<number | null>(null);
  const [createPartySize, setCreatePartySize] = useState("");
  const [createLocationText, setCreateLocationText] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [checkout, setCheckout] = useState<BookingCheckout | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [delayMinutesDraft, setDelayMinutesDraft] = useState("0");
  const [delayReasonDraft, setDelayReasonDraft] = useState("");
  const [delayNotify, setDelayNotify] = useState(true);
  const [delayNotifyWindow, setDelayNotifyWindow] = useState("24");
  const [delaySaving, setDelaySaving] = useState(false);
  const [delayError, setDelayError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [servicePrice, setServicePrice] = useState("20");
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const lastMinuteHeightRef = useRef(minuteHeight);
  const scrollInitRef = useRef(false);

  const { data: servicesData, isLoading: servicesLoading, mutate: mutateServices } = useSWR<{
    ok: boolean;
    items: ServiceItem[];
  }>("/api/organizacao/servicos", fetcher);
  const { data: orgData, mutate: mutateOrg } = useSWR<{
    ok: boolean;
    organization?: {
      reservationAssignmentMode?: string | null;
      timezone?: string | null;
      modules?: string[] | null;
      primaryModule?: string | null;
    };
    membershipRole?: string | null;
  }>(orgMeUrl, fetcher);

  const services = servicesData?.items ?? [];
  const activeServices = services.filter((service) => service.isActive);
  const selectedCreateService =
    activeServices.find((service) => service.id === createServiceId) ?? null;
  const hasCourtServices = services.some((service) => service.kind === "COURT");
  const hasNonCourtServices = services.some((service) => service.kind !== "COURT");

  const assignmentMode = orgData?.organization?.reservationAssignmentMode ?? "PROFESSIONAL";
  const canFilterByResource = assignmentMode === "RESOURCE" && hasCourtServices;
  const canFilterByProfessional = assignmentMode === "PROFESSIONAL" || hasNonCourtServices;
  const hasHybridFilters = canFilterByResource && canFilterByProfessional;
  const [filterMode, setFilterMode] = useState<ReservationAssignmentMode>(() =>
    canFilterByResource && assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL",
  );
  const createAssignmentConfig = useMemo(
    () =>
      resolveServiceAssignmentMode({
        organizationMode: assignmentMode,
        serviceKind: selectedCreateService?.kind ?? null,
      }),
    [assignmentMode, selectedCreateService?.kind],
  );
  const createAssignmentMode = createAssignmentConfig.mode;
  const timezone = orgData?.organization?.timezone ?? "Europe/Lisbon";
  const membershipRole = orgData?.membershipRole ?? null;
  const isStaffMember = membershipRole === "STAFF";

  useEffect(() => {
    if (!drawerBooking) {
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleError(null);
      return;
    }
    const start = new Date(drawerBooking.startsAt);
    setRescheduleDate(formatInputDate(start, timezone));
    setRescheduleTime(formatInputTime(start, timezone));
    setRescheduleError(null);
  }, [drawerBooking, timezone]);

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

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (assignmentMode === "RESOURCE" && canFilterByResource) {
      setFilterMode("RESOURCE");
      return;
    }
    if (canFilterByProfessional) {
      setFilterMode("PROFESSIONAL");
      return;
    }
    if (canFilterByResource) {
      setFilterMode("RESOURCE");
    }
  }, [assignmentMode, canFilterByProfessional, canFilterByResource]);

  useEffect(() => {
    if (initializedRef.current) return;
    const professionalIdRaw = searchParams.get("professionalId");
    const resourceIdRaw = searchParams.get("resourceId");
    const parsedProfessionalId = professionalIdRaw ? Number(professionalIdRaw) : NaN;
    const parsedResourceId = resourceIdRaw ? Number(resourceIdRaw) : NaN;
    const hasProfessionalId = Number.isFinite(parsedProfessionalId);
    const hasResourceId = Number.isFinite(parsedResourceId);

    if (hasProfessionalId && canFilterByProfessional) {
      setSelectedProfessionalId(parsedProfessionalId);
    }
    if (hasResourceId && canFilterByResource) {
      setSelectedResourceId(parsedResourceId);
    }

    if (hasProfessionalId && hasResourceId) {
      if (assignmentMode === "PROFESSIONAL" && canFilterByProfessional) {
        setFilterMode("PROFESSIONAL");
      } else if (canFilterByResource) {
        setFilterMode("RESOURCE");
      }
    } else if (hasProfessionalId && canFilterByProfessional) {
      setFilterMode("PROFESSIONAL");
    } else if (hasResourceId && canFilterByResource) {
      setFilterMode("RESOURCE");
    }

    initializedRef.current = true;
  }, [assignmentMode, canFilterByProfessional, canFilterByResource, searchParams]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    setCalendarTab(tab === "availability" ? "availability" : "agenda");
    const view = searchParams.get("view");
    if (view === "day" || view === "week") {
      setCalendarView(view);
    }
  }, [searchParams]);

  useEffect(() => {
    scrollInitRef.current = false;
  }, [calendarTab, calendarView]);

  useEffect(() => {
    if (!hydrated) return;
    const container = calendarScrollRef.current;
    if (!container) return;
    if (!scrollInitRef.current) {
      container.scrollTop = DEFAULT_VIEW_START_HOUR * hourHeight;
      scrollInitRef.current = true;
    }
  }, [calendarTab, calendarView, hourHeight, hydrated]);

  useEffect(() => {
    const container = calendarScrollRef.current;
    if (!container) return;
    const previous = lastMinuteHeightRef.current;
    if (previous && previous !== minuteHeight) {
      const minutes = container.scrollTop / previous;
      container.scrollTop = minutes * minuteHeight;
    }
    lastMinuteHeightRef.current = minuteHeight;
  }, [minuteHeight]);

  useEffect(() => {
    const createParam = searchParams.get("create");
    if (createParam === "service") {
      if (serviceInitRef.current) return;
      openServiceDrawer();
      serviceInitRef.current = true;
      return;
    }
    serviceInitRef.current = false;
  }, [searchParams]);

  useEffect(() => {
    if (!createSlot) return;
    if (!createServiceId && activeServices.length) {
      setCreateServiceId(activeServices[0].id);
    }
  }, [activeServices, createServiceId, createSlot]);

  useEffect(() => {
    if (!selectedCreateService) {
      setCreateLocationText("");
      return;
    }
    if (selectedCreateService.locationMode === "CHOOSE_AT_BOOKING") {
      setCreateLocationText(selectedCreateService.defaultLocationText ?? "");
      return;
    }
    setCreateLocationText("");
  }, [selectedCreateService?.id]);

  useEffect(() => {
    if (!createSlot) return;
    const query = clientQuery.trim();
    if (query.length < 2) {
      setClientResults([]);
      setClientLoading(false);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setClientLoading(true);
      try {
        const res = await fetch(
          `/api/organizacao/reservas/clientes?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setClientResults(Array.isArray(json.items) ? json.items : []);
        } else {
          setClientResults([]);
        }
      } catch {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [clientQuery, createSlot]);

  const calendarStart = useMemo(() => {
    return calendarView === "week" ? getWeekStart(focusDate, timezone) : buildZonedDate(getDateParts(focusDate, timezone), timezone, 0, 0);
  }, [calendarView, focusDate, timezone]);

  const calendarDays = useMemo(() => {
    const count = calendarView === "week" ? 7 : 1;
    const startParts = getDateParts(calendarStart, timezone);
    return Array.from({ length: count }, (_, idx) =>
      buildZonedDate(addDaysToParts(startParts, idx), timezone, 0, 0),
    );
  }, [calendarStart, calendarView, timezone]);
  const placeholderDays = useMemo(
    () =>
      Array.from({ length: calendarView === "week" ? 7 : 1 }, () => PLACEHOLDER_DAY),
    [calendarView],
  );
  const calendarDaysToRender = hydrated ? calendarDays : placeholderDays;

  const rangeStartIso = calendarStart.toISOString();
  const rangeEndIso = useMemo(() => {
    const startParts = getDateParts(calendarStart, timezone);
    const endParts = addDaysToParts(startParts, calendarView === "week" ? 7 : 1);
    return buildZonedDate(endParts, timezone, 0, 0).toISOString();
  }, [calendarStart, calendarView, timezone]);

  const { data: bookingsData, isLoading: bookingsLoading, mutate: mutateBookings } = useSWR<
    { ok: boolean; items: BookingItem[] }
  >(`/api/organizacao/reservas?from=${encodeURIComponent(rangeStartIso)}&to=${encodeURIComponent(rangeEndIso)}`, fetcher);

  const upcomingRange = useMemo(() => {
    const todayParts = getDateParts(new Date(), timezone);
    const start = buildZonedDate(todayParts, timezone, 0, 0);
    const end = buildZonedDate(addDaysToParts(todayParts, 14), timezone, 0, 0);
    return { start, end };
  }, [timezone]);
  const { data: upcomingData, isLoading: upcomingLoading, mutate: mutateUpcoming } = useSWR<{
    ok: boolean;
    items: BookingItem[];
  }>(
    `/api/organizacao/reservas?from=${encodeURIComponent(upcomingRange.start.toISOString())}&to=${encodeURIComponent(
      upcomingRange.end.toISOString(),
    )}`,
    fetcher,
  );

  const shouldLoadProfessionals = canFilterByProfessional;
  const shouldLoadResources = canFilterByResource;

  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    shouldLoadProfessionals ? "/api/organizacao/reservas/profissionais" : null,
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    shouldLoadResources ? "/api/organizacao/reservas/recursos" : null,
    fetcher,
  );

  const bookings = bookingsData?.items ?? [];
  const professionals = professionalsData?.items ?? [];
  const resources = resourcesData?.items ?? [];
  const activeProfessionals = professionals.filter((professional) => professional.isActive);
  const activeResources = resources.filter((resource) => resource.isActive);
  const selectedServiceProfessionalIds = selectedCreateService?.professionalLinks?.map((link) => link.professionalId) ?? [];
  const selectedServiceResourceIds = selectedCreateService?.resourceLinks?.map((link) => link.resourceId) ?? [];
  const hasServiceProfessionalLinks = selectedServiceProfessionalIds.length > 0;
  const hasServiceResourceLinks = selectedServiceResourceIds.length > 0;
  const availableProfessionalsForService = hasServiceProfessionalLinks
    ? activeProfessionals.filter((professional) => selectedServiceProfessionalIds.includes(professional.id))
    : activeProfessionals;
  const availableResourcesForService = hasServiceResourceLinks
    ? activeResources.filter((resource) => selectedServiceResourceIds.includes(resource.id))
    : activeResources;

  const delayScope = useMemo(() => {
    if (filterMode === "RESOURCE" && selectedResourceId) {
      const label = resources.find((resource) => resource.id === selectedResourceId)?.label ?? "Recurso";
      return { scopeType: "RESOURCE", scopeId: selectedResourceId, label };
    }
    if (filterMode === "PROFESSIONAL" && selectedProfessionalId) {
      const label = professionals.find((professional) => professional.id === selectedProfessionalId)?.name ?? "Profissional";
      return { scopeType: "PROFESSIONAL", scopeId: selectedProfessionalId, label };
    }
    return { scopeType: "ORGANIZATION", scopeId: 0, label: "Organização" };
  }, [filterMode, selectedProfessionalId, selectedResourceId, professionals, resources]);

  const delayKey =
    organizationId && Number.isFinite(organizationId)
      ? `/api/organizacao/reservas/delays?scopeType=${delayScope.scopeType}&scopeId=${delayScope.scopeId}&organizationId=${organizationId}`
      : null;
  const { data: delayData, mutate: mutateDelay } = useSWR<{ ok: boolean; delay: { id: number; delayMinutes: number; reason: string | null; effectiveFrom: string } | null }>(
    delayKey,
    fetcher,
  );
  const activeDelay = delayData?.delay ?? null;

  useEffect(() => {
    if (!isStaffMember) return;
    if (filterMode !== "PROFESSIONAL") return;
    if (!selectedProfessionalId && activeProfessionals.length) {
      setSelectedProfessionalId(activeProfessionals[0].id);
    }
  }, [isStaffMember, filterMode, selectedProfessionalId, activeProfessionals]);

  useEffect(() => {
    if (!activeDelay) {
      setDelayMinutesDraft("0");
      setDelayReasonDraft("");
      return;
    }
    setDelayMinutesDraft(String(activeDelay.delayMinutes ?? 0));
    setDelayReasonDraft(activeDelay.reason ?? "");
  }, [activeDelay?.id, delayScope.scopeType, delayScope.scopeId]);

  useEffect(() => {
    if (!selectedCreateService) return;
    if (createAssignmentMode === "PROFESSIONAL") {
      if (
        createProfessionalId &&
        !availableProfessionalsForService.some((professional) => professional.id === createProfessionalId)
      ) {
        setCreateProfessionalId(null);
      }
    }
    if (createAssignmentMode === "RESOURCE") {
      if (
        createResourceId &&
        !availableResourcesForService.some((resource) => resource.id === createResourceId)
      ) {
        setCreateResourceId(null);
      }
    }
  }, [
    createAssignmentMode,
    availableProfessionalsForService,
    availableResourcesForService,
    createProfessionalId,
    createResourceId,
    selectedCreateService?.id,
  ]);

  useEffect(() => {
    if (createAssignmentMode !== "RESOURCE") return;
    const selectedResource = availableResourcesForService.find((resource) => resource.id === createResourceId);
    if (selectedResource && !createPartySize) {
      setCreatePartySize(String(selectedResource.capacity));
    }
  }, [createAssignmentMode, availableResourcesForService, createResourceId, createPartySize]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const bookingMode = getBookingMode(booking);
      if (bookingMode !== filterMode) return false;
      if (filterMode === "PROFESSIONAL" && selectedProfessionalId) {
        return booking.professional?.id === selectedProfessionalId;
      }
      if (filterMode === "RESOURCE" && selectedResourceId) {
        return booking.resource?.id === selectedResourceId;
      }
      return true;
    });
  }, [filterMode, bookings, selectedProfessionalId, selectedResourceId]);

  const availabilityScope = useMemo(() => {
    if (filterMode === "PROFESSIONAL") {
      const resolvedProfessionalId =
        selectedProfessionalId ?? (isStaffMember ? activeProfessionals[0]?.id ?? null : null);
      if (resolvedProfessionalId) {
        return {
          scopeType: "PROFESSIONAL" as const,
          scopeId: resolvedProfessionalId,
          title: "Disponibilidade do profissional",
          subtitle: "Ajusta os blocos do colaborador selecionado.",
        };
      }
    }
    if (filterMode === "RESOURCE" && selectedResourceId) {
      return {
        scopeType: "RESOURCE" as const,
        scopeId: selectedResourceId,
        title: "Disponibilidade do recurso",
        subtitle: "Ajusta os blocos do recurso selecionado.",
      };
    }
    return {
      scopeType: "ORGANIZATION" as const,
      scopeId: null,
      title: "Disponibilidade semanal",
      subtitle: "Define os blocos base da agenda.",
    };
  }, [filterMode, selectedProfessionalId, selectedResourceId, isStaffMember, activeProfessionals]);

  const calendarStartHour = CALENDAR_FULL_START_HOUR;
  const calendarEndHour = CALENDAR_FULL_END_HOUR;
  const calendarViewportHeight = hourHeight * DEFAULT_VIEW_HOURS;

  const bookingsByDay = useMemo(() => {
    if (!hydrated) return new Map<string, PositionedBooking[]>();
    const map = new Map<string, PositionedBooking[]>();
    calendarDays.forEach((day) => {
      const dayKey = getDayKey(day, timezone);
      const dayBookings = filteredBookings.filter((booking) =>
        isSameDay(new Date(booking.startsAt), day, timezone),
      );
      map.set(
        dayKey,
        buildBookingPositions(dayBookings, timezone, calendarStartHour, calendarEndHour, minuteHeight),
      );
    });
    return map;
  }, [calendarDays, filteredBookings, timezone, calendarStartHour, calendarEndHour, hydrated, minuteHeight]);

  const now = hydrated ? new Date() : PLACEHOLDER_DAY;
  const isTodayInView = hydrated && calendarDays.some((day) => isSameDay(day, now, timezone));
  const nowTimeParts = hydrated ? getTimeParts(now, timezone) : { hour: 0, minute: 0 };
  const todayTop = hydrated
    ? (nowTimeParts.hour * 60 + nowTimeParts.minute - calendarStartHour * 60) * minuteHeight
    : 0;

  const upcomingBookings = useMemo(() => {
    const items = (upcomingData?.items ?? []).filter((booking) => {
      const bookingMode = getBookingMode(booking);
      if (bookingMode !== filterMode) return false;
      if (filterMode === "PROFESSIONAL" && selectedProfessionalId) {
        return booking.professional?.id === selectedProfessionalId;
      }
      if (filterMode === "RESOURCE" && selectedResourceId) {
        return booking.resource?.id === selectedResourceId;
      }
      return true;
    });
    return items
      .filter((booking) => new Date(booking.startsAt) >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 6);
  }, [filterMode, now, selectedProfessionalId, selectedResourceId, upcomingData?.items]);

  const activeServiceCount = activeServices.length;
  const confirmedRevenueCents = bookings.reduce(
    (sum, booking) => (["CONFIRMED", "COMPLETED"].includes(booking.status) ? sum + booking.price : sum),
    0,
  );
  const pendingBookings = bookings.filter((booking) =>
    ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status),
  ).length;

  const rangeLabel = hydrated
    ? calendarView === "day"
      ? formatLongDate(calendarStart, timezone)
      : `${formatRangeDate(calendarStart, timezone)} — ${formatRangeDate(
          buildZonedDate(addDaysToParts(getDateParts(calendarStart, timezone), 6), timezone, 0, 0),
          timezone,
        )}`
    : "—";

  const drawerBookingClosed = drawerBooking
    ? ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(
        drawerBooking.status,
      )
    : false;
  const drawerBookingStarted = drawerBooking ? new Date(drawerBooking.startsAt) <= new Date() : false;
  const canMarkNoShow =
    !!drawerBooking &&
    !drawerBookingClosed &&
    ["CONFIRMED", "PENDING_CONFIRMATION", "PENDING"].includes(drawerBooking.status) &&
    drawerBookingStarted;
  const inviteSummary = useMemo(() => {
    const fallback = { total: 0, accepted: 0, declined: 0, pending: 0 };
    if (!drawerBooking) return fallback;
    if (drawerBooking.inviteSummary) return drawerBooking.inviteSummary;
    const invites = participantsData?.invites ?? [];
    return invites.reduce(
      (acc, invite) => {
        if (invite.status === "ACCEPTED") acc.accepted += 1;
        else if (invite.status === "DECLINED") acc.declined += 1;
        else acc.pending += 1;
        acc.total += 1;
        return acc;
      },
      { ...fallback },
    );
  }, [drawerBooking, participantsData?.invites]);
  const participantSummary = useMemo(() => {
    const fallback = { total: 0, confirmed: 0, cancelled: 0 };
    if (!drawerBooking) return fallback;
    if (drawerBooking.participantSummary) return drawerBooking.participantSummary;
    const participants = participantsData?.participants ?? [];
    return participants.reduce(
      (acc, participant) => {
        if (participant.status === "CONFIRMED") acc.confirmed += 1;
        else acc.cancelled += 1;
        acc.total += 1;
        return acc;
      },
      { ...fallback },
    );
  }, [drawerBooking, participantsData?.participants]);

  const handleShiftRange = (direction: -1 | 1) => {
    const delta = calendarView === "week" ? 7 : 1;
    const baseParts = getDateParts(focusDate, timezone);
    const nextParts = addDaysToParts(baseParts, delta * direction);
    setFocusDate(buildZonedDate(nextParts, timezone, 12, 0));
  };

  const handleModeChange = async (mode: "PROFESSIONAL" | "RESOURCE") => {
    if (modeSaving || assignmentMode === mode) return;
    setModeSaving(mode);
    try {
      if (!organizationId || Number.isNaN(organizationId)) {
        throw new Error("Seleciona uma organização primeiro.");
      }
      const res = await fetch(`/api/organizacao/me?organizationId=${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationAssignmentMode: mode }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar modo.");
      }
      setSelectedProfessionalId(null);
      setSelectedResourceId(null);
      mutateOrg();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar modo.";
      alert(message);
    } finally {
      setModeSaving(null);
    }
  };

  const handleCancel = async (bookingId: number) => {
    if (cancelingId) return;
    const confirmed = window.confirm("Cancelar reserva? O reembolso segue a politica definida.");
    if (!confirmed) return;

    setCancelingId(bookingId);
    try {
      const res = await fetch(`/api/organizacao/reservas/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao cancelar reserva.");
      }
      mutateBookings();
      if (json.booking) {
        setDrawerBooking((prev) => (prev ? { ...prev, ...json.booking } : prev));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar reserva.";
      alert(message);
    } finally {
      setCancelingId(null);
    }
  };

  const handleReschedule = async () => {
    if (!drawerBooking || rescheduleBusy) return;
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError("Indica data e hora.");
      return;
    }
    const [year, month, day] = rescheduleDate.split("-").map((part) => Number(part));
    const [hour, minute] = rescheduleTime.split(":").map((part) => Number(part));
    if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      setRescheduleError("Data ou hora inválida.");
      return;
    }
    const startsAt = makeUtcDateFromLocal({ year, month, day, hour, minute }, timezone);
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      setRescheduleError("Data inválida.");
      return;
    }
    setRescheduleBusy(true);
    setRescheduleError(null);
    try {
      const res = await fetch(`/api/organizacao/reservas/${drawerBooking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: startsAt.toISOString() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao reagendar reserva.");
      }
      mutateBookings();
      if (json.booking) {
        setDrawerBooking((prev) => (prev ? { ...prev, ...json.booking } : prev));
      }
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "Erro ao reagendar reserva.");
    } finally {
      setRescheduleBusy(false);
    }
  };

  const handleDelaySave = async (overrideMinutes?: number) => {
    if (!organizationId || !Number.isFinite(organizationId)) return;
    setDelaySaving(true);
    setDelayError(null);
    try {
      const delayMinutes = Number.isFinite(Number(overrideMinutes))
        ? Math.max(0, Math.round(Number(overrideMinutes)))
        : Math.max(0, Math.round(Number(delayMinutesDraft)));
      const res = await fetch("/api/organizacao/reservas/delays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: delayScope.scopeType,
          scopeId: delayScope.scopeId,
          delayMinutes,
          reason: delayReasonDraft.trim(),
          notify: delayNotify,
          notifyWindowHours: Number(delayNotifyWindow) || 24,
          organizationId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.delay) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar atraso.");
      }
      await mutateDelay();
      await mutateBookings();
      await mutateUpcoming();
    } catch (err) {
      setDelayError(err instanceof Error ? err.message : "Erro ao atualizar atraso.");
    } finally {
      setDelaySaving(false);
    }
  };

  const handleNoShow = async (bookingId: number) => {
    if (noShowBusy) return;
    const confirmed = window.confirm("Marcar como no-show? O cliente será notificado.");
    if (!confirmed) return;
    setNoShowBusy(true);
    try {
      const res = await fetch(`/api/organizacao/reservas/${bookingId}/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar reserva.");
      }
      mutateBookings();
      if (json.booking) {
        setDrawerBooking((prev) => (prev ? { ...prev, ...json.booking } : prev));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar reserva.";
      alert(message);
    } finally {
      setNoShowBusy(false);
    }
  };

  const closeCreateDrawer = () => {
    setCreateSlot(null);
    setCreateServiceId(null);
    setCreateClient(null);
    setClientQuery("");
    setClientResults([]);
    setCreateProfessionalId(null);
    setCreateResourceId(null);
    setCreatePartySize("");
    setCreateLocationText("");
    setCreateError(null);
    setCreateLoading(false);
    setCheckout(null);
    setPaymentError(null);
    setServiceDrawerOpen(false);
  };

  const closeServiceDrawer = () => {
    setServiceDrawerOpen(false);
    setServiceSaving(false);
    setServiceError(null);
    setServiceTitle("");
    setServiceDescription("");
    setServiceDuration("60");
    setServicePrice("20");
  };

  const openServiceDrawer = () => {
    setDrawerBooking(null);
    setCreateSlot(null);
    setCreateServiceId(null);
    setCheckout(null);
    setPaymentError(null);
    setCreateError(null);
    setServiceSaving(false);
    setServiceError(null);
    setServiceDrawerOpen(true);
  };

  const handleCreateService = async () => {
    if (serviceSaving) return;
    const title = serviceTitle.trim();
    if (!title) {
      setServiceError("Indica um título.");
      return;
    }
    const durationValue = Number(serviceDuration);
    if (!SERVICE_DURATION_OPTIONS.includes(durationValue)) {
      setServiceError("Seleciona a duração.");
      return;
    }
    const priceValue = Number(servicePrice.replace(",", "."));
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setServiceError("Preço inválido.");
      return;
    }
    setServiceSaving(true);
    setServiceError(null);
    try {
      const res = await fetch("/api/organizacao/servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: serviceDescription.trim() || null,
          durationMinutes: durationValue,
          unitPriceCents: Math.round(priceValue * 100),
          currency: "EUR",
          categoryTag: null,
          locationMode: "FIXED",
          defaultLocationText: null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao criar serviço.");
      }
      closeServiceDrawer();
      setCreateServiceId(json.service?.id ?? null);
      mutateServices();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "Erro ao criar serviço.");
    } finally {
      setServiceSaving(false);
    }
  };

  const openCreateDrawer = (startsAt: Date) => {
    if (!servicesLoading && activeServices.length === 0) {
      openServiceDrawer();
      return;
    }
    const initialServiceId = activeServices[0]?.id ?? null;
    const initialServiceKind =
      initialServiceId != null
        ? activeServices.find((service) => service.id === initialServiceId)?.kind ?? null
        : null;
    const initialAssignmentMode = resolveServiceAssignmentMode({
      organizationMode: assignmentMode,
      serviceKind: initialServiceKind,
    }).mode;
    setDrawerBooking(null);
    setServiceDrawerOpen(false);
    setCreateSlot(startsAt);
    setCreateServiceId(initialServiceId);
    setCreateClient(null);
    setClientQuery("");
    setClientResults([]);
    setCreateProfessionalId(initialAssignmentMode === "PROFESSIONAL" ? selectedProfessionalId : null);
    setCreateResourceId(initialAssignmentMode === "RESOURCE" ? selectedResourceId : null);
    const selectedResource = activeResources.find((resource) => resource.id === selectedResourceId);
    setCreatePartySize(
      initialAssignmentMode === "RESOURCE" ? String(selectedResource?.capacity ?? "") : "",
    );
    setCreateLocationText("");
    setCreateError(null);
    setCheckout(null);
    setPaymentError(null);
  };

  const handleEmptySlotClick = (event: MouseEvent<HTMLDivElement>, day: Date) => {
    if (calendarTab !== "agenda") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-booking]")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const totalMinutes = (calendarEndHour - calendarStartHour) * 60;
    let minutes = Math.floor(offsetY / minuteHeight);
    minutes = Math.max(0, Math.min(totalMinutes - 15, minutes));
    minutes = Math.floor(minutes / 15) * 15;
    const hour = calendarStartHour + Math.floor(minutes / 60);
    const minute = minutes % 60;
    const dayParts = getDateParts(day, timezone);
    const startsAt = makeUtcDateFromLocal({ ...dayParts, hour, minute }, timezone);
    if (startsAt <= new Date()) return;
    openCreateDrawer(startsAt);
  };

  const handleCreateBooking = async () => {
    if (createLoading) return;
    if (!createSlot) {
      setCreateError("Seleciona um horário válido.");
      return;
    }
    if (!selectedCreateService) {
      setCreateError("Seleciona um serviço.");
      return;
    }
    if (!createClient) {
      setCreateError("Seleciona um cliente.");
      return;
    }
    const parsedPartySize = createAssignmentMode === "RESOURCE" ? Number(createPartySize) : null;
    if (
      createAssignmentMode === "RESOURCE" &&
      (!Number.isFinite(parsedPartySize) || (parsedPartySize ?? 0) <= 0)
    ) {
      setCreateError("Capacidade obrigatória.");
      return;
    }
    if (
      selectedCreateService.locationMode === "CHOOSE_AT_BOOKING" &&
      !createLocationText.trim()
    ) {
      setCreateError("Local obrigatório para esta marcação.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    setPaymentError(null);

    try {
      const payload = {
        serviceId: selectedCreateService.id,
        startsAt: createSlot.toISOString(),
        userId: createClient.id,
        professionalId: createAssignmentMode === "PROFESSIONAL" ? createProfessionalId : null,
        resourceId: createAssignmentMode === "RESOURCE" ? createResourceId : null,
        partySize: createAssignmentMode === "RESOURCE" ? parsedPartySize : null,
        locationText:
          selectedCreateService.locationMode === "CHOOSE_AT_BOOKING"
            ? createLocationText.trim()
            : null,
      };

      const res = await fetch("/api/organizacao/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errorMsg =
          json?.error === "PHONE_REQUIRED"
            ? "O cliente precisa de telemóvel no perfil para reservar."
            : json?.message || json?.error || "Erro ao criar reserva.";
        setCreateError(errorMsg);
        return;
      }

      const bookingId = json.booking?.id;
      if (!bookingId) {
        setCreateError("Reserva criada mas sem ID.");
        return;
      }

      mutateBookings();

      const checkoutRes = await fetch(`/api/organizacao/reservas/${bookingId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const checkoutJson = await checkoutRes.json().catch(() => null);
      if (!checkoutRes.ok || !checkoutJson?.ok) {
        throw new Error(checkoutJson?.message || checkoutJson?.error || "Erro ao iniciar checkout.");
      }

      setCheckout({
        clientSecret: checkoutJson.clientSecret,
        paymentIntentId: checkoutJson.paymentIntentId,
        amountCents: checkoutJson.amountCents,
        currency: checkoutJson.currency,
        bookingId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao iniciar checkout.";
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePaymentConfirmed = () => {
    setCheckout(null);
    setPaymentError(null);
    setCreateError(null);
    mutateBookings();
    mutateUpcoming();
    closeCreateDrawer();
  };

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={DASHBOARD_LABEL}>Reservas</p>
            <h1 className={DASHBOARD_TITLE}>Agenda</h1>
            <p className={DASHBOARD_MUTED}>Gestão central de marcações, serviços e disponibilidade.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={CTA_PRIMARY} onClick={openServiceDrawer}>
              Novo serviço
            </button>
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "p-3 flex flex-wrap items-center justify-between gap-3")}> 
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={CHIP_BASE}
              onClick={() => {
                const todayParts = getDateParts(new Date(), timezone);
                setFocusDate(buildZonedDate(todayParts, timezone, 12, 0));
              }}
            >
              Hoje
            </button>
            <button
              type="button"
              className={CHIP_BASE}
              onClick={() => handleShiftRange(-1)}
              title="Anterior"
              aria-label="Anterior"
            >
              ←
            </button>
            <button
              type="button"
              className={CHIP_BASE}
              onClick={() => handleShiftRange(1)}
              title="Seguinte"
              aria-label="Seguinte"
            >
              →
            </button>
            <span className="text-sm font-semibold text-white/90">{rangeLabel}</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">Fuso: {timezone}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {calendarTab === "agenda" && (
              <>
                <button
                  type="button"
                  onClick={() => setCalendarView("day")}
                  className={cn(
                    CHIP_BASE,
                    calendarView === "day" && CHIP_ACTIVE,
                  )}
                >
                  Dia
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarView("week")}
                  className={cn(
                    CHIP_BASE,
                    calendarView === "week" && CHIP_ACTIVE,
                  )}
                >
                  Semana
                </button>
              </>
            )}
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Zoom</span>
              <input
                type="range"
                min={MIN_HOUR_HEIGHT}
                max={MAX_HOUR_HEIGHT}
                step={4}
                value={hourHeight}
                onChange={(event) => setHourHeight(normalizeHourHeight(Number(event.target.value)))}
                className="h-1 w-24 cursor-pointer accent-white/70"
                aria-label="Zoom do calendário"
              />
            </div>
          </div>

          {isStaffMember ? (
            <div className="text-[12px] text-white/60">
              Modo: {assignmentMode === "RESOURCE" ? "Recurso" : "Profissional"}
              {hasHybridFilters && (
                <span className="text-white/40"> | Vista: {filterMode === "RESOURCE" ? "Recursos" : "Profissionais"}</span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Modo</span>
              <button
                type="button"
                onClick={() => handleModeChange("PROFESSIONAL")}
                className={cn(
                  CHIP_BASE,
                  assignmentMode === "PROFESSIONAL" && CHIP_ACTIVE,
                )}
              >
                Profissional
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("RESOURCE")}
                className={cn(
                  CHIP_BASE,
                  assignmentMode === "RESOURCE" && CHIP_ACTIVE,
                )}
              >
                Recurso
              </button>
              {modeSaving && <span className="text-[11px] text-white/60">A guardar...</span>}
            </div>
          )}
        </div>

        {(canFilterByProfessional || canFilterByResource) && (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
            {hasHybridFilters && (
              <>
                <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Vista</span>
                <button
                  type="button"
                  onClick={() => setFilterMode("PROFESSIONAL")}
                  className={cn(
                    CHIP_BASE,
                    filterMode === "PROFESSIONAL" && CHIP_ACTIVE,
                  )}
                >
                  Profissionais
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("RESOURCE")}
                  className={cn(
                    CHIP_BASE,
                    filterMode === "RESOURCE" && CHIP_ACTIVE,
                  )}
                >
                  Recursos
                </button>
              </>
            )}
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Filtrar</span>
            {!isStaffMember && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProfessionalId(null);
                  setSelectedResourceId(null);
                }}
                className={cn(
                  CHIP_BASE,
                  (filterMode === "PROFESSIONAL" ? !selectedProfessionalId : !selectedResourceId) && CHIP_ACTIVE,
                )}
              >
                Todos
              </button>
            )}
            {filterMode === "PROFESSIONAL" &&
              (activeProfessionals.length === 0 ? (
                <span className="text-white/40">Sem profissionais ativos.</span>
              ) : (
                activeProfessionals.map((professional) => (
                  <button
                    key={professional.id}
                    type="button"
                    onClick={() => setSelectedProfessionalId(professional.id)}
                    className={cn(
                      CHIP_BASE,
                      selectedProfessionalId === professional.id && CHIP_ACTIVE,
                    )}
                  >
                    {professional.name}
                  </button>
                ))
              ))}
            {filterMode === "RESOURCE" &&
              (activeResources.length === 0 ? (
                <span className="text-white/40">Sem recursos configurados.</span>
              ) : (
                activeResources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => setSelectedResourceId(resource.id)}
                    className={cn(
                      CHIP_BASE,
                      selectedResourceId === resource.id && CHIP_ACTIVE,
                    )}
                  >
                    {resource.label} · {resource.capacity}
                  </button>
                ))
              ))}
          </div>
        )}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className={cn(calendarTab === "availability" ? "" : DASHBOARD_CARD, calendarTab === "availability" ? "" : "p-4")}> 
          {calendarTab === "availability" ? (
            <AvailabilityEditor
              scopeType={availabilityScope.scopeType}
              scopeId={availabilityScope.scopeId ?? undefined}
              title={availabilityScope.title}
              subtitle={availabilityScope.subtitle}
              hourHeight={hourHeight}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                <h2 className="text-sm font-semibold text-white/90 tracking-[0.02em]">Calendário</h2>
                  <p className={DASHBOARD_MUTED}>
                    Arrasta para explorar a semana. Visível 09:00–19:00 (scroll para o resto do dia).
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/55">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Confirmada
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      Pendente
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      Cancelada/Conflito
                    </span>
                  </div>
                </div>
                <div className="text-[12px] text-white/60">
                  {bookingsLoading ? "A carregar..." : `${filteredBookings.length} reservas visíveis`}
                </div>
              </div>

              <div className="rounded-2xl border border-white/12 bg-[linear-gradient(165deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))] shadow-[0_30px_90px_rgba(3,8,20,0.55)] backdrop-blur-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[840px]">
                    <div
                      className="grid gap-1 sticky top-0 z-30 border-b border-white/10 bg-[rgba(6,10,20,0.86)] backdrop-blur-xl"
                      style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}
                    >
                      <div className="sticky left-0 z-30 h-11 rounded-tl-2xl border-r border-white/10 bg-[rgba(6,10,20,0.86)] backdrop-blur-xl" />
                      <div className={cn("grid gap-1", calendarView === "week" ? "grid-cols-7" : "grid-cols-1")}>
                        {calendarDaysToRender.map((day, idx) => {
                          const isToday = hydrated && isSameDay(day, now, timezone);
                          const label = hydrated
                            ? new Intl.DateTimeFormat("pt-PT", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                timeZone: timezone,
                              }).format(day)
                            : "—";
                          return (
                            <div
                              key={`header-${idx}`}
                              className={cn(
                                "flex h-11 items-center justify-center rounded-t-lg rounded-b-none border border-white/10 border-b-0 bg-white/[0.06] px-3 py-0 text-[11px] font-semibold text-white/70 shadow-[0_10px_26px_rgba(0,0,0,0.22)]",
                                isToday
                                  ? "border-[#6BFFFF]/30 bg-[linear-gradient(135deg,rgba(107,255,255,0.24),rgba(106,123,255,0.14))] text-white"
                                  : "hover:border-white/15 hover:text-white/80",
                              )}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      ref={calendarScrollRef}
                      className="overflow-y-auto orya-scrollbar-hide"
                      style={{ height: calendarViewportHeight, maxHeight: "calc(100vh - 320px)" }}
                    >
                      <div className="grid gap-1" style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}>
                        <div
                          className="sticky left-0 z-20 relative border-r border-white/8 bg-[rgba(6,10,20,0.7)] backdrop-blur-xl"
                          style={{
                            height: (calendarEndHour - calendarStartHour) * hourHeight,
                            backgroundImage:
                              "linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                            backgroundSize: `100% ${hourHeight / 4}px, 100% ${hourHeight}px`,
                            backgroundPosition: "0 0, 0 0",
                          }}
                        >
                          {Array.from({ length: calendarEndHour - calendarStartHour }, (_, idx) => {
                            const hour = calendarStartHour + idx;
                            const top = (hour - calendarStartHour) * hourHeight;
                            const labelClass =
                              hour === calendarStartHour
                                ? "absolute right-2 text-[10px] font-mono leading-none tracking-[0.12em] text-white/40"
                                : "absolute right-2 -translate-y-1/2 text-[10px] font-mono leading-none tracking-[0.12em] text-white/40";
                            return (
                              <div
                                key={`time-${hour}`}
                                className={labelClass}
                                style={{ top }}
                              >
                                {String(hour).padStart(2, "0")}:00
                              </div>
                            );
                          })}
                        </div>

                        <div className={cn("grid gap-1", calendarView === "week" ? "grid-cols-7" : "grid-cols-1")}>
                          {calendarDaysToRender.map((day, idx) => {
                            const dayKey = getDayKey(day, timezone);
                            const positions = bookingsByDay.get(dayKey) ?? [];
                            const isToday = hydrated && isSameDay(day, now, timezone);
                            return (
                              <div
                                key={`day-${idx}`}
                                className={cn(
                                  "relative rounded-b-xl rounded-t-none border border-white/10 border-t-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                                  "cursor-pointer",
                                  isToday && "ring-1 ring-inset ring-[#6BFFFF]/20",
                                )}
                                style={{
                                  height: (calendarEndHour - calendarStartHour) * hourHeight,
                                  backgroundImage:
                                    "linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
                                  backgroundSize: `100% ${hourHeight / 4}px, 100% ${hourHeight}px`,
                                  backgroundPosition: "0 0, 0 0",
                                }}
                                onClick={(event) => handleEmptySlotClick(event, day)}
                              >
                                {isToday && (
                                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(180deg,rgba(107,255,255,0.08),rgba(106,123,255,0.02),rgba(106,123,255,0.01))]" />
                                )}
                                {hydrated &&
                                  isToday &&
                                  isTodayInView &&
                                  todayTop >= 0 &&
                                  todayTop <= (calendarEndHour - calendarStartHour) * hourHeight && (
                                    <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center gap-2" style={{ top: todayTop }}>
                                      <span className="h-[1px] flex-1 bg-red-400/70" />
                                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                                        Agora
                                      </span>
                                    </div>
                                  )}
                                {positions.map((item) => {
                                  const start = new Date(item.booking.startsAt);
                                  const end = new Date(start.getTime() + item.booking.durationMinutes * 60000);
                                  const estimatedStart = item.booking.estimatedStartsAt
                                    ? new Date(item.booking.estimatedStartsAt)
                                    : null;
                                  const showEstimate =
                                    estimatedStart && estimatedStart.getTime() !== start.getTime();
                                  const assignedLabel =
                                    item.booking.professional?.name || item.booking.resource?.label || null;
                                  const width = 100 / item.laneCount;
                                  const left = item.lane * width;
                                  const isCancelled = ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(
                                    item.booking.status,
                                  );
                                  const statusTone =
                                    item.booking.status === "CONFIRMED" || item.booking.status === "COMPLETED"
                                      ? "border-emerald-300/50 bg-[linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.12))]"
                                      : item.booking.status === "PENDING_CONFIRMATION" || item.booking.status === "PENDING"
                                        ? "border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(251,191,36,0.08))]"
                                        : item.booking.status === "DISPUTED" || isCancelled
                                          ? "border-rose-300/60 bg-[linear-gradient(135deg,rgba(244,63,94,0.24),rgba(244,63,94,0.06))]"
                                          : "border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))]";
                                  return (
                                    <button
                                      key={item.booking.id}
                                      type="button"
                                      data-booking
                                      className={cn(
                                        "absolute rounded-xl border px-3 py-2 text-left text-[11px] text-white shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl",
                                        statusTone,
                                      )}
                                      style={{
                                        top: item.top,
                                        height: item.height,
                                        left: `calc(${left}% + 4px)`,
                                        width: `calc(${width}% - 8px)`,
                                      }}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        closeCreateDrawer();
                                        setDrawerBooking(item.booking);
                                      }}
                                    >
                                      <div className="font-semibold">
                                        {formatTimeLabel(start, timezone)} · {item.booking.service?.title || "Serviço"}
                                      </div>
                                      <div className="text-[10px] text-white/70">
                                        {formatTimeLabel(start, timezone)}–{formatTimeLabel(end, timezone)}
                                      </div>
                                      {showEstimate && (
                                        <div className="text-[10px] text-amber-100/80">
                                          Estimado {formatTimeLabel(estimatedStart, timezone)}
                                        </div>
                                      )}
                                      {assignedLabel && (
                                        <div className="text-[10px] text-white/60">{assignedLabel}</div>
                                      )}
                                      <div className="text-[10px] text-white/70">
                                        {item.booking.user?.fullName || item.booking.user?.username || "Cliente"}
                                      </div>
                                    </button>
                                  );
                                })}
                                {!bookingsLoading && positions.length === 0 && (
                                  <p className="absolute left-2 top-2 text-[11px] text-white/35">Sem reservas</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}> 
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Resumo</p>
              <p className="mt-2 text-2xl font-semibold text-white">{activeServiceCount}</p>
              <p className={DASHBOARD_MUTED}>serviços ativos</p>
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Reservas pendentes</span>
              <span>{pendingBookings}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Receita confirmada</span>
              <span>{formatCurrency(confirmedRevenueCents, "EUR")}</span>
            </div>
          </section>

          <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}> 
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Atrasos</p>
              <p className="text-sm text-white/70">Escopo: {delayScope.label}</p>
              {activeDelay && activeDelay.delayMinutes > 0 && (
                <p className="mt-1 text-[12px] text-amber-100/80">
                  Ativo · +{activeDelay.delayMinutes} min desde{" "}
                  {formatTimeLabel(new Date(activeDelay.effectiveFrom), timezone)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                className="w-20 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={delayMinutesDraft}
                onChange={(e) => setDelayMinutesDraft(e.target.value)}
                placeholder="0"
              />
              <span className="text-sm text-white/60">min</span>
            </div>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={delayReasonDraft}
              onChange={(e) => setDelayReasonDraft(e.target.value)}
              placeholder="Motivo (opcional)"
            />
            <div className="flex items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-white/10"
                checked={delayNotify}
                onChange={(e) => setDelayNotify(e.target.checked)}
              />
              <span>Notificar clientes afetados</span>
            </div>
            {delayNotify && (
              <div className="flex items-center gap-2 text-[12px] text-white/60">
                <span>Janela</span>
                <input
                  className="w-16 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[12px] text-white"
                  value={delayNotifyWindow}
                  onChange={(e) => setDelayNotifyWindow(e.target.value)}
                  placeholder="24"
                />
                <span>horas</span>
              </div>
            )}
            {delayError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {delayError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={CTA_PRIMARY}
                onClick={() => handleDelaySave()}
                disabled={delaySaving}
              >
                {delaySaving ? "A atualizar..." : "Aplicar atraso"}
              </button>
              <button
                type="button"
                className={CTA_SECONDARY}
                onClick={() => handleDelaySave(0)}
                disabled={delaySaving}
              >
                Limpar
              </button>
            </div>
          </section>

          <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}> 
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Ações rápidas</h3>
              <button type="button" onClick={openServiceDrawer} className="text-[11px] text-[#6BFFFF]">
                Novo serviço
              </button>
            </div>
            <div className="grid gap-2 text-[12px]">
              <Link href="/organizacao/reservas" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                Agenda principal
              </Link>
              {canFilterByProfessional && (
                <Link
                  href="/organizacao/reservas/profissionais"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
                >
                  Profissionais
                </Link>
              )}
              {canFilterByResource && (
                <Link
                  href="/organizacao/reservas/recursos"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
                >
                  Recursos
                </Link>
              )}
              <Link
                href="/organizacao/reservas?tab=availability"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
              >
                Editar disponibilidade
              </Link>
              <Link href="/organizacao/reservas/politicas" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                Politicas de cancelamento
              </Link>
            </div>
          </section>

          <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}> 
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Proximas reservas</h3>
              <span className="text-[11px] text-white/50">{upcomingBookings.length}</span>
            </div>
            {upcomingLoading && <p className="text-[12px] text-white/60">A carregar...</p>}
            {!upcomingLoading && upcomingBookings.length === 0 && (
              <p className="text-[12px] text-white/50">Sem reservas futuras neste periodo.</p>
            )}
            <div className="space-y-2">
              {upcomingBookings.map((booking) => {
                const start = new Date(booking.startsAt);
                const estimatedStart = booking.estimatedStartsAt ? new Date(booking.estimatedStartsAt) : null;
                const showEstimate =
                  estimatedStart && estimatedStart.getTime() !== start.getTime();
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => {
                      closeCreateDrawer();
                      setDrawerBooking(booking);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-2 text-left"
                  >
                    <p className="text-[12px] font-semibold text-white">
                      {booking.service?.title || "Serviço"}
                    </p>
                    <p className="text-[11px] text-white/60">
                      {formatLongDate(start, timezone)} · {formatTimeLabel(start, timezone)}
                    </p>
                    {showEstimate && (
                      <p className="text-[11px] text-amber-100/80">
                        Estimado {formatTimeLabel(estimatedStart, timezone)}
                      </p>
                    )}
                    <p className="text-[11px] text-white/60">
                      {booking.user?.fullName || booking.user?.username || "Cliente"}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}> 
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Catalogo</h3>
              <div className="flex items-center gap-2 text-[11px]">
                <button type="button" onClick={openServiceDrawer} className="text-[#6BFFFF]">
                  Novo serviço
                </button>
                <Link href="/organizacao/reservas/servicos" className="text-white/50">
                  Gerir
                </Link>
              </div>
            </div>
            {servicesLoading && <p className="text-[12px] text-white/60">A carregar...</p>}
            {!servicesLoading && services.length === 0 && (
              <div className="space-y-2">
                <p className="text-[12px] text-white/50">Cria o teu primeiro serviço.</p>
                <button
                  type="button"
                  onClick={openServiceDrawer}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                >
                  Criar agora
                </button>
              </div>
            )}
            <div className="space-y-2">
              {services.slice(0, 4).map((service) => (
                <Link
                  key={service.id}
                  href={`/organizacao/reservas/${service.id}`}
                  className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <p className="text-[12px] font-semibold text-white">{service.title}</p>
                  <p className="text-[11px] text-white/60">
                    {service.durationMinutes} min · {formatCurrency(service.unitPriceCents, service.currency)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {serviceDrawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute left-0 right-0 bottom-0 top-[var(--org-topbar-height)] bg-black/60"
            onClick={closeServiceDrawer}
          />
          <aside className="relative ml-auto mt-[var(--org-topbar-height)] h-[calc(100vh-var(--org-topbar-height))] w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0B0F16] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Serviços</p>
                <h2 className="text-xl font-semibold text-white">Novo serviço</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70"
                onClick={closeServiceDrawer}
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-white/70">
              <div>
                <label className="text-white/50">Título</label>
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={serviceTitle}
                  onChange={(event) => setServiceTitle(event.target.value)}
                  placeholder="Ex: Corte + barba"
                />
              </div>

              <div>
                <label className="text-white/50">Duração</label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={serviceDuration}
                  onChange={(event) => setServiceDuration(event.target.value)}
                >
                  {SERVICE_DURATION_OPTIONS.map((option) => (
                    <option key={`service-duration-${option}`} value={String(option)}>
                      {option} min
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/50">Preço</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={servicePrice}
                  onChange={(event) => setServicePrice(event.target.value)}
                />
                <p className="text-[11px] text-white/50">Usa 0 para gratuito.</p>
              </div>

              <div>
                <label className="text-white/50">Descrição</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  rows={3}
                  value={serviceDescription}
                  onChange={(event) => setServiceDescription(event.target.value)}
                  placeholder="Resumo (opcional)"
                />
              </div>
            </div>

            {serviceError && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {serviceError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className={CTA_PRIMARY}
                onClick={handleCreateService}
                disabled={serviceSaving || !serviceTitle.trim()}
              >
                {serviceSaving ? "A criar..." : "Criar serviço"}
              </button>
              <button type="button" className={CTA_SECONDARY} onClick={closeServiceDrawer}>
                Cancelar
              </button>
            </div>
          </aside>
        </div>
      )}

      {drawerBooking && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute left-0 right-0 bottom-0 top-[var(--org-topbar-height)] bg-black/60"
            onClick={() => setDrawerBooking(null)}
          />
          <aside className="relative ml-auto mt-[var(--org-topbar-height)] h-[calc(100vh-var(--org-topbar-height))] w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0B0F16] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Reserva</p>
                <h2 className="text-xl font-semibold text-white">{drawerBooking.service?.title || "Serviço"}</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70"
                onClick={() => setDrawerBooking(null)}
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-white/70">
              <div>
                <p className="text-white/50">Cliente</p>
                <p className="text-white">
                  {drawerBooking.user?.fullName || drawerBooking.user?.username || "Cliente"}
                </p>
              </div>
              <div>
                <p className="text-white/50">Data e hora</p>
                <p className="text-white">
                  {formatLongDate(new Date(drawerBooking.startsAt), timezone)} · {formatTimeLabel(new Date(drawerBooking.startsAt), timezone)}
                </p>
              </div>
              {drawerBooking.estimatedStartsAt && (
                <div>
                  <p className="text-white/50">Hora estimada</p>
                  <p className="text-white">
                    {formatTimeLabel(new Date(drawerBooking.estimatedStartsAt), timezone)}
                    {drawerBooking.delayMinutes ? ` (+${drawerBooking.delayMinutes} min)` : ""}
                  </p>
                </div>
              )}
              <div>
                <p className="text-white/50">Duracao</p>
                <p className="text-white">{drawerBooking.durationMinutes} min</p>
              </div>
              <div>
                <p className="text-white/50">Preço</p>
                <p className="text-white">{formatCurrency(drawerBooking.price, drawerBooking.currency)}</p>
              </div>
              <div>
                <p className="text-white/50">Estado</p>
                <p className="text-white">{formatBookingStatus(drawerBooking.status)}</p>
              </div>
              {drawerBooking.professional?.name && (
                <div>
                  <p className="text-white/50">Profissional</p>
                  <p className="text-white">{drawerBooking.professional.name}</p>
                </div>
              )}
              {getBookingMode(drawerBooking) === "RESOURCE" && drawerBooking.resource?.label && (
                <div>
                  <p className="text-white/50">Recurso</p>
                  <p className="text-white">{drawerBooking.resource.label}</p>
                </div>
              )}
              {getBookingMode(drawerBooking) === "RESOURCE" && drawerBooking.partySize && (
                <div>
                  <p className="text-white/50">Capacidade</p>
                  <p className="text-white">{drawerBooking.partySize} pax</p>
                </div>
              )}
              {(inviteSummary.total > 0 || participantSummary.total > 0) && (
                <div>
                  <p className="text-white/50">Participantes</p>
                  <p className="text-white text-[12px]">
                    {participantSummary.confirmed} confirmados
                    {inviteSummary.pending ? ` · ${inviteSummary.pending} pendentes` : ""}
                    {inviteSummary.declined ? ` · ${inviteSummary.declined} recusados` : ""}
                  </p>
                </div>
              )}
            </div>

            {drawerBooking && (
              <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">RSVP</p>
                  <p className="text-[12px] text-white/60">
                    {participantSummary.confirmed}/{inviteSummary.total || participantSummary.total} confirmados
                  </p>
                </div>
                <div className="space-y-2">
                  {(participantsData?.participants ?? []).length === 0 && (participantsData?.invites ?? []).length === 0 ? (
                    <p className="text-[12px] text-white/50">Sem convites.</p>
                  ) : (
                    <div className="space-y-2">
                      {(participantsData?.invites ?? []).map((invite) => {
                        const label =
                          invite.targetName ||
                          invite.targetContact ||
                          "Convidado";
                        return (
                          <div key={`invite-${invite.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm text-white">{label}</p>
                                {invite.targetContact && (
                                  <p className="text-[12px] text-white/60">{invite.targetContact}</p>
                                )}
                              </div>
                              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                                {formatInviteStatus(invite.status)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {(participantsData?.participants ?? []).length > 0 && (
                        <div className="pt-2 text-[12px] text-white/50">
                          Confirmados:
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(participantsData?.participants ?? []).map((participant) => {
                              const label =
                                participant.name || participant.contact || "Participante";
                              return (
                                <span
                                  key={`participant-${participant.id}`}
                                  className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70"
                                >
                                  {label} · {formatParticipantStatus(participant.status)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!drawerBookingClosed && (
              <div className="mt-6 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Reagendar</p>
                  <p className="text-[12px] text-white/60">Escolhe nova data e hora.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <label className="flex flex-col gap-1 text-white/60">
                    Data
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(event) => setRescheduleDate(event.target.value)}
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-white/60">
                    Hora
                    <input
                      type="time"
                      step={900}
                      value={rescheduleTime}
                      onChange={(event) => setRescheduleTime(event.target.value)}
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                </div>
                {rescheduleError && (
                  <p className="text-[11px] text-red-200">{rescheduleError}</p>
                )}
                <button
                  type="button"
                  className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] text-white hover:bg-white/20 disabled:opacity-60"
                  onClick={handleReschedule}
                  disabled={rescheduleBusy}
                >
                  {rescheduleBusy ? "A reagendar..." : "Reagendar reserva"}
                </button>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {drawerBooking.service?.id && (
                <Link href={`/organizacao/reservas/${drawerBooking.service.id}`} className={CTA_SECONDARY}>
                  Ver serviço
                </Link>
              )}
              {!"CANCELLED CANCELLED_BY_CLIENT CANCELLED_BY_ORG COMPLETED DISPUTED NO_SHOW".split(" ").includes(drawerBooking.status) && (
                <button
                  type="button"
                  className="w-full rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-[12px] text-red-100"
                  onClick={() => handleCancel(drawerBooking.id)}
                  disabled={cancelingId === drawerBooking.id}
                >
                  {cancelingId === drawerBooking.id ? "A cancelar..." : "Cancelar reserva"}
                </button>
              )}
              {canMarkNoShow && (
                <button
                  type="button"
                  className="w-full rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-100"
                  onClick={() => handleNoShow(drawerBooking.id)}
                  disabled={noShowBusy}
                >
                  {noShowBusy ? "A atualizar..." : "Marcar no-show"}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {createSlot && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute left-0 right-0 bottom-0 top-[var(--org-topbar-height)] bg-black/60"
            onClick={closeCreateDrawer}
          />
          <aside className="relative ml-auto mt-[var(--org-topbar-height)] h-[calc(100vh-var(--org-topbar-height))] w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0B0F16] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Nova reserva</p>
                <h2 className="text-xl font-semibold text-white">Criar e cobrar</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70"
                onClick={closeCreateDrawer}
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-white/70">
              <div>
                <p className="text-white/50">Data e hora</p>
                <p className="text-white">
                  {formatLongDate(createSlot, timezone)} · {formatTimeLabel(createSlot, timezone)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-white/50">Serviço</label>
                {activeServices.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                    <p>Sem serviços ativos.</p>
                    <button
                      type="button"
                      onClick={openServiceDrawer}
                      className="mt-2 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                    >
                      Criar serviço
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={createServiceId ?? ""}
                      onChange={(event) => setCreateServiceId(Number(event.target.value) || null)}
                    >
                      <option value="">Seleciona um serviço</option>
                      {activeServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.title} · {service.durationMinutes} min · {formatCurrency(service.unitPriceCents, service.currency)}
                        </option>
                      ))}
                    </select>
                    {selectedCreateService && (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                        {selectedCreateService.durationMinutes} min · {formatCurrency(selectedCreateService.unitPriceCents, selectedCreateService.currency)}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-white/50">Cliente</label>
                {createClient ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{formatClientLabel(createClient)}</p>
                        <p className="text-white/60">
                          {createClient.contactPhone ? createClient.contactPhone : "Sem telemovel"}
                          {createClient.email ? ` · ${createClient.email}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                        onClick={() => setCreateClient(null)}
                      >
                        Trocar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      placeholder="Pesquisar por nome, username ou email"
                      value={clientQuery}
                      onChange={(event) => setClientQuery(event.target.value)}
                    />
                    <div className="space-y-2">
                      {clientLoading && <p className="text-[12px] text-white/50">A pesquisar...</p>}
                      {!clientLoading && clientQuery.trim().length >= 2 && clientResults.length === 0 && (
                        <p className="text-[12px] text-white/50">Sem resultados.</p>
                      )}
                      {clientResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[12px] text-white/80"
                          onClick={() => {
                            setCreateClient(client);
                            setClientQuery("");
                            setClientResults([]);
                          }}
                        >
                          <p className="font-semibold text-white">{formatClientLabel(client)}</p>
                          <p className="text-white/60">
                            {client.contactPhone ? client.contactPhone : "Sem telemovel"}
                            {client.email ? ` · ${client.email}` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {createAssignmentMode === "PROFESSIONAL" && (
                <div className="space-y-2">
                  <label className="text-white/50">Profissional</label>
                  <select
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    value={createProfessionalId ?? ""}
                    onChange={(event) =>
                      setCreateProfessionalId(event.target.value ? Number(event.target.value) : null)
                    }
                  >
                    <option value="">Auto-atribuir</option>
                    {availableProfessionalsForService.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professional.name}
                      </option>
                    ))}
                  </select>
                  {hasServiceProfessionalLinks && availableProfessionalsForService.length === 0 && (
                    <p className="text-[12px] text-white/50">Sem profissionais ligados a este serviço.</p>
                  )}
                </div>
              )}

              {createAssignmentMode === "RESOURCE" && (
                <div className="space-y-2">
                  <label className="text-white/50">Capacidade</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    value={createPartySize}
                    onChange={(event) => setCreatePartySize(event.target.value)}
                  />
                  <label className="text-white/50">Recurso</label>
                  <select
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    value={createResourceId ?? ""}
                    onChange={(event) =>
                      setCreateResourceId(event.target.value ? Number(event.target.value) : null)
                    }
                  >
                    <option value="">Auto-assign</option>
                    {availableResourcesForService.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.label} · {resource.capacity}
                      </option>
                    ))}
                  </select>
                  {hasServiceResourceLinks && availableResourcesForService.length === 0 && (
                    <p className="text-[12px] text-white/50">Sem recursos ligados a este serviço.</p>
                  )}
                </div>
              )}

              {selectedCreateService?.locationMode === "CHOOSE_AT_BOOKING" && (
                <div className="space-y-2">
                  <label className="text-white/50">Local</label>
                  <input
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Ex: Rua Central, 45"
                    value={createLocationText}
                    onChange={(event) => setCreateLocationText(event.target.value)}
                  />
                </div>
              )}

              {createError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
                  {createError}
                </div>
              )}

              {!checkout && (
                <button
                  type="button"
                  className={CTA_PRIMARY}
                  onClick={handleCreateBooking}
                  disabled={createLoading}
                >
                  {createLoading ? "A criar..." : "Criar reserva e pagar"}
                </button>
              )}

              {checkout && elementsOptions && stripePromise && (
                <div className="space-y-3">
                  <p className="text-[12px] text-white/60">Pagamento</p>
                  <Elements stripe={stripePromise} options={elementsOptions}>
                    <DashboardPaymentForm
                      amountCents={checkout.amountCents}
                      currency={checkout.currency}
                      onConfirmed={handlePaymentConfirmed}
                      onError={(message) => setPaymentError(message)}
                      disabled={createLoading}
                    />
                  </Elements>
                  {paymentError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
                      {paymentError}
                    </div>
                  )}
                </div>
              )}

              {checkout && !stripePromise && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
                  Stripe não configurado.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
