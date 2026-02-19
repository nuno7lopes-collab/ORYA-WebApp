import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  Linking,
  Alert,
  TextInput,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  InteractionManager,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useEventDetail } from "../../features/events/hooks";
import { tokens, useTranslation } from "@orya/shared";
import { Ionicons } from "../../components/icons/Ionicons";
import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useAuth } from "../../lib/auth";
import {
  useCheckoutStore,
  buildCheckoutIdempotencyKey,
} from "../../features/checkout/store";
import {
  createPairingCheckoutIntent,
} from "../../features/checkout/api";
import {
  createPairing,
  joinOpenPairing,
  acceptInvite,
  declineInvite,
} from "../../features/tournaments/api";
import {
  useMyPairings,
  useOpenPairings,
  usePadelMatches,
  usePadelStandings,
} from "../../features/tournaments/hooks";
import {
  resolveRegistrationBlockReason,
  resolveRegistrationPrimaryCtaLabel,
  shouldShowMyPairingSection,
  shouldShowOpenPairingsSection,
} from "../../features/tournaments/uxState";
import { safeBack } from "../../lib/navigation";
import { FavoriteToggle } from "../../components/events/FavoriteToggle";
import { StickyPurchaseBar } from "../../components/events/detail/StickyPurchaseBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileEnv } from "../../lib/env";
import { getUserFacingError } from "../../lib/errors";
import { resolveMediaUri } from "../../lib/media";
import { trackEvent } from "../../lib/analytics";
import { useProfileSummary } from "../../features/profile/hooks";
import { sendEventSignal } from "../../features/events/signals";
import { formatCurrency, formatDate, formatTime } from "../../lib/formatters";
import { trackCrmEngagement } from "../../lib/crm";
import * as Haptics from "expo-haptics";
import {
  resolveCanOpenTicketSheet,
  shouldDismissByPullDown,
} from "../../features/events/detailState";
import { EventHeroSquare } from "../../components/events/detail/EventHeroSquare";
import { EventHeaderMeta } from "../../components/events/detail/EventHeaderMeta";
import { EventInfoAccordion } from "../../components/events/detail/EventInfoAccordion";
import { EventLocationBlock } from "../../components/events/detail/EventLocationBlock";
import { PadelSection } from "../../components/events/detail/PadelSection";
import {
  TicketSelectorItem,
  TicketSelectorSheet,
} from "../../components/events/detail/TicketSelectorSheet";
import { getDominantTint, getFallbackTint } from "../../lib/imageTint";

const formatDateRange = (startsAt?: string, endsAt?: string): string | null => {
  if (!startsAt) return null;
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;

    const date = formatDate(start, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const startTime = formatTime(start);

    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;

    const endTime = formatTime(end);

    return `${date} · ${startTime}–${endTime}`;
  } catch {
    return null;
  }
};

const resolveStatusLabel = (
  status: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT" | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  switch (status) {
    case "CANCELLED":
      return t("events:status.cancelled");
    case "PAST":
      return t("events:status.ended");
    case "DRAFT":
      return t("events:status.draft");
    default:
      return t("events:status.active");
  }
};

const formatTicketPrice = (
  priceCents: number,
  currency: string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (priceCents <= 0) return t("common:price.free");
  const amount = priceCents / 100;
  return formatCurrency(amount, currency?.toUpperCase() || "EUR");
};

const resolveTicketStatusLabel = (
  status: string | null | undefined,
  remaining: number | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (status === "CLOSED") return t("events:tickets.closed");
  if (status === "UPCOMING") return t("events:tickets.upcoming");
  if (status === "SOLD_OUT" || remaining === 0)
    return t("events:tickets.soldOut");
  return t("events:tickets.available");
};

const resolveAccessBadge = (
  mode: string | null | undefined,
  t: (key: string) => string,
) => {
  const normalized = mode?.toUpperCase();
  if (normalized === "INVITE_ONLY" || normalized === "UNLISTED")
    return { label: t("events:access.invite"), variant: "muted" as const };
  return { label: t("events:access.public"), variant: "accent" as const };
};

const resolvePadelRegistrationLabel = (
  status: string | null | undefined,
  t: (key: string) => string,
) => {
  const normalized = status?.toUpperCase();
  if (normalized === "OPEN") return t("events:padel.registration.open");
  if (normalized === "NOT_OPEN") return t("events:padel.registration.notOpen");
  if (normalized === "CLOSED") return t("events:padel.registration.closed");
  if (normalized === "STARTED") return t("events:padel.registration.started");
  if (normalized === "UNPUBLISHED")
    return t("events:padel.registration.unpublished");
  return t("events:padel.registration.unavailable");
};

const resolvePadelPaymentModeLabel = (
  mode: string | null | undefined,
  t: (key: string) => string,
): string | null => {
  const normalized = mode?.toUpperCase();
  if (normalized === "SPLIT") return t("events:padel.payment.split");
  if (normalized === "FULL") return t("events:padel.payment.full");
  return mode ?? null;
};

const resolvePairingLabel = (
  pairing: any,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const explicitLabel =
    typeof pairing?.label === "string" ? pairing.label.trim() : "";
  if (explicitLabel) return explicitLabel;
  if (Array.isArray(pairing?.players)) {
    const names = pairing.players
      .map((player: any) => player?.name || player?.username)
      .filter(Boolean) as string[];
    if (names.length) return names.join(" / ");
  }
  if (!pairing || !Array.isArray(pairing.slots)) {
    return pairing?.id
      ? t("events:padel.pairing.withId", { id: pairing.id })
      : t("events:padel.pairing.default");
  }
  const names = pairing.slots
    .map(
      (slot: any) =>
        slot?.playerProfile?.displayName ||
        slot?.playerProfile?.fullName ||
        slot?.playerProfile?.username,
    )
    .filter(Boolean) as string[];
  if (names.length === 0) {
    return pairing?.id
      ? t("events:padel.pairing.withId", { id: pairing.id })
      : t("events:padel.pairing.default");
  }
  return names.join(" / ");
};

const normalizeEmailValue = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";
const normalizeUsernameValue = (value?: string | null) =>
  value?.trim().replace(/^@+/, "").toLowerCase() ?? "";

const mapInviteTokenReason = (
  reason: string | null | undefined,
  t: (key: string) => string,
) => {
  switch ((reason ?? "").toUpperCase()) {
    case "INVITE_TOKEN_NOT_ALLOWED":
      return t("events:invite.tokenNotAllowed");
    case "INVITE_TOKEN_TTL_REQUIRED":
      return t("events:invite.tokenExpired");
    case "INVITE_TOKEN_REQUIRES_EMAIL":
      return t("events:invite.tokenEmailOnly");
    case "INVITE_TOKEN_INVALID":
    case "INVITE_TOKEN_NOT_FOUND":
      return t("events:invite.tokenInvalid");
    default:
      return null;
  }
};

type Rgb = { r: number; g: number; b: number };
type Gradient3 = [string, string, string];
type Gradient4 = [string, string, string, string];

type EventBackdropPalette = {
  rootGradient: Gradient3;
  topGradient: Gradient4;
  blendGradient: Gradient4;
  closeOrbFill: string;
  closeOrbBorder: string;
  closeOrbHighlight: string;
  closeButtonShadow: string;
};

const ORYA_BLUE_PRIMARY: Rgb = { r: 10, g: 29, b: 72 };
const ORYA_BLUE_DEEP: Rgb = { r: 4, g: 14, b: 40 };
const ORYA_SKY_ACCENT: Rgb = { r: 120, g: 222, b: 255 };

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));
const clampAlpha = (value: number) => Math.max(0, Math.min(1, value));

const rgba = (color: Rgb, alpha: number) =>
  `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(
    color.b,
  )}, ${clampAlpha(alpha)})`;

const parsePercentOrFloat = (token: string) => {
  const raw = token.trim();
  if (!raw) return Number.NaN;
  if (raw.endsWith("%")) return Number.parseFloat(raw) / 100;
  return Number.parseFloat(raw);
};

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const lig = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: clampChannel((r + m) * 255),
    g: clampChannel((g + m) * 255),
    b: clampChannel((b + m) * 255),
  };
};

const parseColorToRgb = (color: string): Rgb | null => {
  const value = color.trim();
  if (!value) return null;

  const rgbaMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((item) => item.trim());
    if (parts.length >= 3) {
      const parsed = parts.slice(0, 3).map((item) => Number.parseFloat(item));
      if (parsed.every((item) => Number.isFinite(item))) {
        const [r, g, b] = parsed;
        return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
      }
    }
  }

  const hslaMatch = value.match(/^hsla?\(([^)]+)\)$/i);
  if (hslaMatch) {
    const parts = hslaMatch[1].split(",").map((item) => item.trim());
    if (parts.length >= 3) {
      const h = Number.parseFloat(parts[0]);
      const s = parsePercentOrFloat(parts[1]);
      const l = parsePercentOrFloat(parts[2]);
      if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
        return hslToRgb(h, s, l);
      }
    }
  }

  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const hex =
      raw.length === 3
        ? raw
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : raw;
    const parsed = Number.parseInt(hex, 16);
    if (Number.isFinite(parsed)) {
      return {
        r: (parsed >> 16) & 0xff,
        g: (parsed >> 8) & 0xff,
        b: parsed & 0xff,
      };
    }
  }
  return null;
};

const mixRgb = (from: Rgb, to: Rgb, weight: number): Rgb => {
  const safe = Math.max(0, Math.min(1, weight));
  return {
    r: clampChannel(from.r + (to.r - from.r) * safe),
    g: clampChannel(from.g + (to.g - from.g) * safe),
    b: clampChannel(from.b + (to.b - from.b) * safe),
  };
};

const liftTintForBackdrop = (input: Rgb): Rgb => {
  const luminance = input.r * 0.2126 + input.g * 0.7152 + input.b * 0.0722;
  let output = input;
  if (luminance < 74) {
    const lift = Math.min(1, (74 - luminance) / 74);
    output = mixRgb(output, ORYA_SKY_ACCENT, 0.24 + lift * 0.4);
  } else if (luminance > 190) {
    output = mixRgb(output, ORYA_BLUE_PRIMARY, 0.3);
  }
  return mixRgb(output, ORYA_BLUE_PRIMARY, 0.18);
};

