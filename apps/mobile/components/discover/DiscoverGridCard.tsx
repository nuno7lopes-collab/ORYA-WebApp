import { Link } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "../icons/Ionicons";
import { tokens, type PublicEventCard, useTranslation } from "@orya/shared";
import { DiscoverOfferCard, DiscoverServiceCard } from "../../features/discover/types";
import { getFallbackTint } from "../../lib/imageTint";
import { GlassSkeleton } from "../glass/GlassSkeleton";
import { formatCurrency, formatDate, formatTime } from "../../lib/formatters";
import { resolveMediaUri } from "../../lib/media";

type DiscoverGridCardProps = {
  offer: DiscoverOfferCard;
  size?: number;
  height?: number;
  source?: string;
  style?: StyleProp<ViewStyle>;
};

type BadgeProps = {
  label: string;
  variant?: "default" | "price";
};

const resolveServiceKind = (kind: DiscoverServiceCard["kind"], t: (key: string) => string): string => {
  switch (kind) {
    case "COURT":
      return t("services:kind.court");
    case "CLASS":
      return t("services:kind.class");
    default:
      return t("services:kind.service");
  }
};

const resolveEventType = (event: PublicEventCard, t: (key: string) => string): string => {
  if (event.tournament) return t("events:labels.tournament");
  if ((event.categories ?? []).includes("PADEL")) return t("events:labels.padel");
  return t("events:labels.event");
};

const formatEventPrice = (event: PublicEventCard, t: (key: string, options?: any) => string): string | null => {
  if (event.isGratis) return t("common:price.free");
  if (typeof event.priceFrom === "number") {
    return t("common:price.from", { price: formatCurrency(event.priceFrom, "EUR") });
  }
  const ticketPrices = event.ticketTypes
    ? event.ticketTypes
        .map((ticket) => (typeof ticket.price === "number" ? ticket.price : null))
        .filter((price): price is number => price !== null)
    : [];
  if (ticketPrices.length > 0) {
    const min = Math.min(...ticketPrices) / 100;
    return t("common:price.from", { price: formatCurrency(min, "EUR") });
  }
  return null;
};

const formatServicePrice = (service: DiscoverServiceCard, t: (key: string, options?: any) => string): string => {
  if (service.unitPriceCents <= 0) return t("common:price.free");
  const amount = service.unitPriceCents / 100;
  const currency = service.currency?.toUpperCase() || "EUR";
  return formatCurrency(amount, currency, { maximumFractionDigits: 0 });
};

const resolveFallbackIcon = (event: PublicEventCard | null, service: DiscoverServiceCard | null) => {
  if (service?.kind === "COURT") return "tennisball";
  if (service?.kind === "CLASS") return "briefcase";
  if (event?.tournament) return "trophy";
  if ((event?.categories ?? []).includes("PADEL")) return "tennisball";
  return "calendar";
};

const formatEventMeta = (event: PublicEventCard | null) => {
  if (!event?.startsAt) return event?.location?.city ?? null;
  try {
    const startsAt = new Date(event.startsAt);
    if (Number.isNaN(startsAt.getTime())) return event.location?.city ?? null;
    const date = formatDate(startsAt, { day: "2-digit", month: "short" });
    const time = formatTime(startsAt, { hour: "2-digit", minute: "2-digit" });
    const city = event.location?.city ?? null;
    return city ? `${date} · ${time} · ${city}` : `${date} · ${time}`;
  } catch {
    return event.location?.city ?? null;
  }
};

