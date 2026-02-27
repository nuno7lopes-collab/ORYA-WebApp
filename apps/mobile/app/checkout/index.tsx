import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "../../components/icons/Ionicons";
import { buildHoldSubjectFingerprint, tokens } from "@orya/shared";
import Constants from "expo-constants";
import {
  initStripe,
  isPlatformPaySupported,
  useStripe,
} from "@stripe/stripe-react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import {
  useCheckoutStore,
  buildCheckoutIdempotencyKey,
} from "../../features/checkout/store";
import {
  createCheckoutIntent,
  createPairingCheckoutIntent,
  fetchCheckoutStatus,
} from "../../features/checkout/api";
import {
  CheckoutMethod,
  CheckoutInventoryHold,
  CheckoutStatusResponse,
} from "../../features/checkout/types";
import { useAuth } from "../../lib/auth";
import { getMobileEnv } from "../../lib/env";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { getUserFacingError } from "../../lib/errors";
import { trackEvent } from "../../lib/analytics";
import { api, ApiError } from "../../lib/api";
import { buildReturnUrl, resolveAppScheme } from "../../lib/deeplink";
import {
  detectStripeModeFromPublishableKey,
  normalizeStripeMode,
  resolveStripeRuntimeKey,
  stripeModeLabel,
} from "../../lib/stripeRuntime";

const formatMoney = (
  cents: number | null | undefined,
  currency?: string | null,
): string | null => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  if (cents <= 0) return "Grátis";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency?.toUpperCase() || "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const resolveMethodLabel = (method: CheckoutMethod) => {
  if (method === "apple_pay") return "Apple Pay";
  if (method === "mbway") return "MBWay";
  return "Cartão";
};

const toApiPaymentMethod = (method: CheckoutMethod): "card" | "mbway" => {
  if (method === "mbway") return "mbway";
  return "card";
};

