import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";

const formatMoney = (cents: number, currency?: string | null): string => {
  if (!Number.isFinite(cents)) return "—";
  if (cents <= 0) return "Grátis";
  const amount = cents / 100;
  return `${amount.toFixed(0)} ${currency?.toUpperCase() || "EUR"}`;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { eventTitle, ticketName, quantity, totalCents, currency } = useLocalSearchParams<{
    eventTitle?: string;
    ticketName?: string;
    quantity?: string;
    totalCents?: string;
    currency?: string;
  }>();

  const qty = Number(quantity ?? "1");
  const total = Number(totalCents ?? "0");
  const totalLabel = formatMoney(total, currency);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground variant="deep">
        <View className="px-5 pt-12 pb-6">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-2"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
            <Text className="text-white text-sm font-semibold">Voltar</Text>
          </Pressable>
        </View>

        <View className="px-5 gap-4">
          <GlassCard intensity={60} highlight>
            <View className="gap-3">
              <Text className="text-white text-sm font-semibold">Checkout</Text>
              <Text className="text-white text-lg font-semibold" numberOfLines={2}>
                {eventTitle ?? "Evento"}
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-white/70 text-sm">{ticketName ?? "Bilhete"}</Text>
                <GlassPill label={`${qty}x`} variant="muted" />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-white/60 text-sm">Total</Text>
                <Text className="text-white text-xl font-semibold">{totalLabel}</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard intensity={52}>
            <View className="gap-2">
              <Text className="text-white text-sm font-semibold">Pagamento nativo</Text>
              <Text className="text-white/70 text-sm">
                Estamos a preparar Apple Pay + cartão + MBWay dentro da app. Nesta fase,
                este ecrã valida a seleção e garante que o fluxo está pronto para o checkout
                nativo sem sair da aplicação.
              </Text>
            </View>
          </GlassCard>

          <Pressable
            disabled
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Text className="text-center text-white/50 text-sm font-semibold">
              Continuar para pagamento (em breve)
            </Text>
          </Pressable>
        </View>
      </LiquidBackground>
    </>
  );
}
