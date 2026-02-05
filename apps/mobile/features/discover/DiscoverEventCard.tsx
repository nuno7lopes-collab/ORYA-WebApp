import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "../../components/icons/Ionicons";
import { PublicEventCard, tokens } from "@orya/shared";
import { useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { DiscoverServiceCard } from "./types";
import { fetchEventDetail } from "../events/api";
import { fetchServiceDetail } from "../services/api";
import { useIpLocation } from "../onboarding/hooks";

type Props = {
  item: PublicEventCard | DiscoverServiceCard;
  itemType?: "event" | "service";
  variant?: "feed" | "featured";
  index?: number;
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

const formatDateRange = (startsAt?: string, endsAt?: string): string => {
  if (!startsAt) return "Data por anunciar";
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;

    const date = new Intl.DateTimeFormat("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(start);

    const startTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);

    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;

    const endTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(end);

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

export function DiscoverEventCard({ item, itemType, variant = "feed", index = 0 }: Props) {
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
  const description = service ? service.description : event?.shortDescription;
  const location = service
    ? service.organization.city || service.organization.publicName || service.organization.businessName || "Local a anunciar"
    : event?.location?.city ?? event?.location?.name ?? "Local a anunciar";
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
  const { data: ipLocation } = useIpLocation();

  const cardPrice = isService
    ? service
      ? formatServicePrice(service)
      : "Preco em breve"
    : event
      ? formatEventPrice(event)
      : "Preco em breve";
  const statusLabel = isService ? "Disponivel" : resolveStatusLabel(event?.status);
  const distanceLabel =
    !isService && event?.location
      ? formatDistanceKm(
          event.location.lat ?? null,
          event.location.lng ?? null,
          ipLocation?.approxLatLon?.lat ?? null,
          ipLocation?.approxLatLon?.lon ?? null,
        )
      : null;
  const availabilityLabel = !isService
    ? resolveTicketAvailability(event?.ticketTypes) ?? (event?.isGratis ? "Entrada livre" : null)
    : null;
  const ticketSummary = !isService ? resolveTicketSummary(event?.ticketTypes) : null;
  const attendanceLabel = !isService ? resolveAttendanceSummary(event?.ticketTypes) : null;
  const showTicketRow = !isService && Boolean(ticketSummary || attendanceLabel || availabilityLabel);

  const eventPreviewParams = event
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
    : undefined;

  const servicePreviewParams = service
    ? {
        id: String(service.id ?? ""),
        source: "discover",
        serviceTitle: title,
        servicePriceLabel: cardPrice,
        serviceDuration: durationLabel ?? "",
        serviceKind: resolveServiceKind(service.kind),
        serviceOrg: host,
        serviceCity: service.organization.city ?? "",
        serviceInstructor: instructorLabel ?? "",
        serviceCoverUrl: serviceCover ?? "",
        ...(transitionTag ? { imageTag: transitionTag } : {}),
      }
    : undefined;

  const linkHref = isService
    ? {
        pathname: "/service/[id]" as const,
        params: servicePreviewParams,
      }
    : {
        pathname: "/event/[slug]" as const,
        params: eventPreviewParams,
      };

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

  const onPressIn = () => {
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
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  };

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
                  <View style={{ height: isFeatured ? 190 : 168, justifyContent: "space-between" }}>
                    <Image
                      source={{ uri: coverImage }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={220}
                      sharedTransitionTag={transitionTag ?? undefined}
                    />
                    <LinearGradient
                      colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.65)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View className="flex-row items-center justify-between px-3 pt-3">
                      <View className="flex-row items-center gap-2">
                        <GlassPill label={category} />
                        {!isService && liveNow ? <GlassPill label="AO VIVO" variant="accent" /> : null}
                        {!isService && isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                        {relativeStart ? <GlassPill label={relativeStart} variant="muted" /> : null}
                        {!isService && distanceLabel ? (
                          <GlassPill label={distanceLabel} variant="muted" />
                        ) : null}
                      </View>
                      <View className="flex-row items-center gap-2">
                        <GlassPill label={statusLabel} variant="muted" />
                        <GlassPill
                          label={cardPrice}
                          variant={cardPrice === "Gratis" ? "accent" : "muted"}
                        />
                      </View>
                    </View>
                    <View className="px-3 pb-3">
                      {isFeatured ? (
                        <Text className="text-white text-base font-semibold" numberOfLines={2}>
                          {title}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      height: isFeatured ? 190 : 168,
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

              <View className="gap-2">
                <Text className="text-lg font-semibold text-white" numberOfLines={2}>
                  {title}
                </Text>
                {description ? (
                  <Text className="text-sm text-white/70" numberOfLines={isFeatured ? 3 : 2}>
                    {description}
                  </Text>
                ) : null}

                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
                  <Text className="text-xs text-white/60">{date}</Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.55)" />
                  <Text className="text-xs text-white/55">{location}</Text>
                  {distanceLabel ? (
                    <Text className="text-[11px] text-white/45">· {distanceLabel}</Text>
                  ) : null}
                </View>

                <View className="flex-row items-center gap-2">
                  <Ionicons name="person-outline" size={14} color="rgba(255,255,255,0.55)" />
                  <Text className="text-xs text-white/55" numberOfLines={1}>
                    {host}
                  </Text>
                </View>

                {durationLabel ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.55)" />
                    <Text className="text-xs text-white/55">{durationLabel}</Text>
                    {instructorLabel ? <Text className="text-xs text-white/45">· {instructorLabel}</Text> : null}
                  </View>
                ) : null}

                {showTicketRow ? (
                  <View className="flex-row items-center justify-between pt-1">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="ticket-outline" size={14} color="rgba(255,255,255,0.6)" />
                      <Text className="text-xs text-white/65" numberOfLines={1}>
                        {ticketSummary?.label ?? "Bilhetes"}
                      </Text>
                      {ticketSummary?.priceLabel ? (
                        <Text className="text-[11px] text-white/45">· {ticketSummary.priceLabel}</Text>
                      ) : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {attendanceLabel ? <GlassPill label={attendanceLabel} variant="muted" /> : null}
                      {availabilityLabel ? <GlassPill label={availabilityLabel} variant="muted" /> : null}
                    </View>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between pt-1">
                  <Text className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                    Ver detalhe
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.45)" />
                </View>
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      </Pressable>
    </Link>
  );
}
