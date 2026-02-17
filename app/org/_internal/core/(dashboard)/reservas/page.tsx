"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { AddressCombobox } from "@/components/ui/address-combobox";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import {
  normalizeReservationAssignmentMode,
  requiresProfessionalForAssignmentMode,
  requiresResourceForAssignmentMode,
  resolveServiceAssignmentMode,
} from "@/lib/reservas/serviceAssignment";
import { appendOrganizationIdToHref, buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import BookingChargesPanel from "@/app/org/_internal/core/(dashboard)/reservas/_components/BookingChargesPanel";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CHIP_BASE =
  "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-white/20 hover:bg-white/10 hover:text-white";
const CHIP_ACTIVE =
  "border-white/35 bg-white/18 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]";
const SERVICE_DURATION_OPTIONS = [30, 60, 90, 120];
type ReservationFilterMode = "PROFESSIONAL" | "RESOURCE";

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

const formatCentsInput = (cents: number) => (cents / 100).toFixed(2);

const parseAmountToCents = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
};

const parsePercentToBps = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
};

const distributeEvenly = (total: number, count: number) => {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, idx) => base + (idx < remainder ? 1 : 0));
};

const formatBookingStatus = (status: string) => {
  switch (status) {
    case "CONFIRMED":
      return "Confirmada";
    case "COMPLETED":
      return "Concluída";
    case "PENDING_CONFIRMATION":
    case "PENDING":
      return "Pendente";
    case "CANCELLED_BY_CLIENT":
      return "Cancelada pelo cliente";
    case "CANCELLED_BY_ORG":
      return "Cancelada pela organização";
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
  assignmentMode?: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  categoryTag?: string | null;
  locationMode?: string | null;
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null } | null;
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
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  professional?: { id: number; name: string; user?: { fullName?: string | null; avatarUrl?: string | null } | null } | null;
  resource?: { id: number; label: string; capacity: number } | null;
  service: { id: number; title: string | null; kind?: string | null } | null;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
  changeRequest?: {
    id: number;
    requestedBy: "ORG" | "USER";
    status: string;
    proposedStartsAt: string;
    proposedCourtId?: number | null;
    proposedProfessionalId?: number | null;
    proposedResourceId?: number | null;
    priceDeltaCents: number;
    currency: string;
    expiresAt: string;
    createdAt: string;
  } | null;
};

