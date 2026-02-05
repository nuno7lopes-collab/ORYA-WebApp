import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { useStripe, isPlatformPaySupported } from "@stripe/stripe-react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useCheckoutStore } from "../../features/checkout/store";
import { createCheckoutIntent, fetchCheckoutStatus } from "../../features/checkout/api";
import { CheckoutMethod, CheckoutStatusResponse } from "../../features/checkout/types";
import { useAuth } from "../../lib/auth";
import { getMobileEnv } from "../../lib/env";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";

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
  const navigation = useNavigation();
  const { session } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const env = getMobileEnv();
  const stripeKey = env.stripePublishableKey ?? "";
  const merchantId = env.appleMerchantId ?? null;
  const [applePaySupported, setApplePaySupported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatusResponse | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const draft = useCheckoutStore((state) => state.draft);
  const setPaymentMethod = useCheckoutStore((state) => state.setPaymentMethod);
  const setDraft = useCheckoutStore((state) => state.setDraft);
  const setIntent = useCheckoutStore((state) => state.setIntent);
  const resetIntent = useCheckoutStore((state) => state.resetIntent);
  const clearDraft = useCheckoutStore((state) => state.clearDraft);
  const isExpired = useCheckoutStore((state) => state.isExpired);
  const isFocused = useIsFocused();

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

  useEffect(() => {
    if (!draft) {
      setCheckoutStatus(null);
      setError(null);
      return;
    }
    if (!draft.purchaseId && !draft.paymentIntentId) {
      setCheckoutStatus(null);
      setError(null);
    }
  }, [draft?.paymentIntentId, draft?.purchaseId]);

  const allowApplePay = Boolean(merchantId && applePaySupported);
  const selectedMethod = draft?.paymentMethod ?? (allowApplePay ? "apple_pay" : "card");
  const resolvedMethod = !allowApplePay && selectedMethod === "apple_pay" ? "card" : selectedMethod;

  const lineItems = draft?.breakdown?.lines ?? [];
  const totalLabel = formatMoney(draft?.totalCents ?? 0, draft?.currency);
  const isFreeCheckout = Boolean(draft && draft.totalCents <= 0);
  const canPay = Boolean(draft && session?.user?.id && (stripeKey || isFreeCheckout));
  const handleBack = () => {
    safeBack(router, navigation);
  };

  useEffect(() => {
    if (!draft) return;
    if (!isFreeCheckout) return;
    if (draft.quantity === 1) return;
    const { createdAt: _createdAt, expiresAt: _expiresAt, ...payload } = draft;
    setDraft({
      ...payload,
      quantity: 1,
      totalCents: draft.unitPriceCents,
    });
  }, [draft, isFreeCheckout, setDraft]);

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
      return;
    }
    if (!allowApplePay && draft.paymentMethod === "apple_pay") {
      setPaymentMethod("card");
    }
  }, [allowApplePay, draft, setPaymentMethod]);

  const applyCheckoutStatus = useCallback((status: CheckoutStatusResponse) => {
    setCheckoutStatus(status);
    setError(null);
  }, []);

  const runStatusCheck = useCallback(
    async (params?: { purchaseId?: string | null; paymentIntentId?: string | null }) => {
      if (!draft) return null;
      const purchaseId = params?.purchaseId ?? draft.purchaseId ?? null;
      const paymentIntentId = params?.paymentIntentId ?? draft.paymentIntentId ?? null;
      if (!purchaseId && !paymentIntentId) return null;
      setCheckingStatus(true);
      try {
        const status = await fetchCheckoutStatus({ purchaseId, paymentIntentId });
        applyCheckoutStatus(status);
        return status;
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível verificar o pagamento.");
        return null;
      } finally {
        setCheckingStatus(false);
      }
    },
    [applyCheckoutStatus, draft],
  );

  useEffect(() => {
    if (!isFocused) return;
    if (processing) return;
    if (!draft) return;
    if (!draft.purchaseId && !draft.paymentIntentId) return;
    runStatusCheck();
  }, [draft?.paymentIntentId, draft?.purchaseId, isFocused, processing, runStatusCheck]);

  useEffect(() => {
    if (!isFocused) return;
    if (!checkoutStatus) return;
    if (!draft) return;
    if (processing || checkingStatus) return;
    if (checkoutStatus.status !== "PENDING" && checkoutStatus.status !== "PROCESSING") return;
    const timer = setTimeout(() => {
      runStatusCheck();
    }, 6000);
    return () => clearTimeout(timer);
  }, [checkoutStatus, checkingStatus, draft, isFocused, processing, runStatusCheck]);

  const handlePay = async () => {
    if (!draft) return;
    if (!session?.user?.id) {
      router.push("/auth");
      return;
    }
    if (!stripeKey && !isFreeCheckout) {
      setError("Pagamentos indisponíveis. Atualiza as chaves Stripe.");
      return;
    }

    setError(null);
    setCheckoutStatus(null);
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
          paymentMethod: resolvedMethod,
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
          await runStatusCheck({ purchaseId, paymentIntentId });
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
        if (presented.error.code !== "Canceled") {
          setError(presented.error.message ?? "Pagamento cancelado.");
        }
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

  const statusMeta = useMemo(() => {
    if (!draft) return null;
    if (!checkoutStatus) {
      if (isExpired()) {
        return {
          tone: "warning" as const,
          title: "Sessão expirada",
          message: "A sessão de checkout expirou. Recomeça para gerar um novo pagamento.",
          actionLabel: "Recomeçar checkout",
          action: () => {
            resetIntent();
            setCheckoutStatus(null);
            setError(null);
            handlePay();
          },
        };
      }
      return null;
    }

    const status = checkoutStatus.status;
    if (status === "PAID") {
      return {
        tone: "success" as const,
        title: "Pagamento confirmado",
        message: "O teu bilhete já está disponível na carteira.",
        actionLabel: "Ver bilhetes",
        action: () => {
          clearDraft();
          router.replace("/(tabs)/tickets");
        },
      };
    }
    if (status === "FAILED") {
      return {
        tone: "danger" as const,
        title: "Pagamento falhou",
        message: checkoutStatus.errorMessage ?? "Não foi possível concluir o pagamento.",
        actionLabel: "Tentar novamente",
        action: () => {
          resetIntent();
          setCheckoutStatus(null);
          setError(null);
          handlePay();
        },
      };
    }
    if (status === "REQUIRES_ACTION") {
      return {
        tone: "warning" as const,
        title: "Ação necessária",
        message: "Precisas de concluir o pagamento para confirmar a compra.",
        actionLabel: "Continuar pagamento",
        action: () => handlePay(),
      };
    }
    if (status === "REFUNDED") {
      return {
        tone: "warning" as const,
        title: "Pagamento reembolsado",
        message: "O valor foi devolvido. Se quiseres, inicia um novo checkout.",
        actionLabel: "Voltar ao evento",
        action: () => {
          clearDraft();
          router.replace({ pathname: "/event/[slug]", params: { slug: draft.slug } });
        },
      };
    }
    if (status === "DISPUTED") {
      return {
        tone: "warning" as const,
        title: "Pagamento em disputa",
        message: "O pagamento está em disputa. Contacta o suporte se precisares de ajuda.",
      };
    }

    return {
      tone: "info" as const,
      title: status === "PROCESSING" ? "Pagamento em processamento" : "Pagamento pendente",
      message: "Estamos a confirmar o pagamento. Isto pode demorar alguns segundos.",
      actionLabel: "Verificar estado",
      action: () => runStatusCheck(),
      showSpinner: true,
    };
  }, [checkoutStatus, clearDraft, draft, handlePay, isExpired, resetIntent, router, runStatusCheck]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground variant="solid">
        <View className="px-5 pt-12 pb-6">
          <Pressable
            onPress={handleBack}
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
                onPress={() => router.replace("/(tabs)")}
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
                  {!isFreeCheckout && lineItems.length > 0 ? (
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
                  {isFreeCheckout ? (
                    <Text className="text-white/55 text-xs">Limite por pessoa: 1</Text>
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
                    {resolveMethodLabel(resolvedMethod)} em checkout nativo, sem sair da app.
                  </Text>
                </View>
              </GlassCard>

              {!session?.user?.id ? (
                <GlassCard intensity={48}>
                  <Text className="text-white/70 text-sm mb-3">Inicia sessão para concluir a compra.</Text>
                  <Pressable
                    className="rounded-xl bg-white/10 px-4 py-3"
                    onPress={() => router.push("/auth")}
                    style={{ minHeight: tokens.layout.touchTarget }}
                  >
                    <Text className="text-white text-sm font-semibold text-center">Entrar / Criar conta</Text>
                  </Pressable>
                </GlassCard>
              ) : null}

              {statusMeta ? (
                <GlassCard intensity={50}>
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={
                          statusMeta.tone === "success"
                            ? "text-sky-200 text-sm font-semibold"
                            : statusMeta.tone === "danger"
                              ? "text-rose-200 text-sm font-semibold"
                              : statusMeta.tone === "warning"
                                ? "text-amber-200 text-sm font-semibold"
                                : "text-white text-sm font-semibold"
                        }
                      >
                        {statusMeta.title}
                      </Text>
                      {statusMeta.showSpinner || checkingStatus ? (
                        <ActivityIndicator color="white" />
                      ) : null}
                    </View>
                    <Text className="text-white/70 text-sm">{statusMeta.message}</Text>
                    {statusMeta.action ? (
                      <Pressable
                        onPress={statusMeta.action}
                        disabled={processing}
                        className="rounded-xl border border-white/10 bg-white/10 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {statusMeta.actionLabel}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>
              ) : null}

              {error ? (
                <GlassCard intensity={50}>
                  <Text className="text-red-300 text-sm">{error}</Text>
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
