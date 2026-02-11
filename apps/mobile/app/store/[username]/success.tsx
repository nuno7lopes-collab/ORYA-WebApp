import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../components/liquid/GlassCard";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

export default function StoreCheckoutSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    username?: string;
    orderId?: string;
    orderNumber?: string;
    amountCents?: string;
    currency?: string;
  }>();

  const username = typeof params.username === "string" ? params.username : "";
  const orderId = typeof params.orderId === "string" ? Number(params.orderId) : null;
  const orderNumber = typeof params.orderNumber === "string" ? params.orderNumber : null;
  const amount = typeof params.amountCents === "string" ? Number(params.amountCents) : null;
  const currency = typeof params.currency === "string" ? params.currency : "EUR";

  return (
    <LiquidBackground variant="solid">
      <View className="flex-1 justify-center px-5">
        <GlassCard intensity={62}>
          <Text className="text-white text-2xl font-semibold">Compra confirmada</Text>
          <Text className="mt-2 text-white/70 text-sm">
            A tua encomenda foi registada e já está disponível na carteira de compras.
          </Text>
          {orderNumber ? (
            <Text className="mt-4 text-white text-sm font-semibold">Encomenda {orderNumber}</Text>
          ) : null}
          {amount !== null ? (
            <Text className="mt-1 text-white/70 text-xs">Total pago: {formatMoney(amount, currency)}</Text>
          ) : null}

          <View className="mt-5 gap-2">
            <Pressable
              onPress={() =>
                router.replace(
                  orderId
                    ? { pathname: "/store/purchases/[orderId]", params: { orderId: String(orderId) } }
                    : "/store/purchases",
                )
              }
              className="rounded-2xl bg-white px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Ver compra"
            >
              <Text className="text-center text-sm font-semibold text-black">Ver compra</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace({ pathname: "/store/[username]", params: { username } })}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Voltar à loja"
            >
              <Text className="text-center text-sm font-semibold text-white">Voltar à loja</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </LiquidBackground>
  );
}
