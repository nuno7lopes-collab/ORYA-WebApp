import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { useAuth } from "../../../lib/auth";
import { tokens } from "@orya/shared";
import { useStorePurchases } from "../../../features/store/hooks";
import { getStoreErrorMessage } from "../../../features/store/errors";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
};

export default function StorePurchasesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const purchases = useStorePurchases(Boolean(session?.user?.id));

  const openAuth = () => {
    router.replace({ pathname: "/auth", params: { next: "/store/purchases" } });
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Compras Loja"
        leftSlot={
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={{
              width: tokens.layout.touchTarget,
              height: tokens.layout.touchTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.92)" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: 40 }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {!session?.user?.id ? (
          <GlassCard intensity={52}>
            <Text className="text-white text-base font-semibold">Inicia sessão para ver compras</Text>
            <Pressable
              onPress={openAuth}
              className="mt-4 rounded-xl bg-white px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-center text-sm font-semibold text-black">Iniciar sessão</Text>
            </Pressable>
          </GlassCard>
        ) : purchases.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : purchases.isError ? (
          <GlassCard intensity={52}>
            <Text className="text-red-300 text-sm mb-3">{getStoreErrorMessage(purchases.error)}</Text>
            <Pressable
              onPress={() => purchases.refetch()}
              className="rounded-xl bg-white/10 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-center text-sm font-semibold text-white">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="gap-3">
            {(purchases.data?.items ?? []).length ? (
              (purchases.data?.items ?? []).map((order) => (
                <Link
                  key={`store-order-${order.id}`}
                  href={{ pathname: "/store/purchases/[orderId]", params: { orderId: String(order.id) } }}
                  asChild
                >
                  <Pressable className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-white text-sm font-semibold">
                        {order.store.displayName}
                      </Text>
                      <Text className="text-white/65 text-xs">{order.status}</Text>
                    </View>
                    <Text className="mt-1 text-white/65 text-xs">{order.orderNumber ?? `#${order.id}`}</Text>
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">{formatDate(order.createdAt)}</Text>
                      <Text className="text-white text-sm font-semibold">
                        {formatMoney(order.totalCents, order.currency)}
                      </Text>
                    </View>
                  </Pressable>
                </Link>
              ))
            ) : (
              <GlassCard intensity={46}>
                <Text className="text-white/70 text-sm">Ainda não tens compras de Loja.</Text>
              </GlassCard>
            )}
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
