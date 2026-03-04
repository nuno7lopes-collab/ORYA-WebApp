import { useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";

const resolveFirstName = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const [first] = normalized.split(/\s+/);
  return first || null;
};

export default function InicioScreen() {
  const router = useRouter();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const tabBarPadding = useTabBarPadding();
  const { session } = useAuth();
  const profileQuery = useProfileSummary(
    Boolean(session?.user?.id),
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );

  const firstName = useMemo(() => {
    const byProfile = resolveFirstName(profileQuery.data?.fullName);
    if (byProfile) return byProfile;
    const byEmail = resolveFirstName(session?.user?.email?.split("@")[0] ?? null);
    return byEmail ?? "jogador";
  }, [profileQuery.data?.fullName, session?.user?.email]);

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Início"
        titleAlign="center"
        showNotifications
        showMessages
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: tabBarPadding,
          paddingHorizontal: 20,
          gap: 14,
        }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-white/15 bg-white/8 px-4 py-4">
          <Text className="text-white/85 text-sm">Olá, {firstName}</Text>
          <Text className="mt-2 text-white text-2xl font-semibold">Pronto para jogar padel?</Text>
          <Pressable
            onPress={() =>
              Alert.alert(
                "Quero jogar",
                "Estamos a preparar este modo. Em breve vais poder entrar diretamente em jogos.",
              )
            }
            className="mt-4 rounded-2xl bg-white px-4 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Quero jogar"
          >
            <Text className="text-[#0b1014] text-sm font-semibold text-center">Quero jogar</Text>
          </Pressable>
        </View>

        <View className="rounded-3xl border border-white/12 bg-white/5 px-4 py-4">
          <Text className="text-white text-sm font-semibold">Aulas</Text>
          <Text className="mt-1 text-white/70 text-xs">
            Encontra aulas e treinos com reserva imediata.
          </Text>
          <Pressable
            onPress={() => safePush(router, "/aulas")}
            className="mt-3 rounded-xl border border-white/20 bg-white/8 px-4 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Abrir aulas"
          >
            <Text className="text-white text-xs font-semibold text-center">Ver aulas</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => safePush(router, TAB_PATHNAMES.competir)}
            className="flex-1 rounded-2xl border border-white/12 bg-white/6 px-3 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Abrir competir"
          >
            <Text className="text-white text-xs font-semibold text-center">Competir</Text>
          </Pressable>
          <Pressable
            onPress={() => safePush(router, TAB_PATHNAMES.reservas)}
            className="flex-1 rounded-2xl border border-white/12 bg-white/6 px-3 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Abrir reservas"
          >
            <Text className="text-white text-xs font-semibold text-center">Reservas</Text>
          </Pressable>
          <Pressable
            onPress={() => safePush(router, TAB_PATHNAMES.comunidade)}
            className="flex-1 rounded-2xl border border-white/12 bg-white/6 px-3 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Abrir comunidade"
          >
            <Text className="text-white text-xs font-semibold text-center">Comunidade</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LiquidBackground>
  );
}
