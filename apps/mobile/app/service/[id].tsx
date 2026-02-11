import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens, useTranslation } from "@orya/shared";
import { ApiError } from "../../lib/api";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useServiceDetail } from "../../features/services/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import { createMessageRequest } from "../../features/messages/api";
import { getUserFacingError } from "../../lib/errors";
import { formatCurrency } from "../../lib/formatters";

const formatPrice = (
  amountCents: number,
  currency: string,
  t: (key: string) => string,
): string => {
  if (amountCents <= 0) return t("common:price.free");
  const amount = amountCents / 100;
  return formatCurrency(amount, currency?.toUpperCase() || "EUR");
};

const formatDuration = (durationMinutes: number, t: (key: string) => string): string => {
  if (durationMinutes < 60) return t("common:units.minutesShort", { count: durationMinutes });
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const hoursLabel = t("common:units.hoursShort", { count: hours });
  if (!minutes) return hoursLabel;
  const minutesLabel = t("common:units.minutesShort", { count: minutes });
  return `${hoursLabel} ${minutesLabel}`;
};

const kindLabel = (kind: string, t: (key: string) => string): string => {
  switch (kind) {
    case "COURT":
      return t("services:kind.court");
    case "CLASS":
      return t("services:kind.class");
    default:
      return t("services:kind.service");
  }
};