const buildEventBackdropPalette = (tint: string): EventBackdropPalette => {
  const parsedTint = parseColorToRgb(tint) ?? ORYA_BLUE_PRIMARY;
  const liftedTint = liftTintForBackdrop(parsedTint);
  const top = mixRgb(liftedTint, ORYA_SKY_ACCENT, 0.2);
  const middle = mixRgb(liftedTint, ORYA_BLUE_PRIMARY, 0.46);
  const deep = mixRgb(ORYA_BLUE_PRIMARY, ORYA_BLUE_DEEP, 0.52);
  const closeOrb = mixRgb(top, ORYA_BLUE_PRIMARY, 0.5);
  const closeEdge = mixRgb(top, { r: 255, g: 255, b: 255 }, 0.54);

  return {
    rootGradient: [
      rgba(mixRgb(ORYA_BLUE_PRIMARY, liftedTint, 0.16), 1),
      rgba(deep, 1),
      rgba(ORYA_BLUE_DEEP, 1),
    ],
    topGradient: [
      rgba(top, 0.92),
      rgba(middle, 0.68),
      rgba(mixRgb(middle, ORYA_BLUE_DEEP, 0.42), 0.28),
      rgba(ORYA_BLUE_DEEP, 0),
    ],
    blendGradient: [
      rgba(top, 0),
      rgba(mixRgb(middle, ORYA_BLUE_PRIMARY, 0.36), 0.24),
      rgba(mixRgb(ORYA_BLUE_PRIMARY, ORYA_BLUE_DEEP, 0.44), 0.76),
      rgba(ORYA_BLUE_DEEP, 0.98),
    ],
    closeOrbFill: rgba(closeOrb, 0.34),
    closeOrbBorder: rgba(closeEdge, 0.48),
    closeOrbHighlight: rgba(mixRgb(closeEdge, { r: 255, g: 255, b: 255 }, 0.5), 0.2),
    closeButtonShadow: rgba(mixRgb(closeEdge, ORYA_SKY_ACCENT, 0.26), 0.84),
  };
};

