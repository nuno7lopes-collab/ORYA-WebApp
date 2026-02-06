import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { fetchCheckoutStatus } from "../../features/checkout/api";
import { CheckoutStatusResponse } from "../../features/checkout/types";
import { getUserFacingError } from "../../lib/errors";

const resolveStatusCopy = (status?: string | null) => {
  if (status === "PAID") {
    return {
      title: "Bilhete confirmado",
      message: "O bilhete é teu e já está disponível na carteira.",
    };
  }
  if (status === "FAILED") {
    return {
      title: "Não foi possível concluir",
      message: "Houve um problema ao confirmar a inscrição.",
    };
  }
  return {
    title: "A confirmar a inscrição",
    message: "Estamos a finalizar. Pode demorar alguns segundos.",
  };
};

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    purchaseId?: string | string[];
    paymentIntentId?: string | string[];
    eventTitle?: string | string[];
    slug?: string | string[];
  }>();
  const purchaseId = useMemo(() => {
    const raw = Array.isArray(params.purchaseId) ? params.purchaseId[0] : params.purchaseId;
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized || null;
  }, [params.purchaseId]);
  const paymentIntentId = useMemo(() => {
    const raw = Array.isArray(params.paymentIntentId) ? params.paymentIntentId[0] : params.paymentIntentId;
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized || null;
  }, [params.paymentIntentId]);
  const eventTitle = useMemo(
    () => (Array.isArray(params.eventTitle) ? params.eventTitle[0] : params.eventTitle) ?? "Evento",
    [params.eventTitle],
  );
  const slug = useMemo(
    () => (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? null,
    [params.slug],
  );

  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const runStatusCheck = useCallback(async () => {
    if (!purchaseId && !paymentIntentId) return null;
    setChecking(true);
    try {
      const next = await fetchCheckoutStatus({
        purchaseId: purchaseId ?? undefined,
        paymentIntentId: paymentIntentId ?? undefined,
      });
      setStatus(next);
      setError(null);
      return next;
    } catch (err) {
      setError(getUserFacingError(err, "Não foi possível confirmar a inscrição."));
      return null;
    } finally {
      setChecking(false);
    }
  }, [paymentIntentId, purchaseId]);

  useEffect(() => {
    if (!purchaseId && !paymentIntentId) {
      setError("Não foi possível localizar a inscrição.");
      return;
    }
    runStatusCheck();
  }, [paymentIntentId, purchaseId, runStatusCheck]);

  useEffect(() => {
    if (!status) return;
    if (status.status !== "PENDING" && status.status !== "PROCESSING") return;
    const timer = setTimeout(() => {
      runStatusCheck();
    }, 4000);
    return () => clearTimeout(timer);
  }, [runStatusCheck, status]);

  const copy = resolveStatusCopy(status?.status ?? null);
  const isPaid = status?.status === "PAID";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground variant="solid">
        <View className="px-5 pt-12 pb-6">
          <Pressable
            onPress={() => (slug ? router.replace({ pathname: "/event/[slug]", params: { slug } }) : router.back())}
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
              <Text className="text-white text-sm font-semibold">{eventTitle}</Text>
              <Text className="text-white text-2xl font-semibold">{copy.title}</Text>
              <Text className="text-white/70 text-sm">{copy.message}</Text>
              {!isPaid ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="white" />
                  <Text className="text-white/70 text-sm">A verificar estado…</Text>
                </View>
              ) : null}
            </View>
          </GlassCard>

          {error ? (
            <GlassCard intensity={50}>
              <Text className="text-red-300 text-sm">{error}</Text>
            </GlassCard>
          ) : null}

          <Pressable
            onPress={() => router.replace("/(tabs)/tickets")}
            className="rounded-2xl bg-white/15 px-4 py-4"
            style={{ minHeight: tokens.layout.touchTarget, alignItems: "center", justifyContent: "center" }}
            disabled={checking}
          >
            <Text className="text-center text-white text-sm font-semibold">Ver bilhetes</Text>
          </Pressable>
        </View>
      </LiquidBackground>
    </>
  );
}
