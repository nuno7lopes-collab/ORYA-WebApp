import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useEventDetail } from "../../features/events/hooks";
import { tokens } from "@orya/shared";
import { Ionicons } from "../../components/icons/Ionicons";
import { ApiError } from "../../lib/api";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useAuth } from "../../lib/auth";
import { useCheckoutStore } from "../../features/checkout/store";
import { safeBack } from "../../lib/navigation";

const formatDateRange = (startsAt?: string, endsAt?: string): string => {
  if (!startsAt) return "Data por anunciar";
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;

    const date = new Intl.DateTimeFormat("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(start);

    const startTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);

    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;

    const endTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(end);

    return `${date} · ${startTime}–${endTime}`;
  } catch {
    return "Data por anunciar";
  }
};

const resolveStatusLabel = (status?: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT") => {
  switch (status) {
    case "CANCELLED":
      return "Cancelado";
    case "PAST":
      return "Terminado";
    case "DRAFT":
      return "Rascunho";
    default:
      return "Ativo";
  }
};

const formatTicketPrice = (priceCents: number, currency?: string | null): string => {
  if (priceCents <= 0) return "Grátis";
  const amount = priceCents / 100;
  const normalizedCurrency = currency?.toUpperCase() || "EUR";
  return `${amount.toFixed(0)} ${normalizedCurrency}`;
};

const resolveTicketStatusLabel = (status?: string | null, remaining?: number | null): string => {
  if (status === "CLOSED") return "Fechado";
  if (status === "UPCOMING") return "Brevemente";
  if (status === "SOLD_OUT" || remaining === 0) return "Esgotado";
  return "Disponível";
};

