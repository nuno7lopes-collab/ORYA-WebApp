import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "../../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../../components/liquid/GlassCard";
import { TopAppHeader } from "../../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../../components/navigation/useTopBarScroll";
import { safeBack } from "../../../../lib/navigation";
import { tokens } from "@orya/shared";
import { useAuth } from "../../../../lib/auth";
import { useStoreCartMutations, useStoreProduct } from "../../../../features/store/hooks";
import { getStoreErrorMessage } from "../../../../features/store/errors";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

export default function StoreProductScreen() {
  const params = useLocalSearchParams<{ username?: string; slug?: string; storeId?: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const slug = typeof params.slug === "string" ? params.slug : "";
  const storeId = Number(params.storeId ?? 0);
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });

  const query = useStoreProduct(username, slug, Boolean(username && slug));
  const mutations = useStoreCartMutations(Number.isFinite(storeId) && storeId > 0 ? storeId : query.data?.store.id ?? null);

  const variants = query.data?.product?.variants ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );

  const resolvedStoreId = Number.isFinite(storeId) && storeId > 0 ? storeId : query.data?.store.id ?? null;
  const unitPriceCents = selectedVariant?.priceCents ?? query.data?.product.priceCents ?? 0;
  const totalLabel = formatMoney(unitPriceCents * quantity, query.data?.product.currency ?? "EUR");

  const openAuth = () => {
    const next = `/store/${encodeURIComponent(username)}/product/${encodeURIComponent(slug)}`;
    router.push({ pathname: "/auth", params: { next } });
  };

  const addToCart = async () => {
    if (!session?.user?.id) {
      openAuth();
      return;
    }
    if (!resolvedStoreId) {
      setInlineError("Não foi possível identificar a loja.");
      return;
    }
    setSubmitting(true);
    setInlineError(null);
    try {
      await mutations.addItem.mutateAsync({
        storeId: resolvedStoreId,
        productId: query.data?.product.id ?? 0,
        variantId: selectedVariantId,
        quantity,
        personalization: {},
      });
      router.push({ pathname: "/store/[username]/cart", params: { username, storeId: String(resolvedStoreId) } });
    } catch (error) {
      setInlineError(getStoreErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={query.data?.product.name ?? "Produto"}
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
        {query.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : query.isError || !query.data ? (
          <GlassCard intensity={54}>
            <Text className="text-red-300 text-sm mb-3">{getStoreErrorMessage(query.error)}</Text>
            <Pressable
              onPress={() => query.refetch()}
              className="rounded-xl bg-white/10 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-center text-sm font-semibold text-white">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="gap-4">
            {query.data.product.images?.[0]?.url ? (
              <Image
                source={{ uri: query.data.product.images[0].url }}
                style={{ width: "100%", height: 280, borderRadius: 18 }}
                contentFit="cover"
              />
            ) : null}

            <GlassCard intensity={48}>
              <Text className="text-white text-lg font-semibold">{query.data.product.name}</Text>
              {query.data.product.shortDescription ? (
                <Text className="mt-1 text-white/65 text-sm">{query.data.product.shortDescription}</Text>
              ) : null}
              <Text className="mt-3 text-white text-xl font-semibold">
                {formatMoney(unitPriceCents, query.data.product.currency)}
              </Text>
              {query.data.product.compareAtPriceCents ? (
                <Text className="text-white/50 text-sm line-through">
                  {formatMoney(query.data.product.compareAtPriceCents, query.data.product.currency)}
                </Text>
              ) : null}
              {query.data.product.description ? (
                <Text className="mt-3 text-white/70 text-sm">{query.data.product.description}</Text>
              ) : null}
            </GlassCard>

            {variants.length > 0 ? (
              <GlassCard intensity={42}>
                <Text className="text-white text-sm font-semibold mb-2">Variantes</Text>
                <View className="flex-row flex-wrap gap-2">
                  {variants.map((variant) => {
                    const active = selectedVariantId === variant.id;
                    return (
                      <Pressable
                        key={`variant-${variant.id}`}
                        onPress={() => setSelectedVariantId(variant.id)}
                        className={`rounded-full border px-3 py-2 ${
                          active ? "border-sky-300/60 bg-sky-400/25" : "border-white/15 bg-white/5"
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${active ? "text-sky-100" : "text-white/75"}`}>
                          {variant.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            ) : null}

            <GlassCard intensity={42}>
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-sm font-semibold">Quantidade</Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5"
                  >
                    <Ionicons name="remove" size={16} color="white" />
                  </Pressable>
                  <Text className="min-w-[28px] text-center text-white text-sm font-semibold">{quantity}</Text>
                  <Pressable
                    onPress={() => setQuantity((value) => Math.min(20, value + 1))}
                    className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5"
                  >
                    <Ionicons name="add" size={16} color="white" />
                  </Pressable>
                </View>
              </View>

              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-white/70 text-xs">Total</Text>
                <Text className="text-white text-base font-semibold">{totalLabel}</Text>
              </View>

              {inlineError ? <Text className="mt-3 text-rose-200 text-xs">{inlineError}</Text> : null}

              <Pressable
                onPress={addToCart}
                disabled={submitting || !resolvedStoreId}
                className="mt-4 rounded-2xl bg-white px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel="Adicionar ao carrinho"
                accessibilityState={{ disabled: submitting || !resolvedStoreId }}
              >
                <Text className="text-center text-sm font-semibold text-black">
                  {submitting ? "A adicionar..." : "Adicionar ao carrinho"}
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
