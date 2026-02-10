"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripePublic";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pageClass = "min-h-screen w-full text-white";

const cardClass =
  "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

const BOOKING_HOLD_MINUTES = 10;

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
  availabilityId: number | null;
  pendingExpiresAt: string | null;
  reviewId: number | null;
  assignmentMode?: string | null;
  partySize?: number | null;
  professional?: { id: number; name: string; avatarUrl: string | null } | null;
  resource?: { id: number; label: string; capacity: number } | null;
  service: { id: number; title: string | null } | null;
  court: { id: number; name: string | null; isActive?: boolean | null } | null;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
  } | null;
  cancellation: {
    allowed: boolean;
    reason: string | null;
    deadline: string | null;
  };
  reschedule: {
    allowed: boolean;
    reason: string | null;
    deadline: string | null;
  };
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

type Response = {
  ok: boolean;
  items: BookingItem[];
  error?: string;
};

type BookingInviteItem = {
  id: number;
  token: string;
  targetName: string | null;
  targetContact: string | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  respondedAt: string | null;
  createdAt: string;
};

type SplitParticipantForm = {
  inviteId: number;
  label: string;
  contact: string | null;
  status: BookingInviteItem["status"];
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
  status: "NONE" | "OPEN" | "COMPLETED" | "CANCELLED";
  pricingMode: "FIXED" | "DYNAMIC";
  dynamicMode: "AMOUNT" | "PERCENT";
  fixedShare: string;
  deadlineAt: string;
  participants: SplitParticipantForm[];
  totalCents: number;
  paidCents: number;
  currency: string;
};

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

function formatBookingStatus(status: string) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "PENDING_CONFIRMATION" || status === "PENDING") return "Pendente";
  if (status === "COMPLETED") return "Concluída";
  if (status === "DISPUTED") return "Em disputa";
  if (status === "NO_SHOW") return "No-show";
  return "Cancelada";
}

function formatInviteStatus(status: string) {
  if (status === "ACCEPTED") return "Aceite";
  if (status === "DECLINED") return "Recusado";
  return "Pendente";
}

function formatHoldDeadline(pendingExpiresAt: string | null, createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const pending = pendingExpiresAt ? new Date(pendingExpiresAt) : null;
  const expiresAt =
    pending && !Number.isNaN(pending.getTime())
      ? pending
      : new Date(created.getTime() + BOOKING_HOLD_MINUTES * 60 * 1000);
  if (Number.isNaN(expiresAt.getTime())) return null;
  return expiresAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function formatCentsInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function parseAmountToCents(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function parsePercentToBps(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function distributeEvenly(total: number, count: number) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, idx) => base + (idx < remainder ? 1 : 0));
}

