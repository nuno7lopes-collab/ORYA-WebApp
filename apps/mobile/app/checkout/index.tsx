import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { useStripe, isPlatformPaySupported } from "@stripe/stripe-react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useCheckoutStore, buildCheckoutIdempotencyKey } from "../../features/checkout/store";
import { createCheckoutIntent, createPairingCheckoutIntent, fetchCheckoutStatus } from "../../features/checkout/api";
import { CheckoutMethod, CheckoutStatusResponse } from "../../features/checkout/types";
import { useAuth } from "../../lib/auth";
import { getMobileEnv } from "../../lib/env";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { getUserFacingError } from "../../lib/errors";
import { trackEvent } from "../../lib/analytics";

const formatMoney = (cents: number | null | undefined, currency?: string | null): string | null => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  if (cents <= 0) return "Grátis";
  const amount = cents / 100;
  return `${amount.toFixed(0)} ${currency?.toUpperCase() || "EUR"}`;
};

const resolveMethodLabel = (method: CheckoutMethod) => {
  if (method === "apple_pay") return "Apple Pay";
  if (method === "mbway") return "MBWay";
  return "Cartão";
};

const toApiPaymentMethod = (method: CheckoutMethod): "card" | "mbway" => {
  if (method === "mbway") return "mbway";
  return "card";
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
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingChecking, setBookingChecking] = useState(false);

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
    isPlatformPaySupported()
      .then((supported) => {
        if (mounted) setApplePaySupported(Platform.OS === "ios" && Boolean(supported));
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
      setBookingStatus(null);
      setBookingError(null);
      return;
    }
    if (!draft.purchaseId && !draft.paymentIntentId) {
      setCheckoutStatus(null);
      setError(null);
    }
  }, [draft?.paymentIntentId, draft?.purchaseId, draft?.bookingId]);

  const allowApplePay = Boolean(merchantId && applePaySupported);
  const selectedMethod = draft?.paymentMethod ?? (allowApplePay ? "apple_pay" : "card");
  const resolvedMethod = !allowApplePay && selectedMethod === "apple_pay" ? "card" : selectedMethod;

  const totalLabel = formatMoney(draft?.totalCents ?? null, draft?.currency);
  const isFreeCheckout = Boolean(draft && draft.totalCents <= 0);
  const isPadelRegistration = draft?.sourceType === "PADEL_REGISTRATION";
  const isServiceBooking = draft?.sourceType === "SERVICE_BOOKING";
  const itemLabel = isServiceBooking
    ? draft?.ticketName ?? "Reserva"
    : isPadelRegistration
      ? draft?.ticketName ?? "Inscrição"
      : draft?.ticketName ?? "Bilhete";
  const showPaymentMethods = Boolean(draft) && !isFreeCheckout;
  const canPay = Boolean(draft && session?.user?.id && (stripeKey || isFreeCheckout));
  const openAuth = useCallback(() => {
    router.push({ pathname: "/auth", params: { next: "/checkout" } });
  }, [router]);
  const handleBack = () => {
    safeBack(router, navigation, "/(tabs)/index");
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
    const pendingExpiry = draft.pendingExpiresAt ?? draft.bookingExpiresAt ?? null;
    const bookingExpiry = pendingExpiry ? new Date(pendingExpiry).getTime() : null;
    if (bookingExpiry && Number.isFinite(bookingExpiry) && Date.now() > bookingExpiry) {
      return { label: "Reserva expirou", variant: "muted" as const };
    }
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

  useEffect(() => {
    if (!draft?.paymentMethod) return;
    trackEvent("checkout_method_changed", {
      sourceType: draft.sourceType ?? null,
      method: draft.paymentMethod,
    });
    setCheckoutStatus(null);
    setError(null);
  }, [draft?.paymentMethod]);

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
        setError(getUserFacingError(err, "Não foi possível verificar o pagamento."));
        return null;
      } finally {
        setCheckingStatus(false);
      }
    },
    [applyCheckoutStatus, draft],
  );

  const fetchBookingStatus = useCallback(async () => {
    if (!draft?.bookingId) return null;
    setBookingChecking(true);
    try {
      const res = await fetch(`/api/me/reservas/${draft.bookingId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Não foi possível verificar a reserva.");
      }
      const status = json.booking?.status as string | undefined;
      setBookingStatus(status ?? null);
      setBookingError(null);
      return status ?? null;
    } catch (err) {
      setBookingError(getUserFacingError(err, "Não foi possível verificar a reserva."));
      return null;
    } finally {
      setBookingChecking(false);
    }
  }, [draft?.bookingId]);

  const pollBookingStatus = useCallback(async () => {
    if (!draft?.bookingId) return;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await fetchBookingStatus();
      if (status === "CONFIRMED") return;
      if (status && ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(status)) return;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }, [draft?.bookingId, fetchBookingStatus]);

  useEffect(() => {
    if (!isFocused) return;
    if (processing) return;
    if (!draft) return;
    if (!draft.purchaseId && !draft.paymentIntentId) return;
    runStatusCheck();
  }, [draft?.paymentIntentId, draft?.purchaseId, isFocused, processing, runStatusCheck]);

  useEffect(() => {
    if (!isServiceBooking) return;
    if (!checkoutStatus) return;
    if (checkoutStatus.status !== "PAID") return;
    pollBookingStatus();
  }, [checkoutStatus, isServiceBooking, pollBookingStatus]);

  useEffect(() => {
    if (!isServiceBooking || !bookingStatus) return;
    if (bookingStatus === "CONFIRMED") {
      trackEvent("booking_confirmed", { bookingId: draft?.bookingId ?? null });
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(bookingStatus)) {
      trackEvent("booking_cancelled", { bookingId: draft?.bookingId ?? null });
    }
  }, [bookingStatus, draft?.bookingId, isServiceBooking]);

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
      openAuth();
      return;
    }
    if (!stripeKey && !isFreeCheckout) {
      setError("Pagamentos indisponíveis. Atualiza as chaves Stripe.");
      return;
    }

    setError(null);
    setCheckoutStatus(null);
    setProcessing(true);
    trackEvent("checkout_started", {
      sourceType: draft.sourceType ?? null,
      method: resolvedMethod,
      bookingId: draft.bookingId ?? null,
    });

    try {
      const expired = isExpired();
      const needsNewIntent = !draft.clientSecret || expired;
      let clientSecret = draft.clientSecret ?? null;
      let purchaseId = draft.purchaseId ?? null;
      let paymentIntentId = draft.paymentIntentId ?? null;

      if (needsNewIntent) {
        const idempotencyKey = draft.idempotencyKey ?? buildCheckoutIdempotencyKey();
        if (isServiceBooking) {
          if (!draft.serviceId || !draft.bookingId) {
            throw new Error("Reserva inválida.");
          }
          const response = await fetch(`/api/servicos/${draft.serviceId}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId: draft.bookingId,
              paymentMethod: toApiPaymentMethod(resolvedMethod),
            }),
          });
          const json = await response.json().catch(() => null);
          if (!response.ok || !json?.ok) {
            throw new Error(json?.message || json?.error || "Erro ao iniciar pagamento.");
          }
          clientSecret = json.clientSecret ?? null;
          paymentIntentId = json.paymentIntentId ?? null;
          setIntent({
            clientSecret,
            paymentIntentId,
            purchaseId: null,
            breakdown: null,
            freeCheckout: false,
            amountCents: typeof json.amountCents === "number" ? json.amountCents : null,
            currency: typeof json.currency === "string" ? json.currency : null,
          });
          if ((json.amountCents ?? 0) <= 0) {
            await runStatusCheck({ paymentIntentId });
            await pollBookingStatus();
            setProcessing(false);
            return;
          }
        } else {
          const response = isPadelRegistration
            ? await (async () => {
              if (!draft.pairingId || !draft.ticketTypeId) {
                throw new Error("Dupla inválida.");
              }
              return createPairingCheckoutIntent({
                pairingId: draft.pairingId,
                ticketTypeId: draft.ticketTypeId!,
                inviteToken: draft.inviteToken ?? undefined,
                idempotencyKey,
              });
            })()
            : await createCheckoutIntent({
                slug: draft.slug ?? "",
                ticketTypeId: draft.ticketTypeId ?? 0,
                quantity: draft.quantity,
                paymentMethod: resolvedMethod,
                purchaseId: draft.purchaseId ?? undefined,
                paymentScenario: draft.paymentScenario ?? (draft.totalCents <= 0 ? "FREE_CHECKOUT" : "SINGLE"),
                idempotencyKey,
                inviteToken: draft.inviteToken ?? undefined,
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
            }
          : undefined,
        style: "automatic",
      });

      if (init.error) {
        setError(getUserFacingError(init.error, "Erro ao iniciar pagamento."));
        setProcessing(false);
        return;
      }

      trackEvent("checkout_payment_sheet_opened", {
        sourceType: draft.sourceType ?? null,
        method: resolvedMethod,
      });
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code !== "Canceled") {
          setError(getUserFacingError(presented.error, "Pagamento cancelado."));
          trackEvent("checkout_payment_failed", {
            sourceType: draft.sourceType ?? null,
            method: resolvedMethod,
            code: presented.error.code ?? null,
          });
        }
        setProcessing(false);
        return;
      }

      await runStatusCheck({
        purchaseId,
        paymentIntentId,
      });
      trackEvent("checkout_payment_succeeded", {
        sourceType: draft.sourceType ?? null,
        method: resolvedMethod,
      });
    } catch (err: any) {
      setError(getUserFacingError(err, "Não foi possível concluir o pagamento."));
      trackEvent("checkout_payment_failed", {
        sourceType: draft.sourceType ?? null,
        method: resolvedMethod,
      });
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
    if (isServiceBooking && bookingStatus === "CONFIRMED") {
      return {
        tone: "success" as const,
        title: "Reserva confirmada",
        message: "A tua reserva foi confirmada. Encontras os detalhes na carteira.",
        actionLabel: "Ver reservas",
        action: () => {
          clearDraft();
          router.replace("/(tabs)/tickets");
        },
      };
    }
    if (isServiceBooking && bookingStatus && ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(bookingStatus)) {
      return {
        tone: "danger" as const,
        title: "Reserva cancelada",
        message: "Esta reserva foi cancelada. Se precisares, cria uma nova.",
        actionLabel: "Voltar",
        action: () => {
          clearDraft();
          router.replace("/(tabs)/index");
        },
      };
    }
    if (status === "PAID") {
      return {
        tone: "success" as const,
        title: "Pagamento confirmado",
        message: isServiceBooking
          ? "Pagamento confirmado. A confirmar agendamento..."
          : "O teu bilhete já está disponível na carteira.",
        actionLabel: isServiceBooking ? "Verificar reserva" : "Ver bilhetes",
        action: () => {
          if (isServiceBooking) {
            fetchBookingStatus();
            return;
          }
          clearDraft();
          router.replace("/(tabs)/tickets");
        },
        showSpinner: isServiceBooking,
      };
    }
    if (status === "FAILED") {
      return {
        tone: "danger" as const,
        title: "Pagamento falhou",
        message: getUserFacingError(
          checkoutStatus.errorMessage,
          "Não foi possível concluir o pagamento.",
        ),
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
        actionLabel: isServiceBooking ? "Voltar ao serviço" : "Voltar ao evento",
        action: () => {
          clearDraft();
          if (isServiceBooking && draft.serviceId) {
            router.replace({ pathname: "/service/[id]", params: { id: String(draft.serviceId) } });
            return;
          }
          if (draft.slug) {
            router.replace({ pathname: "/event/[slug]", params: { slug: draft.slug } });
          } else {
            router.replace("/(tabs)");
          }
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
  }, [
    bookingStatus,
    checkoutStatus,
    clearDraft,
    draft,
    fetchBookingStatus,
    handlePay,
    isExpired,
    isServiceBooking,
    resetIntent,
    router,
    runStatusCheck,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground variant="solid">
        <View className="px-5 pt-12 pb-6">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
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
                accessibilityRole="button"
                accessibilityLabel="Voltar ao Descobrir"
              >
                  <Text className="text-white text-sm font-semibold text-center">Voltar ao Descobrir</Text>
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
                    {draft.eventTitle ?? draft.serviceTitle ?? "Checkout"}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/70 text-sm">{itemLabel}</Text>
                    <GlassPill label={`${draft.quantity}x`} variant="muted" />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/60 text-sm">Total</Text>
                    {totalLabel ? (
                      <Text className="text-white text-xl font-semibold">{totalLabel}</Text>
                    ) : null}
                  </View>
                  {isFreeCheckout ? (
                    <Text className="text-white/55 text-xs">Limite por pessoa: 1</Text>
                  ) : null}
                </View>
              </GlassCard>

              {showPaymentMethods ? (
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
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar ${option.label}`}
                            accessibilityState={{ selected: active }}
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
              ) : null}

              {!session?.user?.id ? (
                <GlassCard intensity={48}>
                  <Text className="text-white/70 text-sm mb-3">Inicia sessão para concluir a compra.</Text>
                <Pressable
                  className="rounded-xl bg-white/10 px-4 py-3"
                  onPress={openAuth}
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Entrar ou criar conta"
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
                      {statusMeta.showSpinner || checkingStatus || bookingChecking ? (
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
                        accessibilityRole="button"
                        accessibilityLabel={statusMeta.actionLabel}
                        accessibilityState={{ disabled: processing }}
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          {statusMeta.actionLabel}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>
              ) : null}

              {bookingError ? (
                <GlassCard intensity={50}>
                  <Text className="text-amber-200 text-sm">{bookingError}</Text>
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
                accessibilityRole="button"
                accessibilityLabel={draft.totalCents <= 0 ? "Confirmar inscrição" : "Pagar agora"}
                accessibilityState={{ disabled: !canPay || processing }}
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