const formatServiceMeta = (service: DiscoverServiceCard | null) => {
  if (!service?.nextAvailability) {
    return service?.organization?.publicName ?? service?.organization?.businessName ?? null;
  }
  try {
    const next = new Date(service.nextAvailability);
    if (Number.isNaN(next.getTime())) {
      return service.organization?.publicName ?? service.organization?.businessName ?? null;
    }
    const date = formatDate(next, { day: "2-digit", month: "short" });
    const time = formatTime(next, { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return service.organization?.publicName ?? service.organization?.businessName ?? null;
  }
};

function Badge({ label, variant = "default" }: BadgeProps) {
  return (
    <View style={[styles.badge, variant === "price" ? styles.badgePrice : null]}>
      <Text style={styles.badgeText} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

export const DiscoverGridCard = memo(function DiscoverGridCard({
  offer,
  size = 110,
  height,
  source = "discover",
  style,
}: DiscoverGridCardProps) {
  const { t } = useTranslation();
  const isService = offer.type === "service";
  const event = !isService ? offer.event : null;
  const service = isService ? offer.service : null;

  const typeLabel = useMemo(() => {
    if (service) return resolveServiceKind(service.kind, t);
    if (event) return resolveEventType(event, t);
    return t("events:labels.event");
  }, [event, service, t]);

  const priceLabel = useMemo(() => {
    if (service) return formatServicePrice(service, t);
    if (event) return formatEventPrice(event, t);
    return null;
  }, [event, service, t]);

  const coverImageRaw =
    event?.coverImageUrl ??
    service?.organization?.brandingCoverUrl ??
    service?.organization?.brandingAvatarUrl ??
    service?.instructor?.avatarUrl ??
    null;
  const coverImage = useMemo(() => resolveMediaUri(coverImageRaw), [coverImageRaw]);
  const [coverFailed, setCoverFailed] = useState(false);
  const hasCover = Boolean(coverImage) && !coverFailed;

  useEffect(() => {
    setCoverFailed(false);
  }, [coverImage]);

  const fallbackSeed = useMemo(
    () => String(event?.slug ?? service?.id ?? offer.key ?? "orya"),
    [event?.slug, offer.key, service?.id],
  );
  const fallbackTint = useMemo(() => getFallbackTint(fallbackSeed), [fallbackSeed]);
  const fallbackTitle = useMemo(
    () => (service ? service.title : event?.title ?? t("events:labels.event")),
    [event?.title, service?.title, service, t],
  );
  const metaLabel = useMemo(
    () => (service ? formatServiceMeta(service) : formatEventMeta(event)),
    [event, service],
  );

  const eventPreviewParams = useMemo(() => {
    if (!event) return undefined;
    const locationLabel =
      event.location?.formattedAddress ??
      event.location?.city ??
      event.location?.name ??
      "";
    return {
      slug: event.slug ?? "",
      source,
      eventTitle: event.title ?? "",
      coverImageUrl: coverImage ?? "",
      shortDescription: event.shortDescription ?? "",
      startsAt: event.startsAt ?? "",
      endsAt: event.endsAt ?? "",
      locationLabel,
      priceLabel: priceLabel ?? "",
      categoryLabel: typeLabel,
      hostName: event.hostName ?? event.hostUsername ?? "ORYA",
      imageTag: event.slug ? `event-${event.slug}` : undefined,
    };
  }, [event, priceLabel, source, typeLabel, coverImage]);

  const servicePreviewParams = useMemo(() => {
    if (!service) return undefined;
    const serviceAddress =
      service.addressRef?.formattedAddress ??
      service.organization?.addressRef?.formattedAddress ??
      "";
    const host = service.organization.publicName || service.organization.businessName || "ORYA";
    const instructor = service.instructor?.fullName || service.instructor?.username || "";
    const duration = service.durationMinutes ? `${service.durationMinutes} min` : "";
    return {
      id: String(service.id ?? ""),
      source,
      serviceTitle: service.title,
      servicePriceLabel: priceLabel ?? "",
      serviceDuration: duration,
      serviceKind: typeLabel,
      serviceOrg: host,
      serviceAddress: serviceAddress ?? "",
      serviceInstructor: instructor,
      serviceCoverUrl: coverImage ?? "",
      imageTag: service.id ? `service-${service.id}` : undefined,
    };
  }, [coverImage, priceLabel, service, source, typeLabel]);

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

  const accessibilityLabel = event?.title ?? service?.title ?? t("discover:offer");
  const cardHeight = Math.max(height ?? size, size);
  const compact = size <= 136;
  const cozy = size > 136 && size < 180;
  const typeBadgeMaxWidth = compact ? "68%" : cozy ? "64%" : "60%";
  const priceBadgeMaxWidth = compact ? "60%" : cozy ? "56%" : "52%";
  const titleLines = compact ? 2 : 3;

  return (
    <Link href={linkHref} asChild push>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.card,
          { width: size, height: cardHeight },
          style,
          pressed ? styles.cardPressed : null,
        ]}
      >
        {hasCover ? (
          <Image
            source={{ uri: coverImage as string }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <LinearGradient
            colors={[fallbackTint, "rgba(7, 10, 18, 0.95)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.72)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {!hasCover ? (
          <View style={styles.fallbackContent} pointerEvents="none">
            <Ionicons
              name={resolveFallbackIcon(event, service)}
              size={compact ? 20 : 24}
              color="rgba(240,246,255,0.85)"
            />
          </View>
        ) : null}
        <View style={styles.badgeTop} pointerEvents="none">
          <View style={{ maxWidth: typeBadgeMaxWidth }}>
            <Badge label={typeLabel} />
          </View>
        </View>
        {priceLabel ? (
          <View style={styles.badgeBottom} pointerEvents="none">
            <View style={{ maxWidth: priceBadgeMaxWidth }}>
              <Badge label={priceLabel} variant="price" />
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.bottomContent,
            compact ? styles.bottomContentCompact : cozy ? styles.bottomContentCozy : null,
          ]}
          pointerEvents="none"
        >
          <Text
            style={[styles.title, compact ? styles.titleCompact : cozy ? styles.titleCozy : styles.titleComfort]}
            numberOfLines={titleLines}
            allowFontScaling={false}
          >
            {fallbackTitle}
          </Text>
          {metaLabel ? (
            <Text
              style={[styles.meta, compact ? styles.metaCompact : cozy ? styles.metaCozy : styles.metaComfort]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {metaLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
});

export const DiscoverGridCardSkeleton = memo(function DiscoverGridCardSkeleton({
  size = 110,
  height,
  style,
}: {
  size?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size }, style]}>
      <GlassSkeleton height={height ?? size} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(11, 16, 24, 0.55)",
    shadowColor: "rgba(0, 0, 0, 0.4)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(8, 12, 20, 0.55)",
    maxWidth: "90%",
  },
  badgePrice: {
    backgroundColor: "rgba(14, 116, 144, 0.42)",
    borderColor: "rgba(148, 214, 255, 0.35)",
  },
  badgeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTop: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  badgeBottom: {
    position: "absolute",
    top: 8,
    right: 8,
    alignItems: "flex-end",
  },
  bottomContent: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    gap: 3,
  },
  bottomContentCompact: {
    left: 8,
    right: 8,
    bottom: 8,
    gap: 2,
  },
  bottomContentCozy: {
    left: 9,
    right: 9,
    bottom: 9,
    gap: 2,
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  titleCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  titleCozy: {
    fontSize: 13,
    lineHeight: 17,
  },
  titleComfort: {
    fontSize: 14,
    lineHeight: 18,
  },
  meta: {
    color: "rgba(230, 242, 255, 0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  metaCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  metaCozy: {
    fontSize: 11,
    lineHeight: 14,
  },
  metaComfort: {
    fontSize: 12,
    lineHeight: 15,
  },
  fallbackContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
});
