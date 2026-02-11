import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { useStoreBundles, useStoreCatalog, useStoreCart } from "../../../features/store/hooks";
import { useStoreCartStore } from "../../../features/store/cartStore";
import { getStoreErrorMessage } from "../../../features/store/errors";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../../../lib/navigation";
import { tokens } from "@orya/shared";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

export default function StorefrontScreen() {
  const params = useLocalSearchParams<{ username?: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const router = useRouter();
  const navigation = useNavigation();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const catalog = useStoreCatalog(username, Boolean(username));
  const storeId = catalog.data?.store?.id ?? null;
  useStoreCart(storeId, Boolean(storeId));
  const bundlesQuery = useStoreBundles(storeId, Boolean(storeId));
  const cartCount = useStoreCartStore((state) => state.itemCount());
  const bundles = bundlesQuery.data?.items ?? catalog.data?.bundles ?? [];

  const subtitle = useMemo(() => {
    if (!catalog.data?.store) return "Loja";
    if (catalog.data.store.resolvedState === "LOCKED") return "Catálogo em atualização";
    if (catalog.data.store.resolvedState === "CHECKOUT_DISABLED") return "Checkout temporariamente indisponível";
    return "Produtos oficiais";
  }, [catalog.data?.store]);

  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, `/${username}`)}
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

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={catalog.data?.store.displayName ?? "Loja"}
        leftSlot={backButton}
        rightSlot={
          <View className="flex-row items-center gap-2">
            <Link href="/store/purchases" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Compras"
                style={{
                  width: tokens.layout.touchTarget,
                  height: tokens.layout.touchTarget,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="receipt-outline" size={20} color="rgba(255,255,255,0.92)" />
              </Pressable>
            </Link>
            <Link
              href={{ pathname: "/store/[username]/cart", params: { username, storeId: String(storeId ?? "") } }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Carrinho"
                style={{
                  width: tokens.layout.touchTarget,
                  height: tokens.layout.touchTarget,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View>
                  <Ionicons name="cart-outline" size={20} color="rgba(255,255,255,0.92)" />
                  {cartCount > 0 ? (
                    <View className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-sky-400 px-1 py-[1px]">
                      <Text className="text-center text-[10px] font-semibold text-black">{cartCount}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </Link>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: 40 }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        <Text className="mb-4 text-sm text-white/65">{subtitle}</Text>

        {catalog.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : catalog.isError ? (
          <GlassCard intensity={54}>
            <Text className="text-red-300 text-sm mb-3">{getStoreErrorMessage(catalog.error)}</Text>
            <Pressable
              onPress={() => catalog.refetch()}
              className="rounded-xl bg-white/10 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-center text-sm font-semibold text-white">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="gap-5">
            {bundles.length ? (
              <View className="gap-3">
                <Text className="text-white text-base font-semibold">Packs</Text>
                {bundles.map((bundle) => (
                  <GlassCard key={`bundle-${bundle.id}`} intensity={48}>
                    <View className="gap-2">
                      <Text className="text-white text-sm font-semibold">{bundle.name}</Text>
                      {bundle.description ? (
                        <Text className="text-white/65 text-xs">{bundle.description}</Text>
                      ) : null}
                      <Text className="text-emerald-200 text-sm font-semibold">
                        {formatMoney(bundle.totalCents, bundle.currency)}
                      </Text>
                      <Text className="text-white/55 text-[11px]">
                        Poupa {formatMoney(bundle.discountCents, bundle.currency)}
                      </Text>
                    </View>
                  </GlassCard>
                ))}
              </View>
            ) : null}

            <View className="gap-3">
              <Text className="text-white text-base font-semibold">Produtos</Text>
              {catalog.data?.products?.length ? (
                catalog.data.products.map((product) => {
                  const image = product.images?.[0]?.url ?? null;
                  return (
                    <Link
                      key={`product-${product.id}`}
                      href={{
                        pathname: "/store/[username]/product/[slug]",
                        params: {
                          username,
                          slug: product.slug,
                          storeId: String(catalog.data?.store.id ?? ""),
                        },
                      }}
                      asChild
                    >
                      <Pressable
                        className="overflow-hidden rounded-2xl border border-white/12 bg-white/5"
                        accessibilityRole="button"
                        accessibilityLabel={`Ver produto ${product.name}`}
                      >
                        {image ? (
                          <Image source={{ uri: image }} style={{ width: "100%", height: 170 }} contentFit="cover" />
                        ) : (
                          <View className="h-[170px] items-center justify-center bg-white/5">
                            <Ionicons name="image-outline" size={26} color="rgba(255,255,255,0.5)" />
                          </View>
                        )}
                        <View className="p-4">
                          <Text className="text-white text-sm font-semibold">{product.name}</Text>
                          {product.shortDescription ? (
                            <Text className="mt-1 text-white/65 text-xs" numberOfLines={2}>
                              {product.shortDescription}
                            </Text>
                          ) : null}
                          <Text className="mt-2 text-white text-sm font-semibold">
                            {formatMoney(product.priceCents, product.currency)}
                          </Text>
                        </View>
                      </Pressable>
                    </Link>
                  );
                })
              ) : (
                <GlassCard intensity={46}>
                  <Text className="text-white/65 text-sm">Sem produtos públicos neste momento.</Text>
                </GlassCard>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
