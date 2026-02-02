import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useEventDetail } from "../../features/events/hooks";
import { tokens } from "@orya/shared";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "../../lib/api";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";

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

    return `${date} · ${startTime}–${endTime}`;
  } catch {
    return "Data por anunciar";
  }
};

const resolveStatusLabel = (status?: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT") => {
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

export default function EventDetail() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const slugValue = useMemo(() => (Array.isArray(slug) ? slug[0] : slug) ?? null, [slug]);
  const { data, isLoading, isError, error, refetch } = useEventDetail(slugValue ?? "");

  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: tokens.motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, translate, data?.id]);

  const cover = data?.coverImageUrl ?? null;
  const category = data?.categories?.[0] ?? "EVENTO";
  const date = formatDateRange(data?.startsAt, data?.endsAt);
  const location = data?.location?.formattedAddress || data?.location?.city || "Local a anunciar";
  const price =
    data?.isGratis ? "Grátis" : typeof data?.priceFrom === "number" ? `Desde ${data.priceFrom.toFixed(0)}€` : "Preço em breve";
  const description = data?.description ?? data?.shortDescription ?? null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <LiquidBackground variant="deep">
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          <View className="px-5 pt-12 pb-4">
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center gap-2"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
              <Text className="text-white text-sm font-semibold">Voltar</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View className="px-5 gap-3">
              <GlassSkeleton height={220} />
              <GlassSkeleton height={140} />
              <GlassSkeleton height={120} />
            </View>
          ) : isError || !data ? (
            <View className="px-5">
              <GlassSurface intensity={50}>
                <Text className="text-red-300 text-sm mb-3">
                  {error instanceof ApiError && error.status === 404
                    ? "Evento não encontrado."
                    : "Não foi possível carregar o evento."}
                </Text>
                <Pressable
                  onPress={() => refetch()}
                  className="rounded-xl bg-white/10 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassSurface>
            </View>
          ) : (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
              <View className="px-5">
                <View className="overflow-hidden rounded-[28px] border border-white/10">
                  {cover ? (
                    <ImageBackground
                      source={{ uri: cover }}
                      resizeMode="cover"
                      style={{ height: 260, justifyContent: "space-between" }}
                    >
                      <LinearGradient
                        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View className="flex-row items-center justify-between px-4 pt-4">
                        <View className="flex-row items-center gap-2">
                          <GlassPill label={category} />
                          {data.isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                        </View>
                        <GlassPill label={resolveStatusLabel(data.status)} variant="muted" />
                      </View>
                      <View className="px-4 pb-4 gap-2">
                        <Text className="text-white text-2xl font-semibold">{data.title}</Text>
                        {data.shortDescription ? (
                          <Text className="text-white/75 text-sm">{data.shortDescription}</Text>
                        ) : null}
                      </View>
                    </ImageBackground>
                  ) : (
                    <View
                      style={{
                        height: 260,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        justifyContent: "space-between",
                        paddingHorizontal: tokens.spacing.lg,
                        paddingVertical: tokens.spacing.lg,
                      }}
                    >
                      <View className="flex-row items-center gap-2 self-start">
                        <GlassPill label={category} />
                        {data.isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                      </View>
                      <Text className="text-white/60 text-xs">Imagem do evento em breve</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="px-5 pt-6 gap-4">
                <GlassCard intensity={60}>
                  <View className="gap-3">
                    <Text className="text-white text-sm font-semibold">Informações principais</Text>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text className="text-white/70 text-sm">{date}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
                      <Text className="text-white/65 text-sm">{location}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.6)" />
                      <Text className="text-white/70 text-sm">Organizador: {data.hostName ?? "ORYA"}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="pricetag-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text className="text-white text-sm font-semibold">{price}</Text>
                    </View>
                  </View>
                </GlassCard>

                {description ? (
                  <GlassCard intensity={54}>
                    <View className="gap-2">
                      <Text className="text-white text-sm font-semibold">Sobre o evento</Text>
                      <Text className="text-white/75 text-sm">{description}</Text>
                    </View>
                  </GlassCard>
                ) : null}

                <GlassCard intensity={50}>
                  <Text className="text-white/70 text-sm">
                    Checkout e inscrição entram na próxima fase. Já estamos a preparar a experiência
                    completa de compra e carteira.
                  </Text>
                </GlassCard>

                <Pressable
                  disabled
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-center text-white text-sm font-semibold">Inscrever-me</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </LiquidBackground>
    </>
  );
}
