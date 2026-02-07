import { Link, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, InteractionManager } from "react-native";
import { BlurView } from "expo-blur";
import { PublicEventCard, tokens } from "@orya/shared";
import { FavoriteToggle } from "./FavoriteToggle";
import { formatDistanceKm } from "../../lib/geo";
import { GlassSkeleton } from "../glass/GlassSkeleton";
import { getDominantTint, getFallbackTint } from "../../lib/imageTint";
import MaskedView from "@react-native-masked-view/masked-view";

type EventCardSquareProps = {
  event: PublicEventCard;
  index?: number;
  userLat?: number | null;
  userLon?: number | null;
  statusTag?: string | null;
  showFavorite?: boolean;
};

type PriceState = {
  label: string;
  isSoon: boolean;
};

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
});

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatDate = (startsAt?: string, endsAt?: string) => {
  if (!startsAt) return "Data por anunciar";
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const date = EVENT_DATE_FORMATTER.format(start);
    const time = EVENT_TIME_FORMATTER.format(start);
    if (!end || Number.isNaN(end.getTime())) return `${date} · ${time}`;
    const endTime = EVENT_TIME_FORMATTER.format(end);
    return `${date} · ${time}-${endTime}`;
  } catch {
    return "Data por anunciar";
  }
};

const resolvePriceState = (event: PublicEventCard): PriceState => {
  if (event.isGratis) return { label: "Grátis", isSoon: false };
  if (typeof event.priceFrom === "number") return { label: `Desde ${event.priceFrom.toFixed(0)}€`, isSoon: false };
  const ticketTypes = event.ticketTypes ?? [];
  const hasUpcoming = ticketTypes.some((ticket) => ticket.status === "UPCOMING");
  const hasTickets = ticketTypes.length > 0;
  if (hasUpcoming) return { label: "Bilhetes em breve", isSoon: true };
  if (hasTickets) return { label: "Bilhetes em breve", isSoon: true };
  return { label: "Preço em breve", isSoon: true };
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
}: EventCardSquareProps) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(10)).current;

  const rawCategory = event.categories?.[0];
  const category = (
    rawCategory && rawCategory !== "OTHER" && rawCategory !== "GERAL"
      ? rawCategory
      : "EVENTO"
  ).toUpperCase();
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
    "Local a anunciar";
  const date = formatDate(event.startsAt, event.endsAt);
  const priceState = resolvePriceState(event);
  const secondaryTag = statusTag ?? priceState.label;
  const showHeart = showFavorite ?? true;
  const distanceLabel = formatDistanceKm(
    event.location?.lat ?? null,
    event.location?.lng ?? null,
    userLat ?? null,
    userLon ?? null,
  );
  const overlayHeight = "32%";

  const linkHref = useMemo(
    () => ({
      pathname: "/event/[slug]" as const,
      params: {
        slug: event.slug ?? "",
        source: "discover",
        eventTitle: event.title,
        coverImageUrl: event.coverImageUrl ?? "",
        shortDescription: event.shortDescription ?? "",
        startsAt: event.startsAt ?? "",
        endsAt: event.endsAt ?? "",
        locationLabel: location,
        priceLabel: priceState.label,
        categoryLabel: category,
        hostName: event.hostName ?? event.hostUsername ?? "ORYA",
        imageTag: event.slug ? `event-${event.slug}` : undefined,
      },
    }),
    [category, event, location, priceState.label],
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
    <Link href={linkHref} asChild push>
      <Pressable
        onPressIn={() => {
          Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 7 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
        }}
        onPress={() => router.prefetch?.(linkHref)}
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
                  transition={220}
                  cachePolicy="memory-disk"
                  sharedTransitionTag={event.slug ? `event-${event.slug}` : undefined}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
              )}
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
                <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              </MaskedView>
              <LinearGradient
                colors={[
                  withAlpha(tint, 0.0),
                  withAlpha(tint, 0.5),
                  withAlpha(tint, 0.9),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.bottomGradient, { height: overlayHeight }]}
              />
              <View style={styles.tagsRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{category}</Text>
                </View>
                <View style={[styles.tag, priceState.isSoon ? styles.tagSoon : null]}>
                  <Text style={styles.tagText}>{secondaryTag}</Text>
                </View>
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
                  <Text style={styles.overlayMeta} numberOfLines={1}>
                    {date}
                  </Text>
                  <Text style={styles.overlayMetaMuted} numberOfLines={1}>
                    · {priceState.label}
                  </Text>
                </View>
                <Text style={styles.overlayMetaMuted} numberOfLines={1}>
                  {location}
                  {distanceLabel ? ` · ${distanceLabel}` : ""}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Link>
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
  },
  tagSoon: {
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderColor: "rgba(210, 230, 255, 0.4)",
  },
  tagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
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
