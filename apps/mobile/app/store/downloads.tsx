import { ActivityIndicator, Pressable, ScrollView, Text, View, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useAuth } from "../../lib/auth";
import { tokens } from "@orya/shared";
import { getStoreErrorMessage } from "../../features/store/errors";
import { useStoreDigitalDownloadMutation, useStoreDigitalGrants } from "../../features/store/hooks";

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function StoreDownloadsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const grants = useStoreDigitalGrants(undefined, Boolean(session?.user?.id));
  const download = useStoreDigitalDownloadMutation();

  const openAuth = () => {
    router.replace({ pathname: "/auth", params: { next: "/store/downloads" } });
  };

  const handleDownload = async (grantId: number, assetId: number) => {
    try {
      const signed = await download.mutateAsync({ grantId, assetId });
      await Linking.openURL(signed.url);
    } catch {
      // handled in UI
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Descargas digitais"
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
            <Text className="text-white text-base font-semibold">Inicia sessão para descarregar ficheiros</Text>
            <Pressable
              onPress={openAuth}
              className="mt-4 rounded-xl bg-white px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-center text-sm font-semibold text-black">Iniciar sessão</Text>
            </Pressable>
          </GlassCard>
        ) : grants.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : grants.isError ? (
          <GlassCard intensity={52}>
            <Text className="text-red-300 text-sm">{getStoreErrorMessage(grants.error)}</Text>
          </GlassCard>
        ) : (
          <View className="gap-3">
            {(grants.data ?? []).length ? (
              (grants.data ?? []).map((grant) => (
                <GlassCard key={`grant-${grant.id}`} intensity={46}>
                  <Text className="text-white text-sm font-semibold">{grant.product.name}</Text>
                  <Text className="mt-1 text-white/65 text-xs">
                    {grant.store.displayName} · {grant.order.orderNumber ?? `#${grant.order.id}`}
                  </Text>
                  {grant.expiresAt ? (
                    <Text className="mt-1 text-white/55 text-xs">Expira em {formatDate(grant.expiresAt)}</Text>
                  ) : null}

                  <View className="mt-3 gap-2">
                    {grant.assets.map((asset) => (
                      <Pressable
                        key={`asset-${asset.id}`}
                        onPress={() => handleDownload(grant.id, asset.id)}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-3"
                        accessibilityRole="button"
                        accessibilityLabel={`Descarregar ${asset.filename}`}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="flex-1 text-white text-sm font-semibold" numberOfLines={1}>
                            {asset.filename}
                          </Text>
                          <Ionicons name="download-outline" size={18} color="rgba(255,255,255,0.9)" />
                        </View>
                        <Text className="mt-1 text-white/60 text-xs">{asset.mimeType}</Text>
                      </Pressable>
                    ))}
                  </View>
                </GlassCard>
              ))
            ) : (
              <GlassCard intensity={46}>
                <Text className="text-white/70 text-sm">Ainda não tens descargas digitais disponíveis.</Text>
              </GlassCard>
            )}

            {download.isError ? (
              <GlassCard intensity={48}>
                <Text className="text-rose-200 text-xs">{getStoreErrorMessage(download.error)}</Text>
              </GlassCard>
            ) : null}
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