const getBookingMode = (booking: BookingItem): ReservationFilterMode => {
  const serviceKind =
    typeof booking.service?.kind === "string" ? booking.service.kind.trim().toUpperCase() : "";
  if (serviceKind && serviceKind !== "COURT" && !booking.resource) return "PROFESSIONAL";
  const normalized = typeof booking.assignmentMode === "string" ? booking.assignmentMode.toUpperCase() : "";
  if (["RESOURCE", "RESOURCE_ONLY", "PROFESSIONAL_AND_RESOURCE"].includes(normalized)) return "RESOURCE";
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

type PadelClubSummary = {
  id: number;
  name: string;
  shortName?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  kind?: string | null;
};

type PadelCourtSummary = {
  id: number;
  name: string;
  isActive?: boolean;
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

type SplitParticipantForm = {
  inviteId: number;
  label: string;
  contact: string | null;
  status: string;
  include: boolean;
  amount: string;
  percent: string;
  paidAt?: string | null;
};

type SplitState = {
  bookingId: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  status: "NONE" | "OPEN" | "SETTLING" | "SETTLED" | "CHARGE_FAILED" | "DEBT_OPEN" | "CANCELLED";
  pricingMode: "FIXED" | "DYNAMIC";
  dynamicMode: "AMOUNT" | "PERCENT";
  fixedShare: string;
  deadlineAt: string;
  participants: SplitParticipantForm[];
  totalCents: number;
  paidCents: number;
  currency: string;
};


export default function ReservasDashboardPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const organizationIdFromPath = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/org\/(\d+)(?:\/|$)/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [pathname]);
  const organizationIdFromQuery = organizationIdParam ? Number(organizationIdParam) : null;
  const organizationId = Number.isFinite(organizationIdFromQuery ?? Number.NaN)
    ? organizationIdFromQuery
    : organizationIdFromPath;
  const operationalCalendarHref = organizationId
    ? buildOrgHref(organizationId, "/calendar")
    : buildOrgHubHref("/organizations");
  const orgMeUrl =
    organizationId && Number.isFinite(organizationId)
      ? `/api/org/${organizationId}/me`
      : null;
  const [selectedPadelClubId, setSelectedPadelClubId] = useState<number | null>(null);
  const [selectedPadelCourtId, setSelectedPadelCourtId] = useState<number | null>(null);
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [drawerBooking, setDrawerBooking] = useState<BookingItem | null>(null);
  const participantsKey = drawerBooking ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${drawerBooking.id}/participants`) : null;
  const splitKey =
    drawerBooking && organizationId && Number.isFinite(organizationId)
      ? `/api/org/${organizationId}/reservas/${drawerBooking.id}/split`
      : null;
  const { data: participantsData, mutate: mutateParticipants } = useSWR<{
    ok: boolean;
    invites: InviteItem[];
    participants: ParticipantItem[];
  }>(participantsKey, fetcher);
  const { data: splitData, mutate: mutateSplit } = useSWR<any>(splitKey, fetcher);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
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
  const [createAddressQuery, setCreateAddressQuery] = useState("");
  const [createAddressId, setCreateAddressId] = useState<string | null>(null);
  const [createAddressLabel, setCreateAddressLabel] = useState<string | null>(null);
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
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [servicePrice, setServicePrice] = useState("20");
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const splitInitRef = useRef<number | null>(null);
  const splitDirtyRef = useRef(false);
  const [splitState, setSplitState] = useState<SplitState | null>(null);
  const [splitEditorOpen, setSplitEditorOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteContact, setInviteContact] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function showServiceDrawer() {
    setDrawerBooking(null);
    setCreateSlot(null);
    setCreateServiceId(null);
    setCheckout(null);
    setPaymentError(null);
    setCreateError(null);
    setServiceSaving(false);
    setServiceError(null);
    setServiceDrawerOpen(true);
  }
  const showServiceDrawerRef = useRef<() => void>(() => {});
  showServiceDrawerRef.current = showServiceDrawer;

  const { data: servicesData, isLoading: servicesLoading, mutate: mutateServices } = useSWR<{
    ok: boolean;
    items: ServiceItem[];
  }>(resolveCanonicalOrgApiPath("/api/org/[orgId]/servicos"), fetcher);
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
  const padelClubsKey =
    organizationId && Number.isFinite(organizationId)
      ? `/api/padel/clubs?organizationId=${organizationId}&includeInactive=0`
      : null;
  const { data: padelClubsData } = useSWR<{ ok: boolean; items?: PadelClubSummary[] }>(
    padelClubsKey,
    fetcher,
  );
  const padelClubs = padelClubsData?.items ?? [];
  const hasPadelClubs = padelClubs.length > 0;
  const padelCourtsKey =
    selectedPadelClubId && Number.isFinite(selectedPadelClubId)
      ? `/api/padel/clubs/${selectedPadelClubId}/courts`
      : null;
  const { data: padelCourtsData } = useSWR<{ ok: boolean; items?: PadelCourtSummary[] }>(
    padelCourtsKey,
    fetcher,
  );
  const padelCourts = padelCourtsData?.items ?? [];

  useEffect(() => {
    if (!hasPadelClubs) {
      if (selectedPadelClubId !== null) setSelectedPadelClubId(null);
      return;
    }
    if (selectedPadelClubId && padelClubs.some((club) => club.id === selectedPadelClubId)) return;
    const preferred =
      padelClubs.find((club) => club.isDefault) ??
      (padelClubs.length === 1 ? padelClubs[0] : null);
    if (preferred) {
      setSelectedPadelClubId(preferred.id);
    }
  }, [hasPadelClubs, padelClubs, selectedPadelClubId]);

  useEffect(() => {
    setSelectedPadelCourtId(null);
  }, [selectedPadelClubId]);

  const services = servicesData?.items ?? [];
  const activeServices = services.filter((service) => service.isActive);
  const selectedCreateService =
    activeServices.find((service) => service.id === createServiceId) ?? null;
  const hasCourtServices = services.some((service) => service.kind === "COURT");
  const hasNonCourtServices = services.some((service) => service.kind !== "COURT");

  const organizationAssignmentMode = normalizeReservationAssignmentMode(
    orgData?.organization?.reservationAssignmentMode ?? null,
  );
  const assignmentMode: ReservationFilterMode = requiresResourceForAssignmentMode(organizationAssignmentMode)
    ? "RESOURCE"
    : "PROFESSIONAL";
  const canFilterByResource = requiresResourceForAssignmentMode(organizationAssignmentMode) && hasCourtServices;
  const canFilterByProfessional =
    requiresProfessionalForAssignmentMode(organizationAssignmentMode) || hasNonCourtServices;
  const hasHybridFilters = canFilterByResource && canFilterByProfessional;
  const [filterMode, setFilterMode] = useState<ReservationFilterMode>(() =>
    canFilterByResource && assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL",
  );
  const createAssignmentConfig = useMemo(
    () =>
      resolveServiceAssignmentMode({
        organizationMode: organizationAssignmentMode,
        serviceMode: selectedCreateService?.assignmentMode ?? null,
        serviceKind: selectedCreateService?.kind ?? null,
      }),
    [organizationAssignmentMode, selectedCreateService?.assignmentMode, selectedCreateService?.kind],
  );
  const createAssignmentMode = createAssignmentConfig.mode;
  const timezone = orgData?.organization?.timezone ?? "Europe/Lisbon";
  const membershipRole = orgData?.membershipRole ?? null;
  const isStaffMember = membershipRole === "STAFF";

  const handleSendChat = async () => {
    if (!drawerBooking?.id) return;
    if (!chatDraft.trim()) {
      setChatError("Escreve uma mensagem antes de enviar.");
      return;
    }
    setChatSending(true);
    setChatError(null);
    try {
      const response = await fetch("/api/messages/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: drawerBooking.id, body: chatDraft.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao enviar mensagem.");
      }
      setChatDraft("");
      setChatConversationId(payload?.conversationId ?? null);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!drawerBooking) {
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleError(null);
      setSplitState(null);
      setSplitEditorOpen(false);
      splitInitRef.current = null;
      splitDirtyRef.current = false;
      setInviteName("");
      setInviteContact("");
      setInviteMessage("");
      setInviteError(null);
      setChatDraft("");
      setChatError(null);
      setChatConversationId(null);
      return;
    }
    const start = new Date(drawerBooking.startsAt);
    setRescheduleDate(formatInputDate(start, timezone));
    setRescheduleTime(formatInputTime(start, timezone));
    setRescheduleError(null);
    setInviteName("");
    setInviteContact("");
    setInviteMessage("");
    setInviteError(null);
    setChatError(null);
    setChatConversationId(null);
  }, [drawerBooking, timezone]);

  useEffect(() => {
    if (!drawerBooking) return;
    const bookingId = drawerBooking.id;
    if (splitInitRef.current === bookingId && splitDirtyRef.current) return;

    const split = splitData?.data?.split ?? null;
    const baseTotal = split?.baseTotalCents ?? drawerBooking.price ?? 0;
    const paidCents = split?.paidCents ?? 0;
    const inviteItems = participantsData?.invites ?? [];
    const splitParticipants = Array.isArray(split?.participants) ? split.participants : [];

    const baseParticipants: SplitParticipantForm[] = inviteItems.length
      ? inviteItems.map((invite) => {
          const label = invite.targetName || invite.targetContact || "Convidado";
          const splitParticipant = splitParticipants.find((item: any) => item.inviteId === invite.id);
          const baseShare = splitParticipant?.baseShareCents ?? 0;
          const percentValue =
            baseTotal > 0 ? ((baseShare / baseTotal) * 100).toFixed(2).replace(/\.00$/, "") : "";
          return {
            inviteId: invite.id,
            label,
            contact: invite.targetContact ?? null,
            status: invite.status,
            include: split ? Boolean(splitParticipant) : invite.status !== "DECLINED",
            amount: baseShare > 0 ? formatCentsInput(baseShare) : "",
            percent: baseShare > 0 ? percentValue : "",
            paidAt: splitParticipant?.paidAt ?? null,
          };
        })
      : splitParticipants
          .filter((participant: any) => participant.inviteId != null)
          .map((participant: any) => ({
            inviteId: participant.inviteId as number,
            label: participant.name || participant.contact || "Convidado",
            contact: participant.contact ?? null,
            status: participant.status ?? "PENDING",
            include: true,
            amount: participant.baseShareCents ? formatCentsInput(participant.baseShareCents) : "",
            percent:
              baseTotal > 0 && participant.baseShareCents
                ? ((participant.baseShareCents / baseTotal) * 100).toFixed(2).replace(/\.00$/, "")
                : "",
            paidAt: participant.paidAt ?? null,
          }));

    const fixedShare =
      split?.pricingMode === "FIXED" && typeof split?.shareCents === "number"
        ? formatCentsInput(split.shareCents)
        : "";

    const included = baseParticipants.filter((p) => p.include);
    if (!split && included.length > 0 && baseTotal > 0) {
      const distributed = distributeEvenly(baseTotal, included.length);
      included.forEach((participant, idx) => {
        participant.amount = formatCentsInput(distributed[idx] ?? 0);
        participant.percent =
          baseTotal > 0
            ? ((distributed[idx] ?? 0) / baseTotal * 100).toFixed(2).replace(/\.00$/, "")
            : "";
      });
    }

    const autoFixedShare =
      split && split.pricingMode === "FIXED"
        ? fixedShare
        : included.length > 0 && baseTotal % included.length === 0
          ? formatCentsInput(baseTotal / included.length)
          : "";

    setSplitState({
      bookingId,
      loading: Boolean(splitKey && !splitData),
      saving: false,
      error: null,
      status: split?.status ?? "NONE",
      pricingMode: split?.pricingMode === "DYNAMIC" ? "DYNAMIC" : "FIXED",
      dynamicMode: "AMOUNT",
      fixedShare: autoFixedShare,
      deadlineAt: split?.deadlineAt ? split.deadlineAt.slice(0, 16) : "",
      participants: baseParticipants,
      totalCents: baseTotal,
      paidCents,
      currency: split?.currency ?? drawerBooking.currency ?? "EUR",
    });
    setSplitEditorOpen(Boolean(split));
    splitInitRef.current = bookingId;
    splitDirtyRef.current = false;
  }, [drawerBooking, participantsData?.invites, splitData, splitKey]);

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
    const createParam = searchParams.get("create");
    if (createParam === "service") {
      if (serviceInitRef.current) return;
      showServiceDrawerRef.current();
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
      setCreateAddressId(null);
      setCreateAddressLabel(null);
      setCreateAddressQuery("");
      return;
    }
    if (selectedCreateService.locationMode === "CHOOSE_AT_BOOKING") {
      const label = selectedCreateService.addressRef?.formattedAddress ?? "";
      setCreateAddressId(selectedCreateService.addressId ?? null);
      setCreateAddressLabel(label || null);
      setCreateAddressQuery(label);
      return;
    }
    setCreateAddressId(null);
    setCreateAddressLabel(null);
    setCreateAddressQuery("");
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
          resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/clientes?q=${encodeURIComponent(query)}`),
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

  const calendarStart = useMemo(() => getWeekStart(focusDate, timezone), [focusDate, timezone]);

  const rangeStartIso = calendarStart.toISOString();
  const rangeEndIso = useMemo(() => {
    const startParts = getDateParts(calendarStart, timezone);
    const endParts = addDaysToParts(startParts, 7);
    return buildZonedDate(endParts, timezone, 0, 0).toISOString();
  }, [calendarStart, timezone]);

  const requiresPadelClubSelection = hasPadelClubs && !selectedPadelClubId;
  const padelClubQuery = selectedPadelClubId ? `&padelClubId=${selectedPadelClubId}` : "";
  const padelCourtQuery = selectedPadelCourtId ? `&courtId=${selectedPadelCourtId}` : "";

  const { data: bookingsData, isLoading: bookingsLoading, mutate: mutateBookings } = useSWR<
    { ok: boolean; items: BookingItem[] }
  >(
    !requiresPadelClubSelection
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas?from=${encodeURIComponent(rangeStartIso)}&to=${encodeURIComponent(
          rangeEndIso,
        )}${padelClubQuery}${padelCourtQuery}`)
      : null,
    fetcher,
  );

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
    !requiresPadelClubSelection
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas?from=${encodeURIComponent(
          upcomingRange.start.toISOString(),
        )}&to=${encodeURIComponent(upcomingRange.end.toISOString())}${padelClubQuery}${padelCourtQuery}`)
      : null,
    fetcher,
  );

  const shouldLoadProfessionals = canFilterByProfessional;
  const shouldLoadResources = canFilterByResource;

  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    shouldLoadProfessionals ? resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/profissionais") : null,
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    shouldLoadResources ? resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/recursos") : null,
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
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/delays?scopeType=${delayScope.scopeType}&scopeId=${delayScope.scopeId}&organizationId=${organizationId}`)
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

  const now = new Date();

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

  const rangeLabel = `${formatRangeDate(calendarStart, timezone)} — ${formatRangeDate(
    buildZonedDate(addDaysToParts(getDateParts(calendarStart, timezone), 6), timezone, 0, 0),
    timezone,
  )}`;

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

  const splitSummary = useMemo(() => {
    if (!splitState) return null;
    const included = splitState.participants.filter((p) => p.include);
    const totalCents = splitState.totalCents;
    if (included.length === 0) {
      return { valid: false, message: "Seleciona pelo menos um convidado.", diffLabel: "" };
    }
    if (splitState.pricingMode === "FIXED") {
      const fixedCents = parseAmountToCents(splitState.fixedShare);
      if (!fixedCents || fixedCents <= 0) {
        return { valid: false, message: "Indica o preço por pessoa.", diffLabel: "" };
      }
      const sum = fixedCents * included.length;
      const diff = totalCents - sum;
      return {
        valid: diff === 0,
        message: diff === 0 ? null : "O total não coincide com o valor da reserva.",
        diffLabel: diff === 0 ? "Total certo" : `Diferença: ${formatCurrency(diff, splitState.currency)}`,
      };
    }
    if (splitState.dynamicMode === "PERCENT") {
      const bpsValues = included.map((p) => parsePercentToBps(p.percent));
      if (bpsValues.some((value) => value == null)) {
        return { valid: false, message: "Indica todas as percentagens.", diffLabel: "" };
      }
      const sum = (bpsValues as number[]).reduce((acc, value) => acc + value, 0);
      const diff = 10_000 - sum;
      return {
        valid: diff === 0,
        message: diff === 0 ? null : "A soma das percentagens tem de ser 100%.",
        diffLabel: diff === 0 ? "100% ok" : `Falta ${Math.abs(diff) / 100}%`,
      };
    }
    const amounts = included.map((p) => parseAmountToCents(p.amount));
    if (amounts.some((value) => value == null)) {
      return { valid: false, message: "Indica os valores de todos os convidados.", diffLabel: "" };
    }
    const sum = (amounts as number[]).reduce((acc, value) => acc + value, 0);
    const diff = totalCents - sum;
    return {
      valid: diff === 0,
      message: diff === 0 ? null : "O total não coincide com o valor da reserva.",
      diffLabel: diff === 0 ? "Total certo" : `Diferença: ${formatCurrency(diff, splitState.currency)}`,
    };
  }, [splitState]);
  const splitLocked =
    drawerBookingClosed || (splitState ? splitState.paidCents > 0 || splitState.status === "SETTLED" : false);

  const handleShiftRange = (direction: -1 | 1) => {
    const baseParts = getDateParts(focusDate, timezone);
    const nextParts = addDaysToParts(baseParts, 7 * direction);
    setFocusDate(buildZonedDate(nextParts, timezone, 12, 0));
  };

  const handleModeChange = async (mode: "PROFESSIONAL_ONLY" | "RESOURCE_ONLY") => {
    if (modeSaving || organizationAssignmentMode === mode) return;
    setModeSaving(mode);
    try {
      if (!organizationId || Number.isNaN(organizationId)) {
        throw new Error("Seleciona uma organização primeiro.");
      }
      const res = await fetch(`/api/org/${organizationId}/me`, {
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
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${bookingId}/cancel`), {
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
    setRescheduleNotice(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${drawerBooking.id}/reschedule`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: startsAt.toISOString() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao reagendar reserva.");
      }
      mutateBookings();
      if (json.request) {
        setRescheduleNotice("Pedido de reagendamento enviado ao cliente.");
        setDrawerBooking((prev) => (prev ? { ...prev, changeRequest: json.request } : prev));
        setRescheduleDate("");
        setRescheduleTime("");
      } else if (json.booking) {
        setDrawerBooking((prev) => (prev ? { ...prev, ...json.booking } : prev));
      }
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "Erro ao reagendar reserva.");
    } finally {
      setRescheduleBusy(false);
    }
  };

  const handleInviteCreate = async () => {
    if (!drawerBooking || inviteSaving) return;
    const contact = inviteContact.trim();
    if (!contact) {
      setInviteError("Indica o contacto do convidado.");
      return;
    }
    setInviteSaving(true);
    setInviteError(null);
    try {
      const url =
        organizationId && Number.isFinite(organizationId)
          ? `/api/org/${organizationId}/reservas/${drawerBooking.id}/invites`
          : resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${drawerBooking.id}/invites`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          contact,
          message: inviteMessage.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao enviar convite.");
      }
      setInviteName("");
      setInviteContact("");
      setInviteMessage("");
      mutateParticipants();
      if (splitKey) {
        mutateSplit();
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Erro ao enviar convite.");
    } finally {
      setInviteSaving(false);
    }
  };

  const updateSplitParticipant = (inviteId: number, patch: Partial<SplitParticipantForm>) => {
    splitDirtyRef.current = true;
    setSplitState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map((participant) =>
          participant.inviteId === inviteId ? { ...participant, ...patch } : participant,
        ),
      };
    });
  };

  const applyEqualSplit = () => {
    splitDirtyRef.current = true;
    setSplitState((prev) => {
      if (!prev) return prev;
      const included = prev.participants.filter((p) => p.include);
      if (included.length === 0 || prev.totalCents <= 0) return prev;
      if (prev.pricingMode === "FIXED") {
        if (prev.totalCents % included.length !== 0) {
          return { ...prev, fixedShare: "" };
        }
        return { ...prev, fixedShare: formatCentsInput(prev.totalCents / included.length) };
      }
      if (prev.dynamicMode === "AMOUNT") {
        const distributed = distributeEvenly(prev.totalCents, included.length);
        const updated = prev.participants.map((participant) => {
          const idx = included.findIndex((p) => p.inviteId === participant.inviteId);
          if (idx < 0) return participant;
          return { ...participant, amount: formatCentsInput(distributed[idx] ?? 0) };
        });
        return { ...prev, participants: updated };
      }
      const distributed = distributeEvenly(10_000, included.length);
      const updated = prev.participants.map((participant) => {
        const idx = included.findIndex((p) => p.inviteId === participant.inviteId);
        if (idx < 0) return participant;
        const value = (distributed[idx] ?? 0) / 100;
        return { ...participant, percent: value.toFixed(2).replace(/\.00$/, "") };
      });
      return { ...prev, participants: updated };
    });
  };

  const saveSplit = async () => {
    if (!splitState || splitState.saving || splitState.loading) return;
    if (!organizationId || Number.isNaN(organizationId)) {
      setSplitState((prev) => (prev ? { ...prev, error: "Seleciona uma organização primeiro." } : prev));
      return;
    }
    if (splitLocked) return;
    if (!splitSummary?.valid) {
      setSplitState((prev) => (prev ? { ...prev, error: "Revê os valores do split." } : prev));
      return;
    }
    const included = splitState.participants.filter((p) => p.include);
    if (included.length === 0) {
      setSplitState((prev) => (prev ? { ...prev, error: "Seleciona pelo menos um convidado." } : prev));
      return;
    }

    const fixedCents = splitState.pricingMode === "FIXED" ? parseAmountToCents(splitState.fixedShare) : null;
    if (splitState.pricingMode === "FIXED" && (!fixedCents || fixedCents <= 0)) {
      setSplitState((prev) => (prev ? { ...prev, error: "Indica o preço por pessoa." } : prev));
      return;
    }

    const participantsPayload = included.map((participant) => {
      const base = {
        inviteId: participant.inviteId,
        name: participant.label,
        contact: participant.contact,
      };
      if (splitState.pricingMode === "FIXED") {
        return { ...base, shareCents: fixedCents };
      }
      if (splitState.dynamicMode === "PERCENT") {
        const percentBps = parsePercentToBps(participant.percent);
        return { ...base, sharePercentBps: percentBps };
      }
      const shareCents = parseAmountToCents(participant.amount);
      return { ...base, shareCents };
    });

    splitDirtyRef.current = false;
    setSplitState((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const res = await fetch(
        `/api/org/${organizationId}/reservas/${splitState.bookingId}/split`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pricingMode: splitState.pricingMode,
            dynamicMode: splitState.pricingMode === "DYNAMIC" ? splitState.dynamicMode : undefined,
            deadlineAt: splitState.deadlineAt ? new Date(splitState.deadlineAt).toISOString() : null,
            participants: participantsPayload,
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao configurar pagamento dividido.");
      }
      setSplitState((prev) => (prev ? { ...prev, saving: false, error: null } : prev));
      setSplitEditorOpen(true);
      mutateSplit();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao configurar pagamento dividido.";
      setSplitState((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
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
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/delays"), {
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
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${bookingId}/no-show`), {
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
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/servicos"), {
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
      showServiceDrawer();
      return;
    }
    const initialServiceId = activeServices[0]?.id ?? null;
    const initialServiceKind =
      initialServiceId != null
        ? activeServices.find((service) => service.id === initialServiceId)?.kind ?? null
        : null;
    const initialAssignmentMode = resolveServiceAssignmentMode({
      organizationMode: organizationAssignmentMode,
      serviceMode: selectedCreateService?.assignmentMode ?? null,
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
    setCreateAddressQuery("");
    setCreateAddressId(null);
    setCreateAddressLabel(null);
    setCreateError(null);
    setCheckout(null);
    setPaymentError(null);
  };

  const handleQuickCreateBooking = () => {
    const nowDate = new Date();
    const dayParts = getDateParts(nowDate, timezone);
    const timeParts = getTimeParts(nowDate, timezone);
    const nextBucketMinute = Math.ceil((timeParts.hour * 60 + timeParts.minute + 5) / 15) * 15;
    const carryDay = nextBucketMinute >= 24 * 60;
    const targetDay = carryDay ? addDaysToParts(dayParts, 1) : dayParts;
    const minuteOfDay = carryDay ? nextBucketMinute - 24 * 60 : nextBucketMinute;
    const startsAt = buildZonedDate(
      targetDay,
      timezone,
      Math.floor(minuteOfDay / 60),
      minuteOfDay % 60,
    );

    if (startsAt <= nowDate) {
      openCreateDrawer(new Date(nowDate.getTime() + 15 * 60 * 1000));
      return;
    }
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
      !createAddressId
    ) {
      setCreateError("Seleciona uma morada Apple Maps.");
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
        addressId:
          selectedCreateService.locationMode === "CHOOSE_AT_BOOKING"
            ? createAddressId
            : null,
      };

      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas"), {
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

      const checkoutRes = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${bookingId}/checkout`), {
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
            <h1 className="text-xl font-semibold text-white">Operações de reservas</h1>
            <p className={DASHBOARD_MUTED}>
              Setup e ações transacionais. O calendário operacional foi consolidado na ferramenta Calendário.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={operationalCalendarHref} className={CTA_SECONDARY}>
              Abrir calendário operacional
            </Link>
            <button type="button" className={CTA_PRIMARY} onClick={showServiceDrawer}>
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
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
              Agenda operacional disponível em Calendário
            </span>
            <button type="button" onClick={handleQuickCreateBooking} className={CHIP_BASE}>
              Nova reserva
            </button>
          </div>

          {isStaffMember ? (
            <div className="text-[12px] text-white/60">
              Modo: {assignmentMode === "RESOURCE" ? "Recurso" : "Profissional"}
              {organizationAssignmentMode === "PROFESSIONAL_AND_RESOURCE" && (
                <span className="text-white/40"> | Híbrido</span>
              )}
              {hasHybridFilters && (
                <span className="text-white/40"> | Vista: {filterMode === "RESOURCE" ? "Recursos" : "Profissionais"}</span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Modo</span>
              <button
                type="button"
                onClick={() => handleModeChange("PROFESSIONAL_ONLY")}
                className={cn(
                  CHIP_BASE,
                  organizationAssignmentMode === "PROFESSIONAL_ONLY" && CHIP_ACTIVE,
                )}
              >
                Profissional
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("RESOURCE_ONLY")}
                className={cn(
                  CHIP_BASE,
                  organizationAssignmentMode === "RESOURCE_ONLY" && CHIP_ACTIVE,
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

        {hasPadelClubs && (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Clube</span>
            {padelClubs.map((club) => (
              <button
                key={club.id}
                type="button"
                onClick={() => setSelectedPadelClubId(club.id)}
                className={cn(
                  CHIP_BASE,
                  selectedPadelClubId === club.id && CHIP_ACTIVE,
                )}
              >
                {club.shortName || club.name}
              </button>
            ))}
            {selectedPadelClubId && (
              <>
                <span className="text-[10px] uppercase tracking-[0.24em] text-white/50">Campo</span>
                <button
                  type="button"
                  onClick={() => setSelectedPadelCourtId(null)}
                  className={cn(CHIP_BASE, !selectedPadelCourtId && CHIP_ACTIVE)}
                >
                  Todos
                </button>
                {padelCourts.length === 0 ? (
                  <span className="text-white/40">Sem campos ativos.</span>
                ) : (
                  padelCourts.map((court) => (
                    <button
                      key={court.id}
                      type="button"
                      onClick={() => setSelectedPadelCourtId(court.id)}
                      className={cn(
                        CHIP_BASE,
                        selectedPadelCourtId === court.id && CHIP_ACTIVE,
                      )}
                    >
                      {court.name}
                    </button>
                  ))
                )}
              </>
            )}
            {requiresPadelClubSelection && (
              <span className="text-white/40">Seleciona um clube para carregar a agenda.</span>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className={cn(DASHBOARD_CARD, "p-4")}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-300/30 bg-[linear-gradient(140deg,rgba(34,211,238,0.16),rgba(59,130,246,0.1))] p-4">
              <h2 className="text-sm font-semibold text-cyan-50">Calendário operacional centralizado</h2>
              <p className="mt-1 text-sm text-cyan-100/90">
                A grelha operacional foi removida desta página para evitar duplicação e inconsistência.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/85">
                  {bookingsLoading ? "A carregar..." : `${filteredBookings.length} reservas no intervalo`}
                </span>
                <Link href={operationalCalendarHref} className={CTA_PRIMARY}>
                  Abrir calendário operacional
                </Link>
                <button type="button" onClick={handleQuickCreateBooking} className={CTA_SECONDARY}>
                  Nova reserva
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-sm font-semibold text-white">O que fica em Reservas</h3>
              <ul className="mt-2 space-y-1 text-[12px] text-white/70">
                <li>Serviços, profissionais, recursos e clientes.</li>
                <li>Ações transacionais: cancelar, reagendar, no-show, split, checkout.</li>
                <li>Configuração de disponibilidade em /bookings/availability.</li>
              </ul>
            </div>
          </div>
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
              <button type="button" onClick={showServiceDrawer} className="text-[11px] text-[#6BFFFF]">
                Novo serviço
              </button>
            </div>
            <div className="grid gap-2 text-[12px]">
              <Link href={appendOrganizationIdToHref("/org/calendar", organizationId)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                Calendário operacional
              </Link>
              {canFilterByProfessional && (
                <Link
                  href={appendOrganizationIdToHref("/org/bookings/professionals", organizationId)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
                >
                  Profissionais
                </Link>
              )}
              {canFilterByResource && (
                <Link
                  href={appendOrganizationIdToHref("/org/bookings/resources", organizationId)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
                >
                  Recursos
                </Link>
              )}
              <Link
                href={appendOrganizationIdToHref("/org/bookings/availability", organizationId)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80"
              >
                Editar disponibilidade
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
                <button type="button" onClick={showServiceDrawer} className="text-[#6BFFFF]">
                  Novo serviço
                </button>
                <Link href={appendOrganizationIdToHref("/org/bookings", organizationId)} className="text-white/50">
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
                  onClick={showServiceDrawer}
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
                  href={appendOrganizationIdToHref(`/org/bookings/${service.id}`, organizationId)}
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
                <p className="text-white/50">Duração</p>
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
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Adicionar convidado</p>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <label className="flex flex-col gap-1 text-white/60">
                      Nome
                      <input
                        type="text"
                        className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                        value={inviteName}
                        onChange={(event) => setInviteName(event.target.value)}
                        placeholder="Opcional"
                        disabled={inviteSaving}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-white/60">
                      Contacto
                      <input
                        type="text"
                        className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                        value={inviteContact}
                        onChange={(event) => setInviteContact(event.target.value)}
                        placeholder="Email ou telemóvel"
                        disabled={inviteSaving}
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-[12px] text-white/60">
                    Mensagem (opcional)
                    <textarea
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                      rows={2}
                      value={inviteMessage}
                      onChange={(event) => setInviteMessage(event.target.value)}
                      placeholder="Texto curto"
                      disabled={inviteSaving}
                    />
                  </label>
                  {inviteError && <p className="text-[11px] text-red-200">{inviteError}</p>}
                  <button
                    type="button"
                    className="w-full rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                    onClick={handleInviteCreate}
                    disabled={inviteSaving || !inviteContact.trim()}
                  >
                    {inviteSaving ? "A enviar..." : "Enviar convite"}
                  </button>
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

            {splitState && (
              <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pagamento dividido</p>
                    <p className="text-[12px] text-white/60">Divide o valor pelos convidados.</p>
                  </div>
                  {splitState.status !== "NONE" && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                      {splitState.status === "OPEN"
                        ? "Ativo"
                        : splitState.status === "SETTLING"
                          ? "Em acerto"
                        : splitState.status === "SETTLED"
                          ? "Concluído"
                          : splitState.status === "CHARGE_FAILED"
                            ? "Falha de cobrança"
                            : splitState.status === "DEBT_OPEN"
                              ? "Dívida aberta"
                          : "Cancelado"}
                    </span>
                  )}
                </div>

                {splitState.loading ? (
                  <div className="h-16 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[12px] text-white/70">
                      <span>Total da reserva</span>
                      <span className="text-white">{formatCurrency(splitState.totalCents, splitState.currency)}</span>
                    </div>
                    {splitState.status !== "NONE" && (
                      <div className="flex items-center justify-between text-[12px] text-white/70">
                        <span>Pago</span>
                        <span className="text-white">{formatCurrency(splitState.paidCents, splitState.currency)}</span>
                      </div>
                    )}

                    {!splitEditorOpen && splitState.status === "NONE" && (
                      <button
                        type="button"
                        className="w-full rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15"
                        onClick={() => {
                          splitDirtyRef.current = false;
                          setSplitEditorOpen(true);
                        }}
                        disabled={splitLocked || splitState.participants.length === 0}
                      >
                        Configurar split
                      </button>
                    )}
                    {splitLocked && (
                      <p className="text-[11px] text-white/50">
                        Split bloqueado. A reserva está encerrada ou já recebeu pagamentos.
                      </p>
                    )}
                    {!splitLocked && splitState.participants.length === 0 && (
                      <p className="text-[11px] text-white/50">
                        Sem convites. O split precisa de convidados associados à reserva.
                      </p>
                    )}

                    {splitEditorOpen && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-[12px]">
                          <label className="flex flex-col gap-1 text-white/60">
                            Modo
                            <select
                              className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                              value={splitState.pricingMode}
                              onChange={(event) => {
                                splitDirtyRef.current = true;
                                setSplitState((prev) =>
                                  prev ? { ...prev, pricingMode: event.target.value as SplitState["pricingMode"] } : prev,
                                );
                              }}
                              disabled={splitState.saving || splitLocked}
                            >
                              <option value="FIXED">Preço igual</option>
                              <option value="DYNAMIC">Dinâmico</option>
                            </select>
                          </label>
                          {splitState.pricingMode === "DYNAMIC" && (
                            <label className="flex flex-col gap-1 text-white/60">
                              Dinâmico por
                              <select
                                className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                                value={splitState.dynamicMode}
                                onChange={(event) => {
                                  splitDirtyRef.current = true;
                                  setSplitState((prev) =>
                                    prev ? { ...prev, dynamicMode: event.target.value as SplitState["dynamicMode"] } : prev,
                                  );
                                }}
                                disabled={splitState.saving || splitLocked}
                              >
                                <option value="AMOUNT">Valor</option>
                                <option value="PERCENT">Percentagem</option>
                              </select>
                            </label>
                          )}
                        </div>

                        {splitState.pricingMode === "FIXED" && (
                          <label className="flex flex-col gap-1 text-[12px] text-white/60">
                            Preço por pessoa
                            <input
                              type="text"
                              className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                              placeholder="0.00"
                              value={splitState.fixedShare}
                              onChange={(event) => {
                                splitDirtyRef.current = true;
                                setSplitState((prev) => (prev ? { ...prev, fixedShare: event.target.value } : prev));
                              }}
                              disabled={splitState.saving || splitLocked}
                            />
                          </label>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-white/55">
                          <span>Convidados incluídos</span>
                          <button
                            type="button"
                            className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:border-white/40"
                            onClick={applyEqualSplit}
                            disabled={splitState.saving || splitLocked}
                          >
                            Repartir automaticamente
                          </button>
                        </div>

                        <div className="space-y-2">
                          {splitState.participants.length === 0 && (
                            <p className="text-[12px] text-white/50">Sem convites disponíveis.</p>
                          )}
                          {splitState.participants.map((participant) => {
                            const isLocked = splitState.saving || splitLocked;
                            const showAmount =
                              splitState.pricingMode === "DYNAMIC" && splitState.dynamicMode === "AMOUNT";
                            const showPercent =
                              splitState.pricingMode === "DYNAMIC" && splitState.dynamicMode === "PERCENT";
                            return (
                              <div
                                key={`split-${participant.inviteId}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              >
                                <div>
                                  <p className="text-sm text-white">{participant.label}</p>
                                  {participant.contact && (
                                    <p className="text-[11px] text-white/55">{participant.contact}</p>
                                  )}
                                  {participant.paidAt && (
                                    <p className="text-[11px] text-emerald-200/80">Pago</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 text-[11px] text-white/60">
                                    <input
                                      type="checkbox"
                                      checked={participant.include}
                                      onChange={(event) =>
                                        updateSplitParticipant(participant.inviteId, { include: event.target.checked })
                                      }
                                      disabled={isLocked}
                                    />
                                    Incluir
                                  </label>
                                  {splitState.pricingMode === "FIXED" && (
                                    <span className="text-[11px] text-white/70">
                                      {splitState.fixedShare ? `${splitState.fixedShare} ${splitState.currency}` : "--"}
                                    </span>
                                  )}
                                  {showAmount && (
                                    <input
                                      type="text"
                                      className="w-24 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white"
                                      placeholder="0.00"
                                      value={participant.amount}
                                      onChange={(event) =>
                                        updateSplitParticipant(participant.inviteId, { amount: event.target.value })
                                      }
                                      disabled={isLocked || !participant.include}
                                    />
                                  )}
                                  {showPercent && (
                                    <input
                                      type="text"
                                      className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white"
                                      placeholder="0%"
                                      value={participant.percent}
                                      onChange={(event) =>
                                        updateSplitParticipant(participant.inviteId, { percent: event.target.value })
                                      }
                                      disabled={isLocked || !participant.include}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <label className="flex flex-col gap-1 text-[12px] text-white/60">
                          Prazo limite (opcional)
                          <input
                            type="datetime-local"
                            className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                                    value={splitState.deadlineAt}
                                    onChange={(event) => {
                                      splitDirtyRef.current = true;
                                      setSplitState((prev) => (prev ? { ...prev, deadlineAt: event.target.value } : prev));
                                    }}
                                    disabled={splitState.saving || splitLocked}
                                  />
                                </label>

                        {splitSummary?.diffLabel && (
                          <p className="text-[11px] text-white/55">{splitSummary.diffLabel}</p>
                        )}
                        {splitSummary?.message && (
                          <p className="text-[11px] text-red-200">{splitSummary.message}</p>
                        )}
                        {splitState.error && (
                          <p className="text-[11px] text-red-200">{splitState.error}</p>
                        )}

                        <button
                          type="button"
                          className="w-full rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                          onClick={saveSplit}
                          disabled={
                            splitState.saving ||
                            splitLocked ||
                            !splitSummary?.valid
                          }
                        >
                          {splitState.saving
                            ? "A guardar..."
                            : splitState.status === "NONE"
                              ? "Ativar split"
                              : "Atualizar split"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <BookingChargesPanel
              bookingId={drawerBooking.id}
              organizationId={organizationId ?? null}
              defaultCurrency={drawerBooking.currency ?? "EUR"}
              disabled={drawerBookingClosed}
            />

            <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Chat</p>
                  <p className="text-[12px] text-white/60">Conversa direta com o cliente.</p>
                </div>
              </div>
              <div className="space-y-2">
                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  rows={3}
                  placeholder="Escreve a primeira mensagem para iniciar o chat."
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10"
                  disabled={chatSending || drawerBookingClosed}
                />
                {chatError ? <p className="text-[11px] text-red-200">{chatError}</p> : null}
                <div className="flex items-center justify-between">
                  {chatConversationId ? (
                    <Link
                      href={
                        organizationId
                          ? buildOrgHref(organizationId, "/chat", { conversationId: chatConversationId })
                          : buildOrgHubHref("/organizations")
                      }
                      className={cn(CTA_SECONDARY, "text-[11px]")}
                    >
                      Abrir chat
                    </Link>
                  ) : (
                    <span className={cn(DASHBOARD_MUTED, "text-[11px]")}>
                      O chat só aparece após a primeira mensagem.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSendChat}
                    disabled={chatSending || drawerBookingClosed || !chatDraft.trim()}
                    className={cn(CTA_PRIMARY, "text-[11px]")}
                  >
                    {chatSending ? "A enviar..." : "Enviar mensagem"}
                  </button>
                </div>
              </div>
            </div>

            {!drawerBookingClosed && (
              <div className="mt-6 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Reagendar</p>
                  <p className="text-[12px] text-white/60">Escolhe nova data e hora.</p>
                </div>
                {drawerBooking.changeRequest?.status === "PENDING" && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                    Pedido pendente até{" "}
                    {new Date(drawerBooking.changeRequest.expiresAt).toLocaleString("pt-PT", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    .
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <label className="flex flex-col gap-1 text-white/60">
                    Data
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(event) => setRescheduleDate(event.target.value)}
                      disabled={drawerBooking.changeRequest?.status === "PENDING"}
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
                      disabled={drawerBooking.changeRequest?.status === "PENDING"}
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                </div>
                {rescheduleError && (
                  <p className="text-[11px] text-red-200">{rescheduleError}</p>
                )}
                {rescheduleNotice && (
                  <p className="text-[11px] text-emerald-200">{rescheduleNotice}</p>
                )}
                <button
                  type="button"
                  className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] text-white hover:bg-white/20 disabled:opacity-60"
                  onClick={handleReschedule}
                  disabled={rescheduleBusy || drawerBooking.changeRequest?.status === "PENDING"}
                >
                  {rescheduleBusy ? "A reagendar..." : "Reagendar reserva"}
                </button>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {drawerBooking.service?.id && (
                <Link href={appendOrganizationIdToHref(`/org/bookings/${drawerBooking.service.id}`, organizationId)} className={CTA_SECONDARY}>
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
                      onClick={showServiceDrawer}
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
                    <option value="">Atribuição automática</option>
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
                  <AddressCombobox
                    label="Morada (Apple Maps)"
                    value={createAddressQuery}
                    onValueChange={(next) => {
                      setCreateAddressQuery(next);
                      if (!next.trim()) {
                        setCreateAddressLabel(null);
                      }
                    }}
                    addressId={createAddressId}
                    onAddressIdChange={(next) => {
                      setCreateAddressId(next);
                      if (!next) {
                        setCreateAddressLabel(null);
                      }
                    }}
                    onDetailsResolved={(details: GeoDetailsItem | null) => {
                      if (!details?.addressId) {
                        setCreateAddressLabel(null);
                        return;
                      }
                      setCreateAddressLabel(details.formattedAddress?.trim() || details.address?.trim() || null);
                    }}
                    minChars={2}
                    maxItems={10}
                    enableRecents
                    enableGeolocationCta
                  />
                  {createAddressId && (
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                      Morada confirmada: {createAddressLabel || createAddressQuery}
                    </div>
                  )}
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
