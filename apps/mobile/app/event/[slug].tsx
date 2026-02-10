import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  Linking,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useEventDetail } from "../../features/events/hooks";
import { tokens } from "@orya/shared";
import { Ionicons } from "../../components/icons/Ionicons";
import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useAuth } from "../../lib/auth";
import { useCheckoutStore, buildCheckoutIdempotencyKey } from "../../features/checkout/store";
import { createCheckoutIntent, createPairingCheckoutIntent } from "../../features/checkout/api";
import { createPairing, joinOpenPairing, acceptInvite, declineInvite } from "../../features/tournaments/api";
import { useMyPairings, useOpenPairings, usePadelMatches, usePadelStandings } from "../../features/tournaments/hooks";
import { safeBack } from "../../lib/navigation";
import { FavoriteToggle } from "../../components/events/FavoriteToggle";
import { StickyCTA } from "../../components/events/StickyCTA";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileEnv } from "../../lib/env";
import { getUserFacingError } from "../../lib/errors";
import { trackEvent } from "../../lib/analytics";
import { useEventChatThread } from "../../features/chat/hooks";
import { acceptMessageInvite } from "../../features/messages/api";
import { useMessageInvites } from "../../features/messages/hooks";
import { useProfileSummary } from "../../features/profile/hooks";
import { sendEventSignal } from "../../features/events/signals";

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatDateRange = (startsAt?: string, endsAt?: string): string | null => {
  if (!startsAt) return null;
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;

    const date = EVENT_DATE_FORMATTER.format(start);
    const startTime = EVENT_TIME_FORMATTER.format(start);

    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;

    const endTime = EVENT_TIME_FORMATTER.format(end);

    return `${date} · ${startTime}–${endTime}`;
  } catch {
    return null;
  }
};

const resolveStatusLabel = (status?: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT") => {
  switch (status) {
    case "CANCELLED":
      return "Cancelado";
    case "PAST":
      return "Terminado";
    case "DRAFT":
      return "Rascunho";
    default:
      return "Ativo";
  }
};

const formatTicketPrice = (priceCents: number, currency?: string | null): string => {
  if (priceCents <= 0) return "Grátis";
  const amount = priceCents / 100;
  const normalizedCurrency = currency?.toUpperCase() || "EUR";
  return `${amount.toFixed(0)} ${normalizedCurrency}`;
};

const resolveTicketStatusLabel = (status?: string | null, remaining?: number | null): string => {
  if (status === "CLOSED") return "Fechado";
  if (status === "UPCOMING") return "Brevemente";
  if (status === "SOLD_OUT" || remaining === 0) return "Esgotado";
  return "Disponível";
};

const resolveAccessBadge = (mode?: string | null) => {
  const normalized = mode?.toUpperCase();
  if (normalized === "PUBLIC") return { label: "PÚBLICO", variant: "accent" as const };
  if (normalized === "INVITE_ONLY") return { label: "CONVITE", variant: "muted" as const };
  return { label: "UNLISTED", variant: "muted" as const };
};

const resolvePadelRegistrationLabel = (status?: string | null) => {
  const normalized = status?.toUpperCase();
  if (normalized === "OPEN") return "Inscrições abertas";
  if (normalized === "NOT_OPEN") return "Inscrições em breve";
  if (normalized === "CLOSED") return "Inscrições encerradas";
  if (normalized === "STARTED") return "Torneio em curso";
  if (normalized === "UNPUBLISHED") return "Torneio não publicado";
  return "Inscrições indisponíveis";
};

const resolvePadelPaymentModeLabel = (mode?: string | null): string | null => {
  const normalized = mode?.toUpperCase();
  if (normalized === "SPLIT") return "Split";
  if (normalized === "FULL") return "Pago completo";
  return mode ?? null;
};

const resolvePairingLabel = (pairing?: any) => {
  const explicitLabel = typeof pairing?.label === "string" ? pairing.label.trim() : "";
  if (explicitLabel) return explicitLabel;
  if (Array.isArray(pairing?.players)) {
    const names = pairing.players
      .map((player: any) => player?.name || player?.username)
      .filter(Boolean) as string[];
    if (names.length) return names.join(" / ");
  }
  if (!pairing || !Array.isArray(pairing.slots)) {
    return pairing?.id ? `Dupla ${pairing.id}` : "Dupla";
  }
  const names = pairing.slots
    .map((slot: any) => slot?.playerProfile?.fullName || slot?.playerProfile?.username)
    .filter(Boolean) as string[];
  if (names.length === 0) return pairing?.id ? `Dupla ${pairing.id}` : "Dupla";
  return names.join(" / ");
};

const normalizeEmailValue = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const normalizeUsernameValue = (value?: string | null) =>
  value?.trim().replace(/^@+/, "").toLowerCase() ?? "";

const mapInviteTokenReason = (reason?: string | null) => {
  switch ((reason ?? "").toUpperCase()) {
    case "INVITE_TOKEN_NOT_ALLOWED":
      return "Este evento não aceita tokens de convite.";
    case "INVITE_TOKEN_TTL_REQUIRED":
      return "Convite expirado. Pede um novo convite.";
    case "INVITE_TOKEN_REQUIRES_EMAIL":
      return "Este evento só aceita convites por email.";
    case "INVITE_TOKEN_INVALID":
    case "INVITE_TOKEN_NOT_FOUND":
      return "Token inválido ou expirado.";
    default:
      return null;
  }
};

