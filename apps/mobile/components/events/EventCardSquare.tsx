import { Link, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, InteractionManager, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { PublicEventCard, tokens, useTranslation } from "@orya/shared";
import { FavoriteToggle } from "./FavoriteToggle";
import { formatDistanceKm } from "../../lib/geo";
import { GlassSkeleton } from "../glass/GlassSkeleton";
import { getDominantTint, getFallbackTint } from "../../lib/imageTint";
import MaskedView from "@react-native-masked-view/masked-view";
import { EventFeedbackSheet } from "./EventFeedbackSheet";
import { sendEventSignal } from "../../features/events/signals";
import { formatCurrency, formatDate, formatTime } from "../../lib/formatters";

const USE_GLASS_BLUR = Platform.OS === "ios";
const CARD_IMAGE_TRANSITION_MS = Platform.OS === "android" ? 110 : 170;

type EventCardSquareProps = {
  event: PublicEventCard;
  index?: number;
  userLat?: number | null;
  userLon?: number | null;
  statusTag?: string | null;
  showFavorite?: boolean;
  showCountdown?: boolean;
  source?: string;
  onHide?: (payload: { eventId: number; scope: "event" | "category" | "org"; tag?: string | null }) => void;
};

type PriceState = {
  label: string;
  isSoon: boolean;
};

const formatEventDate = (startsAt?: string, endsAt?: string): string | null => {
  if (!startsAt) return null;
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const date = formatDate(start, { day: "2-digit", month: "short" });
    const time = formatTime(start, { hour: "2-digit", minute: "2-digit" });
    if (!end || Number.isNaN(end.getTime())) return `${date} · ${time}`;
    const endTime = formatTime(end, { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}-${endTime}`;
  } catch {
    return null;
  }
};

const formatCountdown = (ms: number) => {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const resolvePriceState = (event: PublicEventCard, t: (key: string, options?: any) => string): PriceState | null => {
  if (event.isGratis) return { label: t("common:price.free"), isSoon: false };
  if (typeof event.priceFrom === "number") {
    return { label: t("common:price.from", { price: formatCurrency(event.priceFrom, "EUR") }), isSoon: false };
  }
  const ticketTypes = event.ticketTypes ?? [];
  const hasUpcoming = ticketTypes.some((ticket) => ticket.status === "UPCOMING");
  const hasTickets = ticketTypes.length > 0;
  if (hasUpcoming) return { label: t("common:price.ticketsSoon"), isSoon: true };
  if (hasTickets) return { label: t("common:price.ticketsSoon"), isSoon: true };
  return null;
};

const resolveCountdownTag = (
  event: PublicEventCard,
  now: number,
  t: (key: string, options?: any) => string,
): string | null => {
  const startsAtMs = event.startsAt ? new Date(event.startsAt).getTime() : null;
  const endsAtMs = event.endsAt ? new Date(event.endsAt).getTime() : null;
  if (startsAtMs && startsAtMs > now) {
    return t("common:time.startsIn", { value: formatCountdown(startsAtMs - now) });
  }
  if (endsAtMs && endsAtMs > now) {
    return t("common:time.endsIn", { value: formatCountdown(endsAtMs - now) });
  }
  if (startsAtMs && startsAtMs <= now && (!endsAtMs || endsAtMs > now)) {
    return t("common:status.live");
  }
  return null;
};

const resolveStatusTag = (status: PublicEventCard["status"] | undefined, t: (key: string) => string) => {
  if (status === "CANCELLED") return t("events:status.cancelled");
  if (status === "PAST") return t("events:status.ended");
  if (status === "DRAFT") return t("events:status.draft");
  return null;
};

const withAlpha = (color: string, alpha: number) => {
  const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const hslaMatch = color.match(/hsla?\(([^)]+)\)/i);
  if (hslaMatch) {
    const parts = hslaMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const [h, s, l] = parts;
      return `hsla(${h}, ${s}, ${l}, ${alpha})`;
    }
  }
  return `rgba(12, 16, 24, ${alpha})`;
};

export const EventCardSquare = memo(function EventCardSquare({
  event,
  index = 0,
  userLat,
  userLon,
  statusTag,
  showFavorite,
  showCountdown,
  source,
  onHide,
}: EventCardSquareProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(10)).current;
  const [now, setNow] = useState(() => Date.now());
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const rawCategory = event.categories?.[0];
  const category = useMemo(() => {
    if (rawCategory === "PADEL") return t("events:labels.padel");
    if (rawCategory && rawCategory !== "OTHER" && rawCategory !== "GERAL") return rawCategory;
    return t("events:labels.event");
  }, [rawCategory, t]).toUpperCase();
  const cover = event.coverImageUrl ?? null;
  const tintSeed = useMemo(
    () => cover ?? event.slug ?? event.title ?? "orya",
    [cover, event.slug, event.title],
  );
  const fallbackTint = useMemo(() => getFallbackTint(tintSeed), [tintSeed]);
  const [tint, setTint] = useState(fallbackTint);
  const location =
    event.location?.formattedAddress ??
    event.location?.city ??
    event.location?.name ??
    null;
  const date = formatEventDate(event.startsAt, event.endsAt);
  const priceState = resolvePriceState(event, t);
  const countdownTag = showCountdown ? resolveCountdownTag(event, now, t) : null;
  const liveLabel = t("common:status.live");
  const isLive = countdownTag === liveLabel;
  const livePulse = useRef(new Animated.Value(1)).current;
  const statusBadge = resolveStatusTag(event.status, t) ?? statusTag ?? null;
  const showStatusBadge =
    statusBadge && (event.status === "CANCELLED" || event.status === "PAST" || event.status === "DRAFT");
  const secondaryTag = showStatusBadge ? statusBadge : countdownTag ?? statusTag ?? priceState?.label ?? null;
  const showHeart = showFavorite ?? true;
  const distanceLabel = formatDistanceKm(
    event.location?.lat ?? null,
    event.location?.lng ?? null,
    userLat ?? null,
    userLon ?? null,
  );
  const overlayHeight = "44%";

  const linkHref = useMemo(
    () => ({
      pathname: "/event/[slug]" as const,
      params: {
        slug: event.slug ?? "",
        source: source ?? "discover",
        eventTitle: event.title,
        coverImageUrl: event.coverImageUrl ?? "",
        shortDescription: event.shortDescription ?? "",
        startsAt: event.startsAt ?? "",
        endsAt: event.endsAt ?? "",
        locationLabel: location ?? "",
        priceLabel: priceState?.label ?? "",
        categoryLabel: category,
        hostName: event.hostName ?? event.hostUsername ?? "ORYA",
        imageTag: event.slug ? `event-${event.slug}` : undefined,
      },
    }),
    [category, event, location, priceState?.label, source],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: tokens.motion.normal,
        delay: Math.min(index, 8) * 30,
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, index, translate]);

  useEffect(() => {
    if (!showCountdown) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, [showCountdown]);

  useEffect(() => {
    if (!isLive) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isLive, livePulse]);

  useEffect(() => {
    let active = true;
    setTint(fallbackTint);
    if (!cover) return () => {
      active = false;
    };
    const task = InteractionManager.runAfterInteractions(() => {
      const startedAt = Date.now();
      getDominantTint(cover, tintSeed)
        .then((resolved) => {
          if (active) setTint(resolved);
          if (__DEV__) {
            const duration = Date.now() - startedAt;
            if (duration > 120) {
              console.info(`[perf] dominantTint ${duration}ms ${event.slug ?? ""}`);
            }
          }
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      task?.cancel?.();
    };
  }, [cover, fallbackTint, tintSeed]);

  return (
    <>
      <Link href={linkHref} asChild push>
        <Pressable
          onPressIn={() => {
            Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 7 }).start();
          }}
          onPressOut={() => {
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
          }}
          onPress={() => {
            InteractionManager.runAfterInteractions(() => {
              sendEventSignal({ eventId: event.id, signalType: "CLICK" });
              router.prefetch?.(linkHref);
            });
          }}
          onLongPress={() => setFeedbackVisible(true)}
          delayLongPress={260}
          accessibilityRole="button"
          accessibilityLabel={`Abrir evento ${event.title}`}
        >
          <Animated.View
            style={{
              opacity: fade,
              transform: [{ translateY: translate }, { scale }],
            }}
          >
            <View style={styles.card}>
              <View style={styles.media}>
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={CARD_IMAGE_TRANSITION_MS}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                )}
                {USE_GLASS_BLUR ? (
                  <MaskedView
                    style={[styles.bottomMask, { height: overlayHeight }]}
                    maskElement={
                      <LinearGradient
                        colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    }
                  >
                    <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                  </MaskedView>
                ) : (
                  <LinearGradient
                    colors={["rgba(8,10,16,0.04)", "rgba(8,10,16,0.3)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.bottomMask, styles.bottomMaskFallback, { height: overlayHeight }]}
                    pointerEvents="none"
                  />
                )}
                <LinearGradient
                  colors={[
                    withAlpha(tint, 0.0),
                    withAlpha(tint, 0.55),
                    withAlpha(tint, 0.95),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.bottomGradient, { height: overlayHeight }]}
                />
                <View style={styles.tagsRow}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{category}</Text>
                  </View>
                  {secondaryTag ? (
                    <View style={[styles.tag, priceState?.isSoon ? styles.tagSoon : null, isLive ? styles.tagLive : null]}>
                      {isLive ? (
                        <Animated.View style={[styles.liveDot, { opacity: livePulse, transform: [{ scale: livePulse }] }]} />
                      ) : null}
                      <Text style={styles.tagText}>{secondaryTag}</Text>
                    </View>
                  ) : null}
                </View>
                {showHeart ? (
                  <View style={styles.heart}>
                    <FavoriteToggle eventId={event.id} style={styles.heartButton} />
                  </View>
                ) : null}
                <View style={[styles.overlay, { height: overlayHeight }]}>
                  <Text style={styles.overlayTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <View style={styles.overlayRow}>
                    {date ? (
                      <Text style={styles.overlayMeta} numberOfLines={1}>
                        {date}
                      </Text>
                    ) : null}
                    {priceState?.label ? (
                      <Text style={styles.overlayMetaMuted} numberOfLines={1}>
                        {date ? `· ${priceState.label}` : priceState.label}
                      </Text>
                    ) : null}
                  </View>
                  {location ? (
                    <Text style={styles.overlayMetaMuted} numberOfLines={1}>
                      {location}
                      {distanceLabel ? ` · ${distanceLabel}` : ""}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Link>
      <EventFeedbackSheet
        visible={feedbackVisible}
        event={event}
        onClose={() => setFeedbackVisible(false)}
        onHide={onHide}
      />
    </>
  );
});

export const EventCardSquareSkeleton = () => (
  <View style={{ marginBottom: 16 }}>
    <GlassSkeleton height={220} />
    <View style={{ height: 10 }} />
    <GlassSkeleton height={64} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8, 12, 20, 0.55)",
    overflow: "hidden",
    marginBottom: 16,
  },
  media: {
    width: "100%",
    aspectRatio: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bottomMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: tokens.radius.xl,
    borderBottomRightRadius: tokens.radius.xl,
    overflow: "hidden",
  },
  bottomMaskFallback: {
    opacity: 0.95,
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: tokens.radius.xl,
    borderBottomRightRadius: tokens.radius.xl,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "flex-end",
    gap: 4,
  },
  overlayTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  overlayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  overlayMeta: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayMetaMuted: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tagsRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tagSoon: {
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderColor: "rgba(210, 230, 255, 0.4)",
  },
  tagLive: {
    borderColor: "rgba(255, 120, 120, 0.55)",
  },
  tagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff6464",
  },
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  heartButton: {
    backgroundColor: "rgba(10, 14, 24, 0.72)",
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
});
