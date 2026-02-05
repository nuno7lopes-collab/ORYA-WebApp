import { Link, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { PublicEventCard, tokens } from "@orya/shared";
import { FavoriteToggle } from "./FavoriteToggle";
import { formatDistanceKm } from "../../lib/geo";
import { GlassSkeleton } from "../glass/GlassSkeleton";

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

  const category = (event.categories?.[0] ?? "EVENTO").toUpperCase();
  const cover = event.coverImageUrl ?? null;
  const location = event.location?.city ?? event.location?.name ?? "Local a anunciar";
  const date = formatDate(event.startsAt, event.endsAt);
  const priceState = resolvePriceState(event);
  const secondaryTag = statusTag ?? priceState.label;
  const showHeart = showFavorite ?? priceState.isSoon;
  const distanceLabel = formatDistanceKm(
    event.location?.lat ?? null,
    event.location?.lng ?? null,
    userLat ?? null,
    userLon ?? null,
  );

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
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
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
                  <FavoriteToggle eventId={event.id} />
                </View>
              ) : null}
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {date}
              </Text>
              <Text style={styles.metaMuted} numberOfLines={1}>
                {location}
                {distanceLabel ? ` · ${distanceLabel}` : ""}
              </Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  tagSoon: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderColor: "rgba(210, 230, 255, 0.35)",
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
  info: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  meta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  metaMuted: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
});