export default function EventDetail() {
  const params = useLocalSearchParams<{
    slug?: string | string[];
    source?: string;
    eventTitle?: string;
    coverImageUrl?: string;
    shortDescription?: string;
    startsAt?: string;
    endsAt?: string;
    locationLabel?: string;
    priceLabel?: string;
    categoryLabel?: string;
    hostName?: string;
    imageTag?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const slugValue = useMemo(
    () => (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? null,
    [params.slug],
  );
  const eventTitleValue = useMemo(
    () => (Array.isArray(params.eventTitle) ? params.eventTitle[0] : params.eventTitle) ?? null,
    [params.eventTitle],
  );
  const previewCoverValue = useMemo(() => {
    const value = params.coverImageUrl;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.coverImageUrl]);
  const previewDescription = useMemo(() => {
    const value = params.shortDescription;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.shortDescription]);
  const previewStartsAt = useMemo(() => {
    const value = params.startsAt;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.startsAt]);
  const previewEndsAt = useMemo(() => {
    const value = params.endsAt;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.endsAt]);
  const previewLocation = useMemo(() => {
    const value = params.locationLabel;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.locationLabel]);
  const previewPrice = useMemo(() => {
    const value = params.priceLabel;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.priceLabel]);
  const previewCategory = useMemo(() => {
    const value = params.categoryLabel;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.categoryLabel]);
  const previewHost = useMemo(() => {
    const value = params.hostName;
    if (Array.isArray(value)) return value[0];
    return value ?? null;
  }, [params.hostName]);
  const previewImageTag = useMemo(() => {
    const raw = Array.isArray(params.imageTag) ? params.imageTag[0] : params.imageTag;
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized ? normalized : null;
  }, [params.imageTag]);
  const { data, isLoading, isError, error, refetch } = useEventDetail(slugValue ?? "");
  const { session } = useAuth();
  const setCheckoutDraft = useCheckoutStore((state) => state.setDraft);
  const transitionSource = params.source === "discover" ? "discover" : "direct";
  const handleBack = () => {
    safeBack(router, navigation);
  };

  const fade = useRef(new Animated.Value(transitionSource === "discover" ? 0 : 0.2)).current;
  const translate = useRef(new Animated.Value(transitionSource === "discover" ? 20 : 10)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: transitionSource === "discover" ? tokens.motion.normal + 120 : tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: transitionSource === "discover" ? tokens.motion.normal + 120 : tokens.motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [data?.id, fade, transitionSource, translate]);

  const ticketTypes = useMemo(() => {
    const list = data?.ticketTypes ?? [];
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [data?.ticketTypes]);

  useEffect(() => {
    if (ticketTypes.length === 0) return;
    if (selectedTicketId !== null) return;
    const firstAvailable = ticketTypes.find((ticket) => {
      const remaining =
        ticket.totalQuantity != null ? Math.max(ticket.totalQuantity - (ticket.soldQuantity ?? 0), 0) : null;
      const status = ticket.status ?? null;
      if (status === "CLOSED" || status === "SOLD_OUT") return false;
      if (remaining === 0) return false;
      return true;
    });
    setSelectedTicketId(firstAvailable?.id ?? ticketTypes[0].id);
  }, [selectedTicketId, ticketTypes]);

  const selectedTicket = useMemo(
    () => ticketTypes.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, ticketTypes],
  );

  const ticketRemaining = useMemo(() => {
    if (!selectedTicket) return null;
    if (selectedTicket.totalQuantity == null) return null;
    return Math.max(selectedTicket.totalQuantity - (selectedTicket.soldQuantity ?? 0), 0);
  }, [selectedTicket]);

  const ticketStatusLabel = useMemo(
    () => resolveTicketStatusLabel(selectedTicket?.status ?? null, ticketRemaining),
    [selectedTicket?.status, ticketRemaining],
  );

  const maxQuantity = useMemo(() => {
    if (ticketRemaining == null) return 10;
    return Math.max(1, Math.min(ticketRemaining, 10));
  }, [ticketRemaining]);

  useEffect(() => {
    if (ticketQuantity > maxQuantity) setTicketQuantity(maxQuantity);
  }, [maxQuantity, ticketQuantity]);

  const totalCents = selectedTicket ? selectedTicket.price * ticketQuantity : 0;
  const canCheckout =
    Boolean(selectedTicket) &&
    ticketStatusLabel === "Disponível" &&
    !isLoading &&
    !isError &&
    Boolean(session);
  const ctaLabel = selectedTicket && selectedTicket.price === 0 ? "Confirmar inscrição" : "Continuar para pagamento";

  const cover = data?.coverImageUrl ?? null;
  const category = data?.categories?.[0] ?? "EVENTO";
  const date = formatDateRange(data?.startsAt, data?.endsAt);
  const location = data?.location?.formattedAddress || data?.location?.city || "Local a anunciar";
  const price =
    data?.isGratis ? "Grátis" : typeof data?.priceFrom === "number" ? `Desde ${data.priceFrom.toFixed(0)}€` : "Preço em breve";
  const description = data?.description ?? data?.shortDescription ?? null;
  const showPreview = isLoading && !data && (eventTitleValue || previewCoverValue || previewDescription);
  const previewDate = previewStartsAt ? formatDateRange(previewStartsAt, previewEndsAt ?? undefined) : date;
  const displayTitle = data?.title ?? eventTitleValue ?? "Evento";
  const displayCategory = data?.categories?.[0] ?? previewCategory ?? category;
  const displayCover = data?.coverImageUrl ?? previewCoverValue ?? cover;
  const displayDescription = data?.shortDescription ?? data?.description ?? previewDescription ?? description;
  const displayLocation = data?.location?.formattedAddress || data?.location?.city || previewLocation || location;
  const displayPrice = data
    ? price
    : previewPrice ?? price;
  const displayHost = data?.hostName ?? previewHost ?? data?.hostUsername ?? "ORYA";
  const displayImageTag = previewImageTag ?? (data?.slug ? `event-${data.slug}` : null);
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, -24],
    extrapolate: "clamp",
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-120, 0, 220],
    outputRange: [1.1, 1, 0.96],
    extrapolate: "clamp",
  });
  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [130, 220],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <LiquidBackground variant="solid">
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            zIndex: 50,
            top: 40,
            left: 20,
            right: 20,
            opacity: compactHeaderOpacity,
          }}
        >
          <GlassCard intensity={52} padding={10}>
            <View className="flex-row items-center justify-between">
              <Text className="text-white text-sm font-semibold" numberOfLines={1} style={{ flex: 1 }}>
                {data?.title ?? eventTitleValue ?? "Evento"}
              </Text>
              <Ionicons name="sparkles-outline" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: 36 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
        >
          <View className="px-5 pt-12 pb-4">
            <Pressable
              onPress={handleBack}
              className="flex-row items-center gap-2"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
              <Text className="text-white text-sm font-semibold">Voltar</Text>
            </Pressable>
          </View>

          {showPreview ? (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
              <View className="px-5">
                <View className="overflow-hidden rounded-[28px] border border-white/10">
                  {displayCover ? (
                    <View style={{ height: 260, justifyContent: "space-between" }}>
                      <Image
                        source={{ uri: displayCover }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={240}
                        sharedTransitionTag={displayImageTag ?? undefined}
                        cachePolicy="memory-disk"
                        priority="high"
                      />
                      <LinearGradient
                        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View className="flex-row items-center justify-between px-4 pt-4">
                        <GlassPill label={displayCategory} />
                        <GlassPill label="A carregar" variant="muted" />
                      </View>
                      <View className="px-4 pb-4 gap-2">
                        <Text className="text-white text-2xl font-semibold">{displayTitle}</Text>
                        {displayDescription ? (
                          <Text className="text-white/75 text-sm">{displayDescription}</Text>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View
                      style={{
                        height: 260,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        justifyContent: "space-between",
                        paddingHorizontal: tokens.spacing.lg,
                        paddingVertical: tokens.spacing.lg,
                      }}
                    >
                      <View className="flex-row items-center gap-2 self-start">
                        <GlassPill label={displayCategory} />
                        <GlassPill label="A carregar" variant="muted" />
                      </View>
                      <Text className="text-white/60 text-xs">A preparar detalhes</Text>
                    </View>
                  )}
                </View>

                <View className="pt-6 gap-3">
                  <GlassCard intensity={50}>
                    <View className="gap-2">
                      <Text className="text-white text-sm font-semibold">Informações principais</Text>
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.7)" />
                        <Text className="text-white/70 text-sm">{previewDate}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
                        <Text className="text-white/65 text-sm">{displayLocation}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.6)" />
                        <Text className="text-white/70 text-sm">Organizador: {displayHost}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="pricetag-outline" size={16} color="rgba(255,255,255,0.7)" />
                        <Text className="text-white text-sm font-semibold">{displayPrice}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </View>
              </View>
            </Animated.View>
          ) : isLoading ? (
            <View className="px-5 gap-3">
              <GlassSkeleton height={220} />
              <GlassSkeleton height={140} />
              <GlassSkeleton height={120} />
            </View>
          ) : isError || !data ? (
            <View className="px-5">
              <GlassSurface intensity={50}>
                <Text className="text-red-300 text-sm mb-3">
                  {error instanceof ApiError && error.status === 404
                    ? "Evento não encontrado."
                    : "Não foi possível carregar o evento."}
                </Text>
                <Pressable
                  onPress={() => refetch()}
                  className="rounded-xl bg-white/10 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassSurface>
            </View>
          ) : (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
              <View className="px-5">
                <Animated.View
                  style={{
                    transform: [{ translateY: heroTranslate }, { scale: heroScale }],
                  }}
                >
                  <View className="overflow-hidden rounded-[28px] border border-white/10">
                    {cover ? (
                      <View style={{ height: 260, justifyContent: "space-between" }}>
                        <Image
                          source={{ uri: cover }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={260}
                          sharedTransitionTag={displayImageTag ?? undefined}
                          cachePolicy="memory-disk"
                          priority="high"
                        />
                        <LinearGradient
                          colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <View className="flex-row items-center justify-between px-4 pt-4">
                          <View className="flex-row items-center gap-2">
                            <GlassPill label={category} />
                            {data.isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                          </View>
                          <GlassPill label={resolveStatusLabel(data.status)} variant="muted" />
                        </View>
                        <View className="px-4 pb-4 gap-2">
                          <Text className="text-white text-2xl font-semibold">{data.title}</Text>
                          {data.shortDescription ? (
                            <Text className="text-white/75 text-sm">{data.shortDescription}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : (
                      <View
                        style={{
                          height: 260,
                          backgroundColor: "rgba(255,255,255,0.08)",
                          justifyContent: "space-between",
                          paddingHorizontal: tokens.spacing.lg,
                          paddingVertical: tokens.spacing.lg,
                        }}
                      >
                        <View className="flex-row items-center gap-2 self-start">
                          <GlassPill label={category} />
                          {data.isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                        </View>
                        <View className="gap-2">
                          <Text className="text-white text-2xl font-semibold">{data.title}</Text>
                          {data.shortDescription ? (
                            <Text className="text-white/75 text-sm">{data.shortDescription}</Text>
                          ) : null}
                        </View>
                      </View>
                    )}
                  </View>
                </Animated.View>
              </View>

              <View className="px-5 pt-6 gap-4">
                <GlassCard intensity={60}>
                  <View className="gap-3">
                    <Text className="text-white text-sm font-semibold">Informações principais</Text>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text className="text-white/70 text-sm">{date}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.6)" />
                      <Text className="text-white/65 text-sm">{location}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.6)" />
                      <Text className="text-white/70 text-sm">Organizador: {data.hostName ?? "ORYA"}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="pricetag-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text className="text-white text-sm font-semibold">{price}</Text>
                    </View>
                  </View>
                </GlassCard>

                {description ? (
                  <GlassCard intensity={54}>
                    <View className="gap-2">
                      <Text className="text-white text-sm font-semibold">Sobre o evento</Text>
                      <Text className="text-white/75 text-sm">{description}</Text>
                    </View>
                  </GlassCard>
                ) : null}

                <View className="gap-3">
                  <Text className="text-white text-sm font-semibold">Bilhetes</Text>
                  {ticketTypes.length === 0 ? (
                    <GlassCard intensity={50}>
                      <Text className="text-white/70 text-sm">
                        Bilhetes a publicar brevemente. Ativa notificações para saber quando abrirem.
                      </Text>
                    </GlassCard>
                  ) : (
                    ticketTypes.map((ticket) => {
                      const remaining =
                        ticket.totalQuantity != null
                          ? Math.max(ticket.totalQuantity - (ticket.soldQuantity ?? 0), 0)
                          : null;
                      const statusLabel = resolveTicketStatusLabel(ticket.status ?? null, remaining);
                      const isSelected = ticket.id === selectedTicketId;
                      const disabled = statusLabel === "Esgotado" || statusLabel === "Fechado";
                      const availability =
                        remaining != null
                          ? remaining <= 6
                            ? `Últimos ${remaining}`
                            : `${remaining} disponíveis`
                          : null;

                      return (
                        <Pressable
                          key={`ticket-${ticket.id}`}
                          disabled={disabled}
                          onPress={() => setSelectedTicketId(ticket.id)}
                          className={isSelected ? "opacity-100" : "opacity-90"}
                        >
                          <GlassCard intensity={isSelected ? 68 : 52} highlight={isSelected}>
                            <View className="gap-3">
                              <View className="flex-row items-center justify-between">
                                <View className="flex-1 pr-2">
                                  <Text className="text-white text-base font-semibold" numberOfLines={1}>
                                    {ticket.name}
                                  </Text>
                                  {ticket.description ? (
                                    <Text className="text-white/65 text-xs mt-1" numberOfLines={2}>
                                      {ticket.description}
                                    </Text>
                                  ) : null}
                                </View>
                                <GlassPill label={formatTicketPrice(ticket.price, ticket.currency)} variant="muted" />
                              </View>
                              <View className="flex-row items-center gap-2">
                                <GlassPill label={statusLabel} variant={disabled ? "muted" : "accent"} />
                                {availability ? (
                                  <Text className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                                    {availability}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </GlassCard>
                        </Pressable>
                      );
                    })
                  )}
                </View>

                {selectedTicket ? (
                  <GlassCard intensity={60} highlight>
                    <View className="gap-4">
                      <Text className="text-white text-sm font-semibold">Resumo da compra</Text>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/70 text-sm">
                          {selectedTicket.name}
                        </Text>
                        <Text className="text-white text-sm font-semibold">
                          {formatTicketPrice(selectedTicket.price, selectedTicket.currency)}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/60 text-sm">Quantidade</Text>
                        <View className="flex-row items-center gap-3">
                          <Pressable
                            onPress={() => setTicketQuantity((prev) => Math.max(1, prev - 1))}
                            className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10"
                            style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          >
                            <Ionicons name="remove" size={16} color="rgba(255,255,255,0.75)" />
                          </Pressable>
                          <Text className="text-white text-base font-semibold">{ticketQuantity}</Text>
                          <Pressable
                            onPress={() => setTicketQuantity((prev) => Math.min(maxQuantity, prev + 1))}
                            className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10"
                            style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          >
                            <Ionicons name="add" size={16} color="rgba(255,255,255,0.85)" />
                          </Pressable>
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/60 text-sm">Total</Text>
                        <Text className="text-white text-lg font-semibold">
                          {formatTicketPrice(totalCents, selectedTicket.currency)}
                        </Text>
                      </View>
                      {!session ? (
                        <Text className="text-xs text-amber-200">
                          Inicia sessão para finalizar a inscrição.
                        </Text>
                      ) : null}
                    </View>
                  </GlassCard>
                ) : null}

                <Pressable
                  disabled={!canCheckout}
                  onPress={() => {
                    if (!selectedTicket) return;
                    setCheckoutDraft({
                      slug: data.slug,
                      eventId: data.id,
                      eventTitle: data.title,
                      ticketTypeId: selectedTicket.id,
                      ticketName: selectedTicket.name,
                      quantity: ticketQuantity,
                      unitPriceCents: selectedTicket.price,
                      totalCents,
                      currency: selectedTicket.currency ?? "EUR",
                      paymentMethod: "card",
                    });
                    router.push("/checkout");
                  }}
                  className={canCheckout ? "rounded-2xl bg-white/15 px-4 py-4" : "rounded-2xl border border-white/10 bg-white/5 px-4 py-4"}
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className={canCheckout ? "text-center text-white text-sm font-semibold" : "text-center text-white/50 text-sm font-semibold"}>
                    {ctaLabel}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </Animated.ScrollView>
      </LiquidBackground>
    </>
  );
}
