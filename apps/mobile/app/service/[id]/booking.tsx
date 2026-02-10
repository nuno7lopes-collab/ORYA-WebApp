import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { tokens } from "@orya/shared";
import { Ionicons } from "../../../components/icons/Ionicons";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { AddressPicker, type AddressSelection } from "../../../components/address/AddressPicker";
import { useServiceDetail } from "../../../features/services/hooks";
import type { ServiceResource } from "../../../features/services/types";
import { useCheckoutStore, buildCheckoutIdempotencyKey } from "../../../features/checkout/store";
import { buildAddonPayload, buildBookingPayload } from "../../../features/services/bookingPayload";
import { useAuth } from "../../../lib/auth";
import { safeBack } from "../../../lib/navigation";
import { getUserFacingError } from "../../../lib/errors";
import { trackEvent } from "../../../lib/analytics";
import { api } from "../../../lib/api";

type AvailabilityDay = {
  date: string;
  hasAvailability: boolean;
  slots: number;
};

type AvailabilitySlot = {
  slotKey: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
};

type CalendarResponse = {
  ok: boolean;
  timezone?: string | null;
  month?: string | null;
  days?: AvailabilityDay[];
  error?: string;
};

type SlotsResponse = {
  ok: boolean;
  items?: AvailabilitySlot[];
  error?: string;
};

const formatMoney = (cents: number, currency: string) => {
  if (!Number.isFinite(cents)) return "-";
  if (cents <= 0) return "Grátis";
  return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
};

const formatDayLabel = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short" });
};

const formatTime = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
};

const monthKey = (year: number, month: number) => year * 12 + (month - 1);

const resolveAssignmentMode = (serviceKind?: string | null, orgMode?: string | null) => {
  if (serviceKind === "COURT") return "RESOURCE";
  if (orgMode === "RESOURCE") return "RESOURCE";
  return "PROFESSIONAL";
};