export default function EventDetail() {
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
    () => (Array.isArray(params.source) ? params.source[0] : params.source) ?? null,
    [params.source],
  );
  const slugValue = useMemo(
    () => (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? null,
    [params.slug],
  );
  const eventTitleValue = useMemo(
    () => (Array.isArray(params.eventTitle) ? params.eventTitle[0] : params.eventTitle) ?? null,
    [params.eventTitle],
  );
  const previewCoverValue = useMemo(() => {
    const value = params.coverImageUrl;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.coverImageUrl]);
  const previewDescription = useMemo(() => {
    const value = params.shortDescription;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.shortDescription]);
  const previewStartsAt = useMemo(() => {
    const value = params.startsAt;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.startsAt]);
  const previewEndsAt = useMemo(() => {
    const value = params.endsAt;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.endsAt]);
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
    if (source) return `/event/${slugValue}?source=${encodeURIComponent(source)}`;
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
  const previewCategory = useMemo(() => {
    const value = params.categoryLabel;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.categoryLabel]);
  const previewHost = useMemo(() => {
    const value = params.hostName;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.hostName]);
  const previewImageTag = useMemo(() => {
    const raw = Array.isArray(params.imageTag) ? params.imageTag[0] : params.imageTag;
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized ? normalized : null;
  }, [params.imageTag]);
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
  const { data, isLoading, isError, error, refetch } = useEventDetail(slugValue ?? "");
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const profileSummaryQuery = useProfileSummary(Boolean(accessToken), accessToken, session?.user?.id ?? null);
  const profileSummary = profileSummaryQuery.data ?? null;
  const setCheckoutDraft = useCheckoutStore((state) => state.setDraft);
  const setCheckoutIntent = useCheckoutStore((state) => state.setIntent);
  const insets = useSafeAreaInsets();
  const env = getMobileEnv();
  const transitionSource = params.source === "discover" ? "discover" : "direct";
  const fade = useRef(new Animated.Value(transitionSource === "discover" ? 0 : 0.2)).current;
  const translate = useRef(new Animated.Value(transitionSource === "discover" ? 20 : 10)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const viewSentRef = useRef(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<"FULL" | "SPLIT">("FULL");
  const [joinMode, setJoinMode] = useState<"INVITE_PARTNER" | "LOOKING_FOR_PARTNER">("INVITE_PARTNER");
  const [inviteContact, setInviteContact] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingActionBusy, setPairingActionBusy] = useState(false);
  const [inviteAccepting, setInviteAccepting] = useState(false);

  useEffect(() => {
    const eventId = data?.id;
    if (!eventId) return;
    if (!viewSentRef.current) {
      sendEventSignal({ eventId, signalType: "VIEW" });
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

  const handleBack = () => {
    safeBack(router, navigation, fallbackRoute);
  };
  const accessMode = data?.accessPolicy?.mode ?? null;
  const accessBadge = resolveAccessBadge(accessMode);
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
  const inviteIdentifierNeedsLogin = inviteIdentifierState.status === "invited" && !session?.user?.id;
  const inviteIdentifierCheckingAccount =
    inviteIdentifierState.status === "invited" && Boolean(session?.user?.id) && profileSummaryQuery.isLoading;
  const inviteIdentifierMismatch =
    inviteIdentifierState.status === "invited" &&
    Boolean(session?.user?.id) &&
    !identifierMatchesAccount &&
    !profileSummaryQuery.isLoading;
  const isPadelEvent =
    typeof data?.templateType === "string" ? data.templateType.toUpperCase() === "PADEL" : Boolean(data?.padel);
  const padelMeta = data?.padel ?? null;
  const padelCategories = Array.isArray(padelMeta?.categories) ? padelMeta?.categories : [];
  const visiblePadelCategories = padelCategories.filter((category) => !category.isHidden);
  const registrationStatus = padelMeta?.registrationStatus ?? null;
  const registrationMessage =
    padelMeta?.registrationMessage ?? resolvePadelRegistrationLabel(registrationStatus);
  const registrationOpen = registrationStatus === "OPEN";
  const padelSnapshot = padelMeta?.snapshot ?? null;
  const padelActionsDisabled = gateLocked || !registrationOpen || !padelMeta?.v2Enabled;
  const selectedPadelCategory =
    visiblePadelCategories.find((category) => category.id === selectedCategoryId) ??
    visiblePadelCategories.find((category) => category.id === padelMeta?.defaultCategoryId) ??
    visiblePadelCategories[0] ??
    null;
  const activeCategoryId = selectedPadelCategory?.id ?? null;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: transitionSource === "discover" ? tokens.motion.normal + 120 : tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: transitionSource === "discover" ? tokens.motion.normal + 120 : tokens.motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [data?.id, fade, transitionSource, translate]);

  const validateInviteToken = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed || !slugValue) {
        setInviteState({ status: "invalid", message: "Token inválido." });
        return;
      }
      setInviteState({ status: "checking" });
      try {
        const response = await api.request<unknown>(`/api/eventos/${encodeURIComponent(slugValue)}/invite-token`, {
          method: "POST",
          body: JSON.stringify({ token: trimmed }),
        });
        const result = unwrapApiResponse<{
          allow?: boolean;
          reason?: string;
          ticketTypeId?: number | null;
        }>(response);
        if (!result.allow) {
          const reasonMessage = mapInviteTokenReason(result.reason);
          setInviteState({
            status: "invalid",
            message: reasonMessage ?? (result.reason ? `Convite inválido (${result.reason}).` : "Convite inválido."),
          });
          return;
        }
        setInviteState({
          status: "valid",
          token: trimmed,
          ticketTypeId:
            typeof result.ticketTypeId === "number" && Number.isFinite(result.ticketTypeId)
              ? result.ticketTypeId
              : null,
        });
      } catch (err: any) {
        setInviteState({ status: "invalid", message: getUserFacingError(err, "Convite inválido.") });
      }
    },
    [slugValue],
  );

  const handleInviteCheck = useCallback(() => {
    validateInviteToken(inviteTokenInput);
  }, [inviteTokenInput, validateInviteToken]);

  const validateInviteIdentifier = useCallback(
    async (identifier: string) => {
      const trimmed = identifier.trim();
      if (!trimmed || !slugValue) {
        setInviteIdentifierState({ status: "invalid", message: "Identificador inválido." });
        return;
      }
      setInviteIdentifierState({ status: "checking" });
      try {
        const response = await api.request<unknown>(`/api/eventos/${encodeURIComponent(slugValue)}/invites/check`, {
          method: "POST",
          body: JSON.stringify({ identifier: trimmed }),
        });
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
              ? "Este evento só aceita convites por username."
              : "Este evento só aceita convites por email.";
          } else if (reasonCode === "USERNAME_NOT_FOUND") {
            message = "Username não encontrado. Usa convite por email.";
          }
          setInviteIdentifierState({
            status: "not_invited",
            message: message ?? (result.reason ? `Convite não encontrado (${result.reason}).` : "Convite não encontrado."),
          });
          return;
        }
        const resolvedType =
          result.type ?? (trimmed.includes("@") ? ("email" as const) : ("username" as const));
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
          message: getUserFacingError(err, "Não foi possível validar o convite."),
        });
      }
    },
    [slugValue],
  );

  const handleInviteIdentifierCheck = useCallback(() => {
    validateInviteIdentifier(inviteIdentifierInput);
  }, [inviteIdentifierInput, validateInviteIdentifier]);

  useEffect(() => {
    if (!isInviteOnly) return;
    if (!inviteTokenParam) return;
    if (inviteState.status === "valid" && inviteState.token === inviteTokenParam) return;
    if (inviteState.status === "checking") return;
    setInviteTokenInput(inviteTokenParam);
    validateInviteToken(inviteTokenParam);
  }, [inviteTokenParam, inviteState.status, inviteState.token, isInviteOnly, validateInviteToken]);

  const ticketTypes = useMemo(() => {
    const list = data?.ticketTypes ?? [];
    const filtered =
      typeof inviteTicketTypeId === "number"
        ? list.filter((ticket) => ticket.id === inviteTicketTypeId)
        : list;
    return [...filtered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [data?.ticketTypes, inviteTicketTypeId]);

  const purchasableTickets = useMemo(() => {
    return ticketTypes.filter((ticket) => {
      const remaining =
        ticket.totalQuantity != null ? Math.max(ticket.totalQuantity - (ticket.soldQuantity ?? 0), 0) : null;
      const status = ticket.status ?? null;
      if (status === "CLOSED" || status === "SOLD_OUT" || status === "UPCOMING") return false;
      if (remaining === 0) return false;
      return true;
    });
  }, [ticketTypes]);

  const hasPurchasableTickets = purchasableTickets.length > 0;

  useEffect(() => {
    if (ticketTypes.length === 0) return;
    if (selectedTicketId !== null) return;
    const firstAvailable = purchasableTickets[0] ?? ticketTypes[0];
    setSelectedTicketId(firstAvailable?.id ?? null);
  }, [purchasableTickets, selectedTicketId, ticketTypes]);

  useEffect(() => {
    if (!isPadelEvent) return;
    if (selectedCategoryId !== null) return;
    const fallbackId =
      padelMeta?.defaultCategoryId ??
      visiblePadelCategories.find((category) => category.isEnabled && !category.isHidden)?.id ??
      visiblePadelCategories[0]?.id ??
      null;
    if (fallbackId) setSelectedCategoryId(fallbackId);
  }, [isPadelEvent, padelMeta?.defaultCategoryId, selectedCategoryId, visiblePadelCategories]);

  const selectedTicket = useMemo(
    () => ticketTypes.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, ticketTypes],
  );

  const ticketRemaining = useMemo(() => {
    if (!selectedTicket) return null;
    if (selectedTicket.totalQuantity == null) return null;
    return Math.max(selectedTicket.totalQuantity - (selectedTicket.soldQuantity ?? 0), 0);
  }, [selectedTicket]);

  const ticketStatusLabel = useMemo(
    () => resolveTicketStatusLabel(selectedTicket?.status ?? null, ticketRemaining),
    [selectedTicket?.status, ticketRemaining],
  );

  const isFreeTicket = selectedTicket?.price === 0;
  const eventIsActive = useMemo(() => {
    if (!data) return false;
    if (data.status !== "ACTIVE") return false;
    const endsAtMs = data.endsAt ? new Date(data.endsAt).getTime() : null;
    if (endsAtMs == null || Number.isNaN(endsAtMs)) return true;
    return endsAtMs > Date.now();
  }, [data]);
  const maxQuantity = useMemo(() => {
    if (isFreeTicket) return 1;
    if (ticketRemaining == null) return 10;
    return Math.max(1, Math.min(ticketRemaining, 10));
  }, [isFreeTicket, ticketRemaining]);

  useEffect(() => {
    if (ticketQuantity > maxQuantity) setTicketQuantity(maxQuantity);
  }, [maxQuantity, ticketQuantity]);

  useEffect(() => {
    if (isFreeTicket && ticketQuantity !== 1) setTicketQuantity(1);
  }, [isFreeTicket, ticketQuantity]);

  const totalCents = selectedTicket ? selectedTicket.price * ticketQuantity : 0;
  const canInitiateCheckout =
    Boolean(selectedTicket) &&
    hasPurchasableTickets &&
    ticketStatusLabel === "Disponível" &&
    !isLoading &&
    !isError &&
    canAccessInvite &&
    eventIsActive;
  const ctaLabel = isFreeTicket ? "Inscrever-me" : "Comprar";

  const cover = data?.coverImageUrl ?? null;
  const category = data?.categories?.[0] ?? null;
  const date = formatDateRange(data?.startsAt, data?.endsAt);
  const location = data?.location?.formattedAddress || data?.location?.city || null;
  const price =
    typeof data?.priceFrom === "number"
      ? data.priceFrom <= 0
        ? "Grátis"
        : `Desde ${data.priceFrom.toFixed(0)}€`
      : null;
  const description = data?.description ?? data?.shortDescription ?? null;
  const showPreview = isLoading && !data && (eventTitleValue || previewCoverValue || previewDescription);
  const previewDate = previewStartsAt ? formatDateRange(previewStartsAt, previewEndsAt ?? undefined) : date;
  const displayTitle = data?.title ?? eventTitleValue ?? null;
  const displayCategory = data?.categories?.[0] ?? previewCategory ?? category;
  const displayCover = data?.coverImageUrl ?? previewCoverValue ?? cover;
  const displayDescription = data?.shortDescription ?? data?.description ?? previewDescription ?? description;
  const displayLocation = data?.location?.formattedAddress || data?.location?.city || previewLocation || location || null;
  const displayPrice = data ? price : previewPrice ?? price;
  const displayHost = data?.hostName ?? previewHost ?? data?.hostUsername ?? null;
  const hostUsername = data?.hostUsername ?? null;
  const handleHostPress = () => {
    if (hostUsername) {
      router.push(`/${hostUsername}`);
    }
  };
  const displayImageTag = previewImageTag ?? (data?.slug ? `event-${data.slug}` : null);
  const showStickyCTA =
    Boolean(data) && !isLoading && !isError && !isPadelEvent && canAccessInvite && eventIsActive;
  const showFavoriteCTA = showStickyCTA && !hasPurchasableTickets;
  const scrollBottomPadding = showStickyCTA
    ? showFavoriteCTA
      ? insets.bottom + 150
      : insets.bottom + 180
    : 36;
  const shareUrl =
    data?.slug && env.apiBaseUrl ? `${env.apiBaseUrl.replace(/\/$/, "")}/eventos/${data.slug}` : null;
  const mapUrl = useMemo(() => {
    if (!data) return null;
    const lat = data.location?.lat ?? null;
    const lng = data.location?.lng ?? null;
    if (lat != null && lng != null) {
      return `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(data.title ?? "Evento")}`;
    }
    if (location) {
      return `http://maps.apple.com/?q=${encodeURIComponent(location)}`;
    }
    return null;
  }, [data, location]);

  const chatQuery = useEventChatThread(
    data?.id ?? null,
    Boolean(session?.user?.id && data?.id),
    accessToken,
  );
  const inviteQuery = useMessageInvites(
    data?.id ?? null,
    Boolean(session?.user?.id && data?.id),
    accessToken,
  );

  const padelEventId = data?.id ?? null;
  const padelEnabled = isPadelEvent && Boolean(padelEventId);
  const openPairingsQuery = useOpenPairings(padelEventId, activeCategoryId, padelEnabled);
  const myPairingsQuery = useMyPairings(padelEventId, padelEnabled && Boolean(session?.user?.id));
  const liveEnabled = padelEnabled && padelMeta?.competitionState === "PUBLIC";
  const standingsQuery = usePadelStandings(padelEventId, activeCategoryId, liveEnabled, liveEnabled);
  const matchesQuery = usePadelMatches(padelEventId, activeCategoryId, liveEnabled, liveEnabled);

  const chatStatusLabel = useMemo(() => {
    const status = chatQuery.data?.thread.status;
    if (status === "OPEN") return "Chat aberto";
    if (status === "ANNOUNCEMENTS") return "Anúncios";
    if (status === "READ_ONLY") return "Só leitura";
    if (status === "CLOSED") return "Fechado";
    return "Chat indisponível";
  }, [chatQuery.data?.thread.status]);

  const pendingInvite = inviteQuery.data?.items?.[0] ?? null;

  const handleAcceptChatInvite = async () => {
    if (!pendingInvite || inviteAccepting) return;
    setInviteAccepting(true);
    try {
      const result = await acceptMessageInvite(pendingInvite.id, accessToken);
      await Promise.all([chatQuery.refetch(), inviteQuery.refetch()]);
      if (result?.threadId && data?.id) {
        router.push({
          pathname: "/messages/[threadId]",
          params: {
            threadId: result.threadId,
            eventId: String(data.id),
            title: data.title ?? "",
            coverImageUrl: data.coverImageUrl ?? "",
            startsAt: data.startsAt ?? "",
            endsAt: data.endsAt ?? "",
          },
        });
      }
    } catch (err) {
      Alert.alert("Chat", getUserFacingError(err, "Não foi possível aceitar o convite."));
    } finally {
      setInviteAccepting(false);
    }
  };

  const handleShare = async () => {
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
    if (!mapUrl) return;
    try {
      await Linking.openURL(mapUrl);
    } catch {
      // ignore
    }
  };

  const handleCreatePairing = async () => {
    if (!data || !padelMeta) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    if (!activeCategoryId) {
      Alert.alert("Inscrição", "Seleciona uma categoria para continuar.");
      return;
    }
    if (!registrationOpen) {
      Alert.alert("Inscrição", registrationMessage);
      return;
    }
    if (joinMode === "INVITE_PARTNER" && !inviteContact.trim()) {
      Alert.alert("Inscrição", "Indica o parceiro para enviar o convite.");
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
        invitedContact: joinMode === "INVITE_PARTNER" && inviteContact.trim() ? inviteContact.trim() : null,
        isPublicOpen: joinMode === "LOOKING_FOR_PARTNER",
      });
      if (result.waitlist) {
        Alert.alert("Lista de espera", "Entraste na lista de espera. Vamos avisar assim que houver vaga.");
      } else {
        Alert.alert("Dupla criada", "A tua inscrição foi criada com sucesso.");
      }
      await Promise.all([myPairingsQuery.refetch(), openPairingsQuery.refetch()]);
    } catch (err: any) {
      if (err?.message?.includes("PADEL_ONBOARDING_REQUIRED")) {
        Alert.alert("Padel", "Completa o onboarding de Padel para continuar.");
        router.push("/onboarding");
        return;
      }
      Alert.alert("Erro", getUserFacingError(err, "Não foi possível criar a dupla."));
    } finally {
      setPairingBusy(false);
    }
  };

  const handleJoinOpenPairing = async (pairingId: number) => {
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    if (pairingBusy) return;
    setPairingBusy(true);
    try {
      await joinOpenPairing(pairingId);
      Alert.alert("Dupla", "Entraste na dupla com sucesso.");
      await Promise.all([myPairingsQuery.refetch(), openPairingsQuery.refetch()]);
    } catch (err: any) {
      Alert.alert("Dupla", getUserFacingError(err, "Não foi possível juntar-te à dupla."));
    } finally {
      setPairingBusy(false);
    }
  };

  const handleAcceptPairingInvite = async (pairingId: number) => {
    if (pairingActionBusy) return;
    setPairingActionBusy(true);
    try {
      await acceptInvite(pairingId);
      await myPairingsQuery.refetch();
    } catch (err: any) {
      Alert.alert("Convite", getUserFacingError(err, "Não foi possível aceitar o convite."));
    } finally {
      setPairingActionBusy(false);
    }
  };

  const handleDeclinePairingInvite = async (pairingId: number) => {
    if (pairingActionBusy) return;
    setPairingActionBusy(true);
    try {
      await declineInvite(pairingId);
      await myPairingsQuery.refetch();
    } catch (err: any) {
      Alert.alert("Convite", getUserFacingError(err, "Não foi possível recusar o convite."));
    } finally {
      setPairingActionBusy(false);
    }
  };

  const handleSharePairingInvite = async (token: string) => {
    if (!token || !data?.slug || !env.apiBaseUrl) return;
    const baseUrl = env.apiBaseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/eventos/${data.slug}?inviteToken=${encodeURIComponent(token)}`;
    try {
      await Share.share({ message: `${data.title}\n${url}`, url });
    } catch {
      // ignore
    }
  };

  const handlePayPairing = async (pairing: { id: number; categoryId?: number | null }) => {
    if (!data) return;
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    const categoryLink =
      padelCategories.find((category) => category.id === (pairing.categoryId ?? activeCategoryId)) ?? null;
    if (!categoryLink?.linkId) {
      Alert.alert("Inscrição", "Categoria inválida para pagamento.");
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
      const currency = response.breakdown?.currency ?? categoryLink.currency ?? "EUR";
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
            eventTitle: data.title ?? "Torneio",
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
        ticketName: categoryLink.label ?? "Inscrição",
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
        freeCheckout: response.freeCheckout ?? response.isGratisCheckout ?? false,
      });
      router.push("/checkout");
    } catch (err: any) {
      Alert.alert("Pagamento", getUserFacingError(err, "Não foi possível iniciar o pagamento."));
    } finally {
      setPairingActionBusy(false);
    }
  };
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, -24],
    extrapolate: "clamp",
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-120, 0, 220],
    outputRange: [1.1, 1, 0.96],
    extrapolate: "clamp",
  });
  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [130, 220],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <LiquidBackground variant="solid">
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            zIndex: 50,
            top: 40,
            left: 20,
            right: 20,
            opacity: compactHeaderOpacity,
          }}
        >
          <GlassCard intensity={52} padding={10}>
            <View className="flex-row items-center justify-between">
              <Text className="text-white text-sm font-semibold" numberOfLines={1} style={{ flex: 1 }}>
                {data?.title ?? eventTitleValue ?? "Evento"}
              </Text>
              <Ionicons name="sparkles-outline" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
        >
          <View className="px-5 pt-12 pb-4">
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
              <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
            </Pressable>
          </View>

          {showPreview ? (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
              <View className="px-5">
                <View className="overflow-hidden rounded-[28px] border border-white/10">
                  {displayCover ? (
                    <View style={{ height: 260, justifyContent: "space-between" }}>
                      <Image
                        source={{ uri: displayCover }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={240}
                        cachePolicy="memory-disk"
                        priority="high"
                      />
                      <LinearGradient
                        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View className="flex-row items-center justify-between px-4 pt-4">
                        <View className="flex-row items-center gap-2">
                          {displayCategory ? <GlassPill label={displayCategory} /> : null}
                          <GlassPill label={accessBadge.label} variant={accessBadge.variant} />
                        </View>
                      </View>
                      <View className="px-4 pb-4 gap-2">
                        {displayTitle ? (
                          <Text className="text-white text-2xl font-semibold">{displayTitle}</Text>
                        ) : null}
                        {displayDescription ? (
                          <Text className="text-white/75 text-sm">{displayDescription}</Text>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View
                      style={{
                        height: 260,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        justifyContent: "space-between",
                        paddingHorizontal: tokens.spacing.lg,
                        paddingVertical: tokens.spacing.lg,
                      }}
                    >
                        <View className="flex-row items-center gap-2 self-start">
                          {displayCategory ? <GlassPill label={displayCategory} /> : null}
                          <GlassPill label={accessBadge.label} variant={accessBadge.variant} />
                        </View>
                    </View>
                  )}
                </View>

                <View className="pt-6 gap-3">
                  <GlassCard intensity={50}>
                    <View className="gap-3">
                      <Text className="text-white text-sm font-semibold">Informações principais</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {previewDate ? (
                          <View className="flex-row items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2">
                            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                            <Text className="text-white/80 text-xs font-semibold">{previewDate}</Text>
                          </View>
                        ) : null}
                        {displayPrice ? (
                          <View className="flex-row items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2">
                            <Ionicons name="pricetag-outline" size={14} color="rgba(255,255,255,0.85)" />
                            <Text className="text-white text-xs font-semibold">{displayPrice}</Text>
                          </View>
                        ) : null}
                        {displayLocation ? (
                          <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
                            <Text className="text-white/70 text-xs" numberOfLines={1}>
                              {displayLocation}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {displayHost ? (
                        <Pressable
                          onPress={handleHostPress}
                          disabled={!hostUsername}
                          className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Abrir organizador ${displayHost}`}
                          accessibilityState={{ disabled: !hostUsername }}
                        >
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.7)" />
                            <Text className="text-white/80 text-sm">Organizador: {displayHost}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                        </Pressable>
                      ) : null}
                      {mapUrl ? (
                        <Pressable
                          onPress={handleOpenMap}
                          className="self-start rounded-full border border-white/15 bg-white/5 px-3 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Abrir no mapa"
                        >
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.85)" />
                            <Text className="text-white/80 text-xs font-semibold">Abrir no mapa</Text>
                          </View>
                        </Pressable>
                      ) : null}
                    </View>
                  </GlassCard>
                </View>
              </View>
            </Animated.View>
          ) : isLoading ? (
            <View className="px-5 gap-3">
              <GlassSkeleton height={220} />
              <GlassSkeleton height={140} />
              <GlassSkeleton height={120} />
            </View>
          ) : isError || !data ? (
            <View className="px-5">
              <GlassSurface intensity={50}>
                <Text className="text-red-300 text-sm mb-3">
                  {error instanceof ApiError && error.status === 404
                    ? "Evento não encontrado."
                    : "Não foi possível carregar o evento."}
                </Text>
                <Pressable
                  onPress={() => refetch()}
                  className="rounded-xl bg-white/10 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassSurface>
            </View>
          ) : (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
              <View className="px-5">
                <Animated.View
                  style={{
                    transform: [{ translateY: heroTranslate }, { scale: heroScale }],
                  }}
                >
                  <View className="overflow-hidden rounded-[28px] border border-white/10">
                    {cover ? (
                      <View style={{ height: 260, justifyContent: "space-between" }}>
                        <Image
                          source={{ uri: cover }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={260}
                          cachePolicy="memory-disk"
                          priority="high"
                        />
                        <LinearGradient
                          colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <View className="flex-row items-center justify-between px-4 pt-4">
                        <View className="flex-row items-center gap-2">
                          {category ? <GlassPill label={category} /> : null}
                          <GlassPill label={accessBadge.label} variant={accessBadge.variant} />
                          {data.isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                        </View>
                          <GlassPill label={resolveStatusLabel(data.status)} variant="muted" />
                        </View>
                        <View className="px-4 pb-4 gap-2">
                          <Text className="text-white text-2xl font-semibold">{data.title}</Text>
                          {data.shortDescription ? (
                            <Text className="text-white/75 text-sm">{data.shortDescription}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : (
                      <View
                        style={{
                          height: 260,
                          backgroundColor: "rgba(255,255,255,0.08)",
                          justifyContent: "space-between",
                          paddingHorizontal: tokens.spacing.lg,
                          paddingVertical: tokens.spacing.lg,
                        }}
                      >
                        <View className="flex-row items-center gap-2 self-start">
                          {category ? <GlassPill label={category} /> : null}
                          <GlassPill label={accessBadge.label} variant={accessBadge.variant} />
                          {data.isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                        </View>
                        <View className="gap-2">
                          <Text className="text-white text-2xl font-semibold">{data.title}</Text>
                          {data.shortDescription ? (
                            <Text className="text-white/75 text-sm">{data.shortDescription}</Text>
                          ) : null}
                        </View>
                      </View>
                    )}
                  </View>
                </Animated.View>
              </View>

              <View className="px-5 pt-6 gap-4">
                <GlassCard intensity={60}>
                  <View className="gap-3">
                    <Text className="text-white text-sm font-semibold">Informações principais</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {date ? (
                        <View className="flex-row items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2">
                          <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                          <Text className="text-white/80 text-xs font-semibold">{date}</Text>
                        </View>
                      ) : null}
                      {price ? (
                        <View className="flex-row items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2">
                          <Ionicons name="pricetag-outline" size={14} color="rgba(255,255,255,0.85)" />
                          <Text className="text-white text-xs font-semibold">{price}</Text>
                        </View>
                      ) : null}
                      {location ? (
                        <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
                          <Text className="text-white/70 text-xs" numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {displayHost ? (
                      <Pressable
                        onPress={handleHostPress}
                        disabled={!hostUsername}
                        className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget - 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir organizador ${displayHost}`}
                        accessibilityState={{ disabled: !hostUsername }}
                      >
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.7)" />
                          <Text className="text-white/80 text-sm">Organizador: {displayHost}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                      </Pressable>
                    ) : null}
                    {mapUrl ? (
                      <Pressable
                        onPress={handleOpenMap}
                        className="self-start rounded-full border border-white/15 bg-white/5 px-3 py-2"
                        style={{ minHeight: tokens.layout.touchTarget - 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir no mapa"
                      >
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.85)" />
                          <Text className="text-white/80 text-xs font-semibold">Abrir no mapa</Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>

                {description ? (
                  <GlassCard intensity={54}>
                    <View className="gap-2">
                      <Text className="text-white text-sm font-semibold">Sobre o evento</Text>
                      <Text className="text-white/75 text-sm">{description}</Text>
                    </View>
                  </GlassCard>
                ) : null}

                <GlassCard intensity={58}>
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-semibold">Chat do evento</Text>
                      <Text className="text-white/60 text-xs">{chatStatusLabel}</Text>
                    </View>
                    {!session?.user?.id ? (
                      <View className="gap-2">
                        <Text className="text-white/65 text-sm">
                          Inicia sessão para veres o chat dos participantes.
                        </Text>
                        <Pressable
                          onPress={openAuth}
                          className="self-start rounded-full border border-white/15 bg-white/5 px-4 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Entrar"
                        >
                          <Text className="text-white text-xs font-semibold">Entrar</Text>
                        </Pressable>
                      </View>
                    ) : chatQuery.isLoading || inviteQuery.isLoading ? (
                      <Text className="text-white/60 text-sm">A carregar chat...</Text>
                    ) : chatQuery.data ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/messages/[threadId]",
                            params: {
                              threadId: chatQuery.data.thread.id,
                              eventId: String(data?.id ?? ""),
                              title: data?.title ?? "",
                              coverImageUrl: data?.coverImageUrl ?? "",
                              startsAt: data?.startsAt ?? "",
                              endsAt: data?.endsAt ?? "",
                            },
                          })
                        }
                        className="rounded-2xl bg-white/90 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir chat"
                      >
                        <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                          Abrir chat
                        </Text>
                      </Pressable>
                    ) : pendingInvite ? (
                      <View className="gap-2">
                        <Text className="text-white/70 text-sm">
                          Tens um convite para o chat deste evento.
                        </Text>
                        <Pressable
                          onPress={handleAcceptChatInvite}
                          disabled={inviteAccepting}
                          className="rounded-2xl bg-white/90 px-4 py-3 disabled:opacity-60"
                          style={{ minHeight: tokens.layout.touchTarget }}
                          accessibilityRole="button"
                          accessibilityLabel="Aceitar convite"
                        >
                          <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                            {inviteAccepting ? "A aceitar..." : "Aceitar convite"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : chatQuery.isError || !chatQuery.data ? (
                      <Text className="text-white/60 text-sm">
                        Chat disponível apenas para participantes do evento.
                      </Text>
                    ) : null}
                  </View>
                </GlassCard>

                {isInviteOnly ? (
                  <GlassCard intensity={52}>
                    <View className="gap-3">
                      <Text className="text-white text-sm font-semibold">Convite necessário</Text>
                      <Text className="text-white/65 text-sm">
                        Introduz o token ou o email/username do convite para desbloquear o checkout.
                      </Text>
                      <TextInput
                        value={inviteTokenInput}
                        onChangeText={setInviteTokenInput}
                        placeholder="Token de convite"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoCapitalize="none"
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white"
                        accessibilityLabel="Token de convite"
                      />
                      <Pressable
                        onPress={handleInviteCheck}
                        disabled={inviteState.status === "checking"}
                        className="rounded-2xl bg-white/15 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel="Validar convite"
                        accessibilityState={{ disabled: inviteState.status === "checking" }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {inviteState.status === "checking" ? "A validar..." : "Validar convite"}
                        </Text>
                      </Pressable>
                      {inviteState.status === "valid" ? (
                        <GlassPill label="Convite confirmado" variant="accent" />
                      ) : inviteState.status === "invalid" ? (
                        <Text className="text-amber-200 text-xs">
                          {inviteState.message ?? "Convite inválido."}
                        </Text>
                      ) : null}
                      <View className="h-px bg-white/10" />
                      <TextInput
                        value={inviteIdentifierInput}
                        onChangeText={setInviteIdentifierInput}
                        placeholder="Email ou @username"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoCapitalize="none"
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white"
                        accessibilityLabel="Email ou username do convite"
                      />
                      <Pressable
                        onPress={handleInviteIdentifierCheck}
                        disabled={inviteIdentifierState.status === "checking"}
                        className="rounded-2xl bg-white/15 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel="Validar email ou username"
                        accessibilityState={{ disabled: inviteIdentifierState.status === "checking" }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {inviteIdentifierState.status === "checking" ? "A validar..." : "Validar email/username"}
                        </Text>
                      </Pressable>
                      {inviteIdentifierValid ? <GlassPill label="Convite confirmado" variant="accent" /> : null}
                      {inviteIdentifierNeedsLogin ? (
                        <View className="gap-2">
                          <Text className="text-amber-200 text-xs">
                            Convite encontrado. Inicia sessão para continuar.
                          </Text>
                          <Pressable
                            onPress={openAuth}
                            className="self-start rounded-full border border-white/15 bg-white/5 px-4 py-2"
                            style={{ minHeight: tokens.layout.touchTarget - 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Entrar"
                          >
                            <Text className="text-white text-xs font-semibold">Entrar</Text>
                          </Pressable>
                        </View>
                      ) : null}
                      {inviteIdentifierCheckingAccount ? (
                        <Text className="text-white/60 text-xs">A confirmar convite...</Text>
                      ) : inviteIdentifierMismatch ? (
                        <Text className="text-amber-200 text-xs">Convite não corresponde à tua conta.</Text>
                      ) : inviteIdentifierState.status === "not_invited" ? (
                        <Text className="text-amber-200 text-xs">
                          {inviteIdentifierState.message ?? "Convite não encontrado."}
                        </Text>
                      ) : inviteIdentifierState.status === "invalid" ? (
                        <Text className="text-amber-200 text-xs">
                          {inviteIdentifierState.message ?? "Identificador inválido."}
                        </Text>
                      ) : null}
                    </View>
                  </GlassCard>
                ) : null}

                {isPadelEvent ? (
                  <>
                    {gateLocked ? (
                      <GlassCard intensity={50}>
                        <Text className="text-white/70 text-sm">
                          Este torneio é por convite. Introduz o token ou email/username para desbloquear inscrições.
                        </Text>
                      </GlassCard>
                    ) : null}

                    <GlassCard intensity={56}>
                      <View className="gap-3">
                        <Text className="text-white text-sm font-semibold">Resumo do torneio</Text>
                        <Text className="text-white/70 text-sm">{registrationMessage}</Text>
                        {padelMeta?.competitionState ? (
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="trophy-outline" size={16} color="rgba(255,255,255,0.7)" />
                            <Text className="text-white/70 text-sm">
                              Estado: {padelMeta.competitionState}
                            </Text>
                          </View>
                        ) : null}
                        {padelSnapshot?.clubName ? (
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
                            <Text className="text-white/65 text-sm">
                              {padelSnapshot.clubName}
                              {padelSnapshot.clubCity ? ` · ${padelSnapshot.clubCity}` : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </GlassCard>

                    {padelSnapshot?.timeline?.length ? (
                      <GlassCard intensity={52}>
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">Timeline</Text>
                          {padelSnapshot.timeline.map((item) => (
                            <View key={item.key} className="flex-row items-center justify-between">
                              <Text className="text-white/80 text-sm">{item.label}</Text>
                              {item.date && formatDateRange(item.date) ? (
                                <Text className="text-white/55 text-xs">
                                  {formatDateRange(item.date)}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </GlassCard>
                    ) : null}

                    {visiblePadelCategories.length > 0 ? (
                      <GlassCard intensity={54}>
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">Categorias</Text>
                          {visiblePadelCategories.map((category) => {
                            const isSelected = category.id === activeCategoryId;
                            const disabled = !category.isEnabled;
                            return (
                              <Pressable
                                key={`padel-category-${category.linkId ?? category.id}`}
                                onPress={() => setSelectedCategoryId(category.id)}
                                disabled={disabled}
                                className={
                                  isSelected
                                    ? "rounded-2xl border border-white/30 bg-white/15 px-4 py-3"
                                    : "rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                                }
                                style={{ minHeight: tokens.layout.touchTarget }}
                                accessibilityRole="button"
                                accessibilityLabel={category.label ? `Categoria ${category.label}` : "Selecionar categoria"}
                                accessibilityState={{ selected: isSelected, disabled }}
                              >
                                <View className="flex-row items-center justify-between">
                                  <View className="flex-1 pr-4">
                                    {category.label ? (
                                      <Text className="text-white text-sm font-semibold">
                                        {category.label}
                                      </Text>
                                    ) : null}
                                    {category.format ? (
                                      <Text className="text-white/60 text-xs mt-1">{category.format}</Text>
                                    ) : null}
                                  </View>
                                  <GlassPill
                                    label={`${formatTicketPrice(category.pricePerPlayerCents ?? 0, category.currency)} / jogador`}
                                    variant="muted"
                                  />
                                </View>
                                <View className="flex-row items-center justify-between pt-2">
                                  <Text className="text-white/60 text-xs">
                                    {category.capacityTeams ? `${category.capacityTeams} equipas` : "Sem limite"}
                                  </Text>
                                  {disabled ? <GlassPill label="Indisponível" variant="muted" /> : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </GlassCard>
                    ) : null}

                    <GlassCard intensity={56}>
                      <View className="gap-3">
                        <Text className="text-white text-sm font-semibold">Inscrição</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {(["FULL", "SPLIT"] as const).map((mode) => {
                            const active = paymentMode === mode;
                            return (
                              <Pressable
                                key={`mode-${mode}`}
                                onPress={() => setPaymentMode(mode)}
                                className={active ? "rounded-full bg-white/20 px-4 py-2" : "rounded-full border border-white/10 bg-white/5 px-4 py-2"}
                                style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                accessibilityRole="button"
                                accessibilityLabel={resolvePadelPaymentModeLabel(mode)}
                                accessibilityState={{ selected: active }}
                              >
                                <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                                  {resolvePadelPaymentModeLabel(mode)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                          {([
                            { key: "INVITE_PARTNER", label: "Convidar parceiro" },
                            { key: "LOOKING_FOR_PARTNER", label: "Dupla aberta" },
                          ] as const).map((option) => {
                            const active = joinMode === option.key;
                            return (
                              <Pressable
                                key={option.key}
                                onPress={() => setJoinMode(option.key)}
                                className={active ? "rounded-full bg-white/20 px-4 py-2" : "rounded-full border border-white/10 bg-white/5 px-4 py-2"}
                                style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                accessibilityRole="button"
                                accessibilityLabel={option.label}
                                accessibilityState={{ selected: active }}
                              >
                                <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {joinMode === "INVITE_PARTNER" ? (
                          <TextInput
                            value={inviteContact}
                            onChangeText={setInviteContact}
                            placeholder="Email ou @username do parceiro"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            autoCapitalize="none"
                            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white"
                            accessibilityLabel="Email ou username do parceiro"
                          />
                        ) : null}
                        {!session?.user?.id ? (
                          <Pressable
                            onPress={openAuth}
                            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
                            style={{ minHeight: tokens.layout.touchTarget }}
                            accessibilityRole="button"
                            accessibilityLabel="Entrar para inscrever"
                          >
                            <Text className="text-white text-sm font-semibold text-center">Entrar para inscrever</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={handleCreatePairing}
                            disabled={padelActionsDisabled || pairingBusy}
                            className={
                              padelActionsDisabled
                                ? "rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                                : "rounded-2xl bg-white/90 px-4 py-3"
                            }
                            style={{ minHeight: tokens.layout.touchTarget }}
                            accessibilityRole="button"
                            accessibilityLabel="Criar dupla"
                            accessibilityState={{ disabled: padelActionsDisabled || pairingBusy }}
                          >
                            <Text
                              className={`text-center text-sm font-semibold ${
                                padelActionsDisabled ? "text-white/50" : ""
                              }`}
                              style={padelActionsDisabled ? undefined : { color: "#0b101a" }}
                            >
                              {pairingBusy ? "A criar dupla..." : "Criar dupla"}
                            </Text>
                          </Pressable>
                        )}
                        {!registrationOpen ? (
                          <Text className="text-white/60 text-xs">{registrationMessage}</Text>
                        ) : null}
                      </View>
                    </GlassCard>

                    <GlassCard intensity={54}>
                      <View className="gap-3">
                        <Text className="text-white text-sm font-semibold">Duplas abertas</Text>
                        {openPairingsQuery.isLoading ? (
                          <Text className="text-white/60 text-sm">A carregar duplas abertas...</Text>
                        ) : (openPairingsQuery.data ?? []).length === 0 ? (
                          <Text className="text-white/60 text-sm">Sem duplas abertas neste momento.</Text>
                        ) : (
                          (openPairingsQuery.data ?? []).map((pairing) => (
                            <View key={`open-${pairing.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <View className="flex-row items-center justify-between">
                                {pairing.category?.label ? (
                                  <Text className="text-white text-sm font-semibold">
                                    {pairing.category.label}
                                  </Text>
                                ) : null}
                                <Text className="text-white/60 text-xs">
                                  {pairing.openSlots ?? 0} vaga(s)
                                </Text>
                              </View>
                              <View className="flex-row items-center justify-between pt-2">
                                {pairing.deadlineAt && formatDateRange(pairing.deadlineAt) ? (
                                  <Text className="text-white/55 text-xs">
                                    Deadline: {formatDateRange(pairing.deadlineAt)}
                                  </Text>
                                ) : null}
                                <Pressable
                                  onPress={() => handleJoinOpenPairing(pairing.id)}
                                  disabled={padelActionsDisabled || pairingBusy}
                                  className="rounded-full border border-white/15 bg-white/10 px-3 py-2"
                                  style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                  accessibilityRole="button"
                                  accessibilityLabel="Juntar-me"
                                  accessibilityState={{ disabled: padelActionsDisabled || pairingBusy }}
                                >
                                  <Text className="text-white text-xs font-semibold">Juntar-me</Text>
                                </Pressable>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    </GlassCard>

                    <GlassCard intensity={56}>
                      <View className="gap-3">
                        <Text className="text-white text-sm font-semibold">Minha dupla</Text>
                        {!session?.user?.id ? (
                          <Text className="text-white/65 text-sm">Inicia sessão para ver as tuas duplas.</Text>
                        ) : myPairingsQuery.isLoading ? (
                          <Text className="text-white/60 text-sm">A carregar a tua dupla...</Text>
                        ) : (myPairingsQuery.data ?? []).length === 0 ? (
                          <Text className="text-white/60 text-sm">Ainda não tens dupla neste torneio.</Text>
                        ) : (
                          (() => {
                            const pairingIdValue = pairingIdParam ? Number(pairingIdParam) : null;
                            const pairing =
                              (Number.isFinite(pairingIdValue)
                                ? (myPairingsQuery.data ?? []).find((p) => p.id === pairingIdValue)
                                : null) ?? (myPairingsQuery.data ?? [])[0];
                            const unpaidSlot = pairing.slots?.find((slot) => slot.paymentStatus !== "PAID");
                            const canPay = Boolean(unpaidSlot);
                            const invitePending = Boolean(pairing.inviteEligibility && !pairing.inviteEligibility.ok);
                            return (
                              <View className="gap-3">
                                <Text className="text-white/70 text-sm">
                                  {pairing.category?.label ?? "Categoria"} · {resolvePadelPaymentModeLabel(pairing.paymentMode)}
                                </Text>
                                {invitePending ? (
                                  <Text className="text-amber-200 text-xs">
                                    Completa os dados de Padel para aceitar o convite.
                                  </Text>
                                ) : null}
                                <View className="flex-row flex-wrap gap-2">
                                  {pairing.inviteEligibility ? (
                                    <>
                                      <Pressable
                                        onPress={() => handleAcceptPairingInvite(pairing.id)}
                                        disabled={pairingActionBusy}
                                        className="rounded-full bg-white/15 px-4 py-2"
                                        style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Aceitar convite"
                                        accessibilityState={{ disabled: pairingActionBusy }}
                                      >
                                        <Text className="text-white text-xs font-semibold">Aceitar convite</Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() => handleDeclinePairingInvite(pairing.id)}
                                        disabled={pairingActionBusy}
                                        className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
                                        style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Recusar convite"
                                        accessibilityState={{ disabled: pairingActionBusy }}
                                      >
                                        <Text className="text-white/80 text-xs font-semibold">Recusar</Text>
                                      </Pressable>
                                    </>
                                  ) : null}
                                  {pairing.inviteToken ? (
                                    <Pressable
                                      onPress={() => handleSharePairingInvite(pairing.inviteToken ?? "")}
                                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
                                      style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                      accessibilityRole="button"
                                      accessibilityLabel="Partilhar convite"
                                    >
                                      <Text className="text-white/80 text-xs font-semibold">Partilhar convite</Text>
                                    </Pressable>
                                  ) : null}
                                  {canPay ? (
                                    <Pressable
                                      onPress={() => handlePayPairing({ id: pairing.id, categoryId: pairing.categoryId ?? null })}
                                      disabled={pairingActionBusy || padelActionsDisabled}
                                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2"
                                      style={{ minHeight: tokens.layout.touchTarget - 8 }}
                                      accessibilityRole="button"
                                      accessibilityLabel="Pagar inscrição"
                                      accessibilityState={{ disabled: pairingActionBusy || padelActionsDisabled }}
                                    >
                                      <Text className="text-white text-xs font-semibold">Pagar inscrição</Text>
                                    </Pressable>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })()
                        )}
                      </View>
                    </GlassCard>

                    {liveEnabled ? (
                      <GlassCard intensity={54}>
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">Live</Text>
                          {standingsQuery.isLoading ? (
                            <Text className="text-white/60 text-sm">A carregar standings...</Text>
                          ) : Object.keys(standingsQuery.data ?? {}).length === 0 ? (
                            <Text className="text-white/60 text-sm">Sem standings disponíveis.</Text>
                          ) : (
                            Object.entries(standingsQuery.data ?? {}).map(([groupLabel, rows]) => {
                              const rowList = Array.isArray(rows) ? (rows as Array<any>) : [];
                              return (
                                <View key={`standings-${groupLabel}`} className="gap-2">
                                <Text className="text-white/70 text-xs uppercase tracking-[0.12em]">
                                  Grupo {groupLabel}
                                </Text>
                                {rowList.map((row, idx) => {
                                  const label =
                                    row.label ||
                                    (row.players || [])
                                      .map((player) => player?.name || player?.username)
                                      .filter(Boolean)
                                      .join(" / ") ||
                                    `Dupla ${row.pairingId}`;
                                  return (
                                    <View key={`row-${groupLabel}-${row.pairingId}`} className="flex-row items-center justify-between">
                                      <Text className="text-white/80 text-sm">#{idx + 1} · {label}</Text>
                                      <Text className="text-white/60 text-xs">
                                        {row.points} pts · {row.wins}V-{row.losses}D
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                              );
                            })
                          )}
                          <View className="h-px bg-white/10" />
                          {matchesQuery.isLoading ? (
                            <Text className="text-white/60 text-sm">A carregar jogos...</Text>
                          ) : (matchesQuery.data ?? []).length === 0 ? (
                            <Text className="text-white/60 text-sm">Sem jogos disponíveis.</Text>
                          ) : (
                            (matchesQuery.data ?? []).slice(0, 6).map((match: any) => (
                              <View key={`match-${match.id}`} className="gap-1">
                                <Text className="text-white/70 text-xs">
                                  {match.groupLabel ? `Grupo ${match.groupLabel}` : "Jogo"}
                                </Text>
                                <Text className="text-white/80 text-sm">
                                  {resolvePairingLabel(match.pairingA)} vs {resolvePairingLabel(match.pairingB)}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      </GlassCard>
                    ) : null}
                  </>
                ) : (
                  <>
                    {gateLocked ? (
                      <GlassCard intensity={50}>
                        <Text className="text-white/70 text-sm">
                          Evento por convite. Introduz o token ou email/username para ver os bilhetes.
                        </Text>
                      </GlassCard>
                    ) : (
                      <>
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">Bilhetes</Text>
                          {ticketTypes.length === 0 ? (
                            <GlassCard intensity={50}>
                              <Text className="text-white/70 text-sm">
                                Bilhetes a publicar brevemente. Ativa notificações para saber quando abrirem.
                              </Text>
                            </GlassCard>
                          ) : (
                            ticketTypes.map((ticket) => {
                              const remaining =
                                ticket.totalQuantity != null
                                  ? Math.max(ticket.totalQuantity - (ticket.soldQuantity ?? 0), 0)
                                  : null;
                              const statusLabel = resolveTicketStatusLabel(ticket.status ?? null, remaining);
                              const isSelected = ticket.id === selectedTicketId;
                              const disabled = statusLabel === "Esgotado" || statusLabel === "Fechado";
                              const availability =
                                remaining != null
                                  ? remaining <= 6
                                    ? `Últimos ${remaining}`
                                    : `${remaining} disponíveis`
                                  : null;

                              return (
                                <Pressable
                                  key={`ticket-${ticket.id}`}
                                  disabled={disabled}
                                  onPress={() => setSelectedTicketId(ticket.id)}
                                  className={isSelected ? "opacity-100" : "opacity-90"}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Selecionar ${ticket.name}`}
                                  accessibilityState={{ selected: isSelected, disabled }}
                                >
                                  <GlassCard intensity={isSelected ? 68 : 52} highlight={isSelected}>
                                    <View className="gap-3">
                                      <View className="flex-row items-center justify-between">
                                        <View className="flex-1 pr-2">
                                          <Text className="text-white text-base font-semibold" numberOfLines={1}>
                                            {ticket.name}
                                          </Text>
                                          {ticket.description ? (
                                            <Text className="text-white/65 text-xs mt-1" numberOfLines={2}>
                                              {ticket.description}
                                            </Text>
                                          ) : null}
                                        </View>
                                        <GlassPill label={formatTicketPrice(ticket.price, ticket.currency)} variant="muted" />
                                      </View>
                                      <View className="flex-row items-center gap-2">
                                        <GlassPill label={statusLabel} variant={disabled ? "muted" : "accent"} />
                                        {availability ? (
                                          <Text className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                                            {availability}
                                          </Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  </GlassCard>
                                </Pressable>
                              );
                            })
                          )}
                        </View>

                        {selectedTicket && hasPurchasableTickets ? (
                          <GlassCard intensity={60} highlight>
                            <View className="gap-4">
                              <Text className="text-white text-sm font-semibold">Resumo da compra</Text>
                              <View className="flex-row items-center justify-between">
                                <Text className="text-white/70 text-sm">
                                  {selectedTicket.name}
                                </Text>
                                <Text className="text-white text-sm font-semibold">
                                  {formatTicketPrice(selectedTicket.price, selectedTicket.currency)}
                                </Text>
                              </View>
                              <View className="flex-row items-center justify-between">
                                <Text className="text-white/60 text-sm">Quantidade</Text>
                                <View className="flex-row items-center gap-3">
                                  <Pressable
                                    onPress={() => setTicketQuantity((prev) => Math.max(1, prev - 1))}
                                    disabled={maxQuantity <= 1}
                                    className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10"
                                    style={{ minHeight: tokens.layout.touchTarget - 8, opacity: maxQuantity <= 1 ? 0.4 : 1 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Diminuir quantidade"
                                    accessibilityState={{ disabled: maxQuantity <= 1 }}
                                  >
                                    <Ionicons name="remove" size={16} color="rgba(255,255,255,0.75)" />
                                  </Pressable>
                                  <Text className="text-white text-base font-semibold">{ticketQuantity}</Text>
                                  <Pressable
                                    onPress={() => setTicketQuantity((prev) => Math.min(maxQuantity, prev + 1))}
                                    disabled={maxQuantity <= 1}
                                    className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10"
                                    style={{ minHeight: tokens.layout.touchTarget - 8, opacity: maxQuantity <= 1 ? 0.4 : 1 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar quantidade"
                                    accessibilityState={{ disabled: maxQuantity <= 1 }}
                                  >
                                    <Ionicons name="add" size={16} color="rgba(255,255,255,0.85)" />
                                  </Pressable>
                                </View>
                              </View>
                              {isFreeTicket ? (
                                <Text className="text-white/55 text-xs">Limite por pessoa: 1</Text>
                              ) : null}
                              <View className="flex-row items-center justify-between">
                                <Text className="text-white/60 text-sm">Total</Text>
                                <Text className="text-white text-lg font-semibold">
                                  {formatTicketPrice(totalCents, selectedTicket.currency)}
                                </Text>
                              </View>
                              {!session ? (
                                <Text className="text-xs text-amber-200">
                                  Inicia sessão para finalizar a inscrição.
                                </Text>
                              ) : null}
                            </View>
                          </GlassCard>
                        ) : null}
                      </>
                    )}
                  </>
                )}

              </View>
            </Animated.View>
          )}
        </Animated.ScrollView>
        {showStickyCTA ? (
          <StickyCTA>
            {showFavoriteCTA ? (
              <View className="flex-row gap-3">
                <FavoriteToggle eventId={data!.id} variant="button" label="Favoritar" style={{ flex: 1 }} />
                <Pressable
                  onPress={handleShare}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Partilhar"
                >
                  <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.9)" />
                  <Text className="text-white text-sm font-semibold">Partilhar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                disabled={!canInitiateCheckout || initiatingCheckout}
                onPress={async () => {
                  if (!selectedTicket || !canInitiateCheckout || initiatingCheckout) return;
                  if (!session?.user?.id) {
                    openAuth();
                    return;
                  }
                  const idempotencyKey = buildCheckoutIdempotencyKey();
                  if (selectedTicket.price <= 0) {
                    setInitiatingCheckout(true);
                    try {
                      trackEvent("checkout_started", {
                        sourceType: "EVENT_TICKET",
                        eventId: data?.id ?? null,
                        ticketTypeId: selectedTicket.id,
                        paymentScenario: "FREE_CHECKOUT",
                      });
                      const response = await createCheckoutIntent({
                        slug: data!.slug,
                        ticketTypeId: selectedTicket.id,
                        quantity: ticketQuantity,
                        paymentMethod: "card",
                        paymentScenario: "FREE_CHECKOUT",
                        idempotencyKey,
                        inviteToken: inviteToken ?? undefined,
                      });
                      const isFree =
                        response.freeCheckout ||
                        response.isGratisCheckout ||
                        (response.amount ?? 0) <= 0;
                      if (isFree) {
                        router.push({
                          pathname: "/checkout/success",
                          params: {
                            purchaseId: response.purchaseId ?? "",
                            paymentIntentId: response.paymentIntentId ?? "",
                            eventTitle: data?.title ?? displayTitle,
                            slug: data?.slug ?? slugValue ?? "",
                          },
                        });
                        return;
                      }
                      setCheckoutDraft({
                        slug: data!.slug,
                        eventId: data!.id,
                        eventTitle: data!.title,
                        sourceType: "EVENT_TICKET",
                        ticketTypeId: selectedTicket.id,
                        ticketName: selectedTicket.name,
                        quantity: ticketQuantity,
                        unitPriceCents: selectedTicket.price,
                        totalCents: response.breakdown?.totalCents ?? totalCents,
                        currency: response.currency ?? selectedTicket.currency ?? "EUR",
                        paymentMethod: "card",
                        paymentScenario: "FREE_CHECKOUT",
                        inviteToken: inviteToken ?? null,
                        idempotencyKey,
                      });
                      setCheckoutIntent({
                        clientSecret: response.clientSecret ?? null,
                        paymentIntentId: response.paymentIntentId ?? null,
                        purchaseId: response.purchaseId ?? null,
                        breakdown: response.breakdown ?? null,
                        freeCheckout: response.freeCheckout ?? response.isGratisCheckout ?? false,
                      });
                      router.push("/checkout");
                    } catch (err) {
                      Alert.alert("Erro", getUserFacingError(err, "Não foi possível concluir a inscrição."));
                    } finally {
                      setInitiatingCheckout(false);
                    }
                    return;
                  }
                  trackEvent("checkout_started", {
                    sourceType: "EVENT_TICKET",
                    eventId: data?.id ?? null,
                    ticketTypeId: selectedTicket.id,
                    paymentScenario: "SINGLE",
                  });
                  setCheckoutDraft({
                    slug: data!.slug,
                    eventId: data!.id,
                    eventTitle: data!.title,
                    sourceType: "EVENT_TICKET",
                    ticketTypeId: selectedTicket.id,
                    ticketName: selectedTicket.name,
                    quantity: ticketQuantity,
                    unitPriceCents: selectedTicket.price,
                    totalCents,
                    currency: selectedTicket.currency ?? "EUR",
                    paymentMethod: "card",
                    paymentScenario: "SINGLE",
                    inviteToken: inviteToken ?? null,
                    idempotencyKey,
                  });
                  router.push("/checkout");
                }}
                className={
                  canInitiateCheckout
                    ? "rounded-2xl bg-white/90 px-4 py-4"
                    : "rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                }
                style={{ minHeight: tokens.layout.touchTarget, alignItems: "center", justifyContent: "center" }}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                accessibilityState={{ disabled: !canInitiateCheckout || initiatingCheckout }}
              >
                {initiatingCheckout ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color="#0b101a" />
                    <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                      A confirmar...
                    </Text>
                  </View>
                ) : (
                  <Text
                    className={`text-center text-sm font-semibold ${canInitiateCheckout ? "" : "text-white/50"}`}
                    style={canInitiateCheckout ? { color: "#0b101a" } : undefined}
                  >
                    {ctaLabel}
                  </Text>
                )}
              </Pressable>
            )}
            {!session?.user?.id && !showFavoriteCTA ? (
              <Text className="text-white/55 text-xs text-center">
                Inicia sessão para continuar.
              </Text>
            ) : null}
          </StickyCTA>
        ) : null}
      </LiquidBackground>
    </>
  );
}
