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
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
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
  createCheckoutIntent,
  createPairingCheckoutIntent,
  fetchCheckoutStatus,
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
import { safeBack, safePush } from "../../lib/navigation";
import { FavoriteToggle } from "../../components/events/FavoriteToggle";
import { StickyPurchaseBar } from "../../components/events/detail/StickyPurchaseBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileEnv } from "../../lib/env";
import { getUserFacingError } from "../../lib/errors";
import { resolveMediaUri } from "../../lib/media";
import { resolveSafeHttpUrl } from "../../lib/externalUrl";
import { trackEvent } from "../../lib/analytics";
import { useProfileSummary } from "../../features/profile/hooks";
import { sendEventSignal } from "../../features/events/signals";
import { formatCurrency, formatDate, formatTime } from "../../lib/formatters";
import { trackCrmEngagement } from "../../lib/crm";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import * as Haptics from "expo-haptics";
import {
  type TicketCtaState,
  resolveTicketCtaState,
  resolveTicketSheetGateState,
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
import { getDominantColor, type DominantColor } from "../../lib/imageTint";
import { buildMapTargets } from "../../lib/mapLinks";

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
  if (normalized === "INVITE_ONLY")
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

type PairingPlayer = {
  name?: string | null;
  username?: string | null;
};

type PairingSlot = {
  playerProfile?: {
    displayName?: string | null;
    fullName?: string | null;
    username?: string | null;
  } | null;
};

type PairingLike = {
  id?: number | null;
  label?: string | null;
  players?: Array<PairingPlayer | null | undefined> | null;
  slots?: Array<PairingSlot | null | undefined> | null;
};

type StandingRow = {
  entityId?: number | string | null;
  label?: string | null;
  players?: Array<PairingPlayer | null | undefined> | null;
  pairingId?: number | null;
  points?: number | string | null;
  wins?: number | string | null;
  losses?: number | string | null;
};

type LiveMatch = {
  id?: number | string | null;
  groupLabel?: string | null;
  pairingA?: PairingLike | null;
  pairingB?: PairingLike | null;
  elapsedSeconds?: number | null;
  status?: string | null;
  startTime?: string | null;
  plannedStartAt?: string | null;
  stream?: unknown;
  score?: unknown;
};

const resolvePairingLabel = (
  pairing: PairingLike | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const explicitLabel =
    typeof pairing?.label === "string" ? pairing.label.trim() : "";
  if (explicitLabel) return explicitLabel;
  if (Array.isArray(pairing?.players)) {
    const names = pairing.players
      .map((player) => player?.name || player?.username)
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
      (slot) =>
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

const resolveMatchStartAt = (match: Record<string, unknown>) => {
  const raw =
    typeof match.startTime === "string"
      ? match.startTime
      : typeof match.plannedStartAt === "string"
        ? match.plannedStartAt
        : null;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveMatchStream = (match: Record<string, unknown>) => {
  const stream =
    match.stream && typeof match.stream === "object" && !Array.isArray(match.stream)
      ? (match.stream as Record<string, unknown>)
      : null;
  if (stream) {
    const urlRaw = typeof stream.url === "string" ? stream.url.trim() : "";
    return { isLive: stream.isLive === true, url: urlRaw.length > 0 ? urlRaw : null };
  }
  const score =
    match.score && typeof match.score === "object" && !Array.isArray(match.score)
      ? (match.score as Record<string, unknown>)
      : null;
  const liveStream =
    score?.liveStream && typeof score.liveStream === "object" && !Array.isArray(score.liveStream)
      ? (score.liveStream as Record<string, unknown>)
      : null;
  const urlRaw = typeof liveStream?.url === "string" ? liveStream.url.trim() : "";
  return { isLive: liveStream?.isLive === true, url: urlRaw.length > 0 ? urlRaw : null };
};

const formatElapsedLabel = (seconds: number | null | undefined) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const resolveTicketCtaLabel = (state: TicketCtaState): string => {
  if (state === "READY") return "events:tickets.cta.state.ready";
  if (state === "INVITE_LOCKED") return "events:tickets.cta.state.inviteLocked";
  if (state === "ENDED") return "events:tickets.cta.state.ended";
  if (state === "COMING_SOON") return "events:tickets.cta.state.comingSoon";
  return "events:tickets.cta.state.unavailable";
};

const isCheckoutSettledStatus = (status: string | null | undefined) =>
  status === "PAID" || status === "SUCCEEDED";

const normalizeEmailValue = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";
const normalizeUsernameValue = (value?: string | null) =>
  value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
const resolveErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err ?? "");

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
  auraGradient: Gradient4;
  topWashGradient: Gradient4 | null;
  depthGradient: Gradient4;
};

const resolveHexRgb = (value: string): Rgb | null => {
  const normalized = value.trim();
  const fullHex = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (!fullHex) return null;
  const hex = fullHex[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

const APP_BG_RGB: Rgb = { r: 10, g: 15, b: 20 };
const GLOBAL_BG_RGB: Rgb =
  resolveHexRgb(tokens.colors.background) ?? { r: 5, g: 7, b: 11 };

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));
const clampAlpha = (value: number) => Math.max(0, Math.min(1, value));

const rgba = (color: Rgb, alpha: number) =>
  `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(
    color.b,
  )}, ${clampAlpha(alpha)})`;

const rgbToHsl = ({ r, g, b }: Rgb) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }

  const hue = Math.round(h * 60);
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: saturation,
    l: lightness,
  };
};

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }): Rgb => {
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

const mixRgb = (from: Rgb, to: Rgb, weight: number): Rgb => {
  const safe = Math.max(0, Math.min(1, weight));
  return {
    r: clampChannel(from.r + (to.r - from.r) * safe),
    g: clampChannel(from.g + (to.g - from.g) * safe),
    b: clampChannel(from.b + (to.b - from.b) * safe),
  };
};

const relativeLuminance = ({ r, g, b }: Rgb) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const normalizeDominantColor = (input: Rgb): Rgb => {
  const hsl = rgbToHsl(input);
  const isNearGrayscale = hsl.s < 0.12;
  if (isNearGrayscale) {
    const luminance =
      input.r * 0.2126 + input.g * 0.7152 + input.b * 0.0722;
    const channel = clampChannel(
      Math.max(22, Math.min(160, luminance * 0.92)),
    );
    return { r: channel, g: channel, b: channel };
  }
  const saturation = Math.max(0.2, Math.min(0.72, hsl.s));
  const lightness = Math.max(0.14, Math.min(0.58, hsl.l));
  return hslToRgb({ h: hsl.h, s: saturation, l: lightness });
};

const buildEventBackdropPalette = (
  dominantColor: DominantColor | null,
): EventBackdropPalette => {
  const normalized = dominantColor
    ? normalizeDominantColor({
        r: dominantColor.r,
        g: dominantColor.g,
        b: dominantColor.b,
      })
    : null;
  const fallbackBase = mixRgb(APP_BG_RGB, { r: 30, g: 44, b: 62 }, 0.34);

  if (!normalized) {
    return {
      rootGradient: [
        rgba(mixRgb(APP_BG_RGB, fallbackBase, 0.24), 1),
        rgba(mixRgb(fallbackBase, GLOBAL_BG_RGB, 0.46), 1),
        rgba(GLOBAL_BG_RGB, 1),
      ],
      auraGradient: [
        rgba(mixRgb(fallbackBase, { r: 255, g: 255, b: 255 }, 0.08), 0.7),
        rgba(fallbackBase, 0.4),
        rgba(mixRgb(fallbackBase, APP_BG_RGB, 0.52), 0.12),
        "rgba(0,0,0,0)",
      ],
      topWashGradient: [
        rgba(fallbackBase, 0.42),
        rgba(mixRgb(fallbackBase, APP_BG_RGB, 0.48), 0.24),
        rgba(APP_BG_RGB, 0.12),
        "rgba(0,0,0,0)",
      ],
      depthGradient: [
        "rgba(0,0,0,0)",
        rgba(GLOBAL_BG_RGB, 0.16),
        rgba(GLOBAL_BG_RGB, 0.9),
        rgba(GLOBAL_BG_RGB, 1),
      ],
    };
  }

  const hsl = rgbToHsl(normalized);
  const luminance = relativeLuminance(normalized);
  const brightnessBoost = Math.max(0, (luminance - 0.54) * 0.5);
  const topStrength = clampAlpha(
    0.46 + hsl.s * 0.32 + (0.62 - luminance) * 0.18,
  );
  const baseTint = mixRgb(normalized, APP_BG_RGB, 0.12);
  const headTint = mixRgb(normalized, { r: 255, g: 255, b: 255 }, 0.06);
  const tailTint = mixRgb(baseTint, GLOBAL_BG_RGB, 0.68);
  const rootTop = mixRgb(normalized, APP_BG_RGB, 0.52);
  const rootMid = mixRgb(normalized, GLOBAL_BG_RGB, 0.76);
  const auraHead = mixRgb(normalized, { r: 255, g: 255, b: 255 }, 0.1);
  const auraTail = mixRgb(normalized, GLOBAL_BG_RGB, 0.42);

  return {
    rootGradient: [
      rgba(rootTop, 1),
      rgba(rootMid, 1),
      rgba(GLOBAL_BG_RGB, 1),
    ],
    auraGradient: [
      rgba(auraHead, clampAlpha(topStrength * 1.08)),
      rgba(normalized, clampAlpha(topStrength * 0.64)),
      rgba(auraTail, clampAlpha(topStrength * 0.24)),
      "rgba(0,0,0,0)",
    ],
    topWashGradient: [
      rgba(headTint, clampAlpha(topStrength * 0.94)),
      rgba(baseTint, clampAlpha(topStrength * 0.7)),
      rgba(tailTint, clampAlpha(topStrength * 0.34)),
      "rgba(0,0,0,0)",
    ],
    depthGradient: [
      "rgba(0,0,0,0)",
      rgba(GLOBAL_BG_RGB, clampAlpha(0.16 + brightnessBoost * 0.35)),
      rgba(GLOBAL_BG_RGB, clampAlpha(0.88 + brightnessBoost * 0.2)),
      rgba(GLOBAL_BG_RGB, 1),
    ],
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
        return TAB_PATHNAMES.agora;
      case "discover":
        return TAB_PATHNAMES.index;
      case "search":
        return "/search";
      case "tickets":
        return "/tickets";
      case "profile":
        return TAB_PATHNAMES.profile;
      default:
        return TAB_PATHNAMES.index;
    }
  }, [source]);

  const nextRoute = useMemo(() => {
    if (!slugValue) return fallbackRoute;
    if (source)
      return `/event/${slugValue}?source=${encodeURIComponent(source)}`;
    return `/event/${slugValue}`;
  }, [fallbackRoute, slugValue, source]);

  const openAuth = useCallback(() => {
    safePush(router, { pathname: "/auth", params: { next: nextRoute } });
  }, [nextRoute, router]);
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
  const [freeCheckoutSuccessVisible, setFreeCheckoutSuccessVisible] =
    useState(false);
  const [freeCheckoutSuccessKicker, setFreeCheckoutSuccessKicker] =
    useState<string>(t("events:tickets.freeSuccess.kicker.single"));
  const [freeCheckoutSuccessTitle, setFreeCheckoutSuccessTitle] =
    useState<string>(t("events:tickets.freeSuccess.title.single"));
  const [freeCheckoutSuccessMessage, setFreeCheckoutSuccessMessage] =
    useState<string | null>(null);
  const [freeCheckoutSuccessCtaLabel, setFreeCheckoutSuccessCtaLabel] =
    useState<string>(t("events:tickets.freeSuccess.cta.single"));
  const freeSuccessOpacity = useRef(new Animated.Value(0)).current;
  const freeSuccessScale = useRef(new Animated.Value(0.92)).current;
  const pullDownTintOpacity = useRef(new Animated.Value(0)).current;
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
  const inviteTokenRequestIdRef = useRef(0);
  const inviteIdentifierRequestIdRef = useRef(0);
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
  const dragStartedAtTopRef = useRef(false);
  const dragMinOffsetRef = useRef(0);
  const dismissResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const triggerLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  }, []);

  useEffect(() => {
    if (!freeCheckoutSuccessVisible) {
      freeSuccessOpacity.setValue(0);
      freeSuccessScale.setValue(0.92);
      return;
    }
    Animated.parallel([
      Animated.timing(freeSuccessOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(freeSuccessScale, {
        toValue: 1,
        friction: 8,
        tension: 86,
        useNativeDriver: true,
      }),
    ]).start();
  }, [freeCheckoutSuccessVisible, freeSuccessOpacity, freeSuccessScale]);

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
  const normalizedAccessMode =
    typeof accessMode === "string" && accessMode.toUpperCase() === "INVITE_ONLY"
      ? "UNLISTED"
      : accessMode;
  const accessBadge = resolveAccessBadge(normalizedAccessMode, t);
  const isInviteOnly = false;
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
      const requestId = inviteTokenRequestIdRef.current + 1;
      inviteTokenRequestIdRef.current = requestId;
      const trimmed = token.trim();
      if (!trimmed || !slugValue) {
        if (requestId !== inviteTokenRequestIdRef.current) return;
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
        if (requestId !== inviteTokenRequestIdRef.current) return;
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
      } catch (err: unknown) {
        if (requestId !== inviteTokenRequestIdRef.current) return;
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
      const requestId = inviteIdentifierRequestIdRef.current + 1;
      inviteIdentifierRequestIdRef.current = requestId;
      const trimmed = identifier.trim();
      if (!trimmed || !slugValue) {
        if (requestId !== inviteIdentifierRequestIdRef.current) return;
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
        if (requestId !== inviteIdentifierRequestIdRef.current) return;
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
      } catch (err: unknown) {
        if (requestId !== inviteIdentifierRequestIdRef.current) return;
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
  const activeCategoryLinkId = selectedPadelCategory?.linkId ?? null;
  const activePadelCategoryTickets = useMemo(() => {
    if (!Number.isFinite(activeCategoryLinkId)) return [];
    return ticketMeta.filter(
      (ticket) => ticket.padelEventCategoryLinkId === activeCategoryLinkId,
    );
  }, [activeCategoryLinkId, ticketMeta]);
  const hasActivePadelCategoryTicket = activePadelCategoryTickets.length > 0;
  const hasActivePadelCategoryPurchasableTicket = activePadelCategoryTickets.some(
    (ticket) => !ticket.unavailable,
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

  const cover = resolveMediaUri(data?.coverImageUrl ?? null);
  const date = formatDateRange(data?.startsAt, data?.endsAt);
  const location =
    data?.location?.formattedAddress || data?.location?.city || null;
  const description = data?.description ?? data?.shortDescription ?? null;
  const displayTitle = data?.title ?? eventTitleValue ?? null;
  const displayCover = cover ?? previewCoverValue ?? null;
  const backdropSeed = useMemo(
    () =>
      String(
        data?.slug ??
          slugValue ??
          displayTitle ??
          eventTitleValue ??
          displayCover ??
          "orya-event",
      ),
    [data?.slug, displayCover, displayTitle, eventTitleValue, slugValue],
  );
  const [backdropDominantColor, setBackdropDominantColor] =
    useState<DominantColor | null>(null);
  const backdropPalette = useMemo(
    () => buildEventBackdropPalette(backdropDominantColor),
    [backdropDominantColor],
  );
  const heroOverlayTint = useMemo(() => {
    if (!backdropDominantColor) return "rgba(8,12,20,0.36)";
    const normalized = normalizeDominantColor({
      r: backdropDominantColor.r,
      g: backdropDominantColor.g,
      b: backdropDominantColor.b,
    });
    return rgba(normalized, 0.42);
  }, [backdropDominantColor]);
  const displayLocation =
    data?.location?.formattedAddress ||
    data?.location?.city ||
    previewLocation ||
    location ||
    null;
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
    let active = true;
    setBackdropDominantColor(null);
    if (!displayCover) {
      return () => {
        active = false;
      };
    }
    const task = InteractionManager.runAfterInteractions(() => {
      getDominantColor(displayCover, backdropSeed)
        .then((resolved) => {
          if (!active) return;
          setBackdropDominantColor(resolved);
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
      safePush(router, `/${hostUsername}`);
    }
  };
  const showStickyPurchaseBar =
    Boolean(data) && !isLoading && !isError && !isPadelEvent;
  const showStickyPurchaseBarUi = showStickyPurchaseBar && !ticketSheetVisible;
  const isPublicEventAccess = !isInviteOnly;
  const ticketGateState = resolveTicketSheetGateState({
    showStickyPurchaseBar,
    ticketMetaLength: ticketMeta.length,
    selectableTicketMetaLength: purchasableTickets.length,
    canAccessInvite,
    eventIsActive,
    isPublicEvent: isPublicEventAccess,
  });
  const canOpenTicketSheet = ticketGateState.canOpenSheet;
  const ticketCtaState = resolveTicketCtaState(ticketGateState);
  const stickyCtaLabel = t(resolveTicketCtaLabel(ticketCtaState));
  const stickyCtaDisabled = ticketCtaState !== "READY";
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
        const status = ticket.status ?? null;
        const disabledReason = !canAccessInvite
          ? t("events:invite.lockedTickets")
          : !eventIsActive
            ? t("events:status.ended")
            : status === "UPCOMING"
              ? t("events:tickets.upcoming")
              : status === "CLOSED"
                ? t("events:tickets.closed")
                : status === "SOLD_OUT" || ticket.remaining === 0
                  ? t("events:tickets.soldOut")
                  : ticket.maxQuantity <= 0
                    ? t("events:tickets.unavailableNow")
                    : null;
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
          disabledReason,
        };
      }),
    [canAccessInvite, eventIsActive, t, ticketMeta, ticketQuantities],
  );
  const hasPriceWithoutTicketTypes =
    showStickyPurchaseBar &&
    !ticketGateState.hasTicketTypes &&
    typeof data?.priceFrom === "number";
  const stickyPriceLabel =
    selectedTicketQuantity > 0
      ? formatTicketPrice(selectedTicketTotalCents, ticketSheetCurrency, t)
      : ticketGateState.inviteLocked
        ? accessBadge.label
      : ticketGateState.eventEnded
        ? t("events:status.ended")
      : hasPriceWithoutTicketTypes
        ? data?.priceFrom && data.priceFrom > 0
          ? t("common:price.from", {
              price: formatCurrency(
                data.priceFrom / 100,
                "EUR",
              ),
            })
          : t("common:price.free")
      : !ticketGateState.hasTicketTypes
        ? t("events:tickets.comingSoon")
      : !ticketGateState.hasSelectableTickets
        ? t("events:tickets.unavailableNow")
      : hasPurchasableTickets
        ? (() => {
            const sorted = [...purchasableTickets].sort(
              (a, b) => a.price - b.price,
            );
            const lowest = sorted[0];
            if (!lowest) return t("events:tickets.unavailableNow");
            return lowest.price > 0
              ? t("common:price.from", {
                  price: formatCurrency(
                    lowest.price / 100,
                    lowest.currencyCode ?? "EUR",
                  ),
                })
              : t("common:price.free");
          })()
        : t("events:tickets.unavailableNow");
  const ticketSheetSubmitLabel = t("events:tickets.sheet.submit.default");
  useEffect(() => {
    if (!ticketGateState.configInvalid || !data?.id) return;
    trackEvent("event_ticket_config_invalid", {
      eventId: data.id,
      slug: data.slug,
      ticketCount: ticketMeta.length,
      accessMode: accessMode ?? "PUBLIC",
    });
  }, [
    accessMode,
    data?.id,
    data?.slug,
    ticketGateState.configInvalid,
    ticketMeta.length,
  ]);

  useEffect(() => {
    if (!hasPriceWithoutTicketTypes || !data?.id) return;
    trackEvent("event_ticket_missing_types_for_price", {
      eventId: data.id,
      slug: data.slug,
      priceFrom: data.priceFrom ?? null,
      accessMode: accessMode ?? "PUBLIC",
    });
  }, [
    accessMode,
    data?.id,
    data?.priceFrom,
    data?.slug,
    hasPriceWithoutTicketTypes,
  ]);

  const shareUrl =
    data?.slug && env.apiBaseUrl
      ? `${env.apiBaseUrl.replace(/\/$/, "")}/eventos/${data.slug}`
      : null;
  const mapTargets = useMemo(() => {
    if (!data) return null;
    const fallbackQuery =
      data.location?.formattedAddress || data.location?.city || null;
    return buildMapTargets({
      label: data.title ?? "ORYA Event",
      query: fallbackQuery,
      lat: data.location?.lat ?? null,
      lng: data.location?.lng ?? null,
    });
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
    hasCategoryTicket: hasActivePadelCategoryTicket,
    hasCategoryPurchasableTicket: hasActivePadelCategoryPurchasableTicket,
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
        : registrationBlockReason === "MISSING_CATEGORY_TICKET"
          ? t("events:tickets.configurationIssue")
        : registrationBlockReason === "CATEGORY_TICKET_UNAVAILABLE"
          ? t("events:tickets.unavailableNow")
        : registrationBlockReason === "MISSING_INVITE_CONTACT"
          ? t("events:padel.partnerRequired")
          : registrationBlockReason === "BUSY"
            ? t("events:padel.creatingPairing")
            : registrationBlockReason === "POLICY_LOCKED"
              ? t("events:padel.completeProfileToAccept")
              : t("events:padel.registrationReadyHint");

  useEffect(() => {
    if (!isPadelEvent || !activeCategoryId || !data?.id) return;
    if (hasActivePadelCategoryTicket) return;
    trackEvent("padel_category_missing_ticket_types", {
      eventId: data.id,
      slug: data.slug,
      categoryId: activeCategoryId,
      categoryLinkId: activeCategoryLinkId,
    });
  }, [
    activeCategoryId,
    activeCategoryLinkId,
    data?.id,
    data?.slug,
    hasActivePadelCategoryTicket,
    isPadelEvent,
  ]);

  useEffect(() => {
    if (!isPadelEvent || !activeCategoryId || !data?.id) return;
    if (!hasActivePadelCategoryTicket) return;
    if (hasActivePadelCategoryPurchasableTicket) return;
    trackEvent("padel_category_no_purchasable_tickets", {
      eventId: data.id,
      slug: data.slug,
      categoryId: activeCategoryId,
      categoryLinkId: activeCategoryLinkId,
    });
  }, [
    activeCategoryId,
    activeCategoryLinkId,
    data?.id,
    data?.slug,
    hasActivePadelCategoryPurchasableTicket,
    hasActivePadelCategoryTicket,
    isPadelEvent,
  ]);

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
      const webUrl = resolveSafeHttpUrl(mapTargets.web);
      if (!webUrl) return;
      const canOpenWeb = await Linking.canOpenURL(webUrl);
      if (!canOpenWeb) return;
      await Linking.openURL(webUrl);
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

  const triggerPullDownDismiss = useCallback(
    (offsetY: number, dragStartedAtTop: boolean) => {
      if (Platform.OS !== "ios") return;
      if (ticketSheetVisible) return;
      if (dismissInFlightRef.current) return;
      if (!dragStartedAtTop) return;
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
      }, 320);
    },
    [handleBack, ticketSheetVisible],
  );

  const handleEventScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const isDragging = dragStartedAtTopRef.current;
      scrollOffsetYRef.current = offsetY;
      const pullDistance = Math.max(0, -offsetY);
      const tintOpacity = Math.min(1, pullDistance / 72);
      pullDownTintOpacity.setValue(tintOpacity);
      if (isDragging && dragStartedAtTopRef.current) {
        dragMinOffsetRef.current = Math.min(dragMinOffsetRef.current, offsetY);
      }
      if (isDragging && dragStartedAtTopRef.current && offsetY <= 0) {
        triggerPullDownDismiss(offsetY, true);
      }
    },
    [pullDownTintOpacity, triggerPullDownDismiss],
  );

  const handleEventScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetYRef.current = offsetY;
      pullDownTintOpacity.setValue(Math.min(1, Math.max(0, -offsetY) / 72));
      dragStartedAtTopRef.current = offsetY <= 1;
      dragMinOffsetRef.current = Math.min(0, offsetY);
    },
    [pullDownTintOpacity],
  );

  const handleEventScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetYRef.current = offsetY;
      const minOffset = Math.min(offsetY, dragMinOffsetRef.current);
      const dragStartedAtTop = dragStartedAtTopRef.current;
      dragStartedAtTopRef.current = false;
      dragMinOffsetRef.current = 0;
      if (minOffset <= 0) {
        triggerPullDownDismiss(minOffset, dragStartedAtTop);
      }
      Animated.timing(pullDownTintOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [pullDownTintOpacity, triggerPullDownDismiss],
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
    if (initiatingCheckout) return;
    if (!data) return;
    if (!canAccessInvite) {
      Alert.alert(
        t("common:labels.error"),
        t("events:invite.lockedTickets"),
      );
      return;
    }
    if (!eventIsActive) {
      Alert.alert(
        t("common:labels.error"),
        t("events:status.ended"),
      );
      return;
    }
    if (selectedTicketItems.length === 0) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    const firstItem = selectedTicketItems[0];
    if (!firstItem) return;
    const idempotencyKey = buildCheckoutIdempotencyKey();
    const checkoutItemsPayload = selectedTicketItems.map((item) => ({
      ticketTypeId: item.ticketTypeId,
      quantity: item.quantity,
    }));
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
      if (selectedItemsAreFree) {
        const response = await createCheckoutIntent({
          slug: data.slug ?? "",
          items: checkoutItemsPayload,
          paymentMethod: "card",
          paymentScenario: "FREE_CHECKOUT",
          inviteToken: inviteToken ?? undefined,
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

        const freeCheckout =
          response.freeCheckout ||
          response.isGratisCheckout ||
          (response.amount ?? 0) <= 0;
        if (freeCheckout) {
          let isSettled = true;
          if (response.purchaseId || response.paymentIntentId) {
            try {
              const status = await fetchCheckoutStatus({
                purchaseId: response.purchaseId ?? undefined,
                paymentIntentId: response.paymentIntentId ?? undefined,
              });
              isSettled = isCheckoutSettledStatus(status.status);
            } catch {
              isSettled = false;
            }
          }

          if (isSettled) {
            const eventTitleCopy =
              data.title?.trim() ||
              displayTitle?.trim() ||
              t("events:tickets.freeSuccess.eventFallback");
            const isPlural = selectedTicketQuantity > 1;
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => undefined);
            setTicketQuantities({});
            setFreeCheckoutSuccessKicker(
              isPlural
                ? t("events:tickets.freeSuccess.kicker.plural")
                : t("events:tickets.freeSuccess.kicker.single"),
            );
            setFreeCheckoutSuccessTitle(
              isPlural
                ? t("events:tickets.freeSuccess.title.plural")
                : t("events:tickets.freeSuccess.title.single"),
            );
            setFreeCheckoutSuccessMessage(
              isPlural
                ? t("events:tickets.freeSuccess.message.plural", {
                    count: selectedTicketQuantity,
                    event: eventTitleCopy,
                  })
                : t("events:tickets.freeSuccess.message.single", {
                    event: eventTitleCopy,
                  }),
            );
            setFreeCheckoutSuccessCtaLabel(
              isPlural
                ? t("events:tickets.freeSuccess.cta.plural")
                : t("events:tickets.freeSuccess.cta.single"),
            );
            setFreeCheckoutSuccessVisible(true);
            trackEvent("checkout_free_ticket_confirmed", {
              sourceType: "EVENT_TICKET",
              eventId: data.id,
              quantity: selectedTicketQuantity,
            });
            return;
          }

          safePush(router, {
            pathname: "/checkout/success",
            params: {
              purchaseId: response.purchaseId ?? "",
              paymentIntentId: response.paymentIntentId ?? "",
              eventTitle: data.title ?? "",
              slug: data.slug ?? "",
            },
          });
          return;
        }
      }
      safePush(router, "/checkout");
    } catch (err: unknown) {
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
    displayTitle,
    eventIsActive,
    initiatingCheckout,
    inviteToken,
    openAuth,
    router,
    selectedItemsAreFree,
    selectedTicketItems,
    selectedTicketQuantity,
    selectedTicketTotalCents,
    session?.user?.id,
    setCheckoutDraft,
    setCheckoutIntent,
    t,
    triggerLightHaptic,
  ]);

  const handleDismissFreeCheckoutSuccess = useCallback(() => {
    setFreeCheckoutSuccessVisible(false);
    setFreeCheckoutSuccessMessage(null);
  }, []);

  const handleViewTicketFromFreeSuccess = useCallback(() => {
    setFreeCheckoutSuccessVisible(false);
    setFreeCheckoutSuccessMessage(null);
    router.replace("/tickets");
  }, [router]);

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
    } catch (err: unknown) {
      if (resolveErrorMessage(err).includes("PADEL_ONBOARDING_REQUIRED")) {
        Alert.alert(
          t("events:padel.onboardingRequiredTitle"),
          t("events:padel.onboardingRequiredBody"),
        );
        safePush(router, TAB_PATHNAMES.profile);
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
      const joinResult = await joinOpenPairing(pairingId);
      Alert.alert(
        t("events:padel.pairingTitle"),
        joinResult.alreadyActive
          ? t("events:padel.joinAlreadyActive")
          : t("events:padel.joinSuccess"),
      );
      await Promise.all([
        myPairingsQuery.refetch(),
        openPairingsQuery.refetch(),
      ]);
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
        safePush(router, {
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
      safePush(router, "/checkout");
    } catch (err: unknown) {
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
          gestureEnabled: false,
        }}
      />
      <LiquidBackground>
        <View pointerEvents="none" style={styles.pageGlobalBase} />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={handleEventScrollBeginDrag}
          onScroll={handleEventScroll}
          onScrollEndDrag={handleEventScrollEndDrag}
        >
          <View
            style={[styles.scrollBackdropRoot, { paddingBottom: scrollBottomPadding }]}
          >
            <View pointerEvents="none" style={styles.scrollBackdropLayer}>
              <View style={styles.scrollBackdropBase} />
              <View
                style={[
                  styles.scrollBackdropTopStack,
                  { height: Math.max(620, insets.top + 520) },
                ]}
              >
                <LinearGradient
                  colors={backdropPalette.rootGradient}
                  locations={[0, 0.36, 1]}
                  start={{ x: 0.12, y: 0 }}
                  end={{ x: 0.88, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={backdropPalette.auraGradient}
                  locations={[0, 0.24, 0.52, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.backdropAura}
                />
                {backdropPalette.topWashGradient ? (
                  <LinearGradient
                    colors={backdropPalette.topWashGradient}
                    locations={[0, 0.3, 0.66, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.backdropTopWash}
                  />
                ) : null}
                <LinearGradient
                  colors={backdropPalette.depthGradient}
                  locations={[0.22, 0.46, 0.72, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>
            <View style={styles.scrollBackdropContent}>
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
                    <EventHeroSquare
                      coverUri={displayCover}
                      title={displayTitle}
                      overlayTint={heroOverlayTint}
                    />
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
                  onToggle={() => setInfoExpanded((current) => !current)}
                  description={description}
                  title={t("events:detail.about")}
                />

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
                          {activeCategoryId &&
                          !hasActivePadelCategoryTicket ? (
                            <Text className="text-amber-200 text-xs">
                              {t("events:tickets.configurationIssue")}
                            </Text>
                          ) : null}
                          {activeCategoryId &&
                          hasActivePadelCategoryTicket &&
                          !hasActivePadelCategoryPurchasableTicket ? (
                            <Text className="text-amber-200 text-xs">
                              {t("events:tickets.unavailableNow")}
                            </Text>
                          ) : null}
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
                                ? (rows as StandingRow[])
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
                                          (player: { name?: string | null; username?: string | null } | null | undefined) =>
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
                                        key={`row-${groupLabel}-${String(row.entityId ?? idx)}`}
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
                                          {row.points ?? 0}{" "}
                                          {t("events:padel.pointsShort")} ·{" "}
                                          {row.wins ?? 0}
                                          {t("events:padel.winsShort")}-
                                          {row.losses ?? 0}
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
                              .map((match, idx) => {
                                const typedMatch = match as LiveMatch;
                                const matchRecord = typedMatch as unknown as Record<string, unknown>;
                                const stream = resolveMatchStream(matchRecord);
                                const startAt = resolveMatchStartAt(matchRecord);
                                const elapsedRaw =
                                  typeof typedMatch.elapsedSeconds === "number" && Number.isFinite(typedMatch.elapsedSeconds)
                                    ? Math.floor(typedMatch.elapsedSeconds)
                                    : (typedMatch.status ?? "").toString().toUpperCase() === "IN_PROGRESS" && startAt
                                      ? Math.max(0, Math.floor((Date.now() - startAt.getTime()) / 1000))
                                      : null;
                                const elapsedLabel = formatElapsedLabel(elapsedRaw);
                                return (
                                  <View
                                    key={`match-${String(typedMatch.id ?? idx)}`}
                                    className="gap-1 rounded-2xl border border-white/14 bg-white/8 px-3 py-3"
                                  >
                                    <View className="flex-row items-center justify-between gap-2">
                                      <Text className="text-white/70 text-xs">
                                        {typedMatch.groupLabel
                                          ? t("events:padel.groupLabel", {
                                              group: typedMatch.groupLabel,
                                            })
                                          : t("events:padel.matchLabel")}
                                      </Text>
                                      <View className="flex-row items-center gap-1.5">
                                        {stream.isLive ? (
                                          <Text className="rounded-full border border-fuchsia-200/50 bg-fuchsia-300/15 px-2 py-0.5 text-[10px] text-fuchsia-100">
                                            Stream
                                          </Text>
                                        ) : null}
                                        {elapsedLabel ? (
                                          <Text className="rounded-full border border-emerald-200/45 bg-emerald-300/12 px-2 py-0.5 text-[10px] text-emerald-100">
                                            {elapsedLabel}
                                          </Text>
                                        ) : null}
                                      </View>
                                    </View>
                                    <Text className="text-white/85 text-sm font-semibold">
                                      {resolvePairingLabel(typedMatch.pairingA, t)} {t("events:detail.vs")} {resolvePairingLabel(typedMatch.pairingB, t)}
                                    </Text>
                                    {stream.isLive && stream.url ? (
                                      <Text className="text-white/60 text-[11px]" numberOfLines={1}>
                                        {stream.url}
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              })
                          )}
                        </View>
                      </PadelSection>
                    ) : null}
                  </>
                ) : null}
                  </View>
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.ScrollView>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pullDownTintLayer,
            {
              height: Math.max(260, insets.top + 220),
              opacity: pullDownTintOpacity,
            },
          ]}
        >
          <LinearGradient
            colors={[
              backdropPalette.rootGradient[0],
              backdropPalette.rootGradient[1],
              "rgba(0,0,0,0)",
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
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
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.back")}
              hitSlop={14}
              style={({ pressed }) => [
                styles.closeButton,
                pressed ? styles.closeButtonPressed : null,
              ]}
            >
              <View pointerEvents="none" style={styles.closePlate}>
                {Platform.OS === "ios" ? (
                  <BlurView intensity={40} tint="dark" style={styles.closePlateBlur} />
                ) : null}
                <View style={styles.closePlateTint} />
                <View style={styles.closeGlyph}>
                  <View style={[styles.closeGlyphLine, styles.closeGlyphLineA]} />
                  <View style={[styles.closeGlyphLine, styles.closeGlyphLineB]} />
                </View>
              </View>
            </Pressable>
          </View>
        </View>
        {showStickyPurchaseBarUi ? (
          <StickyPurchaseBar
            priceLabel={stickyPriceLabel}
            ctaState={ticketCtaState}
            ctaLabel={stickyCtaLabel}
            disabled={stickyCtaDisabled}
            onPress={handleOpenTicketSheet}
          />
        ) : null}
        <TicketSelectorSheet
          visible={ticketSheetVisible && showStickyPurchaseBar}
          title={t("events:tickets.title")}
          items={ticketSelectorItems}
          totalCents={selectedTicketTotalCents}
          currency={ticketSheetCurrency}
          submitLabel={ticketSheetSubmitLabel}
          emptyStateMessage={
            ticketGateState.hasTicketTypes
              ? t("events:tickets.unavailableNow")
              : t("events:tickets.comingSoon")
          }
          onClose={() => setTicketSheetVisible(false)}
          onIncrement={handleIncrementTicket}
          onDecrement={handleDecrementTicket}
          onSubmit={handleCheckoutFromTickets}
        />
        {freeCheckoutSuccessVisible ? (
          <Animated.View
            style={[styles.freeSuccessOverlay, { opacity: freeSuccessOpacity }]}
          >
            <LinearGradient
              colors={["#10F18A", "#17F59B", "#1EF8A8"]}
              start={{ x: 0.28, y: 0 }}
              end={{ x: 0.72, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.freeSuccessContent,
                {
                  paddingTop: insets.top + 18,
                  paddingBottom: insets.bottom + 26,
                },
              ]}
            >
              <View style={styles.freeSuccessHeader}>
                <View style={styles.freeSuccessSpacer} />
                <Pressable
                  onPress={handleDismissFreeCheckoutSuccess}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar confirmação"
                  style={({ pressed }) => [
                    styles.freeSuccessClose,
                    pressed ? styles.closeButtonPressed : null,
                  ]}
                >
                  <Ionicons name="close" size={22} color="#071018" />
                </Pressable>
              </View>

              <Animated.View
                style={[
                  styles.freeSuccessBody,
                  { transform: [{ scale: freeSuccessScale }] },
                ]}
              >
                <View style={styles.freeSuccessIconWrap}>
                  <Ionicons name="checkmark" size={46} color="#071018" />
                </View>
                <Text style={styles.freeSuccessKicker}>
                  {freeCheckoutSuccessKicker}
                </Text>
                <Text style={styles.freeSuccessTitle}>
                  {freeCheckoutSuccessTitle}
                </Text>
                <Text style={styles.freeSuccessMessage}>
                  {freeCheckoutSuccessMessage ??
                    t("events:tickets.freeSuccess.message.default")}
                </Text>
              </Animated.View>

              <Pressable
                onPress={handleViewTicketFromFreeSuccess}
                accessibilityRole="button"
                accessibilityLabel={
                  freeCheckoutSuccessCtaLabel ||
                  t("events:tickets.freeSuccess.cta.accessibility")
                }
                style={({ pressed }) => [
                  styles.freeSuccessCta,
                  pressed ? { opacity: 0.86 } : null,
                ]}
              >
                <Text style={styles.freeSuccessCtaText}>
                  {freeCheckoutSuccessCtaLabel}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </LiquidBackground>
    </>
  );
}

const styles = StyleSheet.create({
  pageGlobalBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.background,
    zIndex: 0,
  },
  scrollBackdropRoot: {
    position: "relative",
  },
  scrollBackdropLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  scrollBackdropBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.background,
  },
  scrollBackdropTopStack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  scrollBackdropContent: {
    position: "relative",
    zIndex: 1,
  },
  pullDownTintLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 24,
  },
  backdropAura: {
    position: "absolute",
    top: -42,
    left: 0,
    right: 0,
    height: "88%",
  },
  backdropTopWash: {
    position: "absolute",
    top: -20,
    left: 0,
    right: 0,
    height: "72%",
  },
  closeButton: {
    width: 54,
    height: 54,
    minWidth: 54,
    maxWidth: 54,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closePlate: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.74)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
  },
  closePlateBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  closePlateTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(226,241,255,0.34)",
    backgroundColor: "rgba(8,12,20,0.46)",
  },
  closeGlyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  closeGlyphLine: {
    position: "absolute",
    width: 21,
    height: 2.8,
    borderRadius: 999,
    backgroundColor: "rgba(248,252,255,0.98)",
  },
  closeGlyphLineA: {
    transform: [{ rotate: "45deg" }],
  },
  closeGlyphLineB: {
    transform: [{ rotate: "-45deg" }],
  },
  closeButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  freeSuccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 460,
    elevation: 460,
  },
  freeSuccessContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  freeSuccessHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  freeSuccessSpacer: {
    width: 54,
    height: 54,
  },
  freeSuccessClose: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(7,16,24,0.24)",
    backgroundColor: "rgba(7,16,24,0.18)",
  },
  freeSuccessBody: {
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  freeSuccessIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,16,24,0.12)",
    borderWidth: 2,
    borderColor: "rgba(7,16,24,0.22)",
    marginBottom: 6,
  },
  freeSuccessKicker: {
    color: "#071018",
    fontSize: 50,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  freeSuccessTitle: {
    color: "#071018",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  freeSuccessMessage: {
    color: "rgba(7,16,24,0.88)",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 10,
    marginTop: 6,
  },
  freeSuccessCta: {
    minHeight: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071018",
    borderWidth: 1,
    borderColor: "rgba(7,16,24,0.92)",
    marginBottom: 4,
  },
  freeSuccessCtaText: {
    color: "#F4F9FF",
    fontSize: 31 / 2,
    lineHeight: 38 / 2,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
