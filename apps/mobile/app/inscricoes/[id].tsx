import { Pressable, Text, View } from "react-native";
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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Data por definir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data por definir";
  return parsed.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
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

  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, "/(tabs)/profile")}
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
        pressed ? { opacity: 0.8 } : null,
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
      <View style={{ flex: 1, paddingTop: topPadding, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}>
        {!accessReady ? (
          <GlassCard intensity={56}>
            <Text className="text-white text-sm font-semibold">Inicia sessão para consultar a inscrição.</Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/auth",
                  params: {
                    next:
                      Number.isFinite(entryId) && entryId > 0
                        ? `/inscricoes/${entryId}`
                        : "/(tabs)/profile",
                  },
                })
              }
              className="mt-3 rounded-xl bg-white/90 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-[#0b1014] text-sm font-semibold text-center">Iniciar sessão</Text>
            </Pressable>
          </GlassCard>
        ) : detailQuery.isLoading ? (
          <View className="gap-3">
            <GlassSkeleton height={128} />
            <GlassSkeleton height={92} />
          </View>
        ) : detailQuery.isError || !detail ? (
          <GlassCard intensity={56}>
            <Text className="text-red-200 text-sm font-semibold">Não foi possível carregar esta inscrição.</Text>
            <Pressable
              onPress={() => detailQuery.refetch()}
              className="mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="gap-3">
            <GlassCard intensity={58}>
              <View className="gap-2">
                <Text className="text-white text-base font-semibold">
                  {detail.event?.title ?? "Torneio"}
                </Text>
                <Text className="text-white/70 text-sm">{formatDate(detail.event?.startsAt)}</Text>
                <Text className="text-white/65 text-xs">Estado: {detail.paymentStatusLabel}</Text>
                <Text className="text-white/65 text-xs">Modo: {detail.badge}</Text>
              </View>
            </GlassCard>

            <GlassCard intensity={52}>
              <View className="gap-2">
                <Text className="text-white text-sm font-semibold">Dupla e participação</Text>
                <Text className="text-white/70 text-xs">
                  {detail.isCaptain ? "És capitão desta inscrição." : "Participas como parceiro."}
                </Text>
                {detail.partnerGuestName || detail.partnerUserId ? (
                  <Text className="text-white/65 text-xs">
                    Parceiro: {detail.partnerGuestName ?? detail.partnerUserId}
                  </Text>
                ) : (
                  <Text className="text-white/55 text-xs">Sem parceiro associado.</Text>
                )}
                <Text className="text-white/65 text-xs">Próxima ação: {detail.nextAction}</Text>
              </View>
            </GlassCard>

            <Pressable
              onPress={() => {
                if (!canOpenEvent || !eventSlug) return;
                router.push({ pathname: "/event/[slug]", params: { slug: eventSlug } });
              }}
              disabled={!canOpenEvent}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3"
              style={!canOpenEvent ? { opacity: 0.55 } : undefined}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <Text className="text-white text-sm font-semibold text-center">
                {actionLabel}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </LiquidBackground>
  );
}