export default function EventDetail() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    slug?: string | string[];
    source?: string;
    eventTitle?: string;
    coverImageUrl?: string;
    shortDescription?: string;
    startsAt?: string;
    endsAt?: string;
    locationLabel?: string;
    priceLabel?: string;
    categoryLabel?: string;
    hostName?: string;
    imageTag?: string;
    inviteToken?: string;
    pairingId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const source = useMemo(
    () =>
      (Array.isArray(params.source) ? params.source[0] : params.source) ?? null,
    [params.source],
  );
  const slugValue = useMemo(
    () => (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? null,
    [params.slug],
  );
  const eventTitleValue = useMemo(
    () =>
      (Array.isArray(params.eventTitle)
        ? params.eventTitle[0]
        : params.eventTitle) ?? null,
    [params.eventTitle],
  );
  const previewCoverValue = useMemo(() => {
    const value = params.coverImageUrl;
    const raw = Array.isArray(value) ? value[0] : value ?? null;
    return resolveMediaUri(raw);
  }, [params.coverImageUrl]);
  const previewStartsAt = useMemo(() => {
    const value = params.startsAt;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.startsAt]);
  const previewLocation = useMemo(() => {
    const value = params.locationLabel;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.locationLabel]);

  const fallbackRoute = useMemo(() => {
    switch (source) {
      case "map":
        return "/map";
      case "notifications":
        return "/notifications";
      case "messages":
        return "/messages";
      case "agora":
        return "/(tabs)/agora";
      case "discover":
        return "/(tabs)/index";
      case "search":
        return "/search";
      case "tickets":
        return "/tickets";
      case "profile":
        return "/(tabs)/profile";
      default:
        return "/(tabs)/index";
    }
  }, [source]);

  const nextRoute = useMemo(() => {
    if (!slugValue) return fallbackRoute;
    if (source)
      return `/event/${slugValue}?source=${encodeURIComponent(source)}`;
    return `/event/${slugValue}`;
  }, [fallbackRoute, slugValue, source]);

  const openAuth = useCallback(() => {
    router.push({ pathname: "/auth", params: { next: nextRoute } });
  }, [nextRoute, router]);
  const previewPrice = useMemo(() => {
    const value = params.priceLabel;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.priceLabel]);
  const previewHost = useMemo(() => {
    const value = params.hostName;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.hostName]);
  const inviteTokenParam = useMemo(() => {
    const raw = params.inviteToken;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  }, [params.inviteToken]);
  const pairingIdParam = useMemo(() => {
    const raw = params.pairingId;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  }, [params.pairingId]);
  const { data, isLoading, isError, error, refetch } = useEventDetail(
    slugValue ?? "",
  );
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const profileSummaryQuery = useProfileSummary(
    Boolean(accessToken),
    accessToken,
    session?.user?.id ?? null,
  );
  const profileSummary = profileSummaryQuery.data ?? null;
  const setCheckoutDraft = useCheckoutStore((state) => state.setDraft);
  const setCheckoutIntent = useCheckoutStore((state) => state.setIntent);
  const insets = useSafeAreaInsets();
  const env = getMobileEnv();
  const transitionSource = params.source === "discover" ? "discover" : "direct";
  const fade = useRef(
    new Animated.Value(transitionSource === "discover" ? 0 : 0.2),
  ).current;
  const translate = useRef(
    new Animated.Value(transitionSource === "discover" ? 20 : 10),
  ).current;
  const viewSentRef = useRef(false);
  const [ticketSheetVisible, setTicketSheetVisible] = useState(false);
  const [ticketQuantities, setTicketQuantities] = useState<Record<number, number>>({});
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [initiatingCheckout, setInitiatingCheckout] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [inviteState, setInviteState] = useState<{
    status: "idle" | "checking" | "valid" | "invalid";
    message?: string | null;
    token?: string | null;
    ticketTypeId?: number | null;
  }>({ status: "idle" });
  const [inviteIdentifierInput, setInviteIdentifierInput] = useState("");
  const [inviteIdentifierState, setInviteIdentifierState] = useState<{
    status: "idle" | "checking" | "invited" | "not_invited" | "invalid";
    message?: string | null;
    normalized?: string | null;
    type?: "email" | "username" | null;
  }>({ status: "idle" });
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [paymentMode, setPaymentMode] = useState<"FULL" | "SPLIT">("FULL");
  const [joinMode, setJoinMode] = useState<
    "INVITE_PARTNER" | "LOOKING_FOR_PARTNER"
  >("INVITE_PARTNER");
  const [inviteContact, setInviteContact] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingActionBusy, setPairingActionBusy] = useState(false);
  const dismissInFlightRef = useRef(false);
  const scrollOffsetYRef = useRef(0);
  const dismissResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const triggerLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  }, []);

  useEffect(() => {
    const eventId = data?.id;
    if (!eventId) return;
    if (!viewSentRef.current) {
      sendEventSignal({ eventId, signalType: "VIEW" });
      if (accessToken) {
        trackCrmEngagement({ type: "EVENT_VIEWED", eventId });
      }
      viewSentRef.current = true;
    }
    const startAt = Date.now();
    return () => {
      const dwellMs = Date.now() - startAt;
      if (dwellMs >= 4000) {
        sendEventSignal({ eventId, signalType: "DWELL", signalValue: dwellMs });
      }
    };
  }, [data?.id]);

  const handleBack = useCallback(() => {
    triggerLightHaptic();
    safeBack(router, navigation, fallbackRoute);
  }, [fallbackRoute, navigation, router, triggerLightHaptic]);
  const accessMode = data?.accessPolicy?.mode ?? null;
  const accessBadge = resolveAccessBadge(accessMode, t);
  const isInviteOnly = accessMode?.toUpperCase() === "INVITE_ONLY";
  const inviteValid = inviteState.status === "valid";
  const inviteToken = inviteState.token ?? null;
  const inviteTicketTypeId = inviteState.ticketTypeId ?? null;
  const normalizedInviteIdentifier = inviteIdentifierState.normalized ?? null;
  const identifierMatchesAccount = useMemo(() => {
    if (!normalizedInviteIdentifier) return false;
    if (inviteIdentifierState.status !== "invited") return false;
    const type = inviteIdentifierState.type ?? null;
    if (type === "email") {
      const email = normalizeEmailValue(profileSummary?.email ?? null);
      return Boolean(email && email === normalizedInviteIdentifier);
    }
    if (type === "username") {
      const username = normalizeUsernameValue(profileSummary?.username ?? null);
      return Boolean(username && username === normalizedInviteIdentifier);
    }
    return false;
  }, [
    inviteIdentifierState.status,
    inviteIdentifierState.type,
    normalizedInviteIdentifier,
    profileSummary?.email,
    profileSummary?.username,
  ]);
  const inviteIdentifierValid =
    inviteIdentifierState.status === "invited" &&
    (!session?.user?.id || identifierMatchesAccount);
  const canAccessInvite = !isInviteOnly || inviteValid || inviteIdentifierValid;
  const gateLocked = isInviteOnly && !inviteValid && !inviteIdentifierValid;
  const inviteIdentifierNeedsLogin =
    inviteIdentifierState.status === "invited" && !session?.user?.id;
  const inviteIdentifierCheckingAccount =
    inviteIdentifierState.status === "invited" &&
    Boolean(session?.user?.id) &&
    profileSummaryQuery.isLoading;
  const inviteIdentifierMismatch =
    inviteIdentifierState.status === "invited" &&
    Boolean(session?.user?.id) &&
    !identifierMatchesAccount &&
    !profileSummaryQuery.isLoading;
  const isPadelEvent =
    typeof data?.templateType === "string"
      ? data.templateType.toUpperCase() === "PADEL"
      : Boolean(data?.padel);
  const padelMeta = data?.padel ?? null;
  const padelCategories = Array.isArray(padelMeta?.categories)
    ? padelMeta?.categories
    : [];
  const visiblePadelCategories = padelCategories.filter(
    (category) => !category.isHidden,
  );
  const registrationStatus = padelMeta?.registrationStatus ?? null;
  const registrationMessage =
    padelMeta?.registrationMessage ??
    resolvePadelRegistrationLabel(registrationStatus, t);
  const registrationOpen = registrationStatus === "OPEN";
  const padelSnapshot = padelMeta?.snapshot ?? null;
  const padelActionsDisabled =
    gateLocked || !registrationOpen || !padelMeta?.v2Enabled;
  const selectedPadelCategory =
    visiblePadelCategories.find(
      (category) => category.id === selectedCategoryId,
    ) ??
    visiblePadelCategories.find(
      (category) => category.id === padelMeta?.defaultCategoryId,
    ) ??
    visiblePadelCategories[0] ??
    null;
  const activeCategoryId = selectedPadelCategory?.id ?? null;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration:
          transitionSource === "discover"
            ? tokens.motion.normal + 120
            : tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration:
          transitionSource === "discover"
            ? tokens.motion.normal + 120
            : tokens.motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [data?.id, fade, transitionSource, translate]);

  const validateInviteToken = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed || !slugValue) {
        setInviteState({
          status: "invalid",
          message: t("events:invite.tokenInvalid"),
        });
        return;
      }
      setInviteState({ status: "checking" });
      try {
        const response = await api.request<unknown>(
          `/api/eventos/${encodeURIComponent(slugValue)}/invite-token`,
          {
            method: "POST",
            body: JSON.stringify({ token: trimmed }),
          },
        );
        const result = unwrapApiResponse<{
          allow?: boolean;
          reason?: string;
          ticketTypeId?: number | null;
        }>(response);
        if (!result.allow) {
          const reasonMessage = mapInviteTokenReason(result.reason, t);
          setInviteState({
            status: "invalid",
            message:
              reasonMessage ??
              (result.reason
                ? t("events:invite.invalidWithReason", {
                    reason: result.reason,
                  })
                : t("events:invite.invalid")),
          });
          return;
        }
        setInviteState({
          status: "valid",
          token: trimmed,
          ticketTypeId:
            typeof result.ticketTypeId === "number" &&
            Number.isFinite(result.ticketTypeId)
              ? result.ticketTypeId
              : null,
        });
      } catch (err: any) {
        setInviteState({
          status: "invalid",
          message: getUserFacingError(err, t("events:invite.invalid")),
        });
      }
    },
    [slugValue, t],
  );

  const handleInviteCheck = useCallback(() => {
    validateInviteToken(inviteTokenInput);
  }, [inviteTokenInput, validateInviteToken]);

  const validateInviteIdentifier = useCallback(
    async (identifier: string) => {
      const trimmed = identifier.trim();
      if (!trimmed || !slugValue) {
        setInviteIdentifierState({
          status: "invalid",
          message: t("events:invite.identifierInvalid"),
        });
        return;
      }
      setInviteIdentifierState({ status: "checking" });
      try {
        const response = await api.request<unknown>(
          `/api/eventos/${encodeURIComponent(slugValue)}/invites/check`,
          {
            method: "POST",
            body: JSON.stringify({ identifier: trimmed }),
          },
        );
        const result = unwrapApiResponse<{
          invited?: boolean;
          type?: "email" | "username";
          normalized?: string;
          reason?: string;
        }>(response);
        if (!result.invited) {
          const reasonCode = (result.reason ?? "").toUpperCase();
          let message: string | null = null;
          if (reasonCode === "INVITE_IDENTITY_MATCH_REQUIRED") {
            message = trimmed.includes("@")
              ? t("events:invite.usernameOnly")
              : t("events:invite.emailOnly");
          } else if (reasonCode === "USERNAME_NOT_FOUND") {
            message = t("events:invite.usernameNotFound");
          }
          setInviteIdentifierState({
            status: "not_invited",
            message:
              message ??
              (result.reason
                ? t("events:invite.notFoundWithReason", {
                    reason: result.reason,
                  })
                : t("events:invite.notFound")),
          });
          return;
        }
        const resolvedType =
          result.type ??
          (trimmed.includes("@") ? ("email" as const) : ("username" as const));
        const normalizedRaw = result.normalized ?? trimmed;
        const normalized =
          resolvedType === "email"
            ? normalizeEmailValue(normalizedRaw)
            : normalizeUsernameValue(normalizedRaw);
        setInviteIdentifierState({
          status: "invited",
          normalized,
          type: resolvedType,
        });
      } catch (err: any) {
        setInviteIdentifierState({
          status: "invalid",
          message: getUserFacingError(err, t("events:invite.validateFailed")),
        });
      }
    },
    [slugValue, t],
  );

  const handleInviteIdentifierCheck = useCallback(() => {
    validateInviteIdentifier(inviteIdentifierInput);
  }, [inviteIdentifierInput, validateInviteIdentifier]);

  useEffect(() => {
    if (!isInviteOnly) return;
    if (!inviteTokenParam) return;
    if (
      inviteState.status === "valid" &&
      inviteState.token === inviteTokenParam
    )
      return;
    if (inviteState.status === "checking") return;
    setInviteTokenInput(inviteTokenParam);
    validateInviteToken(inviteTokenParam);
  }, [
    inviteTokenParam,
    inviteState.status,
    inviteState.token,
    isInviteOnly,
    validateInviteToken,
  ]);

  const ticketTypes = useMemo(() => {
    const list = data?.ticketTypes ?? [];
    const filtered =
      typeof inviteTicketTypeId === "number"
        ? list.filter((ticket) => ticket.id === inviteTicketTypeId)
        : list;
    return [...filtered].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }, [data?.ticketTypes, inviteTicketTypeId]);

  const ticketMeta = useMemo(
    () =>
      ticketTypes.map((ticket) => {
        const remaining =
          ticket.totalQuantity != null
            ? Math.max(ticket.totalQuantity - (ticket.soldQuantity ?? 0), 0)
            : null;
        const status = ticket.status ?? null;
        const unavailable =
          status === "CLOSED" ||
          status === "SOLD_OUT" ||
          status === "UPCOMING" ||
          remaining === 0;
        const maxQuantity = unavailable
          ? 0
          : ticket.price <= 0
            ? Math.min(1, remaining ?? 1)
            : remaining == null
              ? 10
              : Math.max(0, Math.min(10, remaining));
        const availabilityLabel =
          remaining != null
            ? remaining <= 6
              ? t("events:tickets.lastSeats", { count: remaining })
              : t("events:tickets.remaining", { count: remaining })
            : null;
        return {
          ...ticket,
          remaining,
          unavailable,
          maxQuantity,
          availabilityLabel,
          statusLabel: resolveTicketStatusLabel(status, remaining, t),
          currencyCode: ticket.currency?.toUpperCase() || "EUR",
        };
      }),
    [t, ticketTypes],
  );
  const ticketMetaById = useMemo(
    () => new Map(ticketMeta.map((ticket) => [ticket.id, ticket])),
    [ticketMeta],
  );
  const purchasableTickets = useMemo(
    () => ticketMeta.filter((ticket) => !ticket.unavailable),
    [ticketMeta],
  );
  const hasPurchasableTickets = purchasableTickets.length > 0;

  useEffect(() => {
    setTicketQuantities((current) => {
      const allowed = new Set(ticketMeta.map((ticket) => ticket.id));
      let changed = false;
      const next: Record<number, number> = {};
      for (const [rawId, rawQuantity] of Object.entries(current)) {
        const id = Number(rawId);
        if (!allowed.has(id)) {
          changed = true;
          continue;
        }
        const quantity = Number.isFinite(rawQuantity) ? rawQuantity : 0;
        const max = ticketMetaById.get(id)?.maxQuantity ?? 0;
        const safeQuantity = Math.max(0, Math.min(max, quantity));
        if (safeQuantity !== quantity) changed = true;
        if (safeQuantity > 0) next[id] = safeQuantity;
      }
      if (!changed && Object.keys(next).length === Object.keys(current).length) {
        return current;
      }
      return next;
    });
  }, [ticketMeta, ticketMetaById]);

  useEffect(() => {
    if (!isPadelEvent) return;
    if (selectedCategoryId !== null) return;
    const fallbackId =
      padelMeta?.defaultCategoryId ??
      visiblePadelCategories.find(
        (category) => category.isEnabled && !category.isHidden,
      )?.id ??
      visiblePadelCategories[0]?.id ??
      null;
    if (fallbackId) setSelectedCategoryId(fallbackId);
  }, [
    isPadelEvent,
    padelMeta?.defaultCategoryId,
    selectedCategoryId,
    visiblePadelCategories,
  ]);

  const eventIsActive = useMemo(() => {
    if (!data) return false;
    if (data.status !== "ACTIVE") return false;
    const endsAtMs = data.endsAt ? new Date(data.endsAt).getTime() : null;
    if (endsAtMs == null || Number.isNaN(endsAtMs)) return true;
    return endsAtMs > Date.now();
  }, [data]);
  const selectedTicketItems = useMemo(
    () =>
      ticketMeta
        .map((ticket) => {
          const quantity = ticketQuantities[ticket.id] ?? 0;
          return {
            ticketTypeId: ticket.id,
            ticketName: ticket.name,
            quantity,
            unitPriceCents: ticket.price,
            lineTotalCents: ticket.price * quantity,
            currency: ticket.currencyCode,
          };
        })
        .filter((item) => item.quantity > 0),
    [ticketMeta, ticketQuantities],
  );
  const selectedTicketQuantity = useMemo(
    () =>
      selectedTicketItems.reduce((total, item) => total + item.quantity, 0),
    [selectedTicketItems],
  );
  const selectedTicketTotalCents = useMemo(
    () =>
      selectedTicketItems.reduce((total, item) => total + item.lineTotalCents, 0),
    [selectedTicketItems],
  );
  const selectedItemsAreFree =
    selectedTicketItems.length > 0 &&
    selectedTicketItems.every((item) => item.unitPriceCents <= 0);
  const ticketInventory = useMemo(() => {
    const totals = ticketTypes
      .filter((ticket) => typeof ticket.totalQuantity === "number")
      .map((ticket) => ({
        total: ticket.totalQuantity ?? 0,
        sold: ticket.soldQuantity ?? 0,
      }));
    if (totals.length === 0) return null;
    const total = totals.reduce((sum, item) => sum + item.total, 0);
    const sold = totals.reduce((sum, item) => sum + item.sold, 0);
    const remaining = Math.max(total - sold, 0);
    return { total, sold, remaining };
  }, [ticketTypes]);
  const ticketInventoryLabel = useMemo(() => {
    if (!ticketInventory) return null;
    if (ticketInventory.remaining === 0) return t("events:tickets.soldOut");
    if (ticketInventory.remaining <= 8)
      return t("events:tickets.lastSeats", {
        count: ticketInventory.remaining,
      });
    return t("events:tickets.remaining", { count: ticketInventory.remaining });
  }, [t, ticketInventory]);

  const fallbackCover = data?.slug
    ? `https://picsum.photos/seed/orya-event-${encodeURIComponent(data.slug)}/1600/900`
    : null;
  const cover = resolveMediaUri(data?.coverImageUrl ?? fallbackCover ?? null);
  const date = formatDateRange(data?.startsAt, data?.endsAt);
  const location =
    data?.location?.formattedAddress || data?.location?.city || null;
  const price =
    typeof data?.priceFrom === "number"
      ? data.priceFrom <= 0
        ? t("common:price.free")
        : t("common:price.from", {
            price: formatCurrency(data.priceFrom, "EUR"),
          })
      : null;
  const description = data?.description ?? data?.shortDescription ?? null;
  const displayTitle = data?.title ?? eventTitleValue ?? null;
  const displayCover = cover ?? previewCoverValue ?? null;
  const backdropSeed = useMemo(
    () =>
      String(
        displayCover ??
          data?.slug ??
          slugValue ??
          displayTitle ??
          eventTitleValue ??
          "orya-event",
      ),
    [data?.slug, displayCover, displayTitle, eventTitleValue, slugValue],
  );
  const fallbackBackdropTint = useMemo(
    () => getFallbackTint(backdropSeed),
    [backdropSeed],
  );
  const [backdropTint, setBackdropTint] = useState(fallbackBackdropTint);
  const backdropPalette = useMemo(
    () => buildEventBackdropPalette(backdropTint),
    [backdropTint],
  );
  const displayLocation =
    data?.location?.formattedAddress ||
    data?.location?.city ||
    previewLocation ||
    location ||
    null;
  const displayPrice = data ? price : (previewPrice ?? price);
  const displayHost =
    data?.hostName ?? previewHost ?? data?.hostUsername ?? null;
  const hostUsername = data?.hostUsername ?? null;
  const hostAvatar = resolveMediaUri(data?.hostAvatarUrl ?? null);
  const startsAtLabel = useMemo(() => {
    const startsAt = data?.startsAt ?? previewStartsAt;
    if (!startsAt) return null;
    try {
      return `Começa às ${formatTime(new Date(startsAt))}`;
    } catch {
      return null;
    }
  }, [data?.startsAt, previewStartsAt]);
  const statusLabel = data ? resolveStatusLabel(data.status, t) : null;

  useEffect(() => {
    setBackdropTint(fallbackBackdropTint);
  }, [fallbackBackdropTint]);

  useEffect(() => {
    let active = true;
    if (!displayCover) {
      return () => {
        active = false;
      };
    }
    const task = InteractionManager.runAfterInteractions(() => {
      getDominantTint(displayCover, backdropSeed)
        .then((resolved) => {
          if (active) setBackdropTint(resolved);
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      task?.cancel?.();
    };
  }, [backdropSeed, displayCover]);

  const handleHostPress = () => {
    if (hostUsername) {
      router.push(`/${hostUsername}`);
    }
  };
  const showStickyPurchaseBar =
    Boolean(data) && !isLoading && !isError && !isPadelEvent;
  const canOpenTicketSheet = resolveCanOpenTicketSheet({
    showStickyPurchaseBar,
    ticketMetaLength: ticketMeta.length,
    canAccessInvite,
    eventIsActive,
  });
  const scrollBottomPadding = showStickyPurchaseBar ? insets.bottom + 190 : 36;
  const ticketSheetCurrency =
    selectedTicketItems[0]?.currency ??
    ticketMeta[0]?.currencyCode ??
    "EUR";
  const ticketSelectorItems: TicketSelectorItem[] = useMemo(
    () =>
      ticketMeta.map((ticket) => {
        const quantity = ticketQuantities[ticket.id] ?? 0;
        const disabled = ticket.unavailable || !canAccessInvite || !eventIsActive;
        return {
          id: ticket.id,
          name: ticket.name,
          description: ticket.description ?? null,
          priceCents: ticket.price,
          currency: ticket.currencyCode,
          quantity,
          maxQuantity: ticket.maxQuantity,
          availabilityLabel: ticket.availabilityLabel,
          limitLabel:
            ticket.price <= 0 && ticket.maxQuantity === 1
              ? t("events:checkout.limitPerPerson", { count: 1 })
              : null,
          statusLabel: ticket.statusLabel,
          disabled,
        };
      }),
    [canAccessInvite, eventIsActive, t, ticketMeta, ticketQuantities],
  );
  const stickyPriceLabel =
    selectedTicketQuantity > 0
      ? formatTicketPrice(selectedTicketTotalCents, ticketSheetCurrency, t)
      : displayPrice ??
        (hasPurchasableTickets
          ? formatTicketPrice(
              purchasableTickets[0].price,
              purchasableTickets[0].currencyCode,
              t,
            )
          : t("events:tickets.comingSoon"));
  const stickyHelperText = !canAccessInvite
    ? t("events:invite.lockedTickets")
    : !eventIsActive
      ? t("events:status.ended")
      : ticketMeta.length === 0
        ? t("events:tickets.comingSoon")
        : !session?.user?.id
          ? t("events:detail.signInToContinue")
          : null;
  const shareUrl =
    data?.slug && env.apiBaseUrl
      ? `${env.apiBaseUrl.replace(/\/$/, "")}/eventos/${data.slug}`
      : null;
  const mapTargets = useMemo(() => {
    if (!data) return null;
    const fallbackQuery =
      data.location?.formattedAddress || data.location?.city || null;
    const lat = data.location?.lat ?? null;
    const lng = data.location?.lng ?? null;
    if (lat != null && lng != null) {
      const label = encodeURIComponent(data.title ?? "ORYA Event");
      const coords = `${lat},${lng}`;
      return {
        apple: `http://maps.apple.com/?ll=${coords}&q=${label}`,
        android: `geo:${coords}?q=${coords}(${label})`,
        web: `https://www.google.com/maps/search/?api=1&query=${coords}`,
      };
    }
    if (fallbackQuery) {
      const query = encodeURIComponent(fallbackQuery);
      return {
        apple: `http://maps.apple.com/?q=${query}`,
        android: `geo:0,0?q=${query}`,
        web: `https://www.google.com/maps/search/?api=1&query=${query}`,
      };
    }
    return null;
  }, [data]);

  const padelEventId = data?.id ?? null;
  const padelEnabled = isPadelEvent && Boolean(padelEventId);
  const openPairingsQuery = useOpenPairings(
    padelEventId,
    activeCategoryId,
    padelEnabled,
  );
  const myPairingsQuery = useMyPairings(
    padelEventId,
    padelEnabled && Boolean(session?.user?.id),
  );
  const liveEnabled = padelEnabled && padelMeta?.competitionState === "PUBLIC";
  const standingsQuery = usePadelStandings(
    padelEventId,
    activeCategoryId,
    liveEnabled,
    liveEnabled,
  );
  const matchesQuery = usePadelMatches(
    padelEventId,
    activeCategoryId,
    liveEnabled,
    liveEnabled,
  );

  const openPairings = openPairingsQuery.data ?? [];
  const myPairings = myPairingsQuery.data ?? [];
  const showOpenPairingsCard = shouldShowOpenPairingsSection(
    openPairingsQuery.isLoading,
    openPairings.length,
  );
  const showMyPairingCard = shouldShowMyPairingSection(
    Boolean(session?.user?.id),
    myPairingsQuery.isLoading,
    myPairings.length,
  );
  const registrationBlockReason = resolveRegistrationBlockReason({
    registrationOpen,
    hasCategory: Boolean(activeCategoryId),
    joinMode,
    inviteContact,
    pairingBusy,
    padelActionsDisabled,
  });
  const canSubmitRegistration = registrationBlockReason === null;
  const registrationPrimaryLabel = resolveRegistrationPrimaryCtaLabel(paymentMode);
  const registrationPrimaryText =
    registrationPrimaryLabel === "CREATE_AND_CONTINUE"
      ? t("events:padel.ctaCreatePairingContinue")
      : t("events:padel.ctaCreatePairingPay");
  const registrationHint =
    registrationBlockReason === "MISSING_CATEGORY"
      ? t("events:padel.categoryRequired")
      : registrationBlockReason === "REGISTRATION_CLOSED"
        ? registrationMessage
        : registrationBlockReason === "MISSING_INVITE_CONTACT"
          ? t("events:padel.partnerRequired")
          : registrationBlockReason === "BUSY"
            ? t("events:padel.creatingPairing")
            : registrationBlockReason === "POLICY_LOCKED"
              ? t("events:padel.completeProfileToAccept")
              : t("events:padel.registrationReadyHint");

  const handleShare = async () => {
    triggerLightHaptic();
    if (!data) return;
    try {
      const message = shareUrl
        ? `${data.title}\n${shareUrl}`
        : `${data.title} · ORYA`;
      await Share.share({ message, url: shareUrl ?? undefined });
    } catch {
      // ignore share errors
    }
  };
  const handleOpenMap = async () => {
    triggerLightHaptic();
    if (!mapTargets) return;
    try {
      const preferred = Platform.OS === "ios" ? mapTargets.apple : mapTargets.android;
      const canOpenPreferred = await Linking.canOpenURL(preferred);
      if (canOpenPreferred) {
        await Linking.openURL(preferred);
        return;
      }
      await Linking.openURL(mapTargets.web);
    } catch {
      // ignore
    }
  };

  const handleIncrementTicket = useCallback(
    (ticketId: number) => {
      setTicketQuantities((current) => {
        const meta = ticketMetaById.get(ticketId);
        if (!meta) return current;
        const disabled = meta.unavailable || !canAccessInvite || !eventIsActive;
        if (disabled || meta.maxQuantity <= 0) return current;
        const nextQuantity = Math.min(
          meta.maxQuantity,
          (current[ticketId] ?? 0) + 1,
        );
        if (nextQuantity === (current[ticketId] ?? 0)) return current;
        return { ...current, [ticketId]: nextQuantity };
      });
    },
    [canAccessInvite, eventIsActive, ticketMetaById],
  );

  const handleDecrementTicket = useCallback((ticketId: number) => {
    setTicketQuantities((current) => {
      const quantity = current[ticketId] ?? 0;
      if (quantity <= 0) return current;
      const nextQuantity = quantity - 1;
      if (nextQuantity === 0) {
        const next = { ...current };
        delete next[ticketId];
        return next;
      }
      return { ...current, [ticketId]: nextQuantity };
    });
  }, []);

  const handleOpenTicketSheet = useCallback(() => {
    triggerLightHaptic();
    if (!canOpenTicketSheet) return;
    setTicketSheetVisible(true);
  }, [canOpenTicketSheet, triggerLightHaptic]);

  const handleEventScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const handleEventScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS !== "ios") return;
      if (ticketSheetVisible) return;
      if (dismissInFlightRef.current) return;
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetYRef.current = offsetY;
      const shouldDismiss = shouldDismissByPullDown({
        platform: Platform.OS,
        offsetY,
        ticketSheetVisible,
        dismissInFlight: dismissInFlightRef.current,
      });
      if (!shouldDismiss || scrollOffsetYRef.current > 0) return;
      dismissInFlightRef.current = true;
      handleBack();
      if (dismissResetTimerRef.current) {
        clearTimeout(dismissResetTimerRef.current);
      }
      dismissResetTimerRef.current = setTimeout(() => {
        dismissInFlightRef.current = false;
        dismissResetTimerRef.current = null;
      }, 420);
    },
    [handleBack, ticketSheetVisible],
  );

  useEffect(() => {
    return () => {
      if (dismissResetTimerRef.current) {
        clearTimeout(dismissResetTimerRef.current);
      }
    };
  }, []);

  const handleCheckoutFromTickets = useCallback(async () => {
    triggerLightHaptic();
    if (!data) return;
    if (!canAccessInvite || !eventIsActive) return;
    if (selectedTicketItems.length === 0) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    const firstItem = selectedTicketItems[0];
    if (!firstItem) return;
    const idempotencyKey = buildCheckoutIdempotencyKey();
    setInitiatingCheckout(true);
    try {
      trackEvent("checkout_started", {
        sourceType: "EVENT_TICKET",
        eventId: data.id,
        paymentScenario: selectedItemsAreFree ? "FREE_CHECKOUT" : "SINGLE",
        itemCount: selectedTicketItems.length,
        quantity: selectedTicketQuantity,
      });
      setCheckoutDraft({
        slug: data.slug,
        eventId: data.id,
        eventTitle: data.title,
        sourceType: "EVENT_TICKET",
        items: selectedTicketItems,
        ticketTypeId: firstItem.ticketTypeId,
        ticketName: firstItem.ticketName,
        quantity: selectedTicketQuantity,
        unitPriceCents: firstItem.unitPriceCents,
        totalCents: selectedTicketTotalCents,
        currency: firstItem.currency,
        paymentMethod: "card",
        paymentScenario: selectedItemsAreFree ? "FREE_CHECKOUT" : "SINGLE",
        inviteToken: inviteToken ?? null,
        idempotencyKey,
      });
      setTicketSheetVisible(false);
      router.push("/checkout");
    } catch (err: any) {
      Alert.alert(
        t("common:labels.error"),
        getUserFacingError(err, t("events:checkout.completeFailed")),
      );
    } finally {
      setInitiatingCheckout(false);
    }
  }, [
    canAccessInvite,
    data,
    eventIsActive,
    inviteToken,
    openAuth,
    router,
    selectedItemsAreFree,
    selectedTicketItems,
    selectedTicketQuantity,
    selectedTicketTotalCents,
    session?.user?.id,
    setCheckoutDraft,
    t,
    triggerLightHaptic,
  ]);

  const handleCreatePairing = async () => {
    triggerLightHaptic();
    if (!data || !padelMeta) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    if (!activeCategoryId) {
      Alert.alert(
        t("events:padel.registrationTitle"),
        t("events:padel.categoryRequired"),
      );
      return;
    }
    if (!registrationOpen) {
      Alert.alert(t("events:padel.registrationTitle"), registrationMessage);
      return;
    }
    if (joinMode === "INVITE_PARTNER" && !inviteContact.trim()) {
      Alert.alert(
        t("events:padel.registrationTitle"),
        t("events:padel.partnerRequired"),
      );
      return;
    }
    if (pairingBusy) return;
    setPairingBusy(true);
    try {
      const result = await createPairing({
        eventId: data.id,
        categoryId: activeCategoryId,
        paymentMode,
        pairingJoinMode: joinMode,
        invitedContact:
          joinMode === "INVITE_PARTNER" && inviteContact.trim()
            ? inviteContact.trim()
            : null,
        isPublicOpen: joinMode === "LOOKING_FOR_PARTNER",
      });
      if (result.waitlist) {
        Alert.alert(
          t("events:padel.waitlistTitle"),
          t("events:padel.waitlistBody"),
        );
      } else {
        Alert.alert(
          t("events:padel.pairingCreatedTitle"),
          t("events:padel.pairingCreatedBody"),
        );
      }
      await Promise.all([
        myPairingsQuery.refetch(),
        openPairingsQuery.refetch(),
      ]);
      const createdPairingId =
        typeof result?.pairing?.id === "number" ? result.pairing.id : null;
      if (createdPairingId && !result.waitlist) {
        await handlePayPairing({
          id: createdPairingId,
          categoryId: activeCategoryId,
        });
      }
    } catch (err: any) {
      if (err?.message?.includes("PADEL_ONBOARDING_REQUIRED")) {
        Alert.alert(
          t("events:padel.onboardingRequiredTitle"),
          t("events:padel.onboardingRequiredBody"),
        );
        router.push("/(tabs)/profile");
        return;
      }
      Alert.alert(
        t("common:labels.error"),
        getUserFacingError(err, t("events:padel.pairingCreateFailed")),
      );
    } finally {
      setPairingBusy(false);
    }
  };

  const handleJoinOpenPairing = async (pairingId: number) => {
    triggerLightHaptic();
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    if (pairingBusy) return;
    setPairingBusy(true);
    try {
      await joinOpenPairing(pairingId);
      Alert.alert(
        t("events:padel.pairingTitle"),
        t("events:padel.joinSuccess"),
      );
      await Promise.all([
        myPairingsQuery.refetch(),
        openPairingsQuery.refetch(),
      ]);
    } catch (err: any) {
      Alert.alert(
        t("events:padel.pairingTitle"),
        getUserFacingError(err, t("events:padel.joinFailed")),
      );
    } finally {
      setPairingBusy(false);
    }
  };

  const handleAcceptPairingInvite = async (pairingId: number) => {
    triggerLightHaptic();
    if (pairingActionBusy) return;
    setPairingActionBusy(true);
    try {
      await acceptInvite(pairingId);
      await myPairingsQuery.refetch();
    } catch (err: any) {
      Alert.alert(
        t("events:invite.title"),
        getUserFacingError(err, t("events:invite.acceptFailed")),
      );
    } finally {
      setPairingActionBusy(false);
    }
  };

  const handleDeclinePairingInvite = async (pairingId: number) => {
    triggerLightHaptic();
    if (pairingActionBusy) return;
    setPairingActionBusy(true);
    try {
      await declineInvite(pairingId);
      await myPairingsQuery.refetch();
    } catch (err: any) {
      Alert.alert(
        t("events:invite.title"),
        getUserFacingError(err, t("events:invite.declineFailed")),
      );
    } finally {
      setPairingActionBusy(false);
    }
  };

  const handleSharePairingInvite = async (token: string) => {
    triggerLightHaptic();
    if (!token || !data?.slug || !env.apiBaseUrl) return;
    const baseUrl = env.apiBaseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/eventos/${data.slug}?inviteToken=${encodeURIComponent(token)}`;
    try {
      await Share.share({ message: `${data.title}\n${url}`, url });
    } catch {
      // ignore
    }
  };

  async function handlePayPairing(pairing: {
    id: number;
    categoryId?: number | null;
  }) {
    triggerLightHaptic();
    if (!data) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    const categoryLink =
      padelCategories.find(
        (category) => category.id === (pairing.categoryId ?? activeCategoryId),
      ) ?? null;
    if (!categoryLink?.linkId) {
      Alert.alert(
        t("events:padel.registrationTitle"),
        t("events:padel.invalidCategoryPayment"),
      );
      return;
    }
    const idempotencyKey = buildCheckoutIdempotencyKey();
    setPairingActionBusy(true);
    try {
      trackEvent("checkout_started", {
        sourceType: "PADEL_REGISTRATION",
        eventId: data?.id ?? null,
        pairingId: pairing.id,
      });
      const response = await createPairingCheckoutIntent({
        pairingId: pairing.id,
        ticketTypeId: categoryLink.linkId,
        idempotencyKey,
      });
      const unitPrice = categoryLink.pricePerPlayerCents ?? 0;
      const total = response.breakdown?.totalCents ?? unitPrice;
      const currency =
        response.breakdown?.currency ?? categoryLink.currency ?? "EUR";
      const isFree =
        response.freeCheckout ||
        response.isGratisCheckout ||
        (response.amount ?? 0) <= 0 ||
        total <= 0;
      if (isFree) {
        router.push({
          pathname: "/checkout/success",
          params: {
            purchaseId: response.purchaseId ?? "",
            paymentIntentId: response.paymentIntentId ?? "",
            eventTitle: data.title ?? t("events:padel.tournamentFallback"),
            slug: data.slug ?? "",
          },
        });
        return;
      }
      setCheckoutDraft({
        slug: data.slug,
        eventId: data.id,
        eventTitle: data.title,
        ticketTypeId: categoryLink.linkId,
        ticketName:
          categoryLink.label ?? t("events:padel.registrationTicketName"),
        quantity: 1,
        unitPriceCents: unitPrice,
        totalCents: total,
        currency,
        paymentMethod: "card",
        sourceType: "PADEL_REGISTRATION",
        paymentScenario: response.paymentScenario ?? undefined,
        pairingId: pairing.id,
        idempotencyKey,
      });
      setCheckoutIntent({
        clientSecret: response.clientSecret ?? null,
        paymentIntentId: response.paymentIntentId ?? null,
        purchaseId: response.purchaseId ?? null,
        breakdown: response.breakdown ?? null,
        freeCheckout:
          response.freeCheckout ?? response.isGratisCheckout ?? false,
      });
      router.push("/checkout");
    } catch (err: any) {
      Alert.alert(
        t("events:payment.title"),
        getUserFacingError(err, t("events:payment.startFailed")),
      );
    } finally {
      setPairingActionBusy(false);
    }
  }
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: "fade_from_bottom",
          gestureEnabled: true,
        }}
      />
      <LiquidBackground variant="solid">
        <View pointerEvents="none" style={styles.backdropLayer}>
          <LinearGradient
            colors={backdropPalette.rootGradient}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.88, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={backdropPalette.topGradient}
            start={{ x: 0.46, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.backdropTopWash}
          />
          <LinearGradient
            colors={backdropPalette.blendGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.backdropBlend}
          />
        </View>
        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleEventScroll}
          onScrollEndDrag={handleEventScrollEndDrag}
        >
          {isLoading && !data ? (
            <View className="px-5 gap-3" style={{ paddingTop: insets.top + 16 }}>
              <GlassSkeleton height={320} />
              <GlassSkeleton height={140} />
              <GlassSkeleton height={120} />
            </View>
          ) : isError || !data ? (
            <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
              <GlassCard intensity={50}>
                <Text className="text-red-300 text-sm mb-3">
                  {error instanceof ApiError && error.status === 404
                    ? t("events:detail.notFound")
                    : t("events:detail.loadError")}
                </Text>
                <Pressable
                  onPress={() => refetch()}
                  className="rounded-xl bg-white/10 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.retry")}
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {t("common:actions.retry")}
                  </Text>
                </Pressable>
              </GlassCard>
            </View>
          ) : (
            <Animated.View
              style={{ opacity: fade, transform: [{ translateY: translate }] }}
            >
              <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
                <EventHeroSquare coverUri={displayCover} title={displayTitle} />
                <EventHeaderMeta
                  title={displayTitle}
                  dateLabel={date}
                  locationLabel={displayLocation}
                  organizer={{
                    name: displayHost,
                    username: hostUsername,
                    avatarUri: hostAvatar,
                    onPress: handleHostPress,
                    disabled: !hostUsername,
                  }}
                >
                  {data?.id ? (
                    <FavoriteToggle
                      eventId={data.id}
                      size={18}
                      style={{ width: 42, height: 42, borderRadius: 21 }}
                    />
                  ) : null}
                  <Pressable
                    onPress={handleShare}
                    disabled={!data}
                    className="h-[42px] min-w-[42px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-3"
                    style={({ pressed }) => [
                      !data ? { opacity: 0.5 } : null,
                      pressed && data
                        ? { opacity: 0.86, transform: [{ scale: 0.96 }] }
                        : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.share")}
                    accessibilityState={{ disabled: !data }}
                  >
                    <Ionicons
                      name="share-outline"
                      size={17}
                      color="rgba(255,255,255,0.9)"
                    />
                  </Pressable>
                </EventHeaderMeta>
              </View>

              <View className="px-5 pt-5 gap-4">
                <EventInfoAccordion
                  expanded={infoExpanded}
                  onToggle={() => setInfoExpanded(true)}
                  description={description}
                  title={t("events:detail.about")}
                >
                  <View className="flex-row flex-wrap gap-2">
                    <GlassPill
                      label={accessBadge.label}
                      variant={accessBadge.variant}
                    />
                    {statusLabel ? (
                      <GlassPill label={statusLabel} variant="muted" />
                    ) : null}
                    {ticketInventoryLabel ? (
                      <GlassPill label={ticketInventoryLabel} variant="muted" />
                    ) : null}
                  </View>
                </EventInfoAccordion>

                <EventLocationBlock
                  startsAtLabel={startsAtLabel}
                  locationLabel={displayLocation}
                  latitude={data.location?.lat ?? null}
                  longitude={data.location?.lng ?? null}
                  onOpenMap={handleOpenMap}
                  openMapLabel={t("common:actions.openMap")}
                />

                {isInviteOnly ? (
                  <GlassCard intensity={52}>
                    <View className="gap-3">
                      <Text className="text-white text-sm font-semibold">
                        {t("events:invite.requiredTitle")}
                      </Text>
                      <Text className="text-white/65 text-sm">
                        {t("events:invite.requiredBody")}
                      </Text>
                      <TextInput
                        value={inviteTokenInput}
                        onChangeText={setInviteTokenInput}
                        placeholder={t("events:invite.tokenPlaceholder")}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoCapitalize="none"
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white"
                        accessibilityLabel={t("events:invite.tokenPlaceholder")}
                      />
                      <Pressable
                        onPress={handleInviteCheck}
                        disabled={inviteState.status === "checking"}
                        className="rounded-2xl bg-white/15 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel={t("events:invite.validateToken")}
                        accessibilityState={{
                          disabled: inviteState.status === "checking",
                        }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {inviteState.status === "checking"
                            ? t("events:invite.validating")
                            : t("events:invite.validateToken")}
                        </Text>
                      </Pressable>
                      {inviteState.status === "valid" ? (
                        <GlassPill
                          label={t("events:invite.confirmed")}
                          variant="accent"
                        />
                      ) : inviteState.status === "invalid" ? (
                        <Text className="text-amber-200 text-xs">
                          {inviteState.message ?? t("events:invite.invalid")}
                        </Text>
                      ) : null}
                      <View className="h-px bg-white/10" />
                      <TextInput
                        value={inviteIdentifierInput}
                        onChangeText={setInviteIdentifierInput}
                        placeholder={t("events:invite.identifierPlaceholder")}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoCapitalize="none"
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white"
                        accessibilityLabel={t(
                          "events:invite.identifierPlaceholder",
                        )}
                      />
                      <Pressable
                        onPress={handleInviteIdentifierCheck}
                        disabled={inviteIdentifierState.status === "checking"}
                        className="rounded-2xl bg-white/15 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          "events:invite.validateIdentifier",
                        )}
                        accessibilityState={{
                          disabled: inviteIdentifierState.status === "checking",
                        }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {inviteIdentifierState.status === "checking"
                            ? t("events:invite.validating")
                            : t("events:invite.validateIdentifier")}
                        </Text>
                      </Pressable>
                      {inviteIdentifierValid ? (
                        <GlassPill
                          label={t("events:invite.confirmed")}
                          variant="accent"
                        />
                      ) : null}
                      {inviteIdentifierNeedsLogin ? (
                        <View className="gap-2">
                          <Text className="text-amber-200 text-xs">
                            {t("events:invite.foundSignIn")}
                          </Text>
                          <Pressable
                            onPress={openAuth}
                            className="self-start rounded-full border border-white/15 bg-white/5 px-4 py-2"
                            style={{ minHeight: tokens.layout.touchTarget }}
                            accessibilityRole="button"
                            accessibilityLabel={t("common:actions.signIn")}
                          >
                            <Text className="text-white text-xs font-semibold">
                              {t("common:actions.signIn")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                      {inviteIdentifierCheckingAccount ? (
                        <Text className="text-white/60 text-xs">
                          {t("events:invite.checking")}
                        </Text>
                      ) : inviteIdentifierMismatch ? (
                        <Text className="text-amber-200 text-xs">
                          {t("events:invite.mismatch")}
                        </Text>
                      ) : inviteIdentifierState.status === "not_invited" ? (
                        <Text className="text-amber-200 text-xs">
                          {inviteIdentifierState.message ??
                            t("events:invite.notFound")}
                        </Text>
                      ) : inviteIdentifierState.status === "invalid" ? (
                        <Text className="text-amber-200 text-xs">
                          {inviteIdentifierState.message ??
                            t("events:invite.identifierInvalid")}
                        </Text>
                      ) : null}
                    </View>
                  </GlassCard>
                ) : null}

                {isPadelEvent ? (
                  <>
                    {gateLocked ? (
                      <PadelSection tone="soft">
                        <Text className="text-white/70 text-sm">
                          {t("events:padel.inviteOnly")}
                        </Text>
                        {!session?.user?.id ? (
                          <Text className="text-amber-200 text-xs">
                            {t("events:detail.signInToContinue")}
                          </Text>
                        ) : null}
                      </PadelSection>
                    ) : null}

                    <PadelSection tone="base">
                      <View className="gap-3">
                        <Text className="text-white text-sm font-semibold">
                          {t("events:padel.summaryTitle")}
                        </Text>
                        <Text className="text-white/70 text-sm">
                          {registrationMessage}
                        </Text>
                        {padelMeta?.competitionState ? (
                          <View className="flex-row items-center gap-2">
                            <Ionicons
                              name="trophy-outline"
                              size={16}
                              color="rgba(255,255,255,0.7)"
                            />
                            <Text className="text-white/70 text-sm">
                              {t("events:padel.statusLabel", {
                                status: padelMeta.competitionState,
                              })}
                            </Text>
                          </View>
                        ) : null}
                        {padelSnapshot?.clubName ? (
                          <View className="flex-row items-center gap-2">
                            <Ionicons
                              name="location-outline"
                              size={16}
                              color="rgba(255,255,255,0.6)"
                            />
                            <Text className="text-white/65 text-sm">
                              {padelSnapshot.clubName}
                              {padelSnapshot.clubCity
                                ? ` · ${padelSnapshot.clubCity}`
                                : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </PadelSection>

                    {padelSnapshot?.timeline?.length ? (
                      <PadelSection tone="soft">
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">
                            {t("events:padel.timelineTitle")}
                          </Text>
                          {padelSnapshot.timeline.map((item) => (
                            <View
                              key={item.key}
                              className="flex-row items-center justify-between"
                            >
                              <Text className="text-white/80 text-sm">
                                {item.label}
                              </Text>
                              {item.date && formatDateRange(item.date) ? (
                                <Text className="text-white/55 text-xs">
                                  {formatDateRange(item.date)}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </PadelSection>
                    ) : null}

                    {visiblePadelCategories.length > 0 ? (
                      <PadelSection tone="base">
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">
                            {t("events:padel.categoriesTitle")}
                          </Text>
                          <Text className="text-white/60 text-xs">
                            {t("events:padel.categoriesHelp")}
                          </Text>
                          {visiblePadelCategories.map((category) => {
                            const isSelected = category.id === activeCategoryId;
                            const disabled = !category.isEnabled;
                            const categoryA11yLabel = category.label
                              ? t("events:padel.categoryLabel", {
                                  label: category.label,
                                })
                              : t("events:padel.categorySelect");
                            const capacityLabel = category.capacityTeams
                              ? t("events:padel.capacityTeams", {
                                  count: category.capacityTeams,
                                })
                              : t("events:padel.capacityUnlimited");
                            return (
                              <Pressable
                                key={`padel-category-${category.linkId ?? category.id}`}
                                onPress={() =>
                                  setSelectedCategoryId(category.id)
                                }
                                disabled={disabled}
                                className={
                                  isSelected
                                    ? "rounded-2xl border border-white/30 bg-white/15 px-4 py-3"
                                    : "rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                                }
                                style={{ minHeight: tokens.layout.touchTarget }}
                                accessibilityRole="button"
                                accessibilityLabel={categoryA11yLabel}
                                accessibilityState={{
                                  selected: isSelected,
                                  disabled,
                                }}
                              >
                                <View className="flex-row items-center justify-between">
                                  <View className="flex-1 pr-4">
                                    {category.label ? (
                                      <View className="flex-row items-center gap-2">
                                        <Text className="text-white text-sm font-semibold">
                                          {category.label}
                                        </Text>
                                        {isSelected ? (
                                          <GlassPill
                                            label={t("events:padel.categorySelected")}
                                            variant="accent"
                                          />
                                        ) : null}
                                      </View>
                                    ) : null}
                                    {category.format ? (
                                      <Text className="text-white/60 text-xs mt-1">
                                        {category.format}
                                      </Text>
                                    ) : null}
                                  </View>
                                  <GlassPill
                                    label={`${formatTicketPrice(
                                      category.pricePerPlayerCents ?? 0,
                                      category.currency,
                                      t,
                                    )} / ${t("events:detail.perPlayer")}`}
                                    variant="muted"
                                  />
                                </View>
                                <View className="flex-row items-center justify-between pt-2">
                                  <Text className="text-white/60 text-xs">
                                    {capacityLabel}
                                  </Text>
                                  {disabled ? (
                                    <GlassPill
                                      label={t(
                                        "events:padel.categoryUnavailable",
                                      )}
                                      variant="muted"
                                    />
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </PadelSection>
                    ) : null}

                    <PadelSection tone="accent">
                      <View className="gap-4">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <View className="h-8 w-8 items-center justify-center rounded-full border border-sky-200/45 bg-sky-300/15">
                              <Ionicons
                                name="person-add-outline"
                                size={15}
                                color="rgba(213,240,255,0.94)"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {t("events:padel.registrationSection")}
                            </Text>
                          </View>
                          <GlassPill
                            label={resolvePadelRegistrationLabel(
                              padelMeta?.registrationStatus,
                              t,
                            )}
                            variant="muted"
                          />
                        </View>
                        <View className="gap-2">
                          <View className="rounded-2xl border border-white/15 bg-white/8 px-3 py-3">
                            <Text className="text-white/70 text-[11px] uppercase tracking-[0.12em]">
                              {t("events:padel.registrationFlow.step1Title")}
                            </Text>
                            <Text className="text-white text-sm font-semibold mt-1">
                              {selectedPadelCategory
                                ? t("events:padel.registrationFlow.step1Ready", {
                                    category: selectedPadelCategory.label ?? "",
                                  }).trim()
                                : t("events:padel.registrationFlow.step1Missing")}
                            </Text>
                          </View>
                          <View className="rounded-2xl border border-sky-200/45 bg-sky-300/20 px-3 py-3">
                            <Text className="text-sky-100/80 text-[11px] uppercase tracking-[0.12em]">
                              {t("events:padel.registrationFlow.step2Title")}
                            </Text>
                            <Text className="text-sky-100 text-sm font-semibold mt-1">
                              {t("events:padel.registrationFlow.step2Subtitle")}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-white/65 text-xs leading-5">
                          {t("events:padel.registrationFlow.helper")}
                        </Text>
                        <View className="gap-2">
                          <Text className="text-white/65 text-[11px] uppercase tracking-[0.12em]">
                            {t("events:padel.paymentModeTitle")}
                          </Text>
                          <View className="flex-row flex-wrap gap-2">
                            {(["FULL", "SPLIT"] as const).map((mode) => {
                              const active = paymentMode === mode;
                              return (
                                <Pressable
                                  key={`mode-${mode}`}
                                  onPress={() => setPaymentMode(mode)}
                                  className={
                                    active
                                      ? "rounded-full border border-sky-200/60 bg-sky-200/30 px-4 py-2"
                                      : "rounded-full border border-white/15 bg-white/8 px-4 py-2"
                                  }
                                  style={{ minHeight: tokens.layout.touchTarget }}
                                  accessibilityRole="button"
                                  accessibilityLabel={
                                    resolvePadelPaymentModeLabel(mode, t) ??
                                    undefined
                                  }
                                  accessibilityState={{ selected: active }}
                                >
                                  <Text
                                    className={
                                      active
                                        ? "text-sky-50 text-xs font-semibold"
                                        : "text-white/70 text-xs"
                                    }
                                  >
                                    {resolvePadelPaymentModeLabel(mode, t)}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <View className="gap-2">
                          <Text className="text-white/65 text-[11px] uppercase tracking-[0.12em]">
                            {t("events:padel.joinModeTitle")}
                          </Text>
                          <View className="flex-row flex-wrap gap-2">
                            {(
                              [
                                { key: "INVITE_PARTNER" },
                                { key: "LOOKING_FOR_PARTNER" },
                              ] as const
                            ).map((option) => {
                              const active = joinMode === option.key;
                              const label =
                                option.key === "INVITE_PARTNER"
                                  ? t("events:padel.join.invitePartner")
                                  : t("events:padel.join.openPair");
                              return (
                                <Pressable
                                  key={option.key}
                                  onPress={() => setJoinMode(option.key)}
                                  className={
                                    active
                                      ? "rounded-full border border-sky-200/60 bg-sky-200/30 px-4 py-2"
                                      : "rounded-full border border-white/15 bg-white/8 px-4 py-2"
                                  }
                                  style={{ minHeight: tokens.layout.touchTarget }}
                                  accessibilityRole="button"
                                  accessibilityLabel={label}
                                  accessibilityState={{ selected: active }}
                                >
                                  <Text
                                    className={
                                      active
                                        ? "text-sky-50 text-xs font-semibold"
                                        : "text-white/70 text-xs"
                                    }
                                  >
                                    {label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        {joinMode === "INVITE_PARTNER" ? (
                          <TextInput
                            value={inviteContact}
                            onChangeText={setInviteContact}
                            placeholder={t("events:padel.invitePlaceholder")}
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            autoCapitalize="none"
                            className="rounded-2xl border border-white/18 bg-white/8 px-4 py-3 text-white"
                            accessibilityLabel={t(
                              "events:padel.invitePlaceholder",
                            )}
                          />
                        ) : null}
                        {!session?.user?.id ? (
                          <Pressable
                            onPress={openAuth}
                            className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3"
                            style={{ minHeight: tokens.layout.touchTarget }}
                            accessibilityRole="button"
                            accessibilityLabel={t(
                              "events:padel.signInToRegister",
                            )}
                          >
                            <Text className="text-white text-sm font-semibold text-center">
                              {t("events:padel.signInToRegister")}
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={handleCreatePairing}
                            disabled={!canSubmitRegistration}
                            className={
                              !canSubmitRegistration
                                ? "rounded-2xl border border-white/14 bg-white/8 px-4 py-3"
                                : "rounded-2xl border border-sky-200/55 bg-sky-100 px-4 py-3"
                            }
                            style={{ minHeight: tokens.layout.touchTarget }}
                            accessibilityRole="button"
                            accessibilityLabel={t("events:padel.createPairing")}
                            accessibilityState={{
                              disabled: !canSubmitRegistration,
                            }}
                          >
                            <Text
                              className={`text-center text-sm font-semibold ${
                                !canSubmitRegistration ? "text-white/50" : ""
                              }`}
                              style={
                                !canSubmitRegistration
                                  ? undefined
                                  : { color: "#082347" }
                              }
                            >
                              {pairingBusy
                                ? t("events:padel.creatingPairing")
                                : registrationPrimaryText}
                            </Text>
                          </Pressable>
                        )}
                        <View
                          className={
                            canSubmitRegistration
                              ? "rounded-xl border border-sky-200/30 bg-sky-300/12 px-3 py-2"
                              : "rounded-xl border border-amber-200/35 bg-amber-200/12 px-3 py-2"
                          }
                        >
                          <Text
                            className={
                              canSubmitRegistration
                                ? "text-sky-100/90 text-xs"
                                : "text-amber-200 text-xs"
                            }
                          >
                            {registrationHint}
                          </Text>
                        </View>
                      </View>
                    </PadelSection>

                    {showMyPairingCard ? (
                      <PadelSection tone="base">
                        <View className="gap-3">
                          <View className="flex-row items-center gap-2">
                            <View className="h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10">
                              <Ionicons
                                name="people-outline"
                                size={15}
                                color="rgba(236,246,255,0.94)"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {t("events:padel.myPairingTitle")}
                            </Text>
                          </View>
                          {myPairingsQuery.isLoading ? (
                            <Text className="text-white/60 text-sm">
                              {t("events:padel.myPairingLoading")}
                            </Text>
                          ) : (
                          (() => {
                            const pairingIdValue = pairingIdParam
                              ? Number(pairingIdParam)
                              : null;
                            const pairing =
                              (Number.isFinite(pairingIdValue)
                                ? myPairings.find(
                                    (p) => p.id === pairingIdValue,
                                  )
                                : null) ?? myPairings[0];
                            const unpaidSlot = pairing.slots?.find(
                              (slot) => slot.paymentStatus !== "PAID",
                            );
                            const canPay = Boolean(unpaidSlot);
                            const invitePending = Boolean(
                              pairing.inviteEligibility &&
                              !pairing.inviteEligibility.ok,
                            );
                            return (
                              <View className="gap-3">
                                <View className="rounded-2xl border border-white/14 bg-white/8 px-3 py-3">
                                  <Text className="text-white/80 text-sm font-semibold">
                                    {pairing.category?.label ??
                                      t("events:detail.categoryFallback")}
                                  </Text>
                                  <Text className="text-white/65 text-xs mt-1">
                                    {resolvePadelPaymentModeLabel(
                                      pairing.paymentMode,
                                      t,
                                    )}
                                  </Text>
                                </View>
                                {invitePending ? (
                                  <Text className="text-amber-200 text-xs">
                                    {t("events:padel.completeProfileToAccept")}
                                  </Text>
                                ) : null}
                                <View className="flex-row flex-wrap gap-2">
                                  {pairing.inviteEligibility ? (
                                    <>
                                      <Pressable
                                        onPress={() =>
                                          handleAcceptPairingInvite(pairing.id)
                                        }
                                        disabled={pairingActionBusy}
                                        className="rounded-full border border-sky-200/55 bg-sky-200/28 px-4 py-2"
                                        style={{
                                          minHeight: tokens.layout.touchTarget,
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                          "events:padel.acceptInvite",
                                        )}
                                        accessibilityState={{
                                          disabled: pairingActionBusy,
                                        }}
                                      >
                                        <Text className="text-sky-50 text-xs font-semibold">
                                          {t("events:padel.acceptInvite")}
                                        </Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() =>
                                          handleDeclinePairingInvite(pairing.id)
                                        }
                                        disabled={pairingActionBusy}
                                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2"
                                        style={{
                                          minHeight: tokens.layout.touchTarget,
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                          "events:padel.declineInvite",
                                        )}
                                        accessibilityState={{
                                          disabled: pairingActionBusy,
                                        }}
                                      >
                                        <Text className="text-white/80 text-xs font-semibold">
                                          {t("events:padel.declineInvite")}
                                        </Text>
                                      </Pressable>
                                    </>
                                  ) : null}
                                  {pairing.inviteToken ? (
                                    <Pressable
                                      onPress={() =>
                                        handleSharePairingInvite(
                                          pairing.inviteToken ?? "",
                                        )
                                      }
                                      className="rounded-full border border-white/20 bg-white/10 px-4 py-2"
                                      style={{
                                        minHeight: tokens.layout.touchTarget,
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={t(
                                        "events:padel.shareInvite",
                                      )}
                                    >
                                      <Text className="text-white/80 text-xs font-semibold">
                                        {t("events:padel.shareInvite")}
                                      </Text>
                                    </Pressable>
                                  ) : null}
                                  {canPay ? (
                                    <Pressable
                                      onPress={() =>
                                        handlePayPairing({
                                          id: pairing.id,
                                          categoryId:
                                            pairing.categoryId ?? null,
                                        })
                                      }
                                      disabled={
                                        pairingActionBusy ||
                                        padelActionsDisabled
                                      }
                                      className="rounded-full border border-white/22 bg-white/16 px-4 py-2"
                                      style={{
                                        minHeight: tokens.layout.touchTarget,
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={t(
                                        "events:padel.payRegistration",
                                      )}
                                      accessibilityState={{
                                        disabled:
                                          pairingActionBusy ||
                                          padelActionsDisabled,
                                      }}
                                    >
                                      <Text className="text-white text-xs font-semibold">
                                        {t("events:padel.payRegistration")}
                                      </Text>
                                    </Pressable>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })()
                          )}
                        </View>
                      </PadelSection>
                    ) : null}

                    {showOpenPairingsCard ? (
                      <PadelSection tone="soft">
                        <View className="gap-3">
                          <View className="flex-row items-center gap-2">
                            <View className="h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10">
                              <Ionicons
                                name="flash-outline"
                                size={15}
                                color="rgba(236,246,255,0.94)"
                              />
                            </View>
                            <Text className="text-white text-sm font-semibold">
                              {t("events:padel.openPairingsTitle")}
                            </Text>
                          </View>
                          <Text className="text-white/65 text-xs">
                            {t("events:padel.openPairingsSubtitle")}
                          </Text>
                          {openPairingsQuery.isLoading ? (
                            <Text className="text-white/60 text-sm">
                              {t("events:padel.openPairingsLoading")}
                            </Text>
                          ) : (
                            openPairings.map((pairing) => (
                              <View
                                key={`open-${pairing.id}`}
                                className="rounded-2xl border border-white/14 bg-white/8 px-4 py-3"
                              >
                                <View className="flex-row items-center justify-between">
                                  {pairing.category?.label ? (
                                    <Text className="text-white text-sm font-semibold">
                                      {pairing.category.label}
                                    </Text>
                                  ) : null}
                                  <Text className="text-white/60 text-xs">
                                    {t("events:padel.openSlots", {
                                      count: pairing.openSlots ?? 0,
                                    })}
                                  </Text>
                                </View>
                                <View className="pt-2 gap-2">
                                  {pairing.deadlineAt &&
                                  formatDateRange(pairing.deadlineAt) ? (
                                    <Text className="text-white/55 text-xs">
                                      {t("events:padel.deadline", {
                                        date: formatDateRange(pairing.deadlineAt),
                                      })}
                                    </Text>
                                  ) : null}
                                  {Array.isArray(pairing.seekingPlayers) &&
                                  pairing.seekingPlayers.length > 0 ? (
                                    <Text className="text-white/70 text-xs">
                                      {pairing.seekingPlayers
                                        .slice(0, 3)
                                        .map((player) => {
                                          const label =
                                            player?.displayName ??
                                            player?.username ??
                                            "Jogador";
                                          return player?.level
                                            ? `${label} · ${player.level}`
                                            : label;
                                        })
                                        .join(" · ")}
                                    </Text>
                                  ) : null}
                                  <Pressable
                                    onPress={() =>
                                      handleJoinOpenPairing(pairing.id)
                                    }
                                    disabled={padelActionsDisabled || pairingBusy}
                                    className="self-start rounded-full border border-sky-200/55 bg-sky-200/28 px-4 py-2"
                                    style={{
                                      minHeight: tokens.layout.touchTarget,
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={t("common:actions.join")}
                                    accessibilityState={{
                                      disabled:
                                        padelActionsDisabled || pairingBusy,
                                    }}
                                  >
                                    <Text className="text-sky-50 text-xs font-semibold">
                                      {t("common:actions.join")}
                                    </Text>
                                  </Pressable>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      </PadelSection>
                    ) : null}

                    {liveEnabled ? (
                      <PadelSection tone="live">
                        <View className="gap-3">
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                              <View className="h-8 w-8 items-center justify-center rounded-full border border-rose-200/40 bg-rose-200/16">
                                <Ionicons
                                  name="radio-outline"
                                  size={15}
                                  color="rgba(255,227,235,0.95)"
                                />
                              </View>
                              <Text className="text-white text-sm font-semibold">
                                {t("events:padel.liveTitle")}
                              </Text>
                            </View>
                            <GlassPill label="LIVE" variant="accent" />
                          </View>
                          {standingsQuery.isLoading ? (
                            <Text className="text-white/60 text-sm">
                              {t("events:padel.standingsLoading")}
                            </Text>
                          ) : Object.keys(standingsQuery.data?.groups ?? {})
                              .length === 0 ? (
                            <Text className="text-white/60 text-sm">
                              {t("events:padel.standingsEmpty")}
                            </Text>
                          ) : (
                            Object.entries(
                              standingsQuery.data?.groups ?? {},
                            ).map(([groupLabel, rows]) => {
                              const rowList = Array.isArray(rows)
                                ? (rows as Array<any>)
                                : [];
                              return (
                                <View
                                  key={`standings-${groupLabel}`}
                                  className="gap-2 rounded-2xl border border-white/14 bg-white/8 p-3"
                                >
                                  <Text className="text-white/70 text-xs uppercase tracking-[0.12em]">
                                    {t("events:padel.groupLabel", {
                                      group: groupLabel,
                                    })}
                                  </Text>
                                  {rowList.map((row, idx) => {
                                    const label =
                                      row.label ||
                                      (row.players || [])
                                        .map(
                                          (player) =>
                                            player?.name || player?.username,
                                        )
                                        .filter(Boolean)
                                        .join(" / ") ||
                                      (standingsQuery.data?.entityType !==
                                        "PLAYER" &&
                                      typeof row.pairingId === "number"
                                        ? t("events:padel.pairing.withId", {
                                            id: row.pairingId,
                                          })
                                        : `Jogador #${row.entityId}`);
                                    return (
                                      <View
                                        key={`row-${groupLabel}-${row.entityId}`}
                                        className="flex-row items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                                      >
                                        <View className="flex-1 pr-2 flex-row items-center gap-2">
                                          <View className="h-6 w-6 rounded-full border border-white/20 bg-white/10 items-center justify-center">
                                            <Text className="text-white/85 text-[11px] font-semibold">
                                              {idx + 1}
                                            </Text>
                                          </View>
                                          <Text className="text-white/85 text-sm flex-1" numberOfLines={1}>
                                            {label}
                                          </Text>
                                        </View>
                                        <Text className="text-white/65 text-xs">
                                          {row.points}{" "}
                                          {t("events:padel.pointsShort")} ·{" "}
                                          {row.wins}
                                          {t("events:padel.winsShort")}-
                                          {row.losses}
                                          {t("events:padel.lossesShort")}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              );
                            })
                          )}
                          <View className="h-px bg-white/12" />
                          {matchesQuery.isLoading ? (
                            <Text className="text-white/60 text-sm">
                              {t("events:padel.matchesLoading")}
                            </Text>
                          ) : (matchesQuery.data ?? []).length === 0 ? (
                            <Text className="text-white/60 text-sm">
                              {t("events:padel.matchesEmpty")}
                            </Text>
                          ) : (
                            (matchesQuery.data ?? [])
                              .slice(0, 6)
                              .map((match: any) => (
                                <View
                                  key={`match-${match.id}`}
                                  className="gap-1 rounded-2xl border border-white/14 bg-white/8 px-3 py-3"
                                >
                                  <Text className="text-white/70 text-xs">
                                    {match.groupLabel
                                      ? t("events:padel.groupLabel", {
                                          group: match.groupLabel,
                                        })
                                      : t("events:padel.matchLabel")}
                                  </Text>
                                  <Text className="text-white/85 text-sm font-semibold">
                                    {resolvePairingLabel(match.pairingA, t)}{" "}
                                    {t("events:detail.vs")}{" "}
                                    {resolvePairingLabel(match.pairingB, t)}
                                  </Text>
                                </View>
                              ))
                          )}
                        </View>
                      </PadelSection>
                    ) : null}
                  </>
                ) : null}
              </View>
            </Animated.View>
          )}
        </Animated.ScrollView>
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            zIndex: 120,
            elevation: 120,
          }}
        >
          <View
            pointerEvents="box-none"
            style={{
              paddingTop: insets.top + 8,
              paddingHorizontal: 20,
              alignItems: "flex-end",
            }}
          >
            <View
              pointerEvents="none"
              style={[
                styles.closeOuterHalo,
                {
                  top: insets.top + 5,
                  borderColor: backdropPalette.closeOrbBorder,
                  backgroundColor: backdropPalette.closeOrbFill,
                },
              ]}
            />
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.back")}
              style={({ pressed }) => [
                styles.closeButton,
                { shadowColor: backdropPalette.closeButtonShadow },
                pressed ? styles.closeButtonPressed : null,
              ]}
            >
              <BlurView
                tint="dark"
                intensity={82}
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.closeButtonShade,
                  { backgroundColor: backdropPalette.closeOrbFill },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.closeButtonHighlight,
                  { backgroundColor: backdropPalette.closeOrbHighlight },
                ]}
              />
              <Ionicons
                name="close"
                size={22}
                color="rgba(245,251,255,0.96)"
              />
            </Pressable>
          </View>
        </View>
        {showStickyPurchaseBar ? (
          <StickyPurchaseBar
            priceLabel={stickyPriceLabel}
            buttonLabel={t("events:detail.ctaBuy")}
            disabled={!canOpenTicketSheet}
            helperText={stickyHelperText}
            onPress={handleOpenTicketSheet}
          />
        ) : null}
        <TicketSelectorSheet
          visible={ticketSheetVisible && showStickyPurchaseBar}
          title={t("events:tickets.title")}
          items={ticketSelectorItems}
          totalCents={selectedTicketTotalCents}
          currency={ticketSheetCurrency}
          canSubmit={
            selectedTicketQuantity > 0 &&
            canAccessInvite &&
            eventIsActive &&
            !initiatingCheckout
          }
          submitting={initiatingCheckout}
          onClose={() => setTicketSheetVisible(false)}
          onIncrement={handleIncrementTicket}
          onDecrement={handleDecrementTicket}
          onSubmit={handleCheckoutFromTickets}
        />
      </LiquidBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropTopWash: {
    position: "absolute",
    top: -40,
    left: 0,
    right: 0,
    height: 560,
  },
  backdropBlend: {
    position: "absolute",
    top: 220,
    left: 0,
    right: 0,
    bottom: -120,
  },
  closeOuterHalo: {
    position: "absolute",
    right: 17,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(215,241,255,0.44)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 12,
  },
  closeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  closeButtonShade: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButtonHighlight: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    height: 18,
    borderRadius: 12,
  },
});
