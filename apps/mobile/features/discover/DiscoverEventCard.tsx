import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { Ionicons } from "../../components/icons/Ionicons";
import { PublicEventCard, tokens } from "@orya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { DiscoverServiceCard } from "./types";
import { fetchEventDetail } from "../events/api";
import { fetchServiceDetail } from "../services/api";
import { getDominantTint, getFallbackTint } from "../../lib/imageTint";

type Props = {
  item: PublicEventCard | DiscoverServiceCard;
  itemType?: "event" | "service";
  variant?: "feed" | "featured";
  index?: number;
  userLat?: number | null;
  userLon?: number | null;
};

const isServiceCard = (item: PublicEventCard | DiscoverServiceCard): item is DiscoverServiceCard => {
  return "durationMinutes" in item;
};

const formatEventPrice = (item: PublicEventCard): string => {
  if (item.isGratis) return "Gratis";
  if (typeof item.priceFrom === "number") return `Desde ${item.priceFrom.toFixed(0)} EUR`;
  const ticketPrices = item.ticketTypes
    ? item.ticketTypes
        .map((ticket) => (typeof ticket.price === "number" ? ticket.price : null))
        .filter((price): price is number => price !== null)
    : [];
  if (ticketPrices.length > 0) {
    const min = Math.min(...ticketPrices) / 100;
    const max = Math.max(...ticketPrices) / 100;
    if (min === max) return `${min.toFixed(0)} EUR`;
    return `Desde ${min.toFixed(0)} EUR`;
  }
  return "Preco em breve";
};

const formatServicePrice = (item: DiscoverServiceCard): string => {
  if (item.unitPriceCents <= 0) return "Gratis";
  const amount = item.unitPriceCents / 100;
  const currency = item.currency?.toUpperCase() || "EUR";
  return `${amount.toFixed(0)} ${currency}`;
};

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatDateRange = (startsAt?: string, endsAt?: string): string => {
  if (!startsAt) return "Data por anunciar";
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;

    const date = EVENT_DATE_FORMATTER.format(start);
    const startTime = EVENT_TIME_FORMATTER.format(start);

    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;

    const endTime = EVENT_TIME_FORMATTER.format(end);

    return `${date} · ${startTime}-${endTime}`;
  } catch {
    return "Data por anunciar";
  }
};

const formatRelativeStart = (startsAt?: string): string | null => {
  if (!startsAt) return null;
  try {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return null;

    const now = new Date();
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Amanha";
    if (diffDays > 1 && diffDays <= 6) return `Em ${diffDays} dias`;
    if (diffDays < 0) return "Ja passou";
    return null;
  } catch {
    return null;
  }
};

const formatServiceRelativeStart = (nextAvailability?: string | null): string | null => {
  if (!nextAvailability) return null;
  try {
    const next = new Date(nextAvailability);
    if (Number.isNaN(next.getTime())) return null;

    const now = new Date();
    const diffMs = next.getTime() - now.getTime();
    if (diffMs <= 0) return "Disponivel";

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours < 1) return "Hoje";
    if (diffHours < 24) return `Em ${diffHours}h`;
    return formatRelativeStart(nextAvailability);
  } catch {
    return null;
  }
};