export default function ServiceBookingScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const serviceId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id]);
  const { data: service, isLoading, isError, error, refetch } = useServiceDetail(serviceId ? String(serviceId) : "");
  const setCheckoutDraft = useCheckoutStore((state) => state.setDraft);
  const setCheckoutIntent = useCheckoutStore((state) => state.setIntent);

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({});
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [calendarDays, setCalendarDays] = useState<AvailabilityDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [addressSelection, setAddressSelection] = useState<AddressSelection | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const assignmentMode = useMemo(
    () => resolveAssignmentMode(service?.kind ?? null, service?.organization?.reservationAssignmentMode ?? null),
    [service?.kind, service?.organization?.reservationAssignmentMode],
  );
  const guestAllowed = Boolean(service?.policy?.guestBookingAllowed);
  const isGuest = !session?.user?.id;

  const availableProfessionals = useMemo(() => {
    const professionals = service?.professionals ?? [];
    const allowedIds = new Set(service?.professionalLinks?.map((link) => link.professionalId) ?? []);
    if (allowedIds.size === 0) return professionals;
    return professionals.filter((professional) => allowedIds.has(professional.id));
  }, [service?.professionals, service?.professionalLinks]);

  const availableResources = useMemo<ServiceResource[]>(() => {
    const resources = service?.resources ?? [];
    const allowedIds = new Set(service?.resourceLinks?.map((link) => link.resourceId) ?? []);
    if (allowedIds.size === 0) return resources;
    return resources.filter((resource) => allowedIds.has(resource.id));
  }, [service?.resources, service?.resourceLinks]);

  const capacityOptions = useMemo<number[]>(() => {
    const capacities = Array.from(new Set(availableResources.map((resource) => resource.capacity)))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    return capacities;
  }, [availableResources]);

  useEffect(() => {
    if (assignmentMode !== "RESOURCE") return;
    if (selectedPartySize) return;
    if (capacityOptions.length > 0) {
      setSelectedPartySize(capacityOptions[0]);
    }
  }, [assignmentMode, capacityOptions, selectedPartySize]);

  useEffect(() => {
    if (assignmentMode !== "PROFESSIONAL") return;
    if (selectedProfessionalId !== null) return;
    if (availableProfessionals.length === 1) {
      setSelectedProfessionalId(availableProfessionals[0].id);
    }
  }, [assignmentMode, availableProfessionals, selectedProfessionalId]);

  const selectedPackage = useMemo(() => {
    return (service?.packages ?? []).find((pkg) => pkg.id === selectedPackageId) ?? null;
  }, [service?.packages, selectedPackageId]);

  const selectedAddonsPayload = useMemo(() => buildAddonPayload(addonQuantities), [addonQuantities]);
  const addonsParam = selectedAddonsPayload.length > 0 ? JSON.stringify(selectedAddonsPayload) : null;

  const addonsDeltaMinutes = useMemo(() => {
    const addons = service?.addons ?? [];
    return selectedAddonsPayload.reduce((total, selected) => {
      const addon = addons.find((item) => item.id === selected.addonId);
      if (!addon) return total;
      return total + addon.deltaMinutes * selected.quantity;
    }, 0);
  }, [selectedAddonsPayload, service?.addons]);

  const addonsDeltaCents = useMemo(() => {
    const addons = service?.addons ?? [];
    return selectedAddonsPayload.reduce((total, selected) => {
      const addon = addons.find((item) => item.id === selected.addonId);
      if (!addon) return total;
      return total + addon.deltaPriceCents * selected.quantity;
    }, 0);
  }, [selectedAddonsPayload, service?.addons]);

  const basePriceCents = selectedPackage?.priceCents ?? service?.unitPriceCents ?? 0;
  const baseDurationMinutes = selectedPackage?.durationMinutes ?? service?.durationMinutes ?? 0;
  const totalCents = Math.max(0, basePriceCents + addonsDeltaCents);
  const effectiveDurationMinutes = Math.max(0, baseDurationMinutes + addonsDeltaMinutes);

  const canFetchCalendar =
    Boolean(serviceId) && (assignmentMode !== "RESOURCE" || Boolean(selectedPartySize));

  const buildAvailabilityParams = useCallback(
    (params: URLSearchParams) => {
      if (assignmentMode === "PROFESSIONAL" && selectedProfessionalId) {
        params.set("professionalId", String(selectedProfessionalId));
      }
      if (assignmentMode === "RESOURCE" && selectedPartySize) {
        params.set("partySize", String(selectedPartySize));
      }
      if (selectedPackageId) {
        params.set("packageId", String(selectedPackageId));
      }
      if (addonsParam) {
        params.set("addons", addonsParam);
      }
    },
    [addonsParam, assignmentMode, selectedPackageId, selectedPartySize, selectedProfessionalId],
  );

  const loadCalendar = useCallback(async () => {
    if (!serviceId || !canFetchCalendar) return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const params = new URLSearchParams({ month: calendarMonth });
      buildAvailabilityParams(params);
      const result = await api.requestRaw<CalendarResponse>(
        `/api/servicos/${serviceId}/calendario?${params.toString()}`,
        { cache: "no-store" },
      );
      const json: CalendarResponse = result.data ?? { ok: false };
      if (!result.ok || !json.ok) {
        throw new Error(json.error || "Não foi possível carregar o calendário.");
      }
      setCalendarDays(json.days ?? []);
    } catch (err) {
      setCalendarError(getUserFacingError(err, "Não foi possível carregar o calendário."));
    } finally {
      setCalendarLoading(false);
    }
  }, [buildAvailabilityParams, calendarMonth, canFetchCalendar, serviceId]);

  const loadSlots = useCallback(async () => {
    if (!serviceId || !selectedDay || !canFetchCalendar) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const params = new URLSearchParams({ day: selectedDay });
      buildAvailabilityParams(params);
      const result = await api.requestRaw<SlotsResponse>(`/api/servicos/${serviceId}/slots?${params.toString()}`, {
        cache: "no-store",
      });
      const json: SlotsResponse = result.data ?? { ok: false };
      if (!result.ok || !json.ok) {
        throw new Error(json.error || "Não foi possível carregar horários.");
      }
      setSlots(json.items ?? []);
    } catch (err) {
      setSlotsError(getUserFacingError(err, "Não foi possível carregar horários."));
    } finally {
      setSlotsLoading(false);
    }
  }, [buildAvailabilityParams, canFetchCalendar, selectedDay, serviceId]);

  useEffect(() => {
    if (!canFetchCalendar) return;
    loadCalendar();
  }, [canFetchCalendar, loadCalendar]);

  useEffect(() => {
    setSelectedDay(null);
    setSelectedSlot(null);
  }, [selectedPackageId, addonsParam, assignmentMode, selectedProfessionalId, selectedPartySize]);

  useEffect(() => {
    if (!selectedDay) return;
    loadSlots();
  }, [loadSlots, selectedDay]);

  const openAuth = useCallback(() => {
    if (!serviceId) return;
    router.push({ pathname: "/auth", params: { next: `/service/${serviceId}/booking` } });
  }, [router, serviceId]);

  const handleBack = () => {
    safeBack(router, navigation, serviceId ? `/service/${serviceId}` : "/(tabs)/index");
  };

  const reserveSlot = useCallback(async (slotOverride?: AvailabilitySlot) => {
    const slot = slotOverride ?? selectedSlot;
    if (!serviceId || !service || !slot) return;
    if (isGuest && !guestAllowed) {
      openAuth();
      return;
    }
    setBookingError(null);
    setBookingLoading(true);
    try {
      if (service.locationMode === "CHOOSE_AT_BOOKING" && !addressSelection?.addressId) {
        throw new Error("Seleciona uma morada antes de reservar.");
      }
      if (isGuest) {
        if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
          throw new Error("Nome, email e telemóvel são obrigatórios.");
        }
      }
      const payload = buildBookingPayload({
        startsAt: slot.startsAt,
        professionalId: assignmentMode === "PROFESSIONAL" ? selectedProfessionalId : null,
        partySize: assignmentMode === "RESOURCE" ? selectedPartySize : null,
        addressId: addressSelection?.addressId ?? null,
        selectedAddons: selectedAddonsPayload,
        packageId: selectedPackageId,
      });
      const payloadWithGuest = isGuest
        ? {
            ...payload,
            guest: {
              name: guestName.trim(),
              email: guestEmail.trim(),
              phone: guestPhone.trim(),
            },
          }
        : payload;
      const result = await api.requestRaw<{
        ok: boolean;
        booking?: { id?: number; startsAt?: string; pendingExpiresAt?: string | null };
        error?: string;
        message?: string;
      }>(`/api/servicos/${serviceId}/reservar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithGuest),
      });
      const json = result.data;
      if (!result.ok || !json?.ok) {
        if (json?.error === "PHONE_REQUIRED") {
          if (!isGuest) {
            setPhoneRequired(true);
            setPendingSlot(slot);
          }
          throw new Error(json?.message || "Telemóvel obrigatório para reservar.");
        }
        throw new Error(json?.message || json?.error || "Não foi possível criar a pré-reserva.");
      }
      trackEvent("booking_hold_created", {
        serviceId,
        bookingId: json.booking?.id ?? null,
      });
      const idempotencyKey = buildCheckoutIdempotencyKey();
      setCheckoutDraft({
        serviceId,
        serviceTitle: service.title,
        bookingId: json.booking?.id ?? null,
        bookingStartsAt: json.booking?.startsAt ?? slot.startsAt,
        pendingExpiresAt: json.booking?.pendingExpiresAt ?? null,
        bookingExpiresAt: json.booking?.pendingExpiresAt ?? null,
        guest: isGuest
          ? { name: guestName.trim(), email: guestEmail.trim(), phone: guestPhone.trim() }
          : null,
        sourceType: "SERVICE_BOOKING",
        ticketName: "Reserva",
        quantity: 1,
        unitPriceCents: basePriceCents,
        totalCents,
        currency: service.currency ?? "EUR",
        paymentMethod: "card",
        idempotencyKey,
      });
      setCheckoutIntent({
        clientSecret: null,
        paymentIntentId: null,
        purchaseId: null,
        breakdown: null,
        freeCheckout: false,
      });
      trackEvent("checkout_started", {
        sourceType: "SERVICE_BOOKING",
        serviceId,
        bookingId: json.booking?.id ?? null,
      });
      router.push("/checkout");
    } catch (err) {
      setBookingError(getUserFacingError(err, "Não foi possível criar a pré-reserva."));
    } finally {
      setBookingLoading(false);
    }
  }, [
    addressSelection?.addressId,
    assignmentMode,
    basePriceCents,
    guestAllowed,
    guestEmail,
    guestName,
    guestPhone,
    isGuest,
    openAuth,
    router,
    selectedAddonsPayload,
    selectedPackageId,
    selectedPartySize,
    selectedProfessionalId,
    selectedSlot,
    service,
    serviceId,
    session?.user?.id,
    setCheckoutDraft,
    setCheckoutIntent,
    totalCents,
  ]);

  const savePhone = useCallback(async () => {
    const value = phoneDraft.trim();
    if (!value) {
      setBookingError("Indica o número de telemóvel.");
      return;
    }
    setPhoneSaving(true);
    setBookingError(null);
    try {
      const result = await api.requestRaw<{
        ok: boolean;
        error?: string;
        message?: string;
      }>("/api/me/contact-phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactPhone: value }),
      });
      const json = result.data;
      if (!result.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível guardar o telemóvel.");
      }
      setPhoneRequired(false);
      setPhoneDraft("");
      if (pendingSlot) {
        const slot = pendingSlot;
        setPendingSlot(null);
        setSelectedSlot(slot);
        await reserveSlot(slot);
      }
    } catch (err) {
      setBookingError(getUserFacingError(err, "Não foi possível guardar o telemóvel."));
    } finally {
      setPhoneSaving(false);
    }
  }, [pendingSlot, phoneDraft, reserveSlot]);

  const canReserve =
    Boolean(selectedSlot) &&
    (!phoneRequired) &&
    (!service || service.locationMode !== "CHOOSE_AT_BOOKING" || Boolean(addressSelection?.addressId)) &&
    (!isGuest || (guestName.trim() && guestEmail.trim() && guestPhone.trim()));

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LiquidBackground variant="solid">
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="white" />
          </View>
        </LiquidBackground>
      </>
    );
  }

  if (isError || !service) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LiquidBackground variant="solid">
          <View className="px-5 pt-12 pb-6">
            <Pressable
              onPress={handleBack}
              style={{
                width: tokens.layout.touchTarget,
                height: tokens.layout.touchTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
            </Pressable>
          </View>
          <View className="px-5">
            <GlassCard intensity={52}>
              <Text className="text-white text-sm">
                {error ? String(error) : "Não foi possível carregar o serviço."}
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="mt-3 rounded-xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Tentar novamente"
              >
                <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
              </Pressable>
            </GlassCard>
          </View>
        </LiquidBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground variant="solid">
        <View className="px-5 pt-12 pb-4">
          <Pressable
            onPress={handleBack}
            style={{
              width: tokens.layout.touchTarget,
              height: tokens.layout.touchTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            <GlassCard intensity={60} highlight>
              <View className="gap-2">
                <Text className="text-white text-lg font-semibold">{service.title}</Text>
                <Text className="text-white/60 text-sm">
                  {formatMoney(basePriceCents, service.currency)} · {effectiveDurationMinutes} min
                </Text>
                {service.organization?.publicName || service.organization?.businessName ? (
                  <Text className="text-white/50 text-xs">
                    {service.organization.publicName ?? service.organization.businessName}
                  </Text>
                ) : null}
              </View>
            </GlassCard>

            {service.packages && service.packages.length > 0 ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Pacotes</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {service.packages.map((pkg) => {
                      const active = pkg.id === selectedPackageId;
                      return (
                        <Pressable
                          key={pkg.id}
                          onPress={() => setSelectedPackageId(active ? null : pkg.id)}
                          className={active ? "rounded-full bg-white/20 px-4 py-2" : "rounded-full border border-white/10 bg-white/5 px-4 py-2"}
                          style={{ minHeight: tokens.layout.touchTarget }}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar pacote ${pkg.label}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text className={active ? "text-white text-sm font-semibold" : "text-white/70 text-sm"}>
                            {pkg.label}
                          </Text>
                          <Text className="text-white/60 text-[11px]">
                            {formatMoney(pkg.priceCents, service.currency)} · {pkg.durationMinutes} min
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </GlassCard>
            ) : null}

            {service.addons && service.addons.length > 0 ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Extras</Text>
                  {service.addons.map((addon) => {
                    const quantity = addonQuantities[addon.id] ?? 0;
                    return (
                      <View key={addon.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                        <View className="flex-row items-center justify-between">
                          <View>
                            <Text className="text-white text-sm">{addon.label}</Text>
                            <Text className="text-white/60 text-xs">
                              +{addon.deltaMinutes} min · +{formatMoney(addon.deltaPriceCents, service.currency)}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Pressable
                              onPress={() =>
                                setAddonQuantities((prev) => {
                                  const next = { ...prev };
                                  next[addon.id] = Math.max(0, (next[addon.id] ?? 0) - 1);
                                  return next;
                                })
                              }
                              className="h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10"
                              accessibilityRole="button"
                              accessibilityLabel={`Diminuir extra ${addon.label}`}
                            >
                              <Ionicons name="remove" size={14} color="rgba(255,255,255,0.7)" />
                            </Pressable>
                            <Text className="text-white text-sm">{quantity}</Text>
                            <Pressable
                              onPress={() =>
                                setAddonQuantities((prev) => {
                                  const next = { ...prev };
                                  const maxQty = addon.maxQty ?? 10;
                                  next[addon.id] = Math.min(maxQty, (next[addon.id] ?? 0) + 1);
                                  return next;
                                })
                              }
                              className="h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10"
                              accessibilityRole="button"
                              accessibilityLabel={`Aumentar extra ${addon.label}`}
                            >
                              <Ionicons name="add" size={14} color="rgba(255,255,255,0.7)" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            ) : null}

            <GlassCard intensity={50}>
              <View className="gap-3">
                <Text className="text-white text-sm font-semibold">
                  {assignmentMode === "RESOURCE" ? "Capacidade" : "Profissional"}
                </Text>
                {assignmentMode === "RESOURCE" ? (
                  <View className="flex-row flex-wrap gap-2">
                    {capacityOptions.map((capacity) => {
                      const active = selectedPartySize === capacity;
                      return (
                        <Pressable
                          key={capacity}
                          onPress={() => setSelectedPartySize(capacity)}
                          className={active ? "rounded-full bg-white/20 px-4 py-2" : "rounded-full border border-white/10 bg-white/5 px-4 py-2"}
                          style={{ minHeight: tokens.layout.touchTarget }}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${capacity} pessoas`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text className={active ? "text-white text-sm font-semibold" : "text-white/70 text-sm"}>
                            {capacity} pessoas
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View className="gap-2">
                    <Pressable
                      onPress={() => setSelectedProfessionalId(null)}
                      className={selectedProfessionalId === null ? "rounded-2xl bg-white/15 px-3 py-3" : "rounded-2xl border border-white/10 bg-white/5 px-3 py-3"}
                      accessibilityRole="button"
                      accessibilityLabel="Qualquer profissional"
                      accessibilityState={{ selected: selectedProfessionalId === null }}
                    >
                      <Text className="text-white text-sm">Qualquer profissional</Text>
                    </Pressable>
                    {availableProfessionals.map((professional) => {
                      const active = selectedProfessionalId === professional.id;
                      return (
                        <Pressable
                          key={professional.id}
                          onPress={() => setSelectedProfessionalId(professional.id)}
                          className={active ? "rounded-2xl bg-white/15 px-3 py-3" : "rounded-2xl border border-white/10 bg-white/5 px-3 py-3"}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${professional.name}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text className="text-white text-sm">{professional.name}</Text>
                          {professional.roleTitle ? (
                            <Text className="text-white/60 text-xs">{professional.roleTitle}</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </GlassCard>

            <GlassCard intensity={50}>
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-sm font-semibold">Agenda</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => {
                        const [year, month] = calendarMonth.split("-").map(Number);
                        const prev = new Date(year, month - 2, 1);
                        const today = new Date();
                        const minKey = monthKey(today.getFullYear(), today.getMonth() + 1);
                        const prevKey = monthKey(prev.getFullYear(), prev.getMonth() + 1);
                        if (prevKey >= minKey) {
                          setCalendarMonth(prev.toISOString().slice(0, 7));
                        }
                      }}
                      className="rounded-full border border-white/10 px-2 py-1"
                      accessibilityRole="button"
                      accessibilityLabel="Mês anterior"
                    >
                      <Ionicons name="chevron-back" size={14} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                    <Text className="text-white/70 text-xs">{calendarMonth}</Text>
                    <Pressable
                      onPress={() => {
                        const [year, month] = calendarMonth.split("-").map(Number);
                        const next = new Date(year, month, 1);
                        const today = new Date();
                        const minKey = monthKey(today.getFullYear(), today.getMonth() + 1);
                        const maxKey = minKey + 3;
                        const nextKey = monthKey(next.getFullYear(), next.getMonth() + 1);
                        if (nextKey <= maxKey) {
                          setCalendarMonth(next.toISOString().slice(0, 7));
                        }
                      }}
                      className="rounded-full border border-white/10 px-2 py-1"
                      accessibilityRole="button"
                      accessibilityLabel="Mês seguinte"
                    >
                      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  </View>
                </View>
                {!canFetchCalendar ? (
                  <Text className="text-white/60 text-xs">Seleciona a capacidade para ver horários.</Text>
                ) : calendarLoading ? (
                  <ActivityIndicator color="white" />
                ) : calendarError ? (
                  <Text className="text-rose-200 text-xs">{calendarError}</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {calendarDays.filter((day) => day.hasAvailability).slice(0, 21).map((day) => {
                      const active = selectedDay === day.date;
                      return (
                        <Pressable
                          key={day.date}
                          onPress={() => {
                            setSelectedDay(day.date);
                            setSelectedSlot(null);
                          }}
                          className={active ? "rounded-xl bg-white/20 px-3 py-2" : "rounded-xl border border-white/10 bg-white/5 px-3 py-2"}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar dia ${formatDayLabel(day.date)}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                            {formatDayLabel(day.date)}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {calendarDays.filter((day) => day.hasAvailability).length === 0 ? (
                      <Text className="text-white/60 text-xs">Sem disponibilidade neste mês.</Text>
                    ) : null}
                  </View>
                )}
              </View>
            </GlassCard>

            {isGuest && guestAllowed ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Dados do convidado</Text>
                  <View className="gap-2">
                    <TextInput
                      value={guestName}
                      onChangeText={setGuestName}
                      placeholder="Nome"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                    <TextInput
                      value={guestEmail}
                      onChangeText={setGuestEmail}
                      placeholder="Email"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                    <TextInput
                      value={guestPhone}
                      onChangeText={setGuestPhone}
                      placeholder="Telemóvel"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      keyboardType="phone-pad"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    />
                  </View>
                </View>
              </GlassCard>
            ) : null}

            {selectedDay ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Horários</Text>
                  {slotsLoading ? (
                    <ActivityIndicator color="white" />
                  ) : slotsError ? (
                    <Text className="text-rose-200 text-xs">{slotsError}</Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {slots.map((slot) => {
                        const active = selectedSlot?.slotKey === slot.slotKey;
                        return (
                          <Pressable
                            key={slot.slotKey}
                            onPress={() => setSelectedSlot(slot)}
                            className={active ? "rounded-full bg-white/20 px-3 py-2" : "rounded-full border border-white/10 bg-white/5 px-3 py-2"}
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar horário ${formatTime(slot.startsAt)}`}
                            accessibilityState={{ selected: active }}
                          >
                            <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                              {formatTime(slot.startsAt)}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {slots.length === 0 ? (
                        <Text className="text-white/60 text-xs">Sem horários para este dia.</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </GlassCard>
            ) : null}

            {service.locationMode === "CHOOSE_AT_BOOKING" ? (
              <GlassCard intensity={50}>
                <AddressPicker
                  label="Morada da reserva"
                  value={addressSelection}
                  onSelect={setAddressSelection}
                  onClear={() => setAddressSelection(null)}
                  placeholder="Seleciona uma morada"
                />
              </GlassCard>
            ) : null}

            {phoneRequired ? (
              <GlassCard intensity={50}>
                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Telemóvel obrigatório</Text>
                  <Text className="text-white/60 text-xs">Precisamos do teu número para confirmar a reserva.</Text>
                  <TextInput
                    value={phoneDraft}
                    onChangeText={setPhoneDraft}
                    keyboardType="phone-pad"
                    placeholder="Telemóvel"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm"
                    accessibilityLabel="Telemóvel"
                  />
                  <Pressable
                    onPress={savePhone}
                    disabled={phoneSaving}
                    className="rounded-xl bg-white/10 px-4 py-3"
                    accessibilityRole="button"
                    accessibilityLabel="Guardar telemóvel"
                    accessibilityState={{ disabled: phoneSaving }}
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      {phoneSaving ? "A guardar..." : "Guardar telemóvel"}
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>
            ) : null}

            {bookingError ? (
              <GlassCard intensity={50}>
                <Text className="text-rose-200 text-sm">{bookingError}</Text>
              </GlassCard>
            ) : null}

            <GlassCard intensity={60} highlight>
              <View className="gap-2">
                <Text className="text-white text-sm font-semibold">Resumo</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-white/60 text-xs">Total</Text>
                  <Text className="text-white text-lg font-semibold">
                    {formatMoney(totalCents, service.currency)}
                  </Text>
                </View>
                <Pressable
                  disabled={!canReserve || bookingLoading}
                  onPress={() => reserveSlot()}
                  className={canReserve ? "rounded-2xl bg-white/15 px-4 py-4" : "rounded-2xl border border-white/10 bg-white/5 px-4 py-4"}
                  style={{ minHeight: tokens.layout.touchTarget, alignItems: "center", justifyContent: "center" }}
                  accessibilityRole="button"
                  accessibilityLabel="Reservar e pagar"
                  accessibilityState={{ disabled: !canReserve || bookingLoading }}
                >
                  {bookingLoading ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="white" />
                      <Text className="text-white text-sm font-semibold">A reservar...</Text>
                    </View>
                  ) : (
                    <Text className={canReserve ? "text-white text-sm font-semibold" : "text-white/50 text-sm font-semibold"}>
                      Reservar e pagar
                    </Text>
                  )}
                </Pressable>
                {!session?.user?.id && !guestAllowed ? (
                  <Text className="text-white/60 text-xs text-center">Inicia sessão para concluir.</Text>
                ) : null}
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </LiquidBackground>
    </>
  );
}
