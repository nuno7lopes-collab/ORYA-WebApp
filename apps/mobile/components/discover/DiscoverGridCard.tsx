import { Link } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "../icons/Ionicons";
import { tokens, type PublicEventCard, useTranslation } from "@orya/shared";
import { DiscoverOfferCard, DiscoverServiceCard } from "../../features/discover/types";
import { getFallbackTint } from "../../lib/imageTint";
import { GlassSkeleton } from "../glass/GlassSkeleton";
import { formatCurrency } from "../../lib/formatters";

type DiscoverGridCardProps = {
  offer: DiscoverOfferCard;
  size?: number;
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

function Badge({ label, variant = "default" }: BadgeProps) {
  return (
    <View style={[styles.badge, variant === "price" ? styles.badgePrice : null]}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const DiscoverGridCard = memo(function DiscoverGridCard({
  offer,
  size = 110,
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

  const coverImage =
    event?.coverImageUrl ??
    service?.organization?.brandingAvatarUrl ??
    service?.instructor?.avatarUrl ??
    null;

  const fallbackSeed = useMemo(
    () => String(event?.slug ?? service?.id ?? offer.key ?? "orya"),
    [event?.slug, offer.key, service?.id],
  );
  const fallbackTint = useMemo(() => getFallbackTint(fallbackSeed), [fallbackSeed]);
  const fallbackTitle = useMemo(
    () => (service ? service.title : event?.title ?? t("events:labels.event")),
    [event?.title, service?.title, service, t],
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
      coverImageUrl: event.coverImageUrl ?? "",
      shortDescription: event.shortDescription ?? "",
      startsAt: event.startsAt ?? "",
      endsAt: event.endsAt ?? "",
      locationLabel,
      priceLabel: priceLabel ?? "",
      categoryLabel: typeLabel,
      hostName: event.hostName ?? event.hostUsername ?? "ORYA",
      imageTag: event.slug ? `event-${event.slug}` : undefined,
    };
  }, [event, priceLabel, source, typeLabel]);

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

  return (
    <Link href={linkHref} asChild push>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.card,
          { width: size, height: size },
          style,
          pressed ? styles.cardPressed : null,
        ]}
      >
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
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
          colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {!coverImage ? (
          <View style={styles.fallbackContent} pointerEvents="none">
            <Ionicons
              name={resolveFallbackIcon(event, service)}
              size={22}
              color="rgba(240,246,255,0.85)"
            />
            <Text style={styles.fallbackTitle} numberOfLines={1}>
              {fallbackTitle}
            </Text>
          </View>
        ) : null}
        <View style={styles.badgeTop} pointerEvents="none">
          <Badge label={typeLabel} />
        </View>
        {priceLabel ? (
          <View style={styles.badgeBottom} pointerEvents="none">
            <Badge label={priceLabel} variant="price" />
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
});

export const DiscoverGridCardSkeleton = memo(function DiscoverGridCardSkeleton({
  size = 110,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size }, style]}>
      <GlassSkeleton height={size} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(8, 12, 20, 0.35)",
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
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
    fontSize: 9,
    fontWeight: "700",
  },
  badgeTop: {
    position: "absolute",
    top: 6,
    left: 6,
  },
  badgeBottom: {
    position: "absolute",
    bottom: 6,
    left: 6,
  },
  fallbackContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  fallbackTitle: {
    color: "rgba(240,246,255,0.85)",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
});
