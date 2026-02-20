import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { useAuth } from "../../../lib/auth";
import { tokens } from "@orya/shared";
import { getStoreErrorMessage } from "../../../features/store/errors";
import { useStorePurchase, useStoreReceiptMutation } from "../../../features/store/hooks";
import { getMobileEnv } from "../../../lib/env";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { safePush } from "../../../lib/navigation";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function StorePurchaseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = useMemo(() => {
    const raw = typeof params.orderId === "string" ? Number(params.orderId) : NaN;
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [params.orderId]);
  const { session } = useAuth();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const detail = useStorePurchase(orderId, Boolean(session?.user?.id && orderId));
  const receipt = useStoreReceiptMutation();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const openAuth = () => {
    const next = orderId ? `/store/purchases/${orderId}` : "/store/purchases";
    router.replace({ pathname: "/auth", params: { next } });
  };

  const handleReceipt = async () => {
    if (!orderId) return;
    setInlineError(null);
    try {
      const url = await receipt.mutateAsync(orderId);
      await Linking.openURL(url);
    } catch (error) {
      setInlineError(getStoreErrorMessage(error, "Não foi possível abrir o recibo."));
    }
  };

  const handleInvoice = async () => {
    if (!orderId || !session?.access_token) return;
    setInlineError(null);
    setInvoiceLoading(true);
    try {
      const baseUrl = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
      const url = `${baseUrl}/api/me/purchases/store/${orderId}/invoice`;
      const baseDir = FileSystem.Paths.cache?.uri ?? FileSystem.Paths.document?.uri ?? null;
      if (!baseDir) throw new Error("Não foi possível preparar o ficheiro da fatura.");
      const output = `${baseDir}store-invoice-${orderId}.pdf`;

      const result = await LegacyFileSystem.downloadAsync(url, output, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error("Partilha indisponível neste dispositivo.");
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      setInlineError(getStoreErrorMessage(error, "Não foi possível gerar a fatura."));
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Detalhe da compra"
        leftSlot={
          <Pressable
            onPress={() => router.replace("/store/purchases")}
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
            <Text className="text-white text-base font-semibold">Inicia sessão para ver o detalhe</Text>
            <Pressable
              onPress={openAuth}
              className="mt-3 self-start rounded-full border border-white/20 bg-white/90 px-4 py-2.5"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-xs font-semibold text-black">Iniciar sessão</Text>
            </Pressable>
          </View>
        ) : detail.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : detail.isError || !detail.data ? (
          <View className="border-b border-rose-200/30 pb-3">
            <Text className="text-red-300 text-sm">{getStoreErrorMessage(detail.error)}</Text>
          </View>
        ) : (
          <View className="gap-4">
            <View className="border-b border-white/12 pb-4">
              <Text className="text-white text-base font-semibold">{detail.data.store.displayName}</Text>
              <Text className="mt-1 text-white/65 text-xs">{detail.data.orderNumber ?? `#${detail.data.id}`}</Text>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-white/65 text-xs">Estado</Text>
                <Text className="text-white text-sm font-semibold">{detail.data.status}</Text>
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-white/65 text-xs">Pago</Text>
                <Text className="text-white text-sm font-semibold">
                  {formatMoney(detail.data.totalCents, detail.data.currency)}
                </Text>
              </View>
              {detail.data.createdAt ? (
                <Text className="mt-2 text-white/60 text-xs">{formatDate(detail.data.createdAt)}</Text>
              ) : null}
            </View>

            <View className="border-b border-white/12 pb-4">
              <Text className="text-white text-sm font-semibold">Linhas</Text>
              <View className="mt-3 gap-3">
                {detail.data.lines.map((line, index, list) => (
                  <View
                    key={`line-${line.id}`}
                    className={index < list.length - 1 ? "border-b border-white/10 pb-3" : "pb-1"}
                  >
                    <Text className="text-white text-sm font-semibold">{line.name}</Text>
                    <View className="mt-1 flex-row items-center justify-between">
                      <Text className="text-white/65 text-xs">Qtd {line.quantity}</Text>
                      <Text className="text-white text-sm font-semibold">
                        {formatMoney(line.totalCents, detail.data.currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View className="border-b border-white/12 pb-4">
              <Text className="text-white text-sm font-semibold">Ações</Text>
              <View className="mt-3 gap-2">
                <Pressable
                  onPress={handleReceipt}
                  disabled={receipt.isPending}
                  className="rounded-xl bg-white px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="Abrir recibo"
                >
                  <Text className="text-center text-sm font-semibold text-black">
                    {receipt.isPending ? "A abrir recibo..." : "Abrir recibo"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleInvoice}
                  disabled={invoiceLoading}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="Descarregar fatura"
                >
                  <Text className="text-center text-sm font-semibold text-white">
                    {invoiceLoading ? "A preparar fatura..." : "Descarregar fatura"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => safePush(router, "/store/downloads")}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="Ir para descargas"
                >
                  <Text className="text-center text-sm font-semibold text-white">Descargas digitais</Text>
                </Pressable>
              </View>
              {inlineError ? <Text className="mt-3 text-rose-200 text-xs">{inlineError}</Text> : null}
            </View>
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
