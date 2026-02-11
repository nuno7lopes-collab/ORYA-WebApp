import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useStripe } from "@stripe/stripe-react-native";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { safeBack } from "../../../lib/navigation";
import { tokens } from "@orya/shared";
import { useAuth } from "../../../lib/auth";
import { AddressPicker, type AddressSelection } from "../../../components/address/AddressPicker";
import {
  useStoreCart,
  useStoreCheckoutMutation,
  useStoreCheckoutPrefill,
  useStoreShippingMethods,
  useStoreShippingQuote,
  useStoreTotals,
} from "../../../features/store/hooks";
import { getStoreErrorMessage } from "../../../features/store/errors";
import { buildReturnUrl } from "../../../lib/deeplink";

const formatMoney = (cents: number | null | undefined, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

const readCountryFromCanonical = (canonical?: Record<string, unknown> | null) => {
  if (!canonical) return null;
  const candidates = [
    canonical.countryCode,
    canonical.country_code,
    canonical.countryCodeISO,
    canonical.country_code_iso,
    canonical.isoCountryCode,
    canonical.iso_country_code,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  }
  return null;
};

export default function StoreCheckoutScreen() {
  const params = useLocalSearchParams<{ username?: string; storeId?: string; subtotalCents?: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const storeId = Number(params.storeId ?? 0);
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const returnUrl = useMemo(() => buildReturnUrl("store"), []);

  const cart = useStoreCart(Number.isFinite(storeId) && storeId > 0 ? storeId : null, Boolean(storeId));
  const totals = useStoreTotals(Number.isFinite(storeId) && storeId > 0 ? storeId : null, Boolean(storeId));
  const prefill = useStoreCheckoutPrefill(
    Number.isFinite(storeId) && storeId > 0 ? storeId : null,
    Boolean(storeId && session?.user?.id),
  );
  const checkout = useStoreCheckoutMutation();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState<AddressSelection | null>(null);
  const [billingAddress, setBillingAddress] = useState<AddressSelection | null>(null);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefill.data) return;
    if (!customerName) setCustomerName(prefill.data.customer.name ?? "");
    if (!customerEmail) setCustomerEmail(prefill.data.customer.email ?? "");
    if (!customerPhone) setCustomerPhone(prefill.data.customer.phone ?? "");

    if (!shippingAddress && prefill.data.shippingAddress) {
      setShippingAddress({
        addressId: prefill.data.shippingAddress.addressId,
        label: prefill.data.shippingAddress.formattedAddress ?? prefill.data.shippingAddress.fullName,
        formattedAddress: prefill.data.shippingAddress.formattedAddress,
      });
    }
    if (!billingAddress && prefill.data.billingAddress) {
      setBillingAddress({
        addressId: prefill.data.billingAddress.addressId,
        label: prefill.data.billingAddress.formattedAddress ?? prefill.data.billingAddress.fullName,
        formattedAddress: prefill.data.billingAddress.formattedAddress,
      });
    }
  }, [
    billingAddress,
    customerEmail,
    customerName,
    customerPhone,
    prefill.data,
    shippingAddress,
  ]);

  const country = readCountryFromCanonical(shippingAddress?.canonical ?? null);
  const shippingMethods = useStoreShippingMethods({
    storeId,
    country,
    subtotalCents: totals.subtotalCents,
    enabled: Boolean(country && totals.requiresShipping),
  });
  const shippingQuote = useStoreShippingQuote({
    storeId,
    country,
    subtotalCents: totals.subtotalCents,
    methodId: selectedShippingMethodId,
    enabled: Boolean(country && totals.requiresShipping),
  });

  useEffect(() => {
    if (!shippingMethods.data?.methods?.length) {
      setSelectedShippingMethodId(null);
      return;
    }
    const currentExists = shippingMethods.data.methods.some((method) => method.id === selectedShippingMethodId);
    if (currentExists) return;
    const defaultMethod =
      shippingMethods.data.methods.find((method) => method.available && method.isDefault) ??
      shippingMethods.data.methods.find((method) => method.available) ??
      null;
    setSelectedShippingMethodId(defaultMethod?.id ?? null);
  }, [selectedShippingMethodId, shippingMethods.data?.methods]);

  const canSubmit =
    Boolean(session?.user?.id) &&
    Boolean(storeId) &&
    totals.itemCount > 0 &&
    customerName.trim().length > 1 &&
    customerEmail.trim().length > 3 &&
    (!totals.requiresShipping || Boolean(shippingAddress?.addressId));

  const openAuth = () => {
    const next = `/store/${encodeURIComponent(username)}/checkout?storeId=${storeId}`;
    router.replace({ pathname: "/auth", params: { next } });
  };

  const handleCheckout = async () => {
    if (!canSubmit) {
      setInlineError("Preenche os dados obrigatórios para continuar.");
      return;
    }
    if (!session?.user?.id) {
      openAuth();
      return;
    }

    setSubmitting(true);
    setInlineError(null);

    try {
      const result = await checkout.mutateAsync({
        storeId,
        payload: {
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim() || null,
          },
          shippingAddress: totals.requiresShipping
            ? {
                addressId: shippingAddress?.addressId ?? "",
                fullName: customerName.trim(),
                nif: null,
              }
            : null,
          billingAddress: billingSameAsShipping
            ? totals.requiresShipping && shippingAddress
              ? {
                  addressId: shippingAddress.addressId,
                  fullName: customerName.trim(),
                  nif: null,
                }
              : null
            : billingAddress
              ? {
                  addressId: billingAddress.addressId,
                  fullName: customerName.trim(),
                  nif: null,
                }
              : null,
          shippingMethodId: totals.requiresShipping ? selectedShippingMethodId : null,
          notes: notes.trim() || null,
        },
      });

      if (result.freeCheckout || !result.clientSecret) {
        router.replace({
          pathname: "/store/[username]/success",
          params: {
            username,
            orderId: String(result.orderId),
            orderNumber: result.orderNumber,
            amountCents: String(result.amountCents),
            currency: result.currency,
          },
        });
        return;
      }

      const init = await initPaymentSheet({
        merchantDisplayName: "ORYA",
        paymentIntentClientSecret: result.clientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: returnUrl,
      });

      if (init.error) {
        throw new Error(init.error.message || "Não foi possível iniciar o pagamento.");
      }

      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code === "Canceled") {
          setInlineError("Pagamento cancelado.");
          return;
        }
        throw new Error(presented.error.message || "Pagamento falhou.");
      }

      router.replace({
        pathname: "/store/[username]/success",
        params: {
          username,
          orderId: String(result.orderId),
          orderNumber: result.orderNumber,
          amountCents: String(result.amountCents),
          currency: result.currency,
        },
      });
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
        title="Checkout"
        leftSlot={
          <Pressable
            onPress={() => safeBack(router, navigation, `/store/${username}/cart?storeId=${storeId}`)}
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
            <Text className="text-white text-base font-semibold">Inicia sessão para concluir a compra</Text>
            <Pressable
              onPress={openAuth}
              className="mt-4 rounded-xl bg-white px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-center text-sm font-semibold text-black">Iniciar sessão</Text>
            </Pressable>
          </GlassCard>
        ) : cart.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="white" />
          </View>
        ) : cart.isError ? (
          <GlassCard intensity={54}>
            <Text className="text-red-300 text-sm">{getStoreErrorMessage(cart.error)}</Text>
          </GlassCard>
        ) : (
          <View className="gap-4">
            <GlassCard intensity={46}>
              <Text className="text-white text-sm font-semibold mb-3">Dados de contacto</Text>
              <View className="gap-3">
                <TextInput
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Nome completo"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white text-sm"
                />
                <TextInput
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white text-sm"
                />
                <TextInput
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
                  placeholder="Telefone (opcional)"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white text-sm"
                />
              </View>
            </GlassCard>

            {totals.requiresShipping ? (
              <GlassCard intensity={46}>
                <AddressPicker
                  label="Morada de envio"
                  value={shippingAddress}
                  onSelect={setShippingAddress}
                  onClear={() => setShippingAddress(null)}
                  placeholder="Procura a tua morada"
                />

                <Pressable
                  onPress={() => setBillingSameAsShipping((value) => !value)}
                  className="mt-4 flex-row items-center gap-2"
                >
                  <Ionicons
                    name={billingSameAsShipping ? "checkbox" : "square-outline"}
                    size={18}
                    color="rgba(255,255,255,0.86)"
                  />
                  <Text className="text-white/80 text-sm">Usar a mesma morada para faturação</Text>
                </Pressable>

                {!billingSameAsShipping ? (
                  <View className="mt-4">
                    <AddressPicker
                      label="Morada de faturação"
                      value={billingAddress}
                      onSelect={setBillingAddress}
                      onClear={() => setBillingAddress(null)}
                      placeholder="Procura a morada de faturação"
                    />
                  </View>
                ) : null}

                {shippingMethods.isLoading ? (
                  <View className="mt-4 flex-row items-center gap-2">
                    <ActivityIndicator color="white" />
                    <Text className="text-white/65 text-xs">A calcular métodos de envio...</Text>
                  </View>
                ) : shippingMethods.data?.methods?.length ? (
                  <View className="mt-4 gap-2">
                    <Text className="text-white text-sm font-semibold">Método de envio</Text>
                    {shippingMethods.data.methods
                      .filter((method) => method.available)
                      .map((method) => {
                        const selected = method.id === selectedShippingMethodId;
                        return (
                          <Pressable
                            key={`shipping-${method.id}`}
                            onPress={() => setSelectedShippingMethodId(method.id)}
                            className={`rounded-xl border px-3 py-3 ${
                              selected ? "border-sky-300/50 bg-sky-400/20" : "border-white/15 bg-white/5"
                            }`}
                          >
                            <View className="flex-row items-center justify-between">
                              <Text className={`text-sm font-semibold ${selected ? "text-sky-100" : "text-white"}`}>
                                {method.name}
                              </Text>
                              <Text className={`text-xs ${selected ? "text-sky-100" : "text-white/70"}`}>
                                {formatMoney(method.shippingCents, cart.data?.cart.currency ?? "EUR")}
                              </Text>
                            </View>
                            {method.description ? (
                              <Text className="mt-1 text-xs text-white/65">{method.description}</Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    {shippingQuote.data?.quote ? (
                      <View className="mt-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                        <Text className="text-white/65 text-xs">
                          Estimativa atual:{" "}
                          <Text className="font-semibold text-white">
                            {formatMoney(
                              shippingQuote.data.quote.shippingCents,
                              cart.data?.cart.currency ?? "EUR",
                            )}
                          </Text>
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text className="mt-4 text-xs text-white/60">
                    O envio será calculado automaticamente no checkout.
                  </Text>
                )}
              </GlassCard>
            ) : null}

            <GlassCard intensity={50}>
              <Text className="text-white text-sm font-semibold">Resumo</Text>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-white/70 text-xs">Subtotal</Text>
                <Text className="text-white text-sm font-semibold">
                  {formatMoney(totals.subtotalCents, cart.data?.cart.currency ?? "EUR")}
                </Text>
              </View>
              {totals.requiresShipping && shippingQuote.data?.quote ? (
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-white/70 text-xs">Envio (estimativa)</Text>
                  <Text className="text-white text-sm font-semibold">
                    {formatMoney(shippingQuote.data.quote.shippingCents, cart.data?.cart.currency ?? "EUR")}
                  </Text>
                </View>
              ) : null}
              <View className="mt-3">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notas da encomenda (opcional)"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  multiline
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white text-sm"
                />
              </View>
              {inlineError ? <Text className="mt-3 text-rose-200 text-xs">{inlineError}</Text> : null}
              <Pressable
                onPress={handleCheckout}
                disabled={!canSubmit || submitting || checkout.isPending}
                className={`mt-4 rounded-2xl px-4 py-3 ${canSubmit ? "bg-white" : "bg-white/15"}`}
                accessibilityRole="button"
                accessibilityLabel="Pagar"
                accessibilityState={{ disabled: !canSubmit || submitting || checkout.isPending }}
              >
                <Text className={`text-center text-sm font-semibold ${canSubmit ? "text-black" : "text-white/65"}`}>
                  {submitting || checkout.isPending ? "A processar..." : "Pagar"}
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
