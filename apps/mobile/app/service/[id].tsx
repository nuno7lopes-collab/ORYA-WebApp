import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { ApiError } from "../../lib/api";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useServiceDetail } from "../../features/services/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { safeBack } from "../../lib/navigation";

const formatPrice = (amountCents: number, currency: string): string => {
  if (amountCents <= 0) return "Gratis";
  const amount = amountCents / 100;
  const normalizedCurrency = currency?.toUpperCase() || "EUR";
  return `${amount.toFixed(0)} ${normalizedCurrency}`;
};

const formatDuration = (durationMinutes: number): string => {
  if (durationMinutes < 60) return `${durationMinutes} min`;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const kindLabel = (kind: string): string => {
  switch (kind) {
    case "COURT":
      return "PADEL";
    case "CLASS":
      return "AULA";
    default:
      return "SERVICO";
  }
};

export default function ServiceDetailScreen() {
  const {
    id,
    source,
    serviceTitle,
    servicePriceLabel,
    serviceDuration,
    serviceKind,
    serviceOrg,
    serviceCity,
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
    serviceCity?: string;
    serviceInstructor?: string;
    serviceCoverUrl?: string;
    imageTag?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const idValue = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? "", [id]);
  const previewTitle = useMemo(
    () => (Array.isArray(serviceTitle) ? serviceTitle[0] : serviceTitle) ?? "Servico",
    [serviceTitle],
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
  const previewOrg = useMemo(() => {
    if (Array.isArray(serviceOrg)) return serviceOrg[0];
    return serviceOrg ?? null;
  }, [serviceOrg]);
  const previewCity = useMemo(() => {
    if (Array.isArray(serviceCity)) return serviceCity[0];
    return serviceCity ?? null;
  }, [serviceCity]);
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
  const transitionSource = source === "discover" ? "discover" : "direct";
  const handleBack = () => {
    safeBack(router, navigation);
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
  const mapUrl = useMemo(() => {
    const label = data?.defaultLocationText || data?.organization?.city || null;
    if (!label) return null;
    return `http://maps.apple.com/?q=${encodeURIComponent(label)}`;
  }, [data?.defaultLocationText, data?.organization?.city]);

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
            className="flex-row items-center gap-2"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
            <Text className="text-white text-sm font-semibold">Voltar</Text>
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
                      sharedTransitionTag={displayImageTag ?? undefined}
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
                        <GlassPill label={previewKind || "SERVICO"} />
                        {previewDuration ? <GlassPill label={previewDuration} variant="muted" /> : null}
                      </View>
                      <GlassPill label={previewPrice || "A carregar"} variant="muted" />
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
                      <GlassPill label={previewKind || "SERVICO"} />
                      {previewDuration ? <GlassPill label={previewDuration} variant="muted" /> : null}
                    </View>
                    <GlassPill label={previewPrice || "A carregar"} variant="muted" />
                  </View>

                  <Text className="text-white text-2xl font-semibold">{previewTitle}</Text>
                  {previewOrg ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="business-outline" size={15} color="rgba(255,255,255,0.65)" />
                      <Text className="text-white/70 text-sm">{previewOrg}</Text>
                    </View>
                  ) : null}

                  {previewCity ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.55)" />
                      <Text className="text-white/65 text-sm">{previewCity}</Text>
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
                  ? "Servico nao encontrado."
                  : "Nao foi possivel carregar o servico."}
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="rounded-xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
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
                    sharedTransitionTag={displayImageTag ?? undefined}
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
                      <GlassPill label={data.categoryTag || kindLabel(data.kind)} />
                      <GlassPill label={formatDuration(data.durationMinutes)} variant="muted" />
                    </View>
                    <GlassPill
                      label={formatPrice(data.unitPriceCents, data.currency)}
                      variant={data.unitPriceCents <= 0 ? "accent" : "muted"}
                    />
                  </View>
                  <View className="px-4 pb-4 gap-2">
                    <Text className="text-white text-2xl font-semibold">{data.title || previewTitle}</Text>
                    <Text className="text-white/75 text-sm">
                      {data.organization.publicName || data.organization.businessName || "ORYA"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <GlassCard intensity={65} highlight>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <GlassPill label={data.categoryTag || kindLabel(data.kind)} />
                    <GlassPill label={formatDuration(data.durationMinutes)} variant="muted" />
                  </View>
                  <GlassPill label={formatPrice(data.unitPriceCents, data.currency)} variant={data.unitPriceCents <= 0 ? "accent" : "muted"} />
                </View>

                <Text className="text-white text-2xl font-semibold">{data.title || previewTitle}</Text>
                {data.description ? <Text className="text-white/75 text-sm">{data.description}</Text> : null}

                <View className="flex-row items-center gap-2">
                  <Ionicons name="business-outline" size={15} color="rgba(255,255,255,0.65)" />
                  <Text className="text-white/70 text-sm">
                    {data.organization.publicName || data.organization.businessName || "ORYA"}
                  </Text>
                </View>

                {data.organization.city ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.55)" />
                    <Text className="text-white/65 text-sm">{data.organization.city}</Text>
                  </View>
                ) : null}
                {data.defaultLocationText ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="pin-outline" size={15} color="rgba(255,255,255,0.45)" />
                    <Text className="text-white/60 text-sm">{data.defaultLocationText}</Text>
                  </View>
                ) : null}
                {mapUrl ? (
                  <Pressable
                    onPress={handleOpenMap}
                    className="self-start flex-row items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2"
                    style={{ minHeight: tokens.layout.touchTarget - 8 }}
                  >
                    <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text className="text-white/80 text-xs font-semibold">Abrir no mapa</Text>
                  </Pressable>
                ) : null}

                {data.instructor ? (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.55)" />
                    <Text className="text-white/65 text-sm">
                      {data.instructor.fullName || data.instructor.username || "Instrutor"}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>

            {data.policy ? (
              <View className="pt-4">
                <GlassCard intensity={54}>
                  <Text className="text-white text-sm font-semibold mb-2">Politica</Text>
                  <Text className="text-white/70 text-sm">
                    {data.policy.name} · Cancelamento ate {data.policy.cancellationWindowMinutes} min antes.
                  </Text>
                </GlassCard>
              </View>
            ) : null}

            {data.packs.length > 0 ? (
              <View className="pt-4 gap-3">
                <Text className="text-white/80 text-sm font-semibold">Pacotes</Text>
                {data.packs.map((pack) => {
                  const amount = pack.packPriceCents / 100;
                  return (
                    <GlassCard key={pack.id} intensity={50}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/80 text-sm">
                          {pack.label || `${pack.quantity} sessoes`}
                        </Text>
                        <GlassPill
                          label={`${amount.toFixed(0)} ${data.currency.toUpperCase()}`}
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
                disabled
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-center text-white text-sm font-semibold">Reservar agora (em breve)</Text>
              </Pressable>
            </View>
          </Animated.ScrollView>
        )}
      </LiquidBackground>
    </>
  );
}
