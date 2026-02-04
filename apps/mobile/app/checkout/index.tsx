import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@orya/shared";
import { useStripe, isPlatformPaySupported } from "@stripe/stripe-react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useCheckoutStore } from "../../features/checkout/store";
import { createCheckoutIntent, fetchCheckoutStatus } from "../../features/checkout/api";
import { CheckoutMethod } from "../../features/checkout/types";
import { useAuth } from "../../lib/auth";
import { getMobileEnv } from "../../lib/env";

const formatMoney = (cents: number, currency?: string | null): string => {
  if (!Number.isFinite(cents)) return "—";
  if (cents <= 0) return "Grátis";
  const amount = cents / 100;
  return `${amount.toFixed(0)} ${currency?.toUpperCase() || "EUR"}`;
};

const resolveMethodLabel = (method: CheckoutMethod) => {
  if (method === "apple_pay") return "Apple Pay";
  if (method === "mbway") return "MBWay";
  return "Cartão";
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const env = getMobileEnv();
  const stripeKey = env.stripePublishableKey ?? "";
  const merchantId = env.appleMerchantId ?? null;
  const [applePaySupported, setApplePaySupported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const draft = useCheckoutStore((state) => state.draft);
  const setPaymentMethod = useCheckoutStore((state) => state.setPaymentMethod);
  const setIntent = useCheckoutStore((state) => state.setIntent);
  const clearDraft = useCheckoutStore((state) => state.clearDraft);
  const isExpired = useCheckoutStore((state) => state.isExpired);

  useEffect(() => {
    let mounted = true;
    isPlatformPaySupported({ applePay: { merchantCountryCode: "PT" } })
      .then((supported) => {
        if (mounted) setApplePaySupported(Boolean(supported));
      })
      .catch(() => {
        if (mounted) setApplePaySupported(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const allowApplePay = Boolean(merchantId && applePaySupported);
  const selectedMethod = draft?.paymentMethod ?? (allowApplePay ? "apple_pay" : "card");

  const lineItems = draft?.breakdown?.lines ?? [];
  const totalLabel = formatMoney(draft?.totalCents ?? 0, draft?.currency);
  const canPay = Boolean(draft && session?.user?.id && stripeKey);

  const statusPill = useMemo(() => {
    if (!draft) return null;
    if (isExpired()) return { label: "Sessão expirou", variant: "muted" as const };
    if (draft.clientSecret) return { label: "Sessão ativa", variant: "accent" as const };
    return null;
  }, [draft, isExpired]);

  useEffect(() => {
    if (!draft) return;
    if (!draft.paymentMethod) {
      setPaymentMethod(allowApplePay ? "apple_pay" : "card");
    }
  }, [allowApplePay, draft, setPaymentMethod]);

  const runStatusCheck = async (params: { purchaseId?: string | null; paymentIntentId?: string | null }) => {
    const status = await fetchCheckoutStatus(params);
    if (status.status === "PAID") {
      setStatusMessage("Compra confirmada. O teu bilhete já está na carteira.");
      clearDraft();
      router.replace("/(tabs)/tickets");
      return;
    }
    if (status.status === "PROCESSING" || status.status === "PENDING") {
      setStatusMessage("Pagamento em processamento. Vais receber uma notificação quando terminar.");
      return;
    }
    if (status.status === "REQUIRES_ACTION") {
      setStatusMessage("Pagamento precisa de ação adicional.");
      return;
    }
    if (status.status === "FAILED") {
      setError("Pagamento falhou. Tenta novamente.");
    }
  };

  const handlePay = async () => {
    if (!draft) return;
    if (!session?.user?.id) {
      router.push("/sign-in");
      return;
    }
    if (!stripeKey) {
      setError("Pagamentos indisponíveis. Atualiza as chaves Stripe.");
      return;
    }

    setError(null);
    setStatusMessage(null);
    setProcessing(true);

    try {
      const expired = isExpired();
      const needsNewIntent = !draft.clientSecret || expired;
      let clientSecret = draft.clientSecret ?? null;
      let purchaseId = draft.purchaseId ?? null;
      let paymentIntentId = draft.paymentIntentId ?? null;

      if (needsNewIntent) {
        const response = await createCheckoutIntent({
          slug: draft.slug,
          ticketTypeId: draft.ticketTypeId,
          quantity: draft.quantity,
          paymentMethod: selectedMethod,
          purchaseId: draft.purchaseId ?? undefined,
          paymentScenario: draft.totalCents <= 0 ? "FREE_CHECKOUT" : "SINGLE",
        });
        clientSecret = response.clientSecret ?? null;
        purchaseId = response.purchaseId ?? null;
        paymentIntentId = response.paymentIntentId ?? null;
        setIntent({
          clientSecret,
          paymentIntentId,
          purchaseId,
          breakdown: response.breakdown ?? null,
          freeCheckout: response.freeCheckout ?? response.isGratisCheckout ?? false,
        });

        if (response.freeCheckout || response.isGratisCheckout || (response.amount ?? 0) <= 0) {
          await runStatusCheck({ purchaseId });
          setProcessing(false);
          return;
        }
      }

      if (!clientSecret) {
        setError("Não foi possível iniciar o pagamento.");
        setProcessing(false);
        return;
      }

      const init = await initPaymentSheet({
        merchantDisplayName: "ORYA",
        paymentIntentClientSecret: clientSecret,
        returnURL: "orya://checkout-redirect",
        allowsDelayedPaymentMethods: true,
        applePay: allowApplePay
          ? {
              merchantCountryCode: "PT",
              merchantIdentifier: merchantId ?? undefined,
            }
          : undefined,
        style: "automatic",
      });

      if (init.error) {
        setError(init.error.message ?? "Erro ao iniciar pagamento.");
        setProcessing(false);
        return;
      }

      const presented = await presentPaymentSheet();
      if (presented.error) {
        setError(presented.error.message ?? "Pagamento cancelado.");
        setProcessing(false);
        return;
      }

      await runStatusCheck({
        purchaseId,
        paymentIntentId,
      });
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível concluir o pagamento.");
    } finally {
      setProcessing(false);
    }
  };

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
          {!draft ? (
            <GlassCard intensity={52}>
              <Text className="text-white/70 text-sm mb-3">Sem checkout ativo no momento.</Text>
              <Pressable
                className="rounded-xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                onPress={() => router.replace("/(tabs)/discover")}
              >
                <Text className="text-white text-sm font-semibold text-center">Voltar ao Discover</Text>
              </Pressable>
            </GlassCard>
          ) : (
            <>
              <GlassCard intensity={60} highlight>
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white text-sm font-semibold">Checkout</Text>
                    {statusPill ? <GlassPill label={statusPill.label} variant={statusPill.variant} /> : null}
                  </View>
                  <Text className="text-white text-lg font-semibold" numberOfLines={2}>
                    {draft.eventTitle ?? "Evento"}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/70 text-sm">{draft.ticketName ?? "Bilhete"}</Text>
                    <GlassPill label={`${draft.quantity}x`} variant="muted" />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/60 text-sm">Total</Text>
                    <Text className="text-white text-xl font-semibold">{totalLabel}</Text>
                  </View>
                  {lineItems.length > 0 ? (
                    <View className="gap-1 pt-2">
                      {lineItems.map((line) => (
                        <View key={`${line.ticketTypeId}-${line.name}`} className="flex-row justify-between">
                          <Text className="text-white/55 text-xs">
                            {line.name} · {line.quantity}x
                          </Text>
                          <Text className="text-white/60 text-xs">{formatMoney(line.lineTotalCents, line.currency)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </GlassCard>

              <GlassCard intensity={52}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Método de pagamento</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {([
                      { key: "apple_pay", label: "Apple Pay", enabled: allowApplePay },
                      { key: "card", label: "Cartão", enabled: true },
                      { key: "mbway", label: "MBWay", enabled: true },
                    ] as const).map((option) => {
                      if (!option.enabled) return null;
                      const active = selectedMethod === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => setPaymentMethod(option.key)}
                          className={active ? "rounded-full bg-white/20 px-4 py-2" : "rounded-full border border-white/10 bg-white/5 px-4 py-2"}
                          style={{ minHeight: tokens.layout.touchTarget }}
                        >
                          <Text className={active ? "text-white text-sm font-semibold" : "text-white/70 text-sm"}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text className="text-white/55 text-xs">
                    {resolveMethodLabel(selectedMethod)} em checkout nativo, sem sair da app.
                  </Text>
                </View>
              </GlassCard>

              {!session?.user?.id ? (
                <GlassCard intensity={48}>
                  <Text className="text-white/70 text-sm mb-3">Inicia sessão para concluir a compra.</Text>
                  <Pressable
                    className="rounded-xl bg-white/10 px-4 py-3"
                    onPress={() => router.push("/sign-in")}
                    style={{ minHeight: tokens.layout.touchTarget }}
                  >
                    <Text className="text-white text-sm font-semibold text-center">Entrar / Criar conta</Text>
                  </Pressable>
                </GlassCard>
              ) : null}

              {error ? (
                <GlassCard intensity={50}>
                  <Text className="text-red-300 text-sm">{error}</Text>
                </GlassCard>
              ) : null}

              {statusMessage ? (
                <GlassCard intensity={50}>
                  <Text className="text-white/75 text-sm">{statusMessage}</Text>
                </GlassCard>
              ) : null}

              <Pressable
                disabled={!canPay || processing}
                onPress={handlePay}
                className={canPay ? "rounded-2xl bg-white/15 px-4 py-4" : "rounded-2xl border border-white/10 bg-white/5 px-4 py-4"}
                style={{ minHeight: tokens.layout.touchTarget, alignItems: "center", justifyContent: "center" }}
              >
                {processing ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color="white" />
                    <Text className="text-white text-sm font-semibold">A processar...</Text>
                  </View>
                ) : (
                  <Text className={canPay ? "text-center text-white text-sm font-semibold" : "text-center text-white/50 text-sm font-semibold"}>
                    {draft.totalCents <= 0 ? "Confirmar inscrição" : "Pagar agora"}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </LiquidBackground>
    </>
  );
}
