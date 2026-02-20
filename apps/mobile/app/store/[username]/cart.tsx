import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { safeBack, safePush } from "../../../lib/navigation";
import { tokens } from "@orya/shared";
import { useAuth } from "../../../lib/auth";
import { getStoreErrorMessage } from "../../../features/store/errors";
import { useStoreCart, useStoreCartMutations, useStoreCatalog, useStoreTotals } from "../../../features/store/hooks";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

export default function StoreCartScreen() {
  const params = useLocalSearchParams<{ username?: string; storeId?: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const initialStoreId = Number(params.storeId ?? 0);
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });

  const catalog = useStoreCatalog(username, Boolean(username) && (!Number.isFinite(initialStoreId) || initialStoreId <= 0));
  const storeId = Number.isFinite(initialStoreId) && initialStoreId > 0 ? initialStoreId : catalog.data?.store.id ?? null;

  const cart = useStoreCart(storeId, Boolean(storeId));
  const totals = useStoreTotals(storeId, Boolean(storeId));
  const mutations = useStoreCartMutations(storeId);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const currency = cart.data?.cart.currency ?? catalog.data?.store.currency ?? "EUR";

  const openAuth = () => {
    const next = `/store/${encodeURIComponent(username)}/cart${storeId ? `?storeId=${storeId}` : ""}`;
    router.replace({ pathname: "/auth", params: { next } });
  };

  const canCheckout = session?.user?.id && storeId && totals.itemCount > 0;

  const adjustItemQuantity = async (itemId: number, nextQuantity: number) => {
    if (!storeId || mutations.busy) return;
    setInlineError(null);
    try {
      if (nextQuantity <= 0) {
        await mutations.removeItem.mutateAsync({ storeId, itemId });
      } else {
        await mutations.updateItem.mutateAsync({ storeId, itemId, quantity: nextQuantity });
      }
    } catch (error) {
      setInlineError(getStoreErrorMessage(error));
    }
  };

  const adjustBundleQuantity = async (bundleKey: string, nextQuantity: number) => {
    if (!storeId || mutations.busy) return;
    setInlineError(null);
    try {
      if (nextQuantity <= 0) {
        await mutations.removeBundle.mutateAsync({ storeId, bundleKey });
      } else {
        await mutations.updateBundle.mutateAsync({ storeId, bundleKey, quantity: nextQuantity });
      }
    } catch (error) {
      setInlineError(getStoreErrorMessage(error));
    }
  };

  const loading = cart.isLoading || (catalog.isLoading && !storeId);
  const error = cart.error ?? catalog.error;

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Carrinho"
        leftSlot={
          <Pressable
            onPress={() => safeBack(router, navigation, `/store/${username}`)}
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
          <View className="gap-2 border-b border-white/12 pb-4">
            <Text className="text-white text-base font-semibold">Inicia sessão para continuar</Text>
            <Text className="mt-2 text-white/70 text-sm">
              Nesta versão, o checkout da Loja no mobile exige autenticação.
            </Text>
            <Pressable
              onPress={openAuth}
              className="mt-3 self-start rounded-full border border-white/20 bg-white/90 px-4 py-2.5"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-xs font-semibold text-black">Iniciar sessão</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : error ? (
          <View className="gap-2 border-b border-rose-200/30 pb-4">
            <Text className="text-red-300 text-sm mb-3">{getStoreErrorMessage(error)}</Text>
            <Pressable
              onPress={() => cart.refetch()}
              className="self-start rounded-full border border-white/20 bg-white/10 px-4 py-2.5"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-xs font-semibold text-white">Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-4">
            {cart.data?.cart.bundles.map((bundle, index, list) => (
              <View
                key={`bundle-${bundle.bundleKey}`}
                className={index < list.length - 1 ? "border-b border-white/10 pb-3" : "pb-1"}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold">{bundle.name}</Text>
                    <Text className="mt-1 text-white/65 text-xs">{bundle.items.length} itens por pack</Text>
                    <Text className="mt-1 text-white text-sm font-semibold">
                      {formatMoney(bundle.totalCents, currency)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      disabled={mutations.busy}
                      onPress={() => adjustBundleQuantity(bundle.bundleKey, bundle.quantity - 1)}
                      className="h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5"
                    >
                      <Ionicons name="remove" size={15} color="white" />
                    </Pressable>
                    <Text className="min-w-[22px] text-center text-white text-sm font-semibold">{bundle.quantity}</Text>
                    <Pressable
                      disabled={mutations.busy}
                      onPress={() => adjustBundleQuantity(bundle.bundleKey, bundle.quantity + 1)}
                      className="h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5"
                    >
                      <Ionicons name="add" size={15} color="white" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {cart.data?.cart.items.map((item, index, list) => (
              <View
                key={`item-${item.id}`}
                className={index < list.length - 1 ? "border-b border-white/10 pb-3" : "pb-1"}
              >
                <View className="flex-row gap-3">
                  {item.product.images?.[0]?.url ? (
                    <Image
                      source={{ uri: item.product.images[0].url }}
                      style={{ width: 72, height: 72, borderRadius: 12 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-[72px] w-[72px] items-center justify-center rounded-xl bg-white/5">
                      <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.45)" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold">{item.product.name}</Text>
                    {item.variant?.label ? <Text className="text-white/65 text-xs">{item.variant.label}</Text> : null}
                    <Text className="mt-1 text-white text-sm font-semibold">
                      {formatMoney(item.unitPriceCents * item.quantity, currency)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      disabled={mutations.busy}
                      onPress={() => adjustItemQuantity(item.id, item.quantity - 1)}
                      className="h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5"
                    >
                      <Ionicons name="remove" size={15} color="white" />
                    </Pressable>
                    <Text className="min-w-[22px] text-center text-white text-sm font-semibold">{item.quantity}</Text>
                    <Pressable
                      disabled={mutations.busy}
                      onPress={() => adjustItemQuantity(item.id, item.quantity + 1)}
                      className="h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5"
                    >
                      <Ionicons name="add" size={15} color="white" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {totals.itemCount === 0 ? (
              <View className="border-b border-white/12 pb-3">
                <Text className="text-white/70 text-sm">O carrinho está vazio.</Text>
              </View>
            ) : (
              <View className="gap-2 border-b border-white/12 pb-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white/70 text-xs">Subtotal</Text>
                  <Text className="text-white text-base font-semibold">{formatMoney(totals.subtotalCents, currency)}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    if (!canCheckout) {
                      openAuth();
                      return;
                    }
                    safePush(router, {
                      pathname: "/store/[username]/checkout",
                      params: { username, storeId: String(storeId), subtotalCents: String(totals.subtotalCents) },
                    });
                  }}
                  disabled={!canCheckout}
                  className={`mt-4 rounded-2xl px-4 py-3 ${canCheckout ? "bg-white" : "bg-white/15"}`}
                  accessibilityRole="button"
                  accessibilityLabel="Avançar para checkout"
                  accessibilityState={{ disabled: !canCheckout }}
                >
                  <Text className={`text-center text-sm font-semibold ${canCheckout ? "text-black" : "text-white/65"}`}>
                    Avançar para checkout
                  </Text>
                </Pressable>
              </View>
            )}

            {inlineError ? (
              <View className="border-b border-rose-200/30 pb-3">
                <Text className="text-rose-200 text-xs">{inlineError}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