export default function ServiceDetailScreen() {
  const { t } = useTranslation();
  const {
    id,
    source,
    serviceTitle,
    servicePriceLabel,
    serviceDuration,
    serviceKind,
    serviceOrg,
    serviceAddress,
    serviceInstructor,
    serviceCoverUrl,
    imageTag,
  } = useLocalSearchParams<{
    id?: string | string[];
    source?: string;
    serviceTitle?: string;
    servicePriceLabel?: string;
    serviceDuration?: string;
    serviceKind?: string;
    serviceOrg?: string;
    serviceAddress?: string;
    serviceInstructor?: string;
    serviceCoverUrl?: string;
    imageTag?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const sourceValue = useMemo(
    () => (Array.isArray(source) ? source[0] : source) ?? null,
    [source],
  );
  const idValue = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? "", [id]);
  const nextRoute = useMemo(() => (idValue ? `/service/${idValue}` : "/service"), [idValue]);
  const openAuth = useCallback(() => {
    router.push({ pathname: "/auth", params: { next: nextRoute } });
  }, [nextRoute, router]);
  const previewTitle = useMemo(
    () => (Array.isArray(serviceTitle) ? serviceTitle[0] : serviceTitle) ?? t("services:detail.fallbackTitle"),
    [serviceTitle, t],
  );
  const previewPrice = useMemo(() => {
    if (Array.isArray(servicePriceLabel)) return servicePriceLabel[0];
    return servicePriceLabel ?? null;
  }, [servicePriceLabel]);
  const previewDuration = useMemo(() => {
    if (Array.isArray(serviceDuration)) return serviceDuration[0];
    return serviceDuration ?? null;
  }, [serviceDuration]);
  const previewKind = useMemo(() => {
    if (Array.isArray(serviceKind)) return serviceKind[0];
    return serviceKind ?? null;
  }, [serviceKind]);
  const previewKindLabel = useMemo(
    () => previewKind ?? t("services:kind.service"),
    [previewKind, t],
  );
  const previewOrg = useMemo(() => {
    if (Array.isArray(serviceOrg)) return serviceOrg[0];
    return serviceOrg ?? null;
  }, [serviceOrg]);
  const previewAddress = useMemo(() => {
    if (Array.isArray(serviceAddress)) return serviceAddress[0];
    return serviceAddress ?? null;
  }, [serviceAddress]);
  const previewInstructor = useMemo(() => {
    if (Array.isArray(serviceInstructor)) return serviceInstructor[0];
    return serviceInstructor ?? null;
  }, [serviceInstructor]);
  const previewCover = useMemo(() => {
    if (Array.isArray(serviceCoverUrl)) return serviceCoverUrl[0];
    return serviceCoverUrl ?? null;
  }, [serviceCoverUrl]);
  const previewImageTag = useMemo(() => {
    const raw = Array.isArray(imageTag) ? imageTag[0] : imageTag;
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized ? normalized : null;
  }, [imageTag]);

  const { data, isLoading, isError, error, refetch } = useServiceDetail(idValue);
  const [contacting, setContacting] = useState(false);
  const transitionSource = source === "discover" ? "discover" : "direct";
  const fallbackRoute = useMemo(() => {
    switch (sourceValue) {
      case "map":
        return "/map";
      case "search":
        return "/search";
      case "discover":
        return "/(tabs)/index";
      case "agora":
        return "/(tabs)/agora";
      default:
        return "/(tabs)/index";
    }
  }, [sourceValue]);
  const handleBack = () => {
    safeBack(router, navigation, fallbackRoute);
  };

  const handleContactOrganization = async () => {
    if (!data?.id) return;
    if (!accessToken) {
      openAuth();
      return;
    }
    if (contacting) return;
    setContacting(true);
    try {
      await createMessageRequest({ serviceId: data.id }, accessToken);
      Alert.alert(t("services:detail.contactTitle"), t("services:detail.contactSuccess"));
    } catch (err) {
      Alert.alert(
        t("services:detail.contactTitle"),
        getUserFacingError(err, t("services:detail.contactError")),
      );
    } finally {
      setContacting(false);
    }
  };

  const fade = useRef(new Animated.Value(transitionSource === "discover" ? 0 : 0.2)).current;
  const translate = useRef(new Animated.Value(transitionSource === "discover" ? 20 : 10)).current;

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

  const showPreview = isLoading && !data && (previewTitle || previewPrice || previewOrg);
  const displayCover =
    previewCover ??
    data?.organization?.brandingAvatarUrl ??
    data?.instructor?.avatarUrl ??
    null;
  const displayImageTag = previewImageTag ?? (data?.id ? `service-${data.id}` : null);
  const resolvedAddress = useMemo(() => {
    return (
      data?.addressRef?.formattedAddress ??
      data?.organization?.addressRef?.formattedAddress ??
      null
    );
  }, [data?.addressRef?.formattedAddress, data?.organization?.addressRef?.formattedAddress]);

  const mapUrl = useMemo(() => {
    if (!resolvedAddress) return null;
    if (Platform.OS === "android") {
      return `geo:0,0?q=${encodeURIComponent(resolvedAddress)}`;
    }
    return `http://maps.apple.com/?q=${encodeURIComponent(resolvedAddress)}`;
  }, [resolvedAddress]);

  const handleOpenMap = async () => {
    if (!mapUrl) return;
    try {
      await Linking.openURL(mapUrl);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <LiquidBackground variant="solid">
        <View className="px-5 pt-12 pb-4">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t("common:actions.back")}
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
          <Animated.ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
            style={{ opacity: fade, transform: [{ translateY: translate }] }}
          >
            <View className="gap-4">
              {displayCover ? (
                <View className="overflow-hidden rounded-[28px] border border-white/10">
                  <View style={{ height: 220, justifyContent: "space-between" }}>
                    <Image
                      source={{ uri: displayCover }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={220}
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
                        <GlassPill label={previewKindLabel} />
                        {previewDuration ? <GlassPill label={previewDuration} variant="muted" /> : null}
                      </View>
                      <GlassPill label={previewPrice ?? t("services:detail.loading")} variant="muted" />
                    </View>
                    <View className="px-4 pb-4 gap-2">
                      <Text className="text-white text-2xl font-semibold">{previewTitle}</Text>
                      {previewOrg ? <Text className="text-white/75 text-sm">{previewOrg}</Text> : null}
                    </View>
                  </View>
                </View>
              ) : null}

              <GlassCard intensity={60} highlight>
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <GlassPill label={previewKindLabel} />
                      {previewDuration ? <GlassPill label={previewDuration} variant="muted" /> : null}
                    </View>
                    <GlassPill label={previewPrice ?? t("services:detail.loading")} variant="muted" />
                  </View>

                  <Text className="text-white text-2xl font-semibold">{previewTitle}</Text>
                  {previewOrg ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="business-outline" size={15} color="rgba(255,255,255,0.65)" />
                      <Text className="text-white/70 text-sm">{previewOrg}</Text>
                    </View>
                  ) : null}

                  {previewAddress ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.55)" />
                      <Text className="text-white/65 text-sm">{previewAddress}</Text>
                    </View>
                  ) : null}

                  {previewInstructor ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.55)" />
                      <Text className="text-white/65 text-sm">{previewInstructor}</Text>
                    </View>
                  ) : null}
                </View>
              </GlassCard>
            </View>
          </Animated.ScrollView>
        ) : isLoading ? (
          <View className="px-5 gap-3">
            <GlassSkeleton height={200} />
            <GlassSkeleton height={140} />
            <GlassSkeleton height={120} />
          </View>
        ) : isError || !data ? (
          <View className="px-5">
            <GlassCard intensity={52}>
              <Text className="text-red-300 text-sm mb-3">
                {error instanceof ApiError && error.status === 404
                  ? t("services:detail.notFound")
                  : t("services:detail.loadError")}
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
          <Animated.ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
            style={{ opacity: fade, transform: [{ translateY: translate }] }}
          >
            {displayCover ? (
              <View className="mb-4 overflow-hidden rounded-[28px] border border-white/10">
                <View style={{ height: 220, justifyContent: "space-between" }}>
                  <Image
                    source={{ uri: displayCover }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={240}
                    cachePolicy="memory-disk"
                    priority="high"
                  />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.7)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View className="flex-row items-center justify-between px-4 pt-4">
                    <View className="flex-row items-center gap-2">
                      <GlassPill label={data.categoryTag || kindLabel(data.kind, t)} />
                      <GlassPill label={formatDuration(data.durationMinutes, t)} variant="muted" />
                    </View>
                    <GlassPill
                      label={formatPrice(data.unitPriceCents, data.currency, t)}
                      variant={data.unitPriceCents <= 0 ? "accent" : "muted"}
                    />
                  </View>
                  <View className="px-4 pb-4 gap-2">
                    <Text className="text-white text-2xl font-semibold">{data.title || previewTitle}</Text>
                    <Text className="text-white/75 text-sm">
                      {data.organization.publicName || data.organization.businessName || t("common:appName")}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <GlassCard intensity={65} highlight>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <GlassPill label={data.categoryTag || kindLabel(data.kind, t)} />
                    <GlassPill label={formatDuration(data.durationMinutes, t)} variant="muted" />
                  </View>
                  <GlassPill
                    label={formatPrice(data.unitPriceCents, data.currency, t)}
                    variant={data.unitPriceCents <= 0 ? "accent" : "muted"}
                  />
                </View>

                <Text className="text-white text-2xl font-semibold">{data.title || previewTitle}</Text>
                {data.description ? <Text className="text-white/75 text-sm">{data.description}</Text> : null}

                <View className="flex-row items-center gap-2">
                  <Ionicons name="business-outline" size={15} color="rgba(255,255,255,0.65)" />
                  <Text className="text-white/70 text-sm">
                    {data.organization.publicName || data.organization.businessName || t("common:appName")}
                  </Text>
                </View>

                {resolvedAddress ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.55)" />
                    <Text className="text-white/65 text-sm">{resolvedAddress}</Text>
                  </View>
                ) : null}
                {mapUrl ? (
                  <Pressable
                    onPress={handleOpenMap}
                    className="self-start flex-row items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2"
                    style={{ minHeight: tokens.layout.touchTarget - 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.openMap")}
                  >
                    <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text className="text-white/80 text-xs font-semibold">
                      {t("common:actions.openMap")}
                    </Text>
                  </Pressable>
                ) : null}

                {data.instructor ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.55)" />
                    <Text className="text-white/65 text-sm">
                      {data.instructor.fullName ||
                        data.instructor.username ||
                        t("services:detail.instructorFallback")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>

            {data.policy ? (
              <View className="pt-4">
                <GlassCard intensity={54}>
                  <Text className="text-white text-sm font-semibold mb-2">
                    {t("services:detail.policyTitle")}
                  </Text>
                  <Text className="text-white/70 text-sm">
                    {t("services:detail.policyText", {
                      policy: data.policy.name,
                      minutes: data.policy.cancellationWindowMinutes,
                    })}
                  </Text>
                </GlassCard>
              </View>
            ) : null}

            {data.packs.length > 0 ? (
              <View className="pt-4 gap-3">
                <Text className="text-white/80 text-sm font-semibold">
                  {t("services:detail.packsTitle")}
                </Text>
                {data.packs.map((pack) => {
                  const amount = pack.packPriceCents / 100;
                  return (
                    <GlassCard key={pack.id} intensity={50}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/80 text-sm">
                          {pack.label || t("services:detail.sessions", { count: pack.quantity })}
                        </Text>
                        <GlassPill
                          label={formatCurrency(amount, data.currency.toUpperCase())}
                          variant={pack.recommended ? "accent" : "muted"}
                        />
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            ) : null}

            <View className="pt-5">
              <Pressable
                onPress={handleContactOrganization}
                disabled={contacting}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4 mb-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("services:detail.contactButton")}
                accessibilityState={{ disabled: contacting }}
              >
                <Text className="text-center text-white text-sm font-semibold">
                  {contacting ? t("common:actions.sending") : t("services:detail.contactButton")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!data?.id) return;
                  router.push({ pathname: "/service/[id]/booking", params: { id: String(data.id) } });
                }}
                className="rounded-2xl bg-white/15 px-4 py-4"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("services:detail.bookNow")}
              >
                <Text className="text-center text-white text-sm font-semibold">
                  {t("services:detail.bookNow")}
                </Text>
              </Pressable>
            </View>
          </Animated.ScrollView>
        )}
      </LiquidBackground>
    </>
  );
}