const resolveStatusLabel = (status?: PublicEventCard["status"]) => {
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

const resolveServiceKind = (kind: DiscoverServiceCard["kind"]): string => {
  switch (kind) {
    case "COURT":
      return "PADEL";
    case "CLASS":
      return "AULA";
    default:
      return "SERVICO";
  }
};

const formatServiceNextAvailability = (nextAvailability?: string | null): string => {
  if (!nextAvailability) return "Sem horarios proximos";
  return formatDateRange(nextAvailability);
};

const isLiveNow = (item: PublicEventCard): boolean => {
  if (!item.startsAt || !item.endsAt) return false;
  const start = new Date(item.startsAt).getTime();
  const end = new Date(item.endsAt).getTime();
  const now = Date.now();
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
};

const formatDistanceKm = (
  lat?: number | null,
  lng?: number | null,
  userLat?: number | null,
  userLng?: number | null,
) => {
  if (lat == null || lng == null || userLat == null || userLng == null) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat - userLat);
  const dLng = toRad(lng - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = 6371 * c;
  if (!Number.isFinite(distance)) return null;
  if (distance < 1) return "<1 km";
  if (distance < 10) return `${distance.toFixed(1)} km`;
  return `${Math.round(distance)} km`;
};

const resolveTicketAvailability = (ticketTypes?: PublicEventCard["ticketTypes"]) => {
  if (!ticketTypes || ticketTypes.length === 0) return null;
  const totals = ticketTypes
    .filter((ticket) => typeof ticket.totalQuantity === "number")
    .map((ticket) => ({
      total: ticket.totalQuantity ?? 0,
      sold: ticket.soldQuantity ?? 0,
    }));
  if (totals.length === 0) return null;
  const totalQuantity = totals.reduce((acc, item) => acc + item.total, 0);
  const soldQuantity = totals.reduce((acc, item) => acc + item.sold, 0);
  const remaining = Math.max(totalQuantity - soldQuantity, 0);
  if (remaining === 0) return "Esgotado";
  if (remaining <= 8) return `Últimos ${remaining}`;
  return `${remaining}+ lugares`;
};

const resolveTicketSummary = (ticketTypes?: PublicEventCard["ticketTypes"]) => {
  if (!ticketTypes || ticketTypes.length === 0) return null;
  const sorted = [...ticketTypes].sort((a, b) => {
    const orderDelta = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return (a.price ?? 0) - (b.price ?? 0);
  });
  const names = sorted.map((ticket) => ticket.name).filter(Boolean);
  if (names.length === 0) return null;
  const primaryNames = names.slice(0, 2).join(" · ");
  const extraCount = Math.max(names.length - 2, 0);
  const label = extraCount > 0 ? `${primaryNames} +${extraCount}` : primaryNames;

  const prices = sorted
    .map((ticket) => (typeof ticket.price === "number" ? ticket.price : null))
    .filter((price): price is number => price !== null);
  const currency =
    sorted.find((ticket) => ticket.currency)?.currency?.toUpperCase() || "EUR";
  const minPrice = prices.length > 0 ? Math.min(...prices) / 100 : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) / 100 : null;
  const priceLabel =
    minPrice !== null && maxPrice !== null
      ? minPrice === maxPrice
        ? `${minPrice.toFixed(0)} ${currency}`
        : `${minPrice.toFixed(0)}–${maxPrice.toFixed(0)} ${currency}`
      : null;

  return {
    label,
    priceLabel,
    count: names.length,
  };
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

const resolveAttendanceSummary = (ticketTypes?: PublicEventCard["ticketTypes"]) => {
  if (!ticketTypes || ticketTypes.length === 0) return null;
  const totals = ticketTypes
    .filter((ticket) => typeof ticket.soldQuantity === "number")
    .map((ticket) => ({
      total: ticket.totalQuantity ?? null,
      sold: ticket.soldQuantity ?? 0,
    }));
  if (totals.length === 0) return null;
  const sold = totals.reduce((acc, item) => acc + item.sold, 0);
  const total = totals.reduce((acc, item) => acc + (item.total ?? 0), 0);
  if (sold <= 0) return null;
  if (total > 0) return `${sold}/${total} inscritos`;
  return `${sold}+ inscritos`;
};

export const DiscoverEventCard = memo(function DiscoverEventCard({
  item,
  itemType,
  variant = "feed",
  index = 0,
  userLat,
  userLon,
}: Props) {
  const isFeatured = variant === "featured";
  const isService = itemType ? itemType === "service" : isServiceCard(item);
  const event = !isService ? (item as PublicEventCard) : null;
  const service = isService ? (item as DiscoverServiceCard) : null;

  const category = useMemo(() => {
    if (service) {
      return service.categoryTag?.trim() || resolveServiceKind(service.kind);
    }
    return event?.categories?.[0] ?? "EVENTO";
  }, [event, service]);

  const title = service ? service.title : event?.title ?? "Oferta";
  const serviceAddress =
    service?.addressRef?.formattedAddress ??
    service?.organization?.addressRef?.formattedAddress ??
    null;
  const location = service
    ? serviceAddress || "Local a anunciar"
    : event?.location?.formattedAddress ??
        event?.location?.city ??
        event?.location?.name ??
        "Local a anunciar";
  const date = service
    ? formatServiceNextAvailability(service.nextAvailability)
    : formatDateRange(event?.startsAt, event?.endsAt);

  const isHighlighted = !isService && Boolean(event?.isHighlighted);
  const liveNow = !isService && event ? isLiveNow(event) : false;
  const relativeStart = isService
    ? formatServiceRelativeStart(service?.nextAvailability)
    : formatRelativeStart(event?.startsAt);

  const host = service
    ? service.organization.publicName || service.organization.businessName || "ORYA"
    : event?.hostName ?? event?.hostUsername ?? "ORYA";

  const durationLabel = service ? `${service.durationMinutes} min` : null;
  const instructorLabel = service?.instructor?.fullName || service?.instructor?.username || null;
  const serviceCover = service?.organization?.brandingAvatarUrl || service?.instructor?.avatarUrl || null;
  const coverImage = isService ? serviceCover : event?.coverImageUrl ?? null;
  const tintSeed = useMemo(
    () => coverImage ?? event?.slug ?? service?.id ?? title ?? "orya",
    [coverImage, event?.slug, service?.id, title],
  );
  const fallbackTint = useMemo(() => getFallbackTint(tintSeed), [tintSeed]);
  const [tint, setTint] = useState(fallbackTint);
  const transitionTag = isService
    ? service?.id
      ? `service-${service.id}`
      : null
    : event?.slug
      ? `event-${event.slug}`
      : null;

  const scale = useRef(new Animated.Value(1)).current;
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealTranslate = useRef(new Animated.Value(14)).current;
  const queryClient = useQueryClient();
  const router = useRouter();
  const cardHeight = isFeatured ? 190 : 168;
  const overlayHeight = Math.round(cardHeight * (isFeatured ? 0.3 : 0.25));

  const cardPrice = useMemo(
    () =>
      isService
        ? service
          ? formatServicePrice(service)
          : "Preco em breve"
        : event
          ? formatEventPrice(event)
          : "Preco em breve",
    [event, isService, service],
  );
  const statusLabel = useMemo(
    () => (isService ? "Disponivel" : resolveStatusLabel(event?.status)),
    [event?.status, isService],
  );
  const distanceLabel = useMemo(() => {
    if (isService || !event?.location) return null;
    return formatDistanceKm(
      event.location.lat ?? null,
      event.location.lng ?? null,
      userLat ?? null,
      userLon ?? null,
    );
  }, [event?.location, isService, userLat, userLon]);
  const availabilityLabel = useMemo(() => {
    if (isService) return null;
    return resolveTicketAvailability(event?.ticketTypes) ?? (event?.isGratis ? "Entrada livre" : null);
  }, [event?.isGratis, event?.ticketTypes, isService]);
  const ticketSummary = useMemo(
    () => (!isService ? resolveTicketSummary(event?.ticketTypes) : null),
    [event?.ticketTypes, isService],
  );
  const attendanceLabel = useMemo(
    () => (!isService ? resolveAttendanceSummary(event?.ticketTypes) : null),
    [event?.ticketTypes, isService],
  );

  const eventPreviewParams = useMemo(
    () =>
      event
        ? {
            slug: event.slug ?? "",
            source: "discover",
            eventTitle: title,
            coverImageUrl: event.coverImageUrl ?? "",
            shortDescription: event.shortDescription ?? "",
            startsAt: event.startsAt ?? "",
            endsAt: event.endsAt ?? "",
            locationLabel: location,
            priceLabel: cardPrice,
            categoryLabel: category,
            hostName: host,
            ...(transitionTag ? { imageTag: transitionTag } : {}),
          }
        : undefined,
    [event, title, location, cardPrice, category, host, transitionTag],
  );

  const servicePreviewParams = useMemo(
    () =>
      service
        ? {
            id: String(service.id ?? ""),
            source: "discover",
            serviceTitle: title,
            servicePriceLabel: cardPrice,
            serviceDuration: durationLabel ?? "",
            serviceKind: resolveServiceKind(service.kind),
            serviceOrg: host,
            serviceAddress: serviceAddress ?? "",
            serviceInstructor: instructorLabel ?? "",
            serviceCoverUrl: serviceCover ?? "",
            ...(transitionTag ? { imageTag: transitionTag } : {}),
          }
        : undefined,
    [service, title, cardPrice, durationLabel, host, instructorLabel, serviceCover, serviceAddress, transitionTag],
  );

  const linkHref = useMemo(
    () =>
      isService
        ? {
            pathname: "/service/[id]" as const,
            params: servicePreviewParams,
          }
        : {
            pathname: "/event/[slug]" as const,
            params: eventPreviewParams,
          },
    [eventPreviewParams, isService, servicePreviewParams],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 280,
        delay: isFeatured ? 30 : Math.min(index, 8) * 35,
        useNativeDriver: true,
      }),
      Animated.spring(revealTranslate, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, isFeatured, revealOpacity, revealTranslate]);

  useEffect(() => {
    let active = true;
    setTint(fallbackTint);
    if (!coverImage) {
      return () => {
        active = false;
      };
    }
    getDominantTint(coverImage, tintSeed)
      .then((resolved) => {
        if (active) setTint(resolved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [coverImage, fallbackTint, tintSeed]);

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 7,
    }).start();

    if (router?.prefetch) {
      router.prefetch(linkHref);
    }

    if (!isService && event?.slug) {
      queryClient.prefetchQuery({
        queryKey: ["event-detail", event.slug],
        queryFn: () => fetchEventDetail(event.slug),
      });
    }

    if (isService && service?.id) {
      queryClient.prefetchQuery({
        queryKey: ["service-detail", String(service.id)],
        queryFn: () => fetchServiceDetail(String(service.id)),
      });
    }
  }, [event?.slug, isService, linkHref, queryClient, router, scale, service?.id]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [scale]);

  return (
    <Link href={linkHref} asChild push>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} android_ripple={{ color: "rgba(255,255,255,0.08)" }}>
        <Animated.View
          style={{
            opacity: revealOpacity,
            transform: [{ translateY: revealTranslate }, { scale }],
            width: isFeatured ? 280 : "auto",
          }}
        >
          <GlassCard
            className={isFeatured ? "mr-4" : "mb-4"}
            intensity={isFeatured ? 65 : 58}
            padding={isFeatured ? tokens.spacing.md : tokens.spacing.lg}
            highlight={isHighlighted || isFeatured}
          >
            <View className="gap-3">
              <View className="overflow-hidden rounded-2xl border border-white/10">
                {coverImage ? (
                  <View style={[styles.mediaContainer, { height: cardHeight }]}>
                    <Image
                      source={{ uri: coverImage }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={220}
                      sharedTransitionTag={transitionTag ?? undefined}
                      cachePolicy="memory-disk"
                      priority={isFeatured ? "high" : "normal"}
                    />
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
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    </MaskedView>
                    <LinearGradient
                      colors={[
                        withAlpha(tint, 0.05),
                        withAlpha(tint, 0.45),
                        withAlpha(tint, 0.85),
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[styles.bottomGradient, { height: overlayHeight }]}
                      pointerEvents="none"
                    />
                    <View className="flex-row items-center justify-between px-3 pt-3">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <GlassPill label={category} />
                        {!isService && liveNow ? <GlassPill label="AO VIVO" variant="accent" /> : null}
                        {!isService && isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                        {relativeStart ? <GlassPill label={relativeStart} variant="muted" /> : null}
                        {!isService && distanceLabel ? (
                          <GlassPill label={distanceLabel} variant="muted" />
                        ) : null}
                      </View>
                    </View>
                    <View style={[styles.overlay, { height: overlayHeight }]}>
                      <Text style={styles.overlayTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.overlayRow}>
                        <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.overlayMeta} numberOfLines={1}>
                          {date}
                        </Text>
                      </View>
                      <View style={styles.overlayRow}>
                        <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.overlayMetaMuted} numberOfLines={1}>
                          {location}
                          {distanceLabel ? ` · ${distanceLabel}` : ""}
                        </Text>
                      </View>
                      <View style={styles.overlayFooter}>
                        <View style={styles.overlayPills}>
                          {statusLabel !== "Ativo" ? (
                            <GlassPill label={statusLabel} variant="muted" />
                          ) : null}
                          <GlassPill
                            label={cardPrice}
                            variant={cardPrice === "Gratis" ? "accent" : "muted"}
                          />
                          {!isService && availabilityLabel ? (
                            <GlassPill label={availabilityLabel} variant="muted" />
                          ) : null}
                          {!isService && attendanceLabel ? (
                            <GlassPill label={attendanceLabel} variant="muted" />
                          ) : null}
                          {!isService && ticketSummary?.priceLabel ? (
                            <GlassPill label={ticketSummary.priceLabel} variant="muted" />
                          ) : null}
                        </View>
                        <View style={styles.overlayArrow}>
                          <Text style={styles.overlayArrowText}>Ver detalhe</Text>
                          <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.6)" />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      height: cardHeight,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      justifyContent: "space-between",
                      paddingHorizontal: tokens.spacing.md,
                      paddingVertical: tokens.spacing.md,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <GlassPill label={category} />
                        {relativeStart ? <GlassPill label={relativeStart} variant="muted" /> : null}
                        {!isService && distanceLabel ? (
                          <GlassPill label={distanceLabel} variant="muted" />
                        ) : null}
                      </View>
                      <GlassPill label={statusLabel} variant="muted" />
                    </View>
                    <View className="gap-2">
                      <View className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10">
                        <Ionicons
                          name={isService ? "fitness-outline" : "sparkles-outline"}
                          size={18}
                          color="rgba(255,255,255,0.9)"
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  mediaContainer: {
    justifyContent: "flex-start",
  },
  bottomMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "flex-end",
    gap: 4,
  },
  overlayTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  overlayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  overlayMeta: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
  overlayMetaMuted: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    flexShrink: 1,
  },
  overlayFooter: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overlayPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  overlayArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  overlayArrowText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
});
