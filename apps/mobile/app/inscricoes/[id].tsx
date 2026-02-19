import { useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Ionicons } from "../../components/icons/Ionicons";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import { usePadelMyRegistrationDetail } from "../../features/tournaments/hooks";
import * as Haptics from "expo-haptics";

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Data por definir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data por definir";
  return parsed.toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatStatusLabel = (value: string | null | undefined) => {
  const normalized = value?.trim();
  if (!normalized) return "Pendente";
  return normalized.replace(/_/g, " ");
};

export default function RegistrationDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(14);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const entryId = Number(idRaw);
  const { session } = useAuth();
  const accessReady = Boolean(session?.user?.id);
  const detailQuery = usePadelMyRegistrationDetail(entryId, accessReady);
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealTranslate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(revealTranslate, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [revealOpacity, revealTranslate]);

  const triggerLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  }, []);

  const handleActionPress = useCallback(
    (action: () => void) => {
      triggerLightHaptic();
      action();
    },
    [triggerLightHaptic],
  );

  const backButton = (
    <Pressable
      onPress={() =>
        handleActionPress(() => safeBack(router, navigation, "/(tabs)/profile"))
      }
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
        },
        pressed ? { opacity: 0.8, transform: [{ scale: 0.96 }] } : null,
      ]}
    >
      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );

  const detail = detailQuery.data ?? null;
  const eventSlug = detail?.event?.slug ?? null;
  const canOpenEvent = Boolean(eventSlug);
  const actionLabel =
    detail?.nextAction === "PAY_PARTNER"
      ? "Pagar parceiro"
      : detail?.nextAction === "CONFIRM_GUARANTEE"
        ? "Confirmar garantia"
        : "Ver evento";

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Inscrição"
        titleAlign="center"
        leftSlot={backButton}
        showNotifications
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        <Animated.View
          style={{
            opacity: revealOpacity,
            transform: [{ translateY: revealTranslate }],
          }}
        >
          {!accessReady ? (
            <GlassCard intensity={56} highlight>
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/8">
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color="rgba(255,255,255,0.86)"
                    />
                  </View>
                  <Text className="text-white text-sm font-semibold">
                    Inicia sessão para consultar a inscrição.
                  </Text>
                </View>
                <Text className="text-white/65 text-xs">
                  O detalhe da inscrição inclui estado de pagamento, dupla e
                  próxima ação.
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  handleActionPress(() =>
                    router.push({
                      pathname: "/auth",
                      params: {
                        next:
                          Number.isFinite(entryId) && entryId > 0
                            ? `/inscricoes/${entryId}`
                            : "/(tabs)/profile",
                      },
                    }),
                  )
                }
                className="mt-3 rounded-xl bg-white/90 px-4 py-3"
                style={({ pressed }) => [
                  { minHeight: tokens.layout.touchTarget },
                  pressed
                    ? { opacity: 0.88, transform: [{ scale: 0.985 }] }
                    : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Iniciar sessão"
              >
                <Text className="text-[#0b1014] text-sm font-semibold text-center">
                  Iniciar sessão
                </Text>
              </Pressable>
            </GlassCard>
          ) : detailQuery.isLoading ? (
            <View className="gap-3">
              <GlassSkeleton height={138} />
              <GlassSkeleton height={108} />
              <GlassSkeleton height={92} />
            </View>
          ) : detailQuery.isError || !detail ? (
            <GlassCard intensity={56}>
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full border border-red-300/35 bg-red-300/10">
                    <Ionicons
                      name="warning-outline"
                      size={15}
                      color="rgba(254,202,202,0.95)"
                    />
                  </View>
                  <Text className="text-red-200 text-sm font-semibold">
                    Não foi possível carregar esta inscrição.
                  </Text>
                </View>
                <Text className="text-white/60 text-xs">
                  Confirma a ligação e tenta novamente.
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  handleActionPress(() => void detailQuery.refetch())
                }
                className="mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-3"
                style={({ pressed }) => [
                  { minHeight: tokens.layout.touchTarget },
                  pressed
                    ? { opacity: 0.88, transform: [{ scale: 0.985 }] }
                    : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Tentar novamente"
              >
                <Text className="text-white text-sm font-semibold text-center">
                  Tentar novamente
                </Text>
              </Pressable>
            </GlassCard>
          ) : (
            <View className="gap-3">
              <GlassCard intensity={60} highlight>
                <View className="gap-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <Text className="text-white text-base font-semibold">
                        {detail.event?.title ?? "Torneio"}
                      </Text>
                      <Text className="text-white/70 text-sm">
                        {formatDate(detail.event?.startsAt)}
                      </Text>
                      <Text className="text-white/60 text-xs">
                        {detail.event?.slug
                          ? `/${detail.event.slug}`
                          : "Evento sem slug público"}
                      </Text>
                    </View>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                      <Ionicons
                        name="trophy-outline"
                        size={20}
                        color="rgba(255,255,255,0.9)"
                      />
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <View className="rounded-full border border-white/18 bg-white/10 px-3 py-2">
                      <Text className="text-white text-[11px] font-semibold uppercase tracking-[0.08em]">
                        {detail.paymentStatusLabel}
                      </Text>
                    </View>
                    <View className="rounded-full border border-white/15 bg-white/7 px-3 py-2">
                      <Text className="text-white/85 text-[11px] font-semibold uppercase tracking-[0.08em]">
                        {detail.badge}
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>

              <GlassCard intensity={52}>
                <View className="gap-3">
                  <View className="flex-row items-center gap-2">
                    <View className="h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10">
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color="rgba(236,246,255,0.92)"
                      />
                    </View>
                    <Text className="text-white text-sm font-semibold">
                      Dupla e participação
                    </Text>
                  </View>
                  <Text className="text-white/70 text-xs">
                    {detail.isCaptain
                      ? "És capitão desta inscrição."
                      : "Participas como parceiro."}
                  </Text>
                  {detail.partnerGuestName || detail.partnerUserId ? (
                    <Text className="text-white/65 text-xs">
                      Parceiro:{" "}
                      {detail.partnerGuestName ?? detail.partnerUserId}
                    </Text>
                  ) : (
                    <Text className="text-white/55 text-xs">
                      Sem parceiro associado.
                    </Text>
                  )}
                  <View className="rounded-xl border border-white/12 bg-white/6 px-3 py-3">
                    <Text className="text-white/55 text-[11px] uppercase tracking-[0.08em]">
                      Próxima ação
                    </Text>
                    <Text className="text-white text-sm font-semibold">
                      {formatStatusLabel(detail.nextAction)}
                    </Text>
                  </View>
                </View>
              </GlassCard>

              <View className="gap-2">
                <Pressable
                  onPress={() => {
                    if (!canOpenEvent || !eventSlug) return;
                    handleActionPress(() =>
                      router.push({
                        pathname: "/event/[slug]",
                        params: { slug: eventSlug },
                      }),
                    );
                  }}
                  disabled={!canOpenEvent}
                  className={
                    canOpenEvent
                      ? "rounded-xl bg-white/90 px-4 py-3"
                      : "rounded-xl border border-white/15 bg-white/10 px-4 py-3"
                  }
                  style={({ pressed }) => [
                    {
                      minHeight: tokens.layout.touchTarget,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    pressed && canOpenEvent
                      ? { opacity: 0.92, transform: [{ scale: 0.985 }] }
                      : null,
                    !canOpenEvent ? { opacity: 0.55 } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                >
                  <Text
                    className={
                      canOpenEvent
                        ? "text-[#0b1014] text-sm font-semibold text-center"
                        : "text-white text-sm font-semibold text-center"
                    }
                  >
                    {actionLabel}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    handleActionPress(() =>
                      safeBack(router, navigation, "/(tabs)/profile"),
                    )
                  }
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={({ pressed }) => [
                    {
                      minHeight: tokens.layout.touchTarget,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    pressed
                      ? { opacity: 0.88, transform: [{ scale: 0.985 }] }
                      : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar ao perfil"
                >
                  <Text className="text-white/85 text-sm font-semibold text-center">
                    Voltar ao perfil
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </LiquidBackground>
  );
}
