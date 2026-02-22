import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "../icons/Ionicons";
import { tokens, type PublicEventCard, useTranslation } from "@orya/shared";
import { DiscoverOfferCard, DiscoverServiceCard } from "../../features/discover/types";
import { getFallbackTint } from "../../lib/imageTint";
import { GlassSkeleton } from "../glass/GlassSkeleton";
import { formatCurrency, formatDate, formatTime } from "../../lib/formatters";
import { resolveMediaUri } from "../../lib/media";
import { safePush } from "../../lib/navigation";

type DiscoverGridCardProps = {
  offer: DiscoverOfferCard;
  size?: number;
  height?: number;
  layout?: "grid" | "row";
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
  if (service) return "briefcase";
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
  layout = "grid",
  source = "discover",
  style,
}: DiscoverGridCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
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
  const handlePress = useCallback(() => {
    safePush(router, linkHref as any);
  }, [linkHref, router]);

  const accessibilityLabel = event?.title ?? service?.title ?? t("discover:offer");
  const safeSize =
    Number.isFinite(size) && size > 0 ? size : 160;
  const safeHeight =
    typeof height === "number" && Number.isFinite(height) && height > 0
      ? height
      : safeSize;
  const cardHeight = Math.max(safeHeight, 96);
  const isRowLayout = layout === "row";
  const compact = safeSize <= 136;
  const cozy = safeSize > 136 && safeSize < 180;
  const typeBadgeMaxWidth = compact ? "68%" : cozy ? "64%" : "60%";
  const priceBadgeMaxWidth = compact ? "60%" : cozy ? "56%" : "52%";
  const titleLines = compact ? 2 : 3;
  const rowMetaLabel = useMemo(() => {
    if (service) {
      const organizationLabel =
        service.organization.publicName ||
        service.organization.businessName ||
        "ORYA";
      const instructorLabel =
        service.instructor?.fullName || service.instructor?.username || "";
      if (instructorLabel) {
        const combined = `${organizationLabel} · ${instructorLabel}`;
        if (metaLabel?.toLowerCase() === combined.toLowerCase()) return null;
        return combined;
      }
      if (metaLabel?.toLowerCase() === organizationLabel.toLowerCase()) {
        return null;
      }
      return organizationLabel;
    }
    return null;
  }, [metaLabel, service]);

  if (isRowLayout) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={handlePress}
        unstable_pressDelay={0}
        style={({ pressed }) => [
          styles.card,
          styles.rowCard,
          { width: safeSize, height: cardHeight },
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
          colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.82)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topSheen}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={[styles.innerFrame, styles.innerFrameRow]} />
        {!hasCover ? (
          <View style={styles.rowFallbackIcon} pointerEvents="none">
            <Ionicons
              name={resolveFallbackIcon(event, service)}
              size={18}
              color="rgba(240,246,255,0.85)"
            />
          </View>
        ) : null}
        <View style={styles.rowContent} pointerEvents="none">
          <View style={styles.rowTop}>
            <Badge label={typeLabel} />
            {priceLabel ? <Badge label={priceLabel} variant="price" /> : null}
          </View>
          <View style={styles.rowBody}>
            <Text
              style={styles.rowTitle}
              numberOfLines={2}
              allowFontScaling={false}
            >
              {fallbackTitle}
            </Text>
            {metaLabel ? (
              <Text
                style={styles.rowMeta}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {metaLabel}
              </Text>
            ) : null}
            {rowMetaLabel ? (
              <Text
                style={styles.rowSubMeta}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {rowMetaLabel}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.rowChevron} pointerEvents="none">
          <Ionicons
            name="chevron-forward"
            size={18}
            color="rgba(255,255,255,0.8)"
          />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      unstable_pressDelay={0}
      style={({ pressed }) => [
        styles.card,
        { width: safeSize, height: cardHeight },
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
      <LinearGradient
        colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topSheen}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.innerFrame} />
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
  const safeSize =
    Number.isFinite(size) && size > 0 ? size : 160;
  const safeHeight =
    typeof height === "number" && Number.isFinite(height) && height > 0
      ? height
      : safeSize;
  return (
    <View style={[{ width: safeSize }, style]}>
      <GlassSkeleton height={safeHeight} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(196, 230, 255, 0.24)",
    backgroundColor: "rgba(10, 16, 26, 0.66)",
    shadowColor: "rgba(0, 0, 0, 0.58)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 4,
  },
  rowCard: {
    borderRadius: 22,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  topSheen: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.66,
  },
  innerFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    margin: 1,
    opacity: 0.72,
  },
  innerFrameRow: {
    borderRadius: 22,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(210, 236, 255, 0.28)",
    backgroundColor: "rgba(8, 13, 23, 0.62)",
    maxWidth: "90%",
  },
  badgePrice: {
    backgroundColor: "rgba(91, 198, 255, 0.3)",
    borderColor: "rgba(174, 227, 255, 0.54)",
  },
  badgeText: {
    color: "rgba(245,252,255,0.96)",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  badgeTop: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  badgeBottom: {
    position: "absolute",
    top: 10,
    right: 10,
    alignItems: "flex-end",
  },
  bottomContent: {
    position: "absolute",
    left: 11,
    right: 11,
    bottom: 11,
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
    letterSpacing: 0.14,
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
    color: "rgba(232, 244, 255, 0.8)",
    fontSize: 11,
    fontWeight: "600",
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
  rowContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowBody: {
    gap: 3,
    paddingRight: 18,
  },
  rowTitle: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  rowMeta: {
    color: "rgba(236, 245, 255, 0.86)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  rowSubMeta: {
    color: "rgba(228, 239, 255, 0.72)",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
  },
  rowChevron: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(214,236,255,0.3)",
    backgroundColor: "rgba(8, 13, 24, 0.44)",
  },
  rowFallbackIcon: {
    position: "absolute",
    right: 13,
    top: 13,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(214,236,255,0.28)",
    backgroundColor: "rgba(8,12,20,0.48)",
    alignItems: "center",
    justifyContent: "center",
  },
});