const createClientSessionId = () => {
  const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
  const randomUUID = cryptoRef?.randomUUID?.();
  if (typeof randomUUID === "string" && randomUUID.length > 0) {
    return randomUUID;
  }
  return `mobsess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const parseInventoryHolds = (raw: unknown): CheckoutInventoryHold[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is CheckoutInventoryHold => {
    if (!entry || typeof entry !== "object") return false;
    const value = entry as Partial<CheckoutInventoryHold>;
    return (
      typeof value.holdId === "string" &&
      typeof value.ticketTypeId === "number" &&
      Number.isFinite(value.ticketTypeId) &&
      typeof value.quantity === "number" &&
      Number.isFinite(value.quantity) &&
      value.quantity > 0 &&
      typeof value.subjectFingerprint === "string" &&
      typeof value.expiresAt === "string" &&
      typeof value.subjectLabel === "string"
    );
  });
};

const CHECKOUT_BLOCKED_CODES = new Set([
  "ORGANIZATION_STRIPE_NOT_CONNECTED",
  "ORGANIZATION_PAYMENTS_NOT_READY",
  "PAYMENTS_NOT_READY",
]);

const resolveApiErrorCode = (error: unknown): string | null => {
  if (error instanceof ApiError && error.code) {
    return error.code.trim().toUpperCase();
  }
  if (!(error instanceof Error)) return null;
  const message = error.message ?? "";
  const jsonCodeMatch = message.match(/"errorCode"\s*:\s*"([^"]+)"/i);
  if (jsonCodeMatch?.[1]) {
    return jsonCodeMatch[1].trim().toUpperCase();
  }
  const codeMatch = message.match(/"code"\s*:\s*"([^"]+)"/i);
  if (codeMatch?.[1]) {
    return codeMatch[1].trim().toUpperCase();
  }
  return null;
};

const isCheckoutBlockedCode = (code: string | null) =>
  Boolean(code && CHECKOUT_BLOCKED_CODES.has(code));

const CHECKOUT_CONFIG_ERROR =
  "Pagamentos indisponíveis neste momento. Falta configuração Stripe.";
const CHECKOUT_MBWAY_EXPO_GO_ERROR =
  "MBWay não está disponível no Expo Go. Usa um Development Build/TestFlight para MBWay.";
const CHECKOUT_AUTOPOLL_TIMEOUT_MS = 20_000;
const CHECKOUT_AUTOPOLL_TIMEOUT_MBWAY_MS = 120_000;
const BOOKING_POLL_INTERVAL_MS = 1200;
const CHECKOUT_POLL_INTERVAL_REQUIRES_ACTION_MS = 1500;
const CHECKOUT_POLL_INTERVAL_REQUIRES_ACTION_MBWAY_MS = 5000;
const CHECKOUT_POLL_INTERVAL_PENDING_MS = 4000;
const CHECKOUT_SETTLEMENT_POLL_MS = 1200;

const buildStripeModeMismatchMessage = (
  expected: "test" | "prod",
  actual: "test" | "prod" | null,
) =>
  `Configuração Stripe inconsistente: servidor em ${stripeModeLabel(expected)} e app em ${stripeModeLabel(actual)}.`;

const isPaymentSettled = (status?: string | null) =>
  status === "PAID" || status === "SUCCEEDED";

const isCheckoutFinal = (status?: string | null) =>
  Boolean(
    status &&
    [
      "PAID",
      "SUCCEEDED",
      "FAILED",
      "REFUNDED",
      "DISPUTED",
      "CANCELED",
      "CANCELLED",
      "EXPIRED",
    ].includes(status),
  );

const isCheckoutPollingState = (status?: string | null) =>
  Boolean(
    status && ["PENDING", "PROCESSING", "REQUIRES_ACTION"].includes(status),
  );

const isBookingTerminalStatus = (status?: string | null) =>
  Boolean(
    status &&
      [
        "CONFIRMED",
        "CANCELLED",
        "CANCELLED_BY_CLIENT",
        "CANCELLED_BY_ORG",
        "COMPLETED",
        "DISPUTED",
        "NO_SHOW",
      ].includes(status),
  );

type StatusMeta = {
  tone: "success" | "danger" | "warning" | "info";
  title: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
  secondaryActionLabel?: string;
  secondaryAction?: () => void;
  showSpinner?: boolean;
};

type TicketInventoryRequirement = {
  ticketTypeId: number;
  quantity: number;
  subjectLabel: string;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const env = getMobileEnv();
  const stripeKey = env.stripePublishableKey ?? "";
  const merchantId = env.appleMerchantId ?? null;
  const appScheme = useMemo(() => resolveAppScheme(), []);
  const [applePaySupported, setApplePaySupported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] =
    useState<CheckoutStatusResponse | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingChecking, setBookingChecking] = useState(false);
  const [bookingTimedOut, setBookingTimedOut] = useState(false);
  const [requiresActionTimedOut, setRequiresActionTimedOut] = useState(false);
  const [checkoutPollingStartedAt, setCheckoutPollingStartedAt] = useState<
    number | null
  >(null);
  const [checkoutPollingTimedOut, setCheckoutPollingTimedOut] = useState(false);
  const [holdCountdownLabel, setHoldCountdownLabel] = useState<string | null>(null);
  const recoveredTrackedRef = useRef(false);
  const statusCheckInFlightRef = useRef<Promise<CheckoutStatusResponse | null> | null>(null);
  const bookingStatusInFlightRef = useRef<Promise<string | null> | null>(null);
  const bookingStatusInFlightBookingIdRef = useRef<number | null>(null);
  const bookingPollInFlightRef = useRef<Promise<void> | null>(null);
  const bookingTimeoutTrackedRef = useRef(false);
  const bookingPollNonceRef = useRef(0);
  const activeBookingIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const returnUrl = useMemo(() => buildReturnUrl("checkout/success"), []);

  const draft = useCheckoutStore((state) => state.draft);
  const setPaymentMethod = useCheckoutStore((state) => state.setPaymentMethod);
  const setDraft = useCheckoutStore((state) => state.setDraft);
  const setIntent = useCheckoutStore((state) => state.setIntent);
  const resetIntent = useCheckoutStore((state) => state.resetIntent);
  const clearDraft = useCheckoutStore((state) => state.clearDraft);
  const isExpired = useCheckoutStore((state) => state.isExpired);
  const isFocused = useIsFocused();

  useEffect(() => {
    let mounted = true;
    isPlatformPaySupported()
      .then((supported) => {
        if (mounted)
          setApplePaySupported(Platform.OS === "ios" && Boolean(supported));
      })
      .catch(() => {
        if (mounted) setApplePaySupported(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    activeBookingIdRef.current = draft?.bookingId ?? null;
    bookingPollNonceRef.current += 1;
    bookingPollInFlightRef.current = null;
    bookingStatusInFlightRef.current = null;
    bookingStatusInFlightBookingIdRef.current = null;
  }, [draft?.bookingId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      bookingPollNonceRef.current += 1;
      bookingPollInFlightRef.current = null;
      bookingStatusInFlightRef.current = null;
      bookingStatusInFlightBookingIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!draft) {
      setCheckoutStatus(null);
      setError(null);
      setBookingStatus(null);
      setBookingError(null);
      setBookingTimedOut(false);
      setRequiresActionTimedOut(false);
      setCheckoutPollingStartedAt(null);
      setCheckoutPollingTimedOut(false);
      recoveredTrackedRef.current = false;
      bookingPollInFlightRef.current = null;
      bookingTimeoutTrackedRef.current = false;
      return;
    }
    if (!draft.purchaseId && !draft.paymentIntentId) {
      setCheckoutStatus(null);
      setError(null);
      setRequiresActionTimedOut(false);
      setCheckoutPollingStartedAt(null);
      setCheckoutPollingTimedOut(false);
      recoveredTrackedRef.current = false;
      bookingPollInFlightRef.current = null;
      bookingTimeoutTrackedRef.current = false;
    }
  }, [draft?.paymentIntentId, draft?.purchaseId, draft?.bookingId]);

  useEffect(() => {
    if (!checkoutHoldExpiresAt) {
      setHoldCountdownLabel(null);
      return;
    }
    const tick = () => {
      const remaining = new Date(checkoutHoldExpiresAt).getTime() - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setHoldCountdownLabel(null);
        return;
      }
      setHoldCountdownLabel(formatCountdown(remaining));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [checkoutHoldExpiresAt]);

  useEffect(() => {
    if (!draft) return;
    if (draft.sourceType !== "SERVICE_BOOKING") return;
    if (!draft.holdId || !draft.clientSessionId || !draft.holdSubjectFingerprint) return;
    if (!draft.organizationId) return;
    const interval = setInterval(() => {
      void (async () => {
        const pingResult = await api.requestRaw<{
          ok: boolean;
          expiresAt?: string | null;
          data?: { expiresAt?: string | null };
        }>("/api/holds/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holdId: draft.holdId,
            orgId: draft.organizationId,
            subjectType: "SERVICE",
            subjectFingerprint: draft.holdSubjectFingerprint,
            clientSessionId: draft.clientSessionId,
          }),
        });
        const body = pingResult.data;
        if (!pingResult.ok || !body?.ok) return;
        const refreshedExpiresAt =
          typeof body.expiresAt === "string"
            ? body.expiresAt
            : typeof body.data?.expiresAt === "string"
              ? body.data.expiresAt
              : null;
        if (!refreshedExpiresAt) return;
        const { createdAt: _createdAt, expiresAt: _expiresAt, ...persisted } = draft;
        setDraft({
          ...persisted,
          holdExpiresAt: refreshedExpiresAt,
        });
      })().catch(() => undefined);
    }, 60_000);
    return () => clearInterval(interval);
  }, [
    draft,
    draft?.clientSessionId,
    draft?.holdId,
    draft?.holdSubjectFingerprint,
    draft?.organizationId,
    draft?.sourceType,
    setDraft,
  ]);

  useEffect(() => {
    if (!draft) return;
    if (isServiceBooking || isPadelRegistration) return;
    const clientSessionId =
      typeof draft.inventoryClientSessionId === "string"
        ? draft.inventoryClientSessionId.trim()
        : "";
    const holds = parseInventoryHolds(draft.inventoryHolds);
    if (!clientSessionId || holds.length === 0) return;
    const interval = setInterval(() => {
      void (async () => {
        const active = holds.filter((entry) => {
          const expires = new Date(entry.expiresAt).getTime();
          return Number.isFinite(expires) && expires > Date.now();
        });
        if (active.length === 0) {
          const { createdAt: _createdAt, expiresAt: _expiresAt, ...persisted } = draft;
          setDraft({
            ...persisted,
            inventoryClientSessionId: null,
            inventoryHolds: [],
            inventoryHoldExpiresAt: null,
          });
          return;
        }

        const refreshed: CheckoutInventoryHold[] = [];
        for (const hold of active) {
          const pingResult = await api.requestRaw<{
            ok?: boolean;
            expiresAt?: string | null;
            data?: { expiresAt?: string | null };
          }>("/api/holds/inventory/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              holdId: hold.holdId,
              clientSessionId,
            }),
          });
          const body = pingResult.data;
          if (!pingResult.ok || !body?.ok) {
            continue;
          }
          const expiresAt =
            typeof body.expiresAt === "string"
              ? body.expiresAt
              : typeof body.data?.expiresAt === "string"
                ? body.data.expiresAt
                : hold.expiresAt;
          refreshed.push({ ...hold, expiresAt });
        }

        const earliest = refreshed.reduce<number | null>((min, hold) => {
          const value = new Date(hold.expiresAt).getTime();
          if (!Number.isFinite(value)) return min;
          if (min === null) return value;
          return Math.min(min, value);
        }, null);

        const { createdAt: _createdAt, expiresAt: _expiresAt, ...persisted } = draft;
        setDraft({
          ...persisted,
          inventoryClientSessionId: refreshed.length > 0 ? clientSessionId : null,
          inventoryHolds: refreshed,
          inventoryHoldExpiresAt: earliest ? new Date(earliest).toISOString() : null,
        });
      })().catch(() => undefined);
    }, 60_000);
    return () => clearInterval(interval);
  }, [draft, isPadelRegistration, isServiceBooking, setDraft]);

  const allowApplePay = Boolean(merchantId && applePaySupported);
  const isExpoGo =
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient";
  const allowMbwayInApp = !isExpoGo;
  const selectedMethod =
    draft?.paymentMethod ?? (allowApplePay ? "apple_pay" : "card");
  const resolvedMethod =
    !allowApplePay && selectedMethod === "apple_pay"
      ? "card"
      : !allowMbwayInApp && selectedMethod === "mbway"
        ? "card"
      : selectedMethod;

  const checkoutItems = useMemo(() => {
    if (!draft) return [];
    if (Array.isArray(draft.items) && draft.items.length > 0) {
      return draft.items
        .filter(
          (item) =>
            Number.isFinite(item.ticketTypeId) &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0,
        )
        .map((item) => ({
          ...item,
          lineTotalCents: item.lineTotalCents ?? item.unitPriceCents * item.quantity,
        }));
    }
    if (
      Number.isFinite(draft.ticketTypeId) &&
      Number.isFinite(draft.quantity) &&
      (draft.quantity ?? 0) > 0
    ) {
      return [
        {
          ticketTypeId: draft.ticketTypeId as number,
          ticketName: draft.ticketName ?? "Bilhete",
          quantity: draft.quantity,
          unitPriceCents: draft.unitPriceCents,
          lineTotalCents: draft.unitPriceCents * draft.quantity,
          currency: draft.currency,
        },
      ];
    }
    return [];
  }, [draft]);
  const totalQuantity = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.quantity, 0),
    [checkoutItems],
  );
  const computedTotalCents = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
    [checkoutItems],
  );
  const totalLabel = formatMoney(
    draft?.totalCents ?? computedTotalCents ?? null,
    draft?.currency ?? checkoutItems[0]?.currency,
  );
  const effectiveTotalCents =
    typeof draft?.totalCents === "number" ? draft.totalCents : computedTotalCents;
  const isFreeCheckout = Boolean(draft && effectiveTotalCents <= 0);
  const allFreeItems =
    checkoutItems.length > 0 &&
    checkoutItems.every((item) => item.unitPriceCents <= 0);
  const isPadelRegistration = draft?.sourceType === "PADEL_REGISTRATION";
  const isServiceBooking = draft?.sourceType === "SERVICE_BOOKING";
  const ticketInventoryRequirements = useMemo(() => {
    if (isServiceBooking || isPadelRegistration || checkoutItems.length === 0) {
      return [] as TicketInventoryRequirement[];
    }
    return checkoutItems.map((item) => ({
      ticketTypeId: item.ticketTypeId,
      quantity: item.quantity,
      subjectLabel: item.ticketName || `Bilhete ${item.ticketTypeId}`,
    }));
  }, [checkoutItems, isPadelRegistration, isServiceBooking]);
  const activeTicketInventoryHolds = useMemo(() => {
    const holds = parseInventoryHolds(draft?.inventoryHolds);
    const now = Date.now();
    return holds.filter((entry) => {
      const expiresMs = new Date(entry.expiresAt).getTime();
      return Number.isFinite(expiresMs) && expiresMs > now;
    });
  }, [draft?.inventoryHolds]);
  const ticketInventoryHoldsCoverSelection = useMemo(() => {
    if (!ticketInventoryRequirements.length) return false;
    const byType = new Map<number, number>();
    for (const hold of activeTicketInventoryHolds) {
      byType.set(hold.ticketTypeId, (byType.get(hold.ticketTypeId) ?? 0) + hold.quantity);
    }
    return ticketInventoryRequirements.every(
      (requirement) =>
        (byType.get(requirement.ticketTypeId) ?? 0) >= requirement.quantity,
    );
  }, [activeTicketInventoryHolds, ticketInventoryRequirements]);
  const ticketInventoryHoldExpiresAt = useMemo(() => {
    if (!activeTicketInventoryHolds.length) return null;
    const earliest = activeTicketInventoryHolds.reduce<number | null>((min, hold) => {
      const value = new Date(hold.expiresAt).getTime();
      if (!Number.isFinite(value)) return min;
      if (min === null) return value;
      return Math.min(min, value);
    }, null);
    return earliest ? new Date(earliest).toISOString() : null;
  }, [activeTicketInventoryHolds]);
  const checkoutHoldExpiresAt = isServiceBooking
    ? draft?.holdExpiresAt ?? null
    : ticketInventoryHoldExpiresAt;
  const itemLabel = isServiceBooking
    ? (draft?.ticketName ?? "Reserva")
    : isPadelRegistration
      ? (draft?.ticketName ?? "Inscrição")
      : checkoutItems.length > 1
        ? `${checkoutItems.length} tipos de bilhete`
        : (draft?.ticketName ?? checkoutItems[0]?.ticketName ?? "Bilhete");
  const showPaymentMethods = Boolean(draft) && !isFreeCheckout;
  const canPay = Boolean(draft && session?.user?.id);
  const currentCheckoutStatus = checkoutStatus?.status ?? null;
  const isStatusPolling = isCheckoutPollingState(currentCheckoutStatus);
  const isSettled = isPaymentSettled(currentCheckoutStatus);
  const hasRetryableFailure = Boolean(
    currentCheckoutStatus &&
      ["FAILED", "CANCELED", "CANCELLED", "EXPIRED"].includes(currentCheckoutStatus),
  );
  const payButtonVisible =
    !isSettled &&
    (!currentCheckoutStatus ||
      currentCheckoutStatus === "REQUIRES_ACTION" ||
      hasRetryableFailure);
  const payButtonDisabled =
    !canPay || processing || checkingStatus || bookingChecking || isStatusPolling;
  const payButtonLabel = isStatusPolling
    ? "A confirmar pagamento..."
    : hasRetryableFailure
      ? "Tentar novamente"
      : effectiveTotalCents <= 0
        ? "Confirmar inscrição"
        : "Pagar agora";
  const openAuth = useCallback(() => {
    safePush(router, { pathname: "/auth", params: { next: "/checkout" } });
  }, [router]);
  const handleBack = () => {
    safeBack(router, navigation, TAB_PATHNAMES.index);
  };

  useEffect(() => {
    if (!draft) return;
    if (!isFreeCheckout) return;
    if (Array.isArray(draft.items) && draft.items.length > 0) return;
    if (draft.quantity === 1) return;
    const { createdAt: _createdAt, expiresAt: _expiresAt, ...payload } = draft;
    setDraft({
      ...payload,
      quantity: 1,
      totalCents: draft.unitPriceCents,
    });
  }, [draft, isFreeCheckout, setDraft]);

  const statusPill = useMemo(() => {
    if (!draft) return null;
    const pendingExpiry =
      draft.pendingExpiresAt ?? draft.bookingExpiresAt ?? null;
    const bookingExpiry = pendingExpiry
      ? new Date(pendingExpiry).getTime()
      : null;
    if (
      bookingExpiry &&
      Number.isFinite(bookingExpiry) &&
      Date.now() > bookingExpiry
    ) {
      return { label: "Reserva expirou", variant: "muted" as const };
    }
    if (isExpired())
      return { label: "Sessão expirou", variant: "muted" as const };
    if (draft.clientSecret)
      return { label: "Sessão ativa", variant: "accent" as const };
    return null;
  }, [draft, isExpired]);

  useEffect(() => {
    if (!draft) return;
    if (!draft.paymentMethod) {
      setPaymentMethod(allowApplePay ? "apple_pay" : "card");
      return;
    }
    if (!allowApplePay && draft.paymentMethod === "apple_pay") {
      setPaymentMethod("card");
    }
  }, [allowApplePay, draft, setPaymentMethod]);

  useEffect(() => {
    if (!draft?.paymentMethod) return;
    trackEvent("checkout_method_changed", {
      sourceType: draft.sourceType ?? null,
      method: draft.paymentMethod,
    });
    setCheckoutStatus(null);
    setError(null);
    setCheckoutPollingStartedAt(null);
    setCheckoutPollingTimedOut(false);
    setRequiresActionTimedOut(false);
    recoveredTrackedRef.current = false;
  }, [draft?.paymentMethod]);

  useEffect(() => {
    if (!draft?.paymentMethod) return;
    if (allowMbwayInApp) return;
    if (draft.paymentMethod !== "mbway") return;
    setPaymentMethod("card");
    setError(CHECKOUT_MBWAY_EXPO_GO_ERROR);
  }, [allowMbwayInApp, draft?.paymentMethod, setPaymentMethod]);

  const applyCheckoutStatus = useCallback((status: CheckoutStatusResponse) => {
    setCheckoutStatus(status);
    setError(null);
    if (isCheckoutPollingState(status.status)) {
      setCheckoutPollingStartedAt((previous) => previous ?? Date.now());
      return;
    }
    setCheckoutPollingStartedAt(null);
    setCheckoutPollingTimedOut(false);
    setRequiresActionTimedOut(false);
  }, []);

  const runStatusCheck = useCallback(
    async (params?: {
      purchaseId?: string | null;
      paymentIntentId?: string | null;
    }) => {
      if (statusCheckInFlightRef.current) {
        return statusCheckInFlightRef.current;
      }
      const task = (async () => {
        if (!draft) return null;
        const purchaseId = params?.purchaseId ?? draft.purchaseId ?? null;
        const paymentIntentId =
          params?.paymentIntentId ?? draft.paymentIntentId ?? null;
        if (!purchaseId && !paymentIntentId) return null;
        setCheckingStatus(true);
        try {
          const status = await fetchCheckoutStatus({
            purchaseId,
            paymentIntentId,
          });
          applyCheckoutStatus(status);
          return status;
        } catch (err: unknown) {
          setError(
            getUserFacingError(err, "Não foi possível verificar o pagamento."),
          );
          return null;
        } finally {
          setCheckingStatus(false);
        }
      })();
      statusCheckInFlightRef.current = task;
      try {
        return await task;
      } finally {
        if (statusCheckInFlightRef.current === task) {
          statusCheckInFlightRef.current = null;
        }
      }
    },
    [applyCheckoutStatus, draft],
  );

  const fetchBookingStatus = useCallback(async () => {
    const bookingId = draft?.bookingId ?? null;
    if (!bookingId) return null;
    if (
      bookingStatusInFlightRef.current &&
      bookingStatusInFlightBookingIdRef.current === bookingId
    ) {
      return bookingStatusInFlightRef.current;
    }
    const task = (async () => {
      if (
        isMountedRef.current &&
        activeBookingIdRef.current === bookingId
      ) {
        setBookingChecking(true);
      }
      try {
        const endpoint = `/api/me/reservas/${bookingId}`;
        const result = await api.requestRaw<{
          ok: boolean;
          booking?: { status?: string };
          message?: string;
          error?: string;
        }>(endpoint, { cache: "no-store" });
        const json = result.data;
        if (!result.ok || !json?.ok) {
          throw new Error(
            json?.message ||
              json?.error ||
              "Não foi possível verificar a reserva.",
          );
        }
        const status = json.booking?.status as string | undefined;
        if (
          isMountedRef.current &&
          activeBookingIdRef.current === bookingId
        ) {
          setBookingStatus(status ?? null);
          setBookingError(null);
        }
        return status ?? null;
      } catch (err) {
        if (
          isMountedRef.current &&
          activeBookingIdRef.current === bookingId
        ) {
          setBookingError(
            getUserFacingError(err, "Não foi possível verificar a reserva."),
          );
        }
        return null;
      } finally {
        if (
          isMountedRef.current &&
          activeBookingIdRef.current === bookingId
        ) {
          setBookingChecking(false);
        }
      }
    })();
    bookingStatusInFlightRef.current = task;
    bookingStatusInFlightBookingIdRef.current = bookingId;
    try {
      return await task;
    } finally {
      if (bookingStatusInFlightRef.current === task) {
        bookingStatusInFlightRef.current = null;
        bookingStatusInFlightBookingIdRef.current = null;
      }
    }
  }, [draft?.bookingId]);

  const pollBookingStatus = useCallback(async () => {
    const bookingId = draft?.bookingId ?? null;
    if (!bookingId) return;
    if (bookingPollInFlightRef.current) {
      await bookingPollInFlightRef.current;
      return;
    }
    const runNonce = bookingPollNonceRef.current;
    const task = (async () => {
      if (
        isMountedRef.current &&
        activeBookingIdRef.current === bookingId &&
        bookingPollNonceRef.current === runNonce
      ) {
        setBookingTimedOut(false);
        bookingTimeoutTrackedRef.current = false;
      }
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (
          !isMountedRef.current ||
          activeBookingIdRef.current !== bookingId ||
          bookingPollNonceRef.current !== runNonce
        ) {
          return;
        }
        const status = await fetchBookingStatus();
        if (isBookingTerminalStatus(status)) return;
        await new Promise((resolve) =>
          setTimeout(resolve, BOOKING_POLL_INTERVAL_MS),
        );
      }
      if (
        !isMountedRef.current ||
        activeBookingIdRef.current !== bookingId ||
        bookingPollNonceRef.current !== runNonce
      ) {
        return;
      }
      setBookingTimedOut(true);
      if (!bookingTimeoutTrackedRef.current) {
        bookingTimeoutTrackedRef.current = true;
        trackEvent("booking_confirm_timeout", {
          bookingId,
          sourceType: draft?.sourceType ?? null,
        });
      }
    })();
    bookingPollInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (bookingPollInFlightRef.current === task) {
        bookingPollInFlightRef.current = null;
      }
    }
  }, [draft?.bookingId, draft?.sourceType, fetchBookingStatus]);

  useEffect(() => {
    if (!isFocused) return;
    if (processing) return;
    if (!draft) return;
    if (!draft.purchaseId && !draft.paymentIntentId) return;
    runStatusCheck();
  }, [
    draft?.paymentIntentId,
    draft?.purchaseId,
    isFocused,
    processing,
    runStatusCheck,
  ]);

  useEffect(() => {
    if (!isServiceBooking) return;
    if (!checkoutStatus) return;
    if (!isPaymentSettled(checkoutStatus.status)) return;
    if (bookingTimedOut) return;
    if (isBookingTerminalStatus(bookingStatus)) return;
    pollBookingStatus();
  }, [
    bookingStatus,
    bookingTimedOut,
    checkoutStatus,
    isServiceBooking,
    pollBookingStatus,
  ]);

  useEffect(() => {
    if (!isServiceBooking || !bookingStatus) return;
    if (isBookingTerminalStatus(bookingStatus)) {
      setBookingTimedOut(false);
      bookingTimeoutTrackedRef.current = false;
      if (bookingStatus === "CONFIRMED") {
        trackEvent("booking_confirmed", { bookingId: draft?.bookingId ?? null });
      }
      if (
        ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(
          bookingStatus,
        )
      ) {
        trackEvent("booking_cancelled", { bookingId: draft?.bookingId ?? null });
      }
    }
  }, [bookingStatus, draft?.bookingId, isServiceBooking]);

  useEffect(() => {
    if (!isFocused) return;
    if (!checkoutStatus) return;
    if (!draft) return;
    if (processing || checkingStatus) return;
    if (!isCheckoutPollingState(checkoutStatus.status)) return;
    if (
      checkoutPollingTimedOut ||
      (checkoutStatus.status === "REQUIRES_ACTION" && requiresActionTimedOut)
    )
      return;
    const now = Date.now();
    const startedAt = checkoutPollingStartedAt ?? now;
    if (!checkoutPollingStartedAt) {
      setCheckoutPollingStartedAt(startedAt);
    }
    const pollingTimeoutMs =
      resolvedMethod === "mbway"
        ? CHECKOUT_AUTOPOLL_TIMEOUT_MBWAY_MS
        : CHECKOUT_AUTOPOLL_TIMEOUT_MS;
    if (now - startedAt >= pollingTimeoutMs) {
      setCheckoutPollingTimedOut(true);
      if (checkoutStatus.status === "REQUIRES_ACTION") {
        setRequiresActionTimedOut(true);
      }
      recoveredTrackedRef.current = false;
      trackEvent("checkout_stuck_timeout", {
        sourceType: draft.sourceType ?? null,
        method: resolvedMethod,
        status: checkoutStatus.status ?? null,
      });
      return;
    }
    const intervalMs =
      checkoutStatus.status === "REQUIRES_ACTION"
        ? resolvedMethod === "mbway"
          ? CHECKOUT_POLL_INTERVAL_REQUIRES_ACTION_MBWAY_MS
          : CHECKOUT_POLL_INTERVAL_REQUIRES_ACTION_MS
        : CHECKOUT_POLL_INTERVAL_PENDING_MS;
    const timer = setTimeout(() => {
      runStatusCheck();
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [
    checkoutPollingStartedAt,
    checkoutPollingTimedOut,
    checkoutStatus,
    checkingStatus,
    draft,
    isFocused,
    processing,
    requiresActionTimedOut,
    resolvedMethod,
    runStatusCheck,
  ]);

  useEffect(() => {
    if (!checkoutStatus) return;
    if (!(checkoutPollingTimedOut || requiresActionTimedOut)) return;
    if (!isCheckoutFinal(checkoutStatus.status)) return;
    if (recoveredTrackedRef.current) return;
    recoveredTrackedRef.current = true;
    trackEvent("checkout_requires_action_recovered", {
      sourceType: draft?.sourceType ?? null,
      method: resolvedMethod,
      status: checkoutStatus.status ?? null,
    });
    setCheckoutPollingTimedOut(false);
    setRequiresActionTimedOut(false);
    setCheckoutPollingStartedAt(null);
  }, [
    checkoutPollingTimedOut,
    checkoutStatus,
    draft?.sourceType,
    requiresActionTimedOut,
    resolvedMethod,
  ]);

  const ensureServiceCheckoutHold = useCallback(async () => {
    if (!draft || !isServiceBooking) {
      throw new Error("Checkout de reserva inválido.");
    }
    const orgId = Number(draft.organizationId);
    const serviceId = Number(draft.serviceId);
    const bookingId = Number(draft.bookingId);
    const startsAtISO = String(draft.bookingStartsAt ?? "").trim();
    const durationMinutes = Number(draft.bookingDurationMinutes);
    if (
      !Number.isFinite(orgId) ||
      !Number.isFinite(serviceId) ||
      !Number.isFinite(bookingId) ||
      !startsAtISO ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      throw new Error("Reserva inválida.");
    }

    const expectedSubjectFingerprint = buildHoldSubjectFingerprint({
      orgId: Math.trunc(orgId),
      subjectType: "SERVICE",
      serviceId: Math.trunc(serviceId),
      startAtISO: startsAtISO,
      durationMinutes: Math.trunc(durationMinutes),
      professionalId:
        typeof draft.bookingProfessionalId === "number"
          ? Math.trunc(draft.bookingProfessionalId)
          : null,
      resourceIds:
        Array.isArray(draft.bookingResourceIds) && draft.bookingResourceIds.length > 0
          ? draft.bookingResourceIds
          : [],
    });
    const nowMs = Date.now();
    const existingHoldExpiresAtMs = draft.holdExpiresAt
      ? new Date(draft.holdExpiresAt).getTime()
      : null;
    const hasExistingHold =
      Boolean(draft.holdId) &&
      Boolean(draft.clientSessionId) &&
      Boolean(draft.holdSubjectFingerprint) &&
      typeof existingHoldExpiresAtMs === "number" &&
      Number.isFinite(existingHoldExpiresAtMs) &&
      existingHoldExpiresAtMs > nowMs;

    if (hasExistingHold) {
      const pingResult = await api.requestRaw<{
        ok: boolean;
        expiresAt?: string | null;
        errorCode?: string | null;
        data?: { expiresAt?: string | null };
      }>("/api/holds/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            holdId: draft.holdId,
            orgId: Math.trunc(orgId),
            subjectType: "SERVICE",
            subjectFingerprint: draft.holdSubjectFingerprint,
            clientSessionId: draft.clientSessionId,
        }),
      });
      const pingBody = pingResult.data;
      if (pingResult.ok && pingBody?.ok) {
        const refreshedExpiresAt =
          typeof pingBody.expiresAt === "string"
            ? pingBody.expiresAt
            : typeof pingBody.data?.expiresAt === "string"
              ? pingBody.data.expiresAt
              : draft.holdExpiresAt ?? null;
        if (refreshedExpiresAt) {
          const { createdAt: _createdAt, expiresAt: _expiresAt, ...persisted } = draft;
          setDraft({
            ...persisted,
            holdExpiresAt: refreshedExpiresAt,
          });
        }
        return {
          holdId: String(draft.holdId),
          clientSessionId: String(draft.clientSessionId),
          subjectFingerprint: String(draft.holdSubjectFingerprint),
        };
      }
      const pingErrorCode =
        typeof pingBody?.errorCode === "string"
          ? pingBody.errorCode
          : null;
      if (pingErrorCode !== "HOLD_EXPIRED" && pingErrorCode !== "SLOT_NOT_AVAILABLE") {
        return {
          holdId: String(draft.holdId),
          clientSessionId: String(draft.clientSessionId),
          subjectFingerprint: String(draft.holdSubjectFingerprint),
        };
      }
    }

    const clientSessionId =
      typeof draft.clientSessionId === "string" && draft.clientSessionId.trim().length > 0
        ? draft.clientSessionId.trim()
        : createClientSessionId();
    const createResult = await api.requestRaw<{
      ok: boolean;
      holdId?: string;
      expiresAt?: string;
      subjectFingerprint?: string;
      errorCode?: string;
      message?: string;
      data?: {
        holdId?: string;
        expiresAt?: string;
        subjectFingerprint?: string;
      };
    }>("/api/holds/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: Math.trunc(orgId),
        subjectType: "SERVICE",
        subjectFingerprint: expectedSubjectFingerprint,
        clientSessionId,
        metadata: {
          subjectLabel: draft.holdSubjectLabel ?? draft.serviceTitle ?? "Reserva",
        },
      }),
    });
    const createBody = createResult.data;
    if (!createResult.ok || !createBody?.ok) {
      const errorCode =
        typeof createBody?.errorCode === "string"
          ? createBody.errorCode
          : "SLOT_NOT_AVAILABLE";
      if (errorCode === "SLOT_NOT_AVAILABLE") {
        throw new Error("Slot indisponível para checkout.");
      }
      throw new Error(createBody?.message || "Não foi possível bloquear o slot para checkout.");
    }

    const holdId =
      typeof createBody.holdId === "string"
        ? createBody.holdId
        : typeof createBody.data?.holdId === "string"
          ? createBody.data.holdId
          : null;
    const expiresAt =
      typeof createBody.expiresAt === "string"
        ? createBody.expiresAt
        : typeof createBody.data?.expiresAt === "string"
          ? createBody.data.expiresAt
          : null;
    const holdSubjectFingerprint =
      typeof createBody.subjectFingerprint === "string"
        ? createBody.subjectFingerprint
        : typeof createBody.data?.subjectFingerprint === "string"
          ? createBody.data.subjectFingerprint
          : null;
    if (!holdId || !expiresAt || !holdSubjectFingerprint) {
      throw new Error("Não foi possível validar o bloqueio para checkout.");
    }

    const { createdAt: _createdAt, expiresAt: _expiresAt, ...persisted } = draft;
    setDraft({
      ...persisted,
      holdId,
      holdExpiresAt: expiresAt,
      holdSubjectFingerprint,
      clientSessionId,
    });

    return { holdId, clientSessionId, subjectFingerprint: holdSubjectFingerprint };
  }, [draft, isServiceBooking, setDraft]);

  const ensureTicketInventoryHolds = useCallback(async () => {
    if (!draft || isServiceBooking || isPadelRegistration) {
      return { ok: true as const, clientSessionId: null, holdIds: [] as string[] };
    }
    if (ticketInventoryRequirements.length === 0) {
      return { ok: true as const, clientSessionId: null, holdIds: [] as string[] };
    }

    if (
      activeTicketInventoryHolds.length > 0 &&
      ticketInventoryHoldsCoverSelection &&
      typeof draft.inventoryClientSessionId === "string" &&
      draft.inventoryClientSessionId.trim().length > 0
    ) {
      return {
        ok: true as const,
        clientSessionId: draft.inventoryClientSessionId.trim(),
        holdIds: activeTicketInventoryHolds.map((entry) => entry.holdId),
      };
    }

    const sessionClientId =
      typeof draft.inventoryClientSessionId === "string" &&
      draft.inventoryClientSessionId.trim().length > 0
        ? draft.inventoryClientSessionId.trim()
        : createClientSessionId();

    const releaseHold = async (holdId: string) => {
      await api.requestRaw<unknown>("/api/holds/inventory/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdId,
          clientSessionId: sessionClientId,
        }),
      });
    };

    if (activeTicketInventoryHolds.length > 0) {
      await Promise.all(activeTicketInventoryHolds.map((entry) => releaseHold(entry.holdId)));
    }

    const created: CheckoutInventoryHold[] = [];
    for (const requirement of ticketInventoryRequirements) {
      const response = await api.requestRaw<{
        ok?: boolean;
        errorCode?: string;
        message?: string;
        holdId?: string;
        expiresAt?: string;
        holdRequired?: boolean;
        subjectFingerprint?: string;
        data?: {
          holdId?: string;
          expiresAt?: string;
          holdRequired?: boolean;
          subjectFingerprint?: string;
        };
      }>("/api/holds/inventory/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: draft.eventId,
          ticketTypeId: requirement.ticketTypeId,
          quantity: requirement.quantity,
          clientSessionId: sessionClientId,
          metadata: { subjectLabel: requirement.subjectLabel },
        }),
      });
      const body = response.data;
      if (!response.ok || !body?.ok) {
        await Promise.all(created.map((entry) => releaseHold(entry.holdId)));
        return {
          ok: false as const,
          message:
            body?.message ||
            (body?.errorCode === "OUT_OF_STOCK"
              ? "Stock esgotado para um dos bilhetes."
              : "Não foi possível reservar os bilhetes para checkout."),
        };
      }
      const holdPayload = (body.data ?? body) as {
        holdId?: string;
        expiresAt?: string;
        holdRequired?: boolean;
        subjectFingerprint?: string;
      };
      if (holdPayload.holdRequired === false) continue;
      if (
        typeof holdPayload.holdId !== "string" ||
        typeof holdPayload.expiresAt !== "string" ||
        typeof holdPayload.subjectFingerprint !== "string"
      ) {
        await Promise.all(created.map((entry) => releaseHold(entry.holdId)));
        return {
          ok: false as const,
          message: "Resposta inválida ao reservar bilhetes para checkout.",
        };
      }
      created.push({
        holdId: holdPayload.holdId,
        expiresAt: holdPayload.expiresAt,
        subjectFingerprint: holdPayload.subjectFingerprint,
        ticketTypeId: requirement.ticketTypeId,
        quantity: requirement.quantity,
        subjectLabel: requirement.subjectLabel,
      });
    }

    const earliest = created.reduce<number | null>((min, hold) => {
      const value = new Date(hold.expiresAt).getTime();
      if (!Number.isFinite(value)) return min;
      if (min === null) return value;
      return Math.min(min, value);
    }, null);
    const { createdAt: _createdAt, expiresAt: _expiresAt, ...persisted } = draft;
    setDraft({
      ...persisted,
      inventoryClientSessionId: sessionClientId,
      inventoryHolds: created,
      inventoryHoldExpiresAt: earliest ? new Date(earliest).toISOString() : null,
    });
    return {
      ok: true as const,
      clientSessionId: sessionClientId,
      holdIds: created.map((entry) => entry.holdId),
    };
  }, [
    activeTicketInventoryHolds,
    draft,
    isPadelRegistration,
    isServiceBooking,
    setDraft,
    ticketInventoryHoldsCoverSelection,
    ticketInventoryRequirements,
  ]);

  const handlePay = async () => {
    if (!draft) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    setError(null);
    setCheckoutStatus(null);
    setCheckoutPollingStartedAt(null);
    setCheckoutPollingTimedOut(false);
    setProcessing(true);
    setRequiresActionTimedOut(false);
    recoveredTrackedRef.current = false;
    trackEvent("checkout_started", {
      sourceType: draft.sourceType ?? null,
      method: resolvedMethod,
      bookingId: draft.bookingId ?? null,
    });

    try {
      const expired = isExpired();
      const needsNewIntent = !draft.clientSecret || expired;
      let clientSecret = draft.clientSecret ?? null;
      let purchaseId = draft.purchaseId ?? null;
      let paymentIntentId = draft.paymentIntentId ?? null;
      let checkoutStripePublishableKey: string | null = null;
      let checkoutStripeMode: "test" | "prod" | null = null;

      if (needsNewIntent) {
        const idempotencyKey =
          draft.idempotencyKey ?? buildCheckoutIdempotencyKey();
        if (isServiceBooking) {
          if (!draft.serviceId || !draft.bookingId) {
            throw new Error("Reserva inválida.");
          }
          const hold = await ensureServiceCheckoutHold();
          const result = await api.requestRaw<{
            ok: boolean;
            clientSecret?: string | null;
            paymentIntentId?: string | null;
            purchaseId?: string | null;
            status?: string | null;
            final?: boolean;
            freeCheckout?: boolean;
            amountCents?: number | null;
            currency?: string | null;
            stripePublishableKey?: string | null;
            stripeMode?: string | null;
            message?: string;
            error?: string;
          }>(`/api/servicos/${draft.serviceId}/checkout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              bookingId: draft.bookingId,
              paymentMethod: toApiPaymentMethod(resolvedMethod),
              idempotencyKey,
              holdId: hold.holdId,
              clientSessionId: hold.clientSessionId,
              subjectFingerprint: hold.subjectFingerprint,
            }),
          });
          const json = result.data;
          if (!result.ok || !json?.ok) {
            throw new Error(
              json?.message || json?.error || "Erro ao iniciar pagamento.",
            );
          }
          clientSecret = json.clientSecret ?? null;
          purchaseId = json.purchaseId ?? null;
          paymentIntentId = json.paymentIntentId ?? null;
          checkoutStripePublishableKey =
            typeof json.stripePublishableKey === "string"
              ? json.stripePublishableKey
              : null;
          checkoutStripeMode = normalizeStripeMode(json.stripeMode);
          setIntent({
            clientSecret,
            paymentIntentId,
            purchaseId: json.purchaseId ?? null,
            breakdown: null,
            freeCheckout: Boolean(json.freeCheckout),
            amountCents:
              typeof json.amountCents === "number" ? json.amountCents : null,
            currency: typeof json.currency === "string" ? json.currency : null,
          });
          if (json.status) {
            setCheckoutStatus({
              status: json.status as CheckoutStatusResponse["status"],
              final: Boolean(json.final),
              purchaseId: json.purchaseId ?? null,
              paymentIntentId,
            });
          }
          if (json.freeCheckout || (json.amountCents ?? 0) <= 0) {
            if (json.purchaseId || paymentIntentId) {
              await runStatusCheck({
                purchaseId: json.purchaseId ?? undefined,
                paymentIntentId,
              });
            }
            await pollBookingStatus();
            setProcessing(false);
            return;
          }
        } else {
          const ticketInventory = await ensureTicketInventoryHolds();
          if (!ticketInventory.ok) {
            throw new Error(ticketInventory.message);
          }
          const response = isPadelRegistration
            ? await (async () => {
                if (!draft.pairingId || !draft.ticketTypeId) {
                  throw new Error("Dupla inválida.");
                }
                return createPairingCheckoutIntent({
                  pairingId: draft.pairingId,
                  ticketTypeId: draft.ticketTypeId!,
                  inviteToken: draft.inviteToken ?? undefined,
                  idempotencyKey,
                });
              })()
            : await createCheckoutIntent({
                slug: draft.slug ?? "",
                items:
                  checkoutItems.length > 0
                    ? checkoutItems.map((item) => ({
                        ticketTypeId: item.ticketTypeId,
                        quantity: item.quantity,
                      }))
                    : undefined,
                ticketTypeId: draft.ticketTypeId ?? 0,
                quantity: totalQuantity > 0 ? totalQuantity : draft.quantity,
                paymentMethod: resolvedMethod,
                purchaseId: draft.purchaseId ?? undefined,
                paymentScenario:
                  draft.paymentScenario ??
                  (allFreeItems ? "FREE_CHECKOUT" : "SINGLE"),
                idempotencyKey,
                inviteToken: draft.inviteToken ?? undefined,
                clientSessionId: ticketInventory.clientSessionId ?? undefined,
                inventoryHoldIds: ticketInventory.holdIds,
              });
          clientSecret = response.clientSecret ?? null;
          purchaseId = response.purchaseId ?? null;
          paymentIntentId = response.paymentIntentId ?? null;
          checkoutStripePublishableKey =
            typeof response.stripePublishableKey === "string"
              ? response.stripePublishableKey
              : null;
          checkoutStripeMode = normalizeStripeMode(response.stripeMode);
          setIntent({
            clientSecret,
            paymentIntentId,
            purchaseId,
            breakdown: response.breakdown ?? null,
            freeCheckout:
              response.freeCheckout ?? response.isGratisCheckout ?? false,
          });

          if (
            response.freeCheckout ||
            response.isGratisCheckout ||
            (response.amount ?? 0) <= 0
          ) {
            await runStatusCheck({ purchaseId, paymentIntentId });
            setProcessing(false);
            return;
          }
        }
      }

      if (!clientSecret) {
        setError("Não foi possível iniciar o pagamento.");
        setProcessing(false);
        return;
      }

      const runtimeStripeKey = resolveStripeRuntimeKey({
        runtimePublishableKey: checkoutStripePublishableKey,
        fallbackPublishableKey: stripeKey,
      });
      if (!runtimeStripeKey) {
        setError(CHECKOUT_CONFIG_ERROR);
        setProcessing(false);
        return;
      }
      const runtimeStripeKeyMode =
        detectStripeModeFromPublishableKey(runtimeStripeKey);
      if (
        checkoutStripeMode &&
        runtimeStripeKeyMode &&
        checkoutStripeMode !== runtimeStripeKeyMode
      ) {
        const mismatchMessage = buildStripeModeMismatchMessage(
          checkoutStripeMode,
          runtimeStripeKeyMode,
        );
        setError(mismatchMessage);
        trackEvent("checkout_payment_blocked", {
          sourceType: draft.sourceType ?? null,
          method: resolvedMethod,
          code: "STRIPE_KEY_MODE_MISMATCH",
        });
        setProcessing(false);
        return;
      }

      await initStripe({
        publishableKey: runtimeStripeKey,
        ...(merchantId ? { merchantIdentifier: merchantId } : {}),
        urlScheme: appScheme,
      });

      const init = await initPaymentSheet({
        merchantDisplayName: "ORYA",
        paymentIntentClientSecret: clientSecret,
        returnURL: returnUrl,
        allowsDelayedPaymentMethods: true,
        applePay: allowApplePay
          ? {
              merchantCountryCode: "PT",
            }
          : undefined,
        style: "automatic",
      });

      if (init.error) {
        setError(getUserFacingError(init.error, "Erro ao iniciar pagamento."));
        setProcessing(false);
        return;
      }

      trackEvent("checkout_payment_sheet_opened", {
        sourceType: draft.sourceType ?? null,
        method: resolvedMethod,
      });
      const presented = await presentPaymentSheet();
      if (presented.error) {
        const presentedCode = presented.error.code ?? "Failed";
        const presentedMessage =
          typeof presented.error.message === "string"
            ? presented.error.message
            : "";
        const messageLower = presentedMessage.toLowerCase();
        const userLikelyCancelled =
          presentedCode === "Canceled" ||
          messageLower.includes("cancel") ||
          messageLower.includes("cancelad");
        if (!userLikelyCancelled) {
          let recoveredStatus: CheckoutStatusResponse | null = null;
          if (purchaseId || paymentIntentId) {
            recoveredStatus = await runStatusCheck({ purchaseId, paymentIntentId });
          }
          if (
            recoveredStatus &&
            (isPaymentSettled(recoveredStatus.status) ||
              isCheckoutPollingState(recoveredStatus.status))
          ) {
            setError(null);
          } else {
            const paymentSheetFallbackMessage =
              resolvedMethod === "mbway"
                ? "Não foi possível confirmar MBWay. Confirma se o método está ativo na Stripe (teste/prod) e tenta novamente."
                : "Não foi possível confirmar o pagamento.";
            setError(
              getUserFacingError(
                presented.error,
                paymentSheetFallbackMessage,
              ),
            );
            trackEvent("checkout_payment_failed", {
              sourceType: draft.sourceType ?? null,
              method: resolvedMethod,
              code: presentedCode,
              message: presentedMessage || null,
            });
          }
        }
        setProcessing(false);
        return;
      }

      let latestStatus = await runStatusCheck({
        purchaseId,
        paymentIntentId,
      });
      if (
        resolvedMethod === "mbway" &&
        latestStatus &&
        isCheckoutPollingState(latestStatus.status)
      ) {
        return;
      }
      const pollStartedAt = Date.now();
      const inlinePollingTimeoutMs =
        resolvedMethod === "mbway"
          ? CHECKOUT_AUTOPOLL_TIMEOUT_MBWAY_MS
          : CHECKOUT_AUTOPOLL_TIMEOUT_MS;
      while (
        latestStatus &&
        isCheckoutPollingState(latestStatus.status) &&
        Date.now() - pollStartedAt < inlinePollingTimeoutMs
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, CHECKOUT_SETTLEMENT_POLL_MS),
        );
        latestStatus = await runStatusCheck({
          purchaseId,
          paymentIntentId,
        });
      }
      if (latestStatus && !isCheckoutFinal(latestStatus.status)) {
        setCheckoutPollingTimedOut(true);
        setCheckoutPollingStartedAt(pollStartedAt);
        setRequiresActionTimedOut(true);
        recoveredTrackedRef.current = false;
        trackEvent("checkout_stuck_timeout", {
          sourceType: draft.sourceType ?? null,
          method: resolvedMethod,
          status: latestStatus.status ?? null,
        });
      }
      if (isPaymentSettled(latestStatus?.status)) {
        trackEvent("checkout_payment_succeeded", {
          sourceType: draft.sourceType ?? null,
          method: resolvedMethod,
        });
      }
    } catch (err: unknown) {
      const errorCode = resolveApiErrorCode(err);
      setError(
        getUserFacingError(err, "Não foi possível concluir o pagamento."),
      );
      if (isCheckoutBlockedCode(errorCode)) {
        trackEvent("checkout_payment_blocked", {
          sourceType: draft.sourceType ?? null,
          method: resolvedMethod,
          code: errorCode,
        });
      } else {
        trackEvent("checkout_payment_failed", {
          sourceType: draft.sourceType ?? null,
          method: resolvedMethod,
          code: errorCode,
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  const statusMeta = useMemo<StatusMeta | null>(() => {
    if (!draft) return null;
    if (!checkoutStatus) {
      if (isExpired()) {
        return {
          tone: "warning" as const,
          title: "Sessão expirada",
          message:
            "A sessão de checkout expirou. Recomeça para gerar um novo pagamento.",
          actionLabel: "Recomeçar checkout",
          action: () => {
            resetIntent();
            setCheckoutStatus(null);
            setError(null);
            handlePay();
          },
        };
      }
      return null;
    }

    const status = checkoutStatus.status;
    if (isServiceBooking && bookingStatus === "CONFIRMED") {
      return {
        tone: "success" as const,
        title: "Reserva confirmada",
        message:
          "A tua reserva foi confirmada. Encontras os detalhes em Reservas.",
        actionLabel: "Ver reservas",
        action: () => {
          clearDraft();
          router.replace("/reservas");
        },
      };
    }
    if (
      isServiceBooking &&
      bookingStatus &&
      ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(
        bookingStatus,
      )
    ) {
      return {
        tone: "danger" as const,
        title: "Reserva cancelada",
        message: "Esta reserva foi cancelada. Se precisares, cria uma nova.",
        actionLabel: "Voltar",
        action: () => {
          clearDraft();
          router.replace(TAB_PATHNAMES.index);
        },
      };
    }
    if (isPaymentSettled(status)) {
      if (isServiceBooking && bookingTimedOut) {
        return {
          tone: "warning" as const,
          title: "Confirmação da reserva pendente",
          message:
            "O pagamento foi confirmado, mas o agendamento ainda está a sincronizar. Atualiza o estado da reserva.",
          actionLabel: "Atualizar reserva",
          action: () => fetchBookingStatus(),
          secondaryActionLabel: "Tentar novamente",
          secondaryAction: () => pollBookingStatus(),
        };
      }
      const shouldShowBookingSpinner =
        isServiceBooking && !isBookingTerminalStatus(bookingStatus);
      return {
        tone: "success" as const,
        title: "Pagamento confirmado",
        message: isServiceBooking
          ? "Pagamento confirmado. A confirmar agendamento..."
          : "O teu bilhete já está disponível na carteira.",
        actionLabel: isServiceBooking ? "Verificar reserva" : "Ver bilhetes",
        action: () => {
          if (isServiceBooking) {
            fetchBookingStatus();
            return;
          }
          clearDraft();
          router.replace("/tickets");
        },
        showSpinner: shouldShowBookingSpinner,
      };
    }
    if (
      status === "FAILED" ||
      status === "CANCELED" ||
      status === "CANCELLED" ||
      status === "EXPIRED"
    ) {
      return {
        tone: "danger" as const,
        title: status === "EXPIRED" ? "Sessão expirada" : "Pagamento falhou",
        message: getUserFacingError(
          checkoutStatus.errorMessage,
          status === "EXPIRED"
            ? "A sessão de checkout expirou. Tenta novamente."
            : "Não foi possível concluir o pagamento.",
        ),
        actionLabel: "Tentar novamente",
        action: () => {
          resetIntent();
          setCheckoutStatus(null);
          setError(null);
          handlePay();
        },
      };
    }
    if (status === "REQUIRES_ACTION") {
      const timedOut = requiresActionTimedOut || checkoutPollingTimedOut;
      if (resolvedMethod === "mbway") {
        return {
          tone: "warning" as const,
          title: timedOut
            ? "Confirmação MBWay pendente"
            : "Aguarda confirmação MBWay",
          message: timedOut
            ? "A confirmação no MBWay está a demorar mais do que o esperado. Atualiza o estado; se continuar pendente, tenta novamente."
            : "Confirma o pagamento na app MBWay e depois atualiza o estado aqui.",
          actionLabel: "Atualizar estado",
          action: () => runStatusCheck(),
          secondaryActionLabel: timedOut ? "Tentar novamente" : undefined,
          secondaryAction: timedOut ? () => handlePay() : undefined,
          showSpinner: !timedOut,
        };
      }
      return {
        tone: "warning" as const,
        title: "Ação necessária",
        message: timedOut
          ? "Ainda não recebemos confirmação final. Podes voltar a tentar ou atualizar o estado."
          : "Precisas de concluir o pagamento para confirmar a compra.",
        actionLabel: "Tentar novamente",
        action: () => handlePay(),
        secondaryActionLabel: "Atualizar estado",
        secondaryAction: () => runStatusCheck(),
      };
    }
    if (checkoutPollingTimedOut) {
      return {
        tone: "warning" as const,
        title: "Confirmação pendente",
        message:
          "A confirmação está a demorar mais do que o esperado. Podes atualizar o estado ou tentar novamente.",
        actionLabel: "Atualizar estado",
        action: () => runStatusCheck(),
        secondaryActionLabel: "Tentar novamente",
        secondaryAction: () => handlePay(),
      };
    }
    if (status === "REFUNDED") {
      return {
        tone: "warning" as const,
        title: "Pagamento reembolsado",
        message: "O valor foi devolvido. Se quiseres, inicia um novo checkout.",
        actionLabel: isServiceBooking
          ? "Voltar ao serviço"
          : "Voltar ao evento",
        action: () => {
          clearDraft();
          if (isServiceBooking && draft.serviceId) {
            router.replace({
              pathname: "/service/[id]",
              params: { id: String(draft.serviceId) },
            });
            return;
          }
          if (draft.slug) {
            router.replace({
              pathname: "/event/[slug]",
              params: { slug: draft.slug },
            });
          } else {
            router.replace(TAB_PATHNAMES.index);
          }
        },
      };
    }
    if (status === "DISPUTED") {
      return {
        tone: "warning" as const,
        title: "Pagamento em disputa",
        message:
          "O pagamento está em disputa. Contacta o suporte se precisares de ajuda.",
      };
    }

    return {
      tone: "info" as const,
      title:
        status === "PROCESSING"
          ? "Pagamento em processamento"
          : "Pagamento pendente",
      message:
        "Estamos a confirmar o pagamento. Isto pode demorar alguns segundos.",
      actionLabel: "Verificar estado",
      action: () => runStatusCheck(),
      showSpinner: true,
    };
  }, [
    bookingStatus,
    checkoutStatus,
    clearDraft,
    draft,
    fetchBookingStatus,
    handlePay,
    isExpired,
    isPaymentSettled,
    isServiceBooking,
    bookingTimedOut,
    checkoutPollingTimedOut,
    requiresActionTimedOut,
    resetIntent,
    router,
    runStatusCheck,
  ]);
  const renderBottomPayButton = payButtonVisible && !statusMeta;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground>
        <View className="px-5 pt-12 pb-6">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={{
              width: tokens.layout.touchTarget,
              height: tokens.layout.touchTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={tokens.colors.text}
            />
          </Pressable>
        </View>

        <View className="px-5 gap-4">
          {!draft ? (
            <GlassCard intensity={52}>
              <Text className="text-white/70 text-sm mb-3">
                Sem checkout ativo no momento.
              </Text>
              <Pressable
                className="rounded-xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                onPress={() => router.replace(TAB_PATHNAMES.index)}
                accessibilityRole="button"
                accessibilityLabel="Voltar ao Descobrir"
              >
                <Text className="text-white text-sm font-semibold text-center">
                  Voltar ao Descobrir
                </Text>
              </Pressable>
            </GlassCard>
          ) : (
            <>
              <GlassCard intensity={60} highlight>
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: "#F4FAFF", fontSize: 14, fontWeight: "700" }}>
                      Checkout
                    </Text>
                    {statusPill ? (
                      <GlassPill
                        label={statusPill.label}
                        variant={statusPill.variant}
                      />
                    ) : null}
                  </View>
                  <Text style={{ color: "#F4FAFF", fontSize: 18, fontWeight: "700" }} numberOfLines={2}>
                    {draft.eventTitle ?? draft.serviceTitle ?? "Checkout"}
                  </Text>
                  {checkoutHoldExpiresAt ? (
                    <View className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <Text style={{ color: "rgba(233,244,255,0.72)", fontSize: 12 }}>
                        {holdCountdownLabel
                          ? `Bloqueio de checkout ativo (${holdCountdownLabel})`
                          : isServiceBooking
                            ? "O seu bloqueio expirou - o slot já não está reservado."
                            : "O seu bloqueio expirou - os bilhetes já não estão reservados."}
                      </Text>
                    </View>
                  ) : null}
                  <View className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: "rgba(238,246,255,0.94)", fontSize: 14, fontWeight: "600" }}>
                        {itemLabel}
                      </Text>
                      <GlassPill label={`${Math.max(totalQuantity, draft.quantity)}x`} variant="muted" />
                    </View>
                    {checkoutItems.length > 0 ? (
                      <View className="gap-1">
                        {checkoutItems.map((item) => (
                          <View
                            key={`checkout-item-${item.ticketTypeId}`}
                            className="flex-row items-center justify-between"
                          >
                            <Text
                              style={{
                                color: "rgba(226,238,252,0.8)",
                                fontSize: 12,
                                flex: 1,
                                paddingRight: 8,
                              }}
                              numberOfLines={1}
                            >
                              {item.quantity}x {item.ticketName}
                            </Text>
                            <Text style={{ color: "rgba(238,246,255,0.9)", fontSize: 12, fontWeight: "600" }}>
                              {formatMoney(item.lineTotalCents, item.currency)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <View className="h-px bg-white/10" />
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: "rgba(233,244,255,0.72)", fontSize: 14, fontWeight: "600" }}>
                        Total
                      </Text>
                      {totalLabel ? (
                        <Text style={{ color: "#F4FAFF", fontSize: 22, fontWeight: "700" }}>
                          {totalLabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {isFreeCheckout ? (
                    <Text style={{ color: "rgba(233,244,255,0.62)", fontSize: 12 }}>
                      Limite por pessoa: 1
                    </Text>
                  ) : null}
                </View>
              </GlassCard>

              {showPaymentMethods ? (
                <GlassCard intensity={52}>
                  <View className="gap-3">
                    <Text className="text-white text-sm font-semibold">
                      Método de pagamento
                    </Text>
                    <View className="gap-2">
                      {(
                        [
                          {
                            key: "apple_pay",
                            label: "Apple Pay",
                            enabled: allowApplePay,
                          },
                          {
                            key: "mbway",
                            label: "MBWay",
                            enabled: allowMbwayInApp,
                          },
                          { key: "card", label: "Cartão", enabled: true },
                        ] as const
                      ).map((option) => {
                        if (!option.enabled) return null;
                        const active = selectedMethod === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => setPaymentMethod(option.key)}
                            className={active
                              ? "rounded-2xl border border-cyan-200/55 bg-cyan-200/14 px-4 py-3"
                              : "rounded-2xl border border-white/12 bg-white/5 px-4 py-3"}
                            style={{
                              minHeight: tokens.layout.touchTarget,
                              justifyContent: "center",
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar ${option.label}`}
                            accessibilityState={{ selected: active }}
                          >
                            <View className="flex-row items-center justify-between gap-3">
                              <Text
                                style={
                                  active
                                    ? { color: "#F4FAFF", fontSize: 14, fontWeight: "700" }
                                    : { color: "rgba(233,244,255,0.84)", fontSize: 14, fontWeight: "600" }
                                }
                              >
                                {option.label}
                              </Text>
                              <View
                                className={
                                  active
                                    ? "h-5 w-5 rounded-full border border-cyan-100 bg-cyan-200/80"
                                    : "h-5 w-5 rounded-full border border-white/35 bg-transparent"
                                }
                              />
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                    {!allowMbwayInApp ? (
                      <Text
                        style={{ color: "rgba(233,244,255,0.62)", fontSize: 12 }}
                      >
                        {CHECKOUT_MBWAY_EXPO_GO_ERROR}
                      </Text>
                    ) : null}
                    <Text style={{ color: "rgba(233,244,255,0.62)", fontSize: 12 }}>
                      {resolveMethodLabel(resolvedMethod)} em checkout nativo,
                      sem sair da app.
                    </Text>
                  </View>
                </GlassCard>
              ) : null}

              {!session?.user?.id ? (
                <GlassCard intensity={48}>
                  <Text className="text-white/70 text-sm mb-3">
                    Inicia sessão para concluir a compra.
                  </Text>
                  <Pressable
                    className="rounded-xl bg-white/10 px-4 py-3"
                    onPress={openAuth}
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel="Entrar ou criar conta"
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      Entrar / Criar conta
                    </Text>
                  </Pressable>
                </GlassCard>
              ) : null}

              {statusMeta ? (
                <GlassCard intensity={50}>
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={
                          statusMeta.tone === "success"
                            ? "text-sky-200 text-sm font-semibold"
                            : statusMeta.tone === "danger"
                              ? "text-rose-200 text-sm font-semibold"
                              : statusMeta.tone === "warning"
                                ? "text-amber-200 text-sm font-semibold"
                                : "text-white text-sm font-semibold"
                        }
                      >
                        {statusMeta.title}
                      </Text>
                      {statusMeta.showSpinner ||
                      checkingStatus ||
                      bookingChecking ? (
                        <ActivityIndicator color="white" />
                      ) : null}
                    </View>
                    <Text className="text-white/70 text-sm">
                      {statusMeta.message}
                    </Text>
                    {statusMeta.action ? (
                      <Pressable
                        onPress={statusMeta.action}
                        disabled={processing}
                        className="rounded-xl border border-white/10 bg-white/10 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel={statusMeta.actionLabel}
                        accessibilityState={{ disabled: processing }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {statusMeta.actionLabel}
                        </Text>
                      </Pressable>
                    ) : null}
                    {statusMeta.secondaryAction ? (
                      <Pressable
                        onPress={statusMeta.secondaryAction}
                        disabled={processing}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel={statusMeta.secondaryActionLabel}
                        accessibilityState={{ disabled: processing }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {statusMeta.secondaryActionLabel}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>
              ) : null}

              {bookingError ? (
                <GlassCard intensity={50}>
                  <Text className="text-amber-200 text-sm">{bookingError}</Text>
                </GlassCard>
              ) : null}

              {error ? (
                <GlassCard intensity={50}>
                  <Text className="text-red-300 text-sm">{error}</Text>
                </GlassCard>
              ) : null}

              {renderBottomPayButton ? (
                <Pressable
                  disabled={payButtonDisabled}
                  onPress={handlePay}
                  className={
                    !payButtonDisabled
                      ? "rounded-2xl bg-[#EAF63A] px-4 py-4"
                      : "rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  }
                  style={{
                    minHeight: tokens.layout.touchTarget,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={payButtonLabel}
                  accessibilityState={{ disabled: payButtonDisabled }}
                >
                  {processing ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="#0A1018" />
                      <Text className="text-[#0A1018] text-sm font-semibold">
                        A processar...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      className={
                        !payButtonDisabled
                          ? "text-center text-[#0A1018] text-sm font-semibold"
                          : "text-center text-white/50 text-sm font-semibold"
                      }
                    >
                      {payButtonLabel}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </LiquidBackground>
    </>
  );
}