export default function MinhasReservasPage() {
  const { data, isLoading, mutate } = useSWR<Response>("/api/me/reservas", fetcher);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [cancelPreview, setCancelPreview] = useState<{
    bookingId: number;
    loading: boolean;
    saving: boolean;
    error: string | null;
    allowed: boolean | null;
    deadline: string | null;
    refund: null | {
      currency: string;
      totalCents: number;
      penaltyCents: number;
      refundCents: number;
      feesRetainedCents?: number;
      rule: string;
    };
  } | null>(null);
  const [rescheduleState, setRescheduleState] = useState<{
    bookingId: number;
    day: string;
    loading: boolean;
    saving: boolean;
    error: string | null;
    slots: Array<{ startsAt: string }>;
    selectedStartsAt: string | null;
  } | null>(null);
  const [changeAction, setChangeAction] = useState<{
    bookingId: number;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [changePayment, setChangePayment] = useState<{
    bookingId: number;
    requestId: number;
    clientSecret: string;
    amountCents: number;
    currency: string;
  } | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<
      number,
      { open: boolean; rating: number; comment: string; saving: boolean; error: string | null }
    >
  >({});
  const [inviteState, setInviteState] = useState<{
    bookingId: number;
    loading: boolean;
    saving: boolean;
    error: string | null;
    notice: string | null;
    items: BookingInviteItem[];
    contact: string;
    name: string;
    message: string;
    copiedToken: string | null;
  } | null>(null);
  const [splitState, setSplitState] = useState<SplitState | null>(null);
  const [splitEditorOpen, setSplitEditorOpen] = useState(false);

  const items = data?.items ?? [];
  const loadError = data && data.ok === false ? data.error ?? "Erro ao carregar reservas." : null;

  const grouped = useMemo(() => {
    const upcoming: BookingItem[] = [];
    const past: BookingItem[] = [];
    const now = Date.now();
    items.forEach((item) => {
      const startAt = new Date(item.startsAt).getTime();
      if (!Number.isNaN(startAt) && startAt >= now) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    });
    return { upcoming, past };
  }, [items]);

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
        diffLabel: diff === 0 ? "Total certo" : `Diferença: ${formatMoney(diff, splitState.currency)}`,
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
      diffLabel: diff === 0 ? "Total certo" : `Diferença: ${formatMoney(diff, splitState.currency)}`,
    };
  }, [splitState]);

  const handleCancel = async (bookingId: number) => {
    if (cancelingId) return;
    setCancelPreview({
      bookingId,
      loading: true,
      saving: false,
      error: null,
      allowed: null,
      deadline: null,
      refund: null,
    });
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/cancel/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao preparar cancelamento.");
      }
      setCancelPreview((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              allowed: Boolean(json.allowed),
              deadline: typeof json.deadline === "string" ? json.deadline : null,
              refund: json.refund ?? null,
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao preparar cancelamento.";
      setCancelPreview((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const closeCancelPreview = () => setCancelPreview(null);

  const confirmCancel = async () => {
    if (!cancelPreview || cancelPreview.saving) return;
    setCancelPreview({ ...cancelPreview, saving: true, error: null });
    setCancelingId(cancelPreview.bookingId);
    try {
      const res = await fetch(`/api/me/reservas/${cancelPreview.bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao cancelar reserva.");
      }
      closeCancelPreview();
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar reserva.";
      setCancelPreview((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    } finally {
      setCancelingId(null);
    }
  };

  const openReschedule = async (booking: BookingItem) => {
    if (!booking.service) return;
    const day = new Date(booking.startsAt).toISOString().slice(0, 10);
    setRescheduleState({
      bookingId: booking.id,
      day,
      loading: true,
      saving: false,
      error: null,
      slots: [],
      selectedStartsAt: null,
    });
    try {
      const qs = new URLSearchParams({ day });
      if (booking.assignmentMode === "PROFESSIONAL" && booking.professional?.id) {
        qs.set("professionalId", String(booking.professional.id));
      }
      if (booking.assignmentMode === "RESOURCE" && booking.partySize) {
        qs.set("partySize", String(booking.partySize));
      }
      if (booking.durationMinutes) {
        qs.set("durationMinutes", String(booking.durationMinutes));
      }
      const res = await fetch(`/api/servicos/${booking.service.id}/slots?${qs.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao carregar horários.");
      }
      const slots = Array.isArray(json?.items)
        ? json.items
            .filter((item: any) => typeof item?.startsAt === "string")
            .map((item: any) => ({ startsAt: item.startsAt as string }))
        : [];
      setRescheduleState((prev) =>
        prev ? { ...prev, slots, loading: false } : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar horários.";
      setRescheduleState((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const handleChangeRequestResponse = async (booking: BookingItem, action: "ACCEPT" | "DECLINE") => {
    if (!booking.changeRequest) return;
    if (changeAction?.loading) return;
    setChangeAction({ bookingId: booking.id, loading: true, error: null });
    try {
      const res = await fetch(`/api/me/reservas/${booking.id}/reschedule/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestId: booking.changeRequest.id,
          paymentMethod: "card",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao responder ao reagendamento.");
      }
      if (json.payment?.clientSecret) {
        setChangePayment({
          bookingId: booking.id,
          requestId: booking.changeRequest.id,
          clientSecret: json.payment.clientSecret,
          amountCents: json.payment.amountCents,
          currency: json.payment.currency ?? booking.currency ?? "EUR",
        });
      } else {
        await mutate();
      }
      setChangeAction({ bookingId: booking.id, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao responder ao reagendamento.";
      setChangeAction({ bookingId: booking.id, loading: false, error: message });
    }
  };

  const handleChangePaymentSuccess = async () => {
    setChangePayment(null);
    await mutate();
  };

  const closeReschedule = () => setRescheduleState(null);

  const setRescheduleDay = async (booking: BookingItem, day: string) => {
    if (!booking.service) return;
    setRescheduleState((prev) =>
      prev ? { ...prev, day, loading: true, error: null, slots: [], selectedStartsAt: null } : prev,
    );
    try {
      const qs = new URLSearchParams({ day });
      if (booking.assignmentMode === "PROFESSIONAL" && booking.professional?.id) {
        qs.set("professionalId", String(booking.professional.id));
      }
      if (booking.assignmentMode === "RESOURCE" && booking.partySize) {
        qs.set("partySize", String(booking.partySize));
      }
      if (booking.durationMinutes) {
        qs.set("durationMinutes", String(booking.durationMinutes));
      }
      const res = await fetch(`/api/servicos/${booking.service.id}/slots?${qs.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao carregar horários.");
      }
      const slots = Array.isArray(json?.items)
        ? json.items
            .filter((item: any) => typeof item?.startsAt === "string")
            .map((item: any) => ({ startsAt: item.startsAt as string }))
        : [];
      setRescheduleState((prev) => (prev ? { ...prev, slots, loading: false } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar horários.";
      setRescheduleState((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleState || rescheduleState.saving) return;
    if (!rescheduleState.selectedStartsAt) {
      setRescheduleState((prev) => (prev ? { ...prev, error: "Escolhe um horário." } : prev));
      return;
    }
    setRescheduleState((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const res = await fetch(`/api/me/reservas/${rescheduleState.bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: rescheduleState.selectedStartsAt }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao reagendar.");
      }
      closeReschedule();
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao reagendar.";
      setRescheduleState((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    }
  };

  const openReview = (bookingId: number) => {
    setReviewDrafts((prev) => {
      const current = prev[bookingId];
      return {
        ...prev,
        [bookingId]: {
          open: true,
          rating: current?.rating ?? 5,
          comment: current?.comment ?? "",
          saving: false,
          error: null,
        },
      };
    });
  };

  const closeReview = (bookingId: number) => {
    setReviewDrafts((prev) => {
      const current = prev[bookingId];
      if (!current) return prev;
      return { ...prev, [bookingId]: { ...current, open: false, error: null } };
    });
  };

  const updateReviewDraft = (bookingId: number, patch: Partial<{ rating: number; comment: string }>) => {
    setReviewDrafts((prev) => {
      const current = prev[bookingId] ?? { open: true, rating: 5, comment: "", saving: false, error: null };
      return { ...prev, [bookingId]: { ...current, ...patch } };
    });
  };

  const submitReview = async (bookingId: number) => {
    const draft = reviewDrafts[bookingId] ?? { rating: 5, comment: "", open: true, saving: false, error: null };
    setReviewDrafts((prev) => ({
      ...prev,
      [bookingId]: { ...draft, open: true, saving: true, error: null },
    }));
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: draft.rating, comment: draft.comment }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao submeter review.");
      }
      setReviewDrafts((prev) => {
        const current = prev[bookingId];
        if (!current) return prev;
        return { ...prev, [bookingId]: { ...current, open: false, saving: false, error: null } };
      });
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao submeter review.";
      setReviewDrafts((prev) => {
        const current = prev[bookingId] ?? { open: true, rating: 5, comment: "", saving: false, error: null };
        return { ...prev, [bookingId]: { ...current, open: true, saving: false, error: message } };
      });
    }
  };

  const toggleChat = (bookingId: number) => {
    setOpenChatId((prev) => (prev === bookingId ? null : bookingId));
  };

  const openInvites = async (bookingId: number) => {
    setInviteState({
      bookingId,
      loading: true,
      saving: false,
      error: null,
      notice: null,
      items: [],
      contact: "",
      name: "",
      message: "",
      copiedToken: null,
    });
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/invites`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao carregar convites.");
      }
      const inviteItems = Array.isArray(json?.data?.items)
        ? json.data.items.map((invite: any) => ({
            id: invite.id,
            token: invite.token,
            targetName: invite.targetName ?? null,
            targetContact: invite.targetContact ?? null,
            message: invite.message ?? null,
            status: invite.status,
            respondedAt: invite.respondedAt ?? null,
            createdAt: invite.createdAt,
          }))
        : [];
      setInviteState((prev) => (prev ? { ...prev, loading: false, items: inviteItems } : prev));

      const booking = items.find((item) => item.id === bookingId) ?? null;
      if (!booking) return;

      setSplitEditorOpen(false);
      setSplitState({
        bookingId,
        loading: true,
        saving: false,
        error: null,
        status: "NONE",
        pricingMode: "FIXED",
        dynamicMode: "AMOUNT",
        fixedShare: "",
        deadlineAt: "",
        participants: [],
        totalCents: booking.price ?? 0,
        paidCents: 0,
        currency: booking.currency ?? "EUR",
      });

      const splitRes = await fetch(`/api/me/reservas/${bookingId}/split`);
      const splitJson = await splitRes.json().catch(() => null);
      if (!splitRes.ok || !splitJson?.ok) {
        setSplitState((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: splitJson?.message || splitJson?.error || "Erro ao carregar pagamento dividido.",
              }
            : prev,
        );
        return;
      }

      const split = splitJson?.data?.split ?? null;
      const baseTotal = split?.baseTotalCents ?? booking.price ?? 0;
      const paidCents = split?.paidCents ?? 0;
      const participants: SplitParticipantForm[] = inviteItems.map((invite) => {
        const label = invite.targetName || invite.targetContact || "Convidado";
        const splitParticipant = split?.participants?.find((item: any) => item.inviteId === invite.id);
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
      });

      const fixedShare =
        split?.pricingMode === "FIXED" && typeof split?.shareCents === "number"
          ? formatCentsInput(split.shareCents)
          : "";

      const autoFixedShare =
        split && split.pricingMode === "FIXED"
          ? fixedShare
          : (() => {
              const included = participants.filter((p) => p.include);
              if (included.length === 0) return "";
              if (baseTotal % included.length !== 0) return "";
              return formatCentsInput(baseTotal / included.length);
            })();

      if (!split) {
        const included = participants.filter((p) => p.include);
        if (included.length > 0) {
          const evenCents = distributeEvenly(baseTotal, included.length);
          included.forEach((participant, idx) => {
            participant.amount = formatCentsInput(evenCents[idx] ?? 0);
            participant.percent = ((evenCents[idx] ?? 0) / (baseTotal || 1) * 100)
              .toFixed(2)
              .replace(/\.00$/, "");
          });
        }
      }

      setSplitState((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              status: split?.status ?? "NONE",
              pricingMode: split?.pricingMode === "DYNAMIC" ? "DYNAMIC" : "FIXED",
              dynamicMode: split?.pricingMode === "DYNAMIC" ? "AMOUNT" : "AMOUNT",
              fixedShare: autoFixedShare,
              deadlineAt: split?.deadlineAt ? split.deadlineAt.slice(0, 16) : "",
              participants,
              totalCents: baseTotal,
              paidCents,
              currency: split?.currency ?? booking.currency ?? "EUR",
            }
          : prev,
      );
      setSplitEditorOpen(Boolean(split));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar convites.";
      setInviteState((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
      setSplitState((prev) =>
        prev ? { ...prev, loading: false, error: message } : prev,
      );
    }
  };

  const closeInvites = () => {
    setInviteState(null);
    setSplitState(null);
    setSplitEditorOpen(false);
  };

  const submitInvite = async () => {
    if (!inviteState || inviteState.saving) return;
    const contact = inviteState.contact.trim();
    if (!contact) {
      setInviteState((prev) =>
        prev ? { ...prev, error: "Indica email ou contacto do convidado.", notice: null } : prev,
      );
      return;
    }
    setInviteState((prev) => (prev ? { ...prev, saving: true, error: null, notice: null } : prev));
    try {
      const res = await fetch(`/api/me/reservas/${inviteState.bookingId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: [
            {
              contact,
              name: inviteState.name.trim() || undefined,
              message: inviteState.message.trim() || undefined,
            },
          ],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao enviar convite.");
      }
      const created = Array.isArray(json?.data?.items) ? json.data.items : [];
      if (created.length === 0) {
        setInviteState((prev) =>
          prev ? { ...prev, saving: false, error: "Esse convidado já existe.", notice: null } : prev,
        );
        return;
      }
      setInviteState((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error: null,
              notice: "Convite enviado.",
              contact: "",
              name: "",
              message: "",
              items: [
                ...created.map((invite: any) => ({
                  id: invite.id,
                  token: invite.token,
                  targetName: invite.targetName ?? null,
                  targetContact: invite.targetContact ?? null,
                  message: invite.message ?? null,
                  status: invite.status,
                  respondedAt: invite.respondedAt ?? null,
                  createdAt: invite.createdAt,
                })),
                ...prev.items,
              ],
            }
          : prev,
      );
      setSplitState((prev) => {
        if (!prev) return prev;
        const existingIds = new Set(prev.participants.map((p) => p.inviteId));
        const newParticipants = created.map((invite: any) => ({
          inviteId: invite.id,
          label: invite.targetName || invite.targetContact || "Convidado",
          contact: invite.targetContact ?? null,
          status: invite.status,
          include: prev.status === "NONE" ? invite.status !== "DECLINED" : false,
          amount: "",
          percent: "",
          paidAt: null,
        }));
        const merged = [
          ...prev.participants,
          ...newParticipants.filter((p: SplitParticipantForm) => !existingIds.has(p.inviteId)),
        ];
        return { ...prev, participants: merged };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar convite.";
      setInviteState((prev) => (prev ? { ...prev, saving: false, error: message, notice: null } : prev));
    }
  };

  const copyInviteLink = async (token: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${baseUrl}/convites/${token}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        throw new Error("Clipboard not available");
      }
      setInviteState((prev) =>
        prev ? { ...prev, copiedToken: token, notice: "Link copiado.", error: null } : prev,
      );
    } catch (err) {
      setInviteState((prev) =>
        prev ? { ...prev, error: "Não foi possível copiar o link.", notice: null } : prev,
      );
    }
  };

  const updateSplitParticipant = (inviteId: number, patch: Partial<SplitParticipantForm>) => {
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
    setSplitState((prev) => {
      if (!prev) return prev;
      const included = prev.participants.filter((p) => p.include);
      if (included.length === 0 || prev.totalCents <= 0) {
        return prev;
      }
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
    if (splitState.paidCents > 0 || splitState.status === "COMPLETED") return;
    if (!splitSummary?.valid) {
      setSplitState((prev) => (prev ? { ...prev, error: "Revê os valores do split." } : prev));
      return;
    }
    const booking = items.find((item) => item.id === splitState.bookingId) ?? null;
    if (!booking) return;
    const included = splitState.participants.filter((p) => p.include);
    if (included.length === 0) {
      setSplitState((prev) => (prev ? { ...prev, error: "Seleciona pelo menos um convidado." } : prev));
      return;
    }
    if (splitState.totalCents <= 0) {
      setSplitState((prev) => (prev ? { ...prev, error: "Reserva sem valor válido." } : prev));
      return;
    }

    const participantsPayload = included.map((participant) => {
      const base = {
        inviteId: participant.inviteId,
        name: participant.label,
        contact: participant.contact,
      };
      if (splitState.pricingMode === "FIXED") {
        const fixedCents = parseAmountToCents(splitState.fixedShare);
        return { ...base, shareCents: fixedCents };
      }
      if (splitState.dynamicMode === "PERCENT") {
        const percentBps = parsePercentToBps(participant.percent);
        return { ...base, sharePercentBps: percentBps };
      }
      const shareCents = parseAmountToCents(participant.amount);
      return { ...base, shareCents };
    });

    setSplitState((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const res = await fetch(`/api/me/reservas/${splitState.bookingId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingMode: splitState.pricingMode,
          dynamicMode: splitState.pricingMode === "DYNAMIC" ? splitState.dynamicMode : undefined,
          deadlineAt: splitState.deadlineAt ? new Date(splitState.deadlineAt).toISOString() : null,
          participants: participantsPayload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao configurar pagamento dividido.");
      }
      setSplitState((prev) => (prev ? { ...prev, saving: false, error: null } : prev));
      await openInvites(splitState.bookingId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao configurar pagamento dividido.";
      setSplitState((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    }
  };

  return (
    <main className={pageClass}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Reservas</p>
          <h1 className="text-3xl font-semibold text-white">As tuas reservas</h1>
          <p className="text-sm text-white/65">
            Confirmações, horários e cancelamentos num só lugar.
          </p>
        </div>

        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Próximas</h2>
              <p className="text-sm text-white/65">Reservas futuras e pendentes.</p>
            </div>
            <Link href="/descobrir/reservas" className="text-[12px] text-[#6BFFFF]">
              Explorar serviços
            </Link>
          </div>

          {isLoading && (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-20 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && loadError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && items.length === 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Ainda não fizeste reservas.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {grouped.upcoming.map((booking) => {
              const deadlineLabel = formatDeadline(booking.cancellation.deadline);
              const rescheduleDeadlineLabel = formatDeadline(booking.reschedule.deadline);
              const isCancelled = ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status);
              const isCompleted = booking.status === "COMPLETED";
              const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
              const canCancel = booking.cancellation.allowed && !isCancelled && !isCompleted;
              const canReschedule = booking.reschedule.allowed && !isCancelled && !isCompleted;
              const canChat = booking.status === "CONFIRMED";
              const canInvite = ["CONFIRMED", "PENDING", "PENDING_CONFIRMATION"].includes(booking.status);
              const holdDeadline = isPending ? formatHoldDeadline(booking.pendingExpiresAt, booking.createdAt) : null;
              const estimatedStart = booking.estimatedStartsAt ? new Date(booking.estimatedStartsAt) : null;
              const originalStart = new Date(booking.startsAt);
              const showEstimate =
                estimatedStart && !Number.isNaN(estimatedStart.getTime()) && estimatedStart.getTime() !== originalStart.getTime();
              const courtLabel = booking.court?.name
                ? `${booking.court.name}${booking.court.isActive === false ? " (inativo)" : ""}`
                : "";
              const pendingChange = booking.changeRequest?.status === "PENDING";
              const changePriceDelta = booking.changeRequest?.priceDeltaCents ?? 0;
              const changeBusy = changeAction?.bookingId === booking.id && changeAction.loading;
              const changeError = changeAction?.bookingId === booking.id ? changeAction.error : null;
              return (
                <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {booking.service?.title || "Serviço"}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {originalStart.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                        {booking.organization?.publicName || booking.organization?.businessName
                          ? ` · ${booking.organization.publicName || booking.organization.businessName}`
                          : ""}
                        {courtLabel ? ` · ${courtLabel}` : ""}
                        {booking.professional?.name ? ` · ${booking.professional.name}` : ""}
                        {booking.resource?.label ? ` · ${booking.resource.label}` : ""}
                        {booking.partySize ? ` · ${booking.partySize} pax` : ""}
                      </p>
                      {booking.status === "CONFIRMED" && deadlineLabel && (
                        <p className="mt-1 text-[12px] text-white/50">Cancelamento até {deadlineLabel}.</p>
                      )}
                      {booking.status === "CONFIRMED" && rescheduleDeadlineLabel && (
                        <p className="mt-1 text-[12px] text-white/50">Reagendamento até {rescheduleDeadlineLabel}.</p>
                      )}
                      {showEstimate && (
                        <p className="mt-1 text-[12px] text-amber-100/80">
                          Hora estimada: {estimatedStart.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                          {booking.delayMinutes ? ` (+${booking.delayMinutes} min)` : ""}
                        </p>
                      )}
                      {isPending && (
                        <p className="mt-1 text-[12px] text-amber-100/80">
                          Pré-reserva pendente
                          {holdDeadline ? ` · expira às ${holdDeadline}` : ""}
                        </p>
                      )}
                      {pendingChange && booking.changeRequest && (
                        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                          <p className="font-semibold">Pedido de alteração</p>
                          <p className="mt-1 text-[12px] text-amber-100/80">
                            Nova data: {new Date(booking.changeRequest.proposedStartsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                          {changePriceDelta !== 0 && (
                            <p className="mt-1 text-[12px] text-amber-100/80">
                              Diferença: {formatMoney(Math.abs(changePriceDelta), booking.changeRequest.currency || booking.currency || "EUR")}{" "}
                              {changePriceDelta > 0 ? "a pagar" : "a receber"}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-amber-100/70">
                            Responder até {new Date(booking.changeRequest.expiresAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                          {changeError && <p className="mt-1 text-[11px] text-red-200">{changeError}</p>}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-60"
                              onClick={() => handleChangeRequestResponse(booking, "ACCEPT")}
                              disabled={changeBusy}
                            >
                              {changeBusy ? "A confirmar..." : "Aceitar"}
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
                              onClick={() => handleChangeRequestResponse(booking, "DECLINE")}
                              disabled={changeBusy}
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                        {formatBookingStatus(booking.status)}
                      </span>
                      {canChat && (
                        <button
                          type="button"
                          className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/40"
                          onClick={() => toggleChat(booking.id)}
                        >
                          {openChatId === booking.id ? "Fechar chat" : "Falar"}
                        </button>
                      )}
                      {canInvite && (
                        <button
                          type="button"
                          className="rounded-full border border-sky-300/40 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-100 hover:bg-sky-400/15"
                          onClick={() => openInvites(booking.id)}
                        >
                          Convites
                        </button>
                      )}
                      {canReschedule && (
                        <button
                          type="button"
                          className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-400/15"
                          onClick={() => openReschedule(booking)}
                        >
                          Reagendar
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelingId === booking.id}
                        >
                          {cancelingId === booking.id ? "A cancelar..." : "Cancelar"}
                        </button>
                      )}
                    </div>
                  </div>
                  {openChatId === booking.id && (
                    <div className="mt-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                        Chat disponível apenas na app.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={cardClass}>
          <div>
            <h2 className="text-base font-semibold text-white">Histórico</h2>
            <p className="text-sm text-white/65">Reservas já concluídas ou canceladas.</p>
          </div>

          <div className="mt-4 space-y-2">
            {grouped.past.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Ainda não tens histórico de reservas.
              </div>
            )}
            {grouped.past.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {booking.service?.title || "Serviço"}
                    </p>
                    <p className="text-[12px] text-white/60">
                      {new Date(booking.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                      {booking.organization?.publicName || booking.organization?.businessName
                        ? ` · ${booking.organization.publicName || booking.organization.businessName}`
                        : ""}
                      {booking.court?.name
                        ? ` · ${booking.court.name}${booking.court.isActive === false ? " (inativo)" : ""}`
                        : ""}
                      {booking.professional?.name ? ` · ${booking.professional.name}` : ""}
                      {booking.resource?.label ? ` · ${booking.resource.label}` : ""}
                      {booking.partySize ? ` · ${booking.partySize} pax` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                      {formatBookingStatus(booking.status)}
                    </span>
                    {["CONFIRMED", "COMPLETED"].includes(booking.status) && (
                      <button
                        type="button"
                        className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/40"
                        onClick={() => toggleChat(booking.id)}
                      >
                        {openChatId === booking.id ? "Fechar chat" : "Falar"}
                      </button>
                    )}
                  </div>
                </div>
                  {openChatId === booking.id && (
                    <div className="mt-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                        Chat disponível apenas na app.
                      </div>
                    </div>
                  )}
                {booking.status === "COMPLETED" && !booking.reviewId && (
                  <div className="mt-3 space-y-2">
                    {!reviewDrafts[booking.id]?.open ? (
                      <button
                        type="button"
                        className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100"
                        onClick={() => openReview(booking.id)}
                      >
                        Avaliar serviço
                      </button>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] text-white/70">Rating</p>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, idx) => idx + 1).map((value) => {
                              const active = (reviewDrafts[booking.id]?.rating ?? 5) >= value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={`h-7 w-7 rounded-full border text-[11px] ${
                                    active
                                      ? "border-amber-300/60 bg-amber-400/20 text-amber-100"
                                      : "border-white/15 bg-white/5 text-white/60"
                                  }`}
                                  onClick={() => updateReviewDraft(booking.id, { rating: value })}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          placeholder="Comentário (opcional)"
                          value={reviewDrafts[booking.id]?.comment ?? ""}
                          onChange={(e) => updateReviewDraft(booking.id, { comment: e.target.value })}
                        />
                        {reviewDrafts[booking.id]?.error && (
                          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            {reviewDrafts[booking.id]?.error}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:bg-white/20 disabled:opacity-60"
                            onClick={() => submitReview(booking.id)}
                            disabled={reviewDrafts[booking.id]?.saving}
                          >
                            {reviewDrafts[booking.id]?.saving ? "A guardar..." : "Enviar review"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60 hover:bg-white/10"
                            onClick={() => closeReview(booking.id)}
                            disabled={reviewDrafts[booking.id]?.saving}
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {rescheduleState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Reagendar</p>
                <p className="mt-1 text-sm text-white/80">
                  Escolhe um novo horário. A confirmação mantém o mesmo pagamento.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                onClick={closeReschedule}
                disabled={rescheduleState.saving}
              >
                Fechar
              </button>
            </div>

            {(() => {
              const booking = items.find((b) => b.id === rescheduleState.bookingId) ?? null;
              if (!booking) return null;
              return (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-[12px] text-white/70">
                      Dia
                      <input
                        type="date"
                        className="ml-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={rescheduleState.day}
                        onChange={(e) => setRescheduleDay(booking, e.target.value)}
                        disabled={rescheduleState.loading || rescheduleState.saving}
                      />
                    </label>
                    <p className="text-[12px] text-white/60">
                      Atual:{" "}
                      {new Date(booking.startsAt).toLocaleString("pt-PT", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  {rescheduleState.error && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      {rescheduleState.error}
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    {rescheduleState.loading ? (
                      <div className="h-20 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
                    ) : rescheduleState.slots.length === 0 ? (
                      <p className="text-sm text-white/70">Sem horários disponíveis neste dia.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {rescheduleState.slots.map((slot) => {
                          const selected = rescheduleState.selectedStartsAt === slot.startsAt;
                          const label = new Date(slot.startsAt).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <button
                              key={slot.startsAt}
                              type="button"
                              className={`rounded-full border px-3 py-1 text-[12px] ${
                                selected
                                  ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                              }`}
                              onClick={() =>
                                setRescheduleState((prev) =>
                                  prev ? { ...prev, selectedStartsAt: slot.startsAt, error: null } : prev,
                                )
                              }
                              disabled={rescheduleState.saving}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                      onClick={submitReschedule}
                      disabled={rescheduleState.saving || rescheduleState.loading}
                    >
                      {rescheduleState.saving ? "A reagendar..." : "Confirmar reagendamento"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:bg-white/10 disabled:opacity-60"
                      onClick={closeReschedule}
                      disabled={rescheduleState.saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {cancelPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Cancelar</p>
                <p className="mt-1 text-sm text-white/80">Confirma os detalhes antes de cancelar.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                onClick={closeCancelPreview}
                disabled={cancelPreview.saving}
              >
                Fechar
              </button>
            </div>

            {cancelPreview.loading ? (
              <div className="mt-4 h-24 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
            ) : (
              <div className="mt-4 space-y-3">
                {cancelPreview.error && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    {cancelPreview.error}
                  </div>
                )}

                {cancelPreview.allowed === false && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    <p>O prazo de cancelamento já passou.</p>
                    {cancelPreview.deadline && (
                      <p className="mt-2 text-[12px] text-white/50">
                        Deadline: {formatDeadline(cancelPreview.deadline)}
                      </p>
                    )}
                  </div>
                )}

                {cancelPreview.allowed !== false && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
                    {cancelPreview.deadline && (
                      <p className="text-[12px] text-white/50">
                        Podes cancelar até {formatDeadline(cancelPreview.deadline)}.
                      </p>
                    )}
                    {cancelPreview.refund ? (
                      <>
                        <p className="text-white/90">
                          Vais receber{" "}
                          <span className="font-semibold text-white">
                            {(cancelPreview.refund.refundCents / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </span>
                        </p>
                        <div className="grid gap-2 md:grid-cols-3 text-[12px] text-white/60">
                          <div>
                            Total pago: {(cancelPreview.refund.totalCents / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </div>
                          <div>
                            Fees retidas:{" "}
                            {((cancelPreview.refund.feesRetainedCents ?? 0) / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </div>
                          <div>
                            Penalização: {(cancelPreview.refund.penaltyCents / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </div>
                        </div>
                        <p className="text-[12px] text-white/50">
                          Nota: as fees de processamento e da plataforma não são devolvidas no cancelamento do cliente.
                        </p>
                      </>
                    ) : (
                      <p>O reembolso será calculado pela política da organização.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-[12px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                    onClick={confirmCancel}
                    disabled={cancelPreview.saving || cancelPreview.loading || cancelPreview.allowed === false}
                  >
                    {cancelPreview.saving ? "A cancelar..." : "Confirmar cancelamento"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:bg-white/10 disabled:opacity-60"
                    onClick={closeCancelPreview}
                    disabled={cancelPreview.saving}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {inviteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Convites</p>
                <p className="mt-1 text-sm text-white/80">
                  Partilha o convite com os convidados. Eles podem responder pelo link.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                onClick={closeInvites}
                disabled={inviteState.saving}
              >
                Fechar
              </button>
            </div>

            {(() => {
              const booking = items.find((b) => b.id === inviteState.bookingId) ?? null;
              return (
                <div className="mt-4 space-y-4">
                  {booking && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                      <p className="text-sm font-semibold text-white">
                        {booking.service?.title || "Serviço"}
                      </p>
                      <p>
                        {new Date(booking.startsAt).toLocaleString("pt-PT", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {booking.organization?.publicName || booking.organization?.businessName ? (
                        <p className="text-white/60">
                          {booking.organization.publicName || booking.organization.businessName}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {inviteState.loading ? (
                    <div className="h-24 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                        <p className="text-[12px] text-white/60">Novo convite</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="text"
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                            placeholder="Nome (opcional)"
                            value={inviteState.name}
                            onChange={(e) =>
                              setInviteState((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                            }
                            disabled={inviteState.saving}
                          />
                          <input
                            type="text"
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                            placeholder="Email ou telemóvel"
                            value={inviteState.contact}
                            onChange={(e) =>
                              setInviteState((prev) => (prev ? { ...prev, contact: e.target.value } : prev))
                            }
                            disabled={inviteState.saving}
                          />
                        </div>
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          placeholder="Mensagem (opcional)"
                          value={inviteState.message}
                          onChange={(e) =>
                            setInviteState((prev) => (prev ? { ...prev, message: e.target.value } : prev))
                          }
                          disabled={inviteState.saving}
                        />
                        {inviteState.error && (
                          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            {inviteState.error}
                          </div>
                        )}
                        {inviteState.notice && (
                          <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                            {inviteState.notice}
                          </div>
                        )}
                        <button
                          type="button"
                          className="rounded-full border border-sky-300/40 bg-sky-400/10 px-4 py-2 text-[12px] text-sky-100 hover:bg-sky-400/15 disabled:opacity-60"
                          onClick={submitInvite}
                          disabled={inviteState.saving}
                        >
                          {inviteState.saving ? "A enviar..." : "Enviar convite"}
                        </button>
                      </div>

                      {splitState && booking && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[12px] text-white/60">Pagamento dividido</p>
                              <p className="text-[11px] text-white/50">
                                Divide o valor pelos convidados para confirmar a reserva.
                              </p>
                            </div>
                            {splitState.status !== "NONE" && (
                              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                                {splitState.status === "OPEN"
                                  ? "Ativo"
                                  : splitState.status === "COMPLETED"
                                    ? "Concluído"
                                    : "Cancelado"}
                              </span>
                            )}
                          </div>

                          {splitState.loading ? (
                            <div className="h-20 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
                          ) : (
                            <div className="space-y-3 text-[12px] text-white/70">
                              <div className="flex items-center justify-between">
                                <span>Valor base da reserva</span>
                                <span className="text-white">{formatMoney(splitState.totalCents, splitState.currency)}</span>
                              </div>
                              {splitState.status !== "NONE" && (
                                <div className="flex items-center justify-between">
                                  <span>Pago</span>
                                  <span className="text-white">
                                    {formatMoney(splitState.paidCents, splitState.currency)}
                                  </span>
                                </div>
                              )}

                              {!splitEditorOpen && splitState.status === "NONE" && (
                                <button
                                  type="button"
                                  className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15"
                                  onClick={() => setSplitEditorOpen(true)}
                                >
                                  Configurar pagamento dividido
                                </button>
                              )}

                              {splitEditorOpen && (
                                <div className="space-y-3">
                                  <div className="grid gap-2 md:grid-cols-2">
                                    <label className="flex flex-col gap-1 text-[11px] text-white/60">
                                      Modo
                                      <select
                                        className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                                        value={splitState.pricingMode}
                                        onChange={(e) =>
                                          setSplitState((prev) =>
                                            prev ? { ...prev, pricingMode: e.target.value as SplitState["pricingMode"] } : prev,
                                          )
                                        }
                                        disabled={splitState.saving || splitState.paidCents > 0 || splitState.status === "COMPLETED"}
                                      >
                                        <option value="FIXED">Preço igual por pessoa</option>
                                        <option value="DYNAMIC">Preço dinâmico</option>
                                      </select>
                                    </label>
                                    {splitState.pricingMode === "DYNAMIC" && (
                                      <label className="flex flex-col gap-1 text-[11px] text-white/60">
                                        Dinâmico por
                                        <select
                                          className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                                          value={splitState.dynamicMode}
                                          onChange={(e) =>
                                            setSplitState((prev) =>
                                              prev ? { ...prev, dynamicMode: e.target.value as SplitState["dynamicMode"] } : prev,
                                            )
                                          }
                                          disabled={splitState.saving || splitState.paidCents > 0 || splitState.status === "COMPLETED"}
                                        >
                                          <option value="AMOUNT">Valor</option>
                                          <option value="PERCENT">Percentagem</option>
                                        </select>
                                      </label>
                                    )}
                                  </div>

                                  {splitState.pricingMode === "FIXED" && (
                                    <label className="flex flex-col gap-1 text-[11px] text-white/60">
                                      Preço por pessoa
                                      <input
                                        type="text"
                                        className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                                        placeholder="0.00"
                                        value={splitState.fixedShare}
                                        onChange={(e) =>
                                          setSplitState((prev) => (prev ? { ...prev, fixedShare: e.target.value } : prev))
                                        }
                                        disabled={splitState.saving || splitState.paidCents > 0 || splitState.status === "COMPLETED"}
                                      />
                                    </label>
                                  )}

                                  <div className="flex items-center justify-between text-[11px] text-white/55">
                                    <span>Convidados incluídos</span>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:border-white/40"
                                      onClick={applyEqualSplit}
                                      disabled={splitState.saving || splitState.paidCents > 0 || splitState.status === "COMPLETED"}
                                    >
                                      Repartir automaticamente
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {splitState.participants.map((participant) => {
                                      const isLocked =
                                        splitState.saving || splitState.paidCents > 0 || splitState.status === "COMPLETED";
                                      const showAmount =
                                        splitState.pricingMode === "DYNAMIC" && splitState.dynamicMode === "AMOUNT";
                                      const showPercent =
                                        splitState.pricingMode === "DYNAMIC" && splitState.dynamicMode === "PERCENT";
                                      return (
                                        <div key={participant.inviteId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                          <div className="min-w-[180px]">
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
                                                onChange={(e) => updateSplitParticipant(participant.inviteId, { include: e.target.checked })}
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
                                                onChange={(e) => updateSplitParticipant(participant.inviteId, { amount: e.target.value })}
                                                disabled={isLocked || !participant.include}
                                              />
                                            )}
                                            {showPercent && (
                                              <input
                                                type="text"
                                                className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white"
                                                placeholder="0%"
                                                value={participant.percent}
                                                onChange={(e) => updateSplitParticipant(participant.inviteId, { percent: e.target.value })}
                                                disabled={isLocked || !participant.include}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <label className="flex flex-col gap-1 text-[11px] text-white/60">
                                    Prazo limite (opcional)
                                    <input
                                      type="datetime-local"
                                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                                      value={splitState.deadlineAt}
                                      onChange={(e) =>
                                        setSplitState((prev) => (prev ? { ...prev, deadlineAt: e.target.value } : prev))
                                      }
                                      disabled={splitState.saving || splitState.paidCents > 0 || splitState.status === "COMPLETED"}
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
                                    className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                                    onClick={saveSplit}
                                    disabled={
                                      splitState.saving ||
                                      splitState.paidCents > 0 ||
                                      splitState.status === "COMPLETED" ||
                                      !splitSummary?.valid
                                    }
                                  >
                                    {splitState.saving ? "A guardar..." : splitState.status === "NONE" ? "Ativar split" : "Atualizar split"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                        <p className="text-[12px] text-white/60">Convites enviados</p>
                        {inviteState.items.length === 0 ? (
                          <p className="text-sm text-white/70">Ainda não enviaste convites.</p>
                        ) : (
                          <div className="space-y-2">
                            {inviteState.items.map((invite) => {
                              const label = invite.targetName || invite.targetContact || "Convidado";
                              const respondedAt = invite.respondedAt
                                ? new Date(invite.respondedAt).toLocaleString("pt-PT", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : null;
                              const statusLabel = formatInviteStatus(invite.status);
                              const statusClass =
                                invite.status === "ACCEPTED"
                                  ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                                  : invite.status === "DECLINED"
                                    ? "border-red-400/40 bg-red-500/10 text-red-100"
                                    : "border-white/15 bg-white/10 text-white/70";
                              const inviteHref = `/convites/${invite.token}`;
                              return (
                                <div key={invite.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-white">{label}</p>
                                      {invite.targetContact && (
                                        <p className="text-[12px] text-white/60">{invite.targetContact}</p>
                                      )}
                                      {respondedAt && (
                                        <p className="text-[12px] text-white/50">Respondido em {respondedAt}</p>
                                      )}
                                    </div>
                                    <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClass}`}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Link
                                      href={inviteHref}
                                      target="_blank"
                                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                                    >
                                      Abrir convite
                                    </Link>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                                      onClick={() => copyInviteLink(invite.token)}
                                    >
                                      {inviteState.copiedToken === invite.token ? "Copiado" : "Copiar link"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {changePayment && (
        <BookingChangePaymentModal
          clientSecret={changePayment.clientSecret}
          amountCents={changePayment.amountCents}
          currency={changePayment.currency}
          onClose={() => setChangePayment(null)}
          onSuccess={handleChangePaymentSuccess}
        />
      )}
    </main>
  );
}

function BookingChangePaymentModal(props: {
  clientSecret: string;
  amountCents: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const stripePromise = useMemo(() => {
    try {
      return loadStripe(getStripePublishableKey());
    } catch {
      return null;
    }
  }, []);

  if (!stripePromise) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          Pagamentos indisponíveis. Tenta novamente mais tarde.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Pagamento</p>
            <p className="mt-1 text-sm text-white/80">
              Diferença de reagendamento: {formatMoney(props.amountCents, props.currency)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
            onClick={props.onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
            <BookingChangePaymentForm onSuccess={props.onSuccess} />
          </Elements>
        </div>
      </div>
    </div>
  );
}

function BookingChangePaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== "undefined" ? window.location.href : undefined,
        },
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message ?? "Falha no pagamento.");
      } else {
        const status = result.paymentIntent?.status;
        if (status && ["succeeded", "processing"].includes(status)) {
          onSuccess();
        } else {
          setError("Pagamento pendente. Atualiza a página em instantes.");
        }
      }
    } catch (err) {
      setError("Erro ao confirmar pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setError(null);
  }, [stripe]);

  return (
    <div className="space-y-3">
      <PaymentElement />
      {error && <p className="text-[11px] text-red-200">{error}</p>}
      <button
        type="button"
        className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] text-white hover:bg-white/20 disabled:opacity-60"
        onClick={handleSubmit}
        disabled={submitting || !stripe || !elements}
      >
        {submitting ? "A confirmar..." : "Pagar diferença"}
      </button>
    </div>
  );
}
