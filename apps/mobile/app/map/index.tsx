import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  InteractionManager,
  Linking,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { tokens } from "@orya/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { Ionicons } from "../../components/icons/Ionicons";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useDiscoverStore } from "../../features/discover/store";
import { useDebouncedValue, useDiscoverMapEvents } from "../../features/discover/hooks";
import { useIpLocation } from "../../features/onboarding/hooks";
import { resolveCityToAddress } from "../../features/discover/location";
import { getDistanceKm, formatDistanceKm } from "../../lib/geo";
import { FiltersBottomSheet } from "../../components/discover/FiltersBottomSheet";
import { safeBack } from "../../lib/navigation";
import type { PublicEventCard } from "@orya/shared";

const DEFAULT_REGION: Region = {
  latitude: 38.7223,
  longitude: -9.1393,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatEventDate = (startsAt?: string | null, endsAt?: string | null) => {
  if (!startsAt) return "Data por anunciar";
  try {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return "Data por anunciar";
    const startLabel = EVENT_DATE_FORMATTER.format(start);
    if (!endsAt) return startLabel;
    const end = new Date(endsAt);
    if (Number.isNaN(end.getTime())) return startLabel;
    return `${startLabel}–${EVENT_DATE_FORMATTER.format(end)}`;
  } catch {
    return "Data por anunciar";
  }
};

const formatPrice = (event: PublicEventCard) => {
  if (event.isGratis) return "Grátis";
  if (typeof event.priceFrom === "number") return `Desde ${event.priceFrom.toFixed(0)}€`;
  return "Preço em breve";
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type MapListItem =
  | { type: "skeleton"; key: string }
  | { type: "event"; event: PublicEventCard };

export default function MapScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(18);
  const { height } = useWindowDimensions();

  const [dataReady, setDataReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapRef = useRef<MapView | null>(null);

  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const dateFilter = useDiscoverStore((state) => state.dateFilter);
  const city = useDiscoverStore((state) => state.city);
  const locationAddressId = useDiscoverStore((state) => state.locationAddressId);
  const locationLat = useDiscoverStore((state) => state.locationLat);
  const locationLng = useDiscoverStore((state) => state.locationLng);
  const locationSource = useDiscoverStore((state) => state.locationSource);
  const distanceKm = useDiscoverStore((state) => state.distanceKm);
  const setPriceFilter = useDiscoverStore((state) => state.setPriceFilter);
  const setDateFilter = useDiscoverStore((state) => state.setDateFilter);
  const setLocation = useDiscoverStore((state) => state.setLocation);
  const setDistanceKm = useDiscoverStore((state) => state.setDistanceKm);
  const resetFilters = useDiscoverStore((state) => state.resetFilters);

  const debouncedCity = useDebouncedValue(city, 320);
  const shouldFetchLocation = dataReady && locationSource === "NONE";
  const { data: ipLocation } = useIpLocation(shouldFetchLocation);
  const ipLat = ipLocation?.approxLatLon?.lat ?? null;
  const ipLng = ipLocation?.approxLatLon?.lon ?? null;

  const distanceLat = deviceCoords?.lat ?? locationLat ?? ipLat;
  const distanceLng = deviceCoords?.lng ?? locationLng ?? ipLng;
  const locationResolveRef = useRef(false);

  const discoverQuery = useDiscoverMapEvents(
    {
      q: "",
      type: priceFilter,
      date: dateFilter,
      city: debouncedCity,
      limit: 60,
    },
    dataReady,
  );

  const events = useMemo(() => {
    const items = discoverQuery.data?.items ?? [];
    return items
      .filter((item) => item.type === "event")
      .map((item) => (item.type === "event" ? item.event : null))
      .filter((item): item is PublicEventCard => Boolean(item));
  }, [discoverQuery.data?.items]);

  const filteredEvents = useMemo(() => {
    if (distanceKm <= 0) return events;
    if (distanceLat == null || distanceLng == null) return events;
    return events.filter((event) => {
      const distance = getDistanceKm(event.location?.lat, event.location?.lng, distanceLat, distanceLng);
      if (distance == null) return false;
      return distance <= distanceKm;
    });
  }, [distanceKm, distanceLat, distanceLng, events]);

  const markerEvents = useMemo(
    () => filteredEvents.filter((event) => event.location?.lat != null && event.location?.lng != null),
    [filteredEvents],
  );

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedEventId) ?? null,
    [filteredEvents, selectedEventId],
  );

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }
    if (!filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(filteredEvents[0].id);
    }
  }, [filteredEvents, selectedEventId]);

  useEffect(() => {
    if (!ipLocation?.city) return;
    if (locationSource === "APPLE_MAPS") return;
    if (!city.trim()) {
      setLocation({ city: ipLocation.city, label: ipLocation.city, source: "IP" });
    }
    if (locationResolveRef.current) return;
    if (locationAddressId) return;
    locationResolveRef.current = true;
    resolveCityToAddress(ipLocation.city)
      .then((details) => {
        if (!details?.addressId) return;
        const canonical = (details.canonical as Record<string, unknown> | null) ?? null;
        const cityFromCanonical =
          (canonical && typeof canonical.city === "string" && canonical.city.trim()
            ? canonical.city.trim()
            : null) ?? details.city ?? ipLocation.city;
        setLocation({
          city: cityFromCanonical ?? "",
          label: details.formattedAddress || ipLocation.city,
          addressId: details.addressId,
          lat: typeof details.lat === "number" ? details.lat : null,
          lng: typeof details.lng === "number" ? details.lng : null,
          source: "APPLE_MAPS",
        });
      })
      .catch(() => undefined)
      .finally(() => {
        locationResolveRef.current = false;
      });
  }, [city, ipLocation?.city, locationAddressId, locationSource, setLocation]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const task = InteractionManager.runAfterInteractions(() => {
        if (active) setDataReady(true);
      });
      return () => {
        active = false;
        task.cancel();
        setDataReady(false);
      };
    }, []),
  );

  const requestDeviceLocation = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== "granted") {
        const request = await Location.requestForegroundPermissionsAsync();
        status = request.status;
      }
      setLocationStatus(status);
      if (status !== "granted") return;

      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown?.coords) {
        setDeviceCoords({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
        return;
      }
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (currentPosition?.coords) {
        setDeviceCoords({ lat: currentPosition.coords.latitude, lng: currentPosition.coords.longitude });
      }
    } catch {
      setLocationError("Não foi possível obter a localização.");
    }
  }, []);

  useEffect(() => {
    requestDeviceLocation();
  }, [requestDeviceLocation]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => undefined);
  }, []);

  const initialRegion = useMemo(() => {
    const lat = deviceCoords?.lat ?? ipLat ?? DEFAULT_REGION.latitude;
    const lng = deviceCoords?.lng ?? ipLng ?? DEFAULT_REGION.longitude;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: DEFAULT_REGION.latitudeDelta,
      longitudeDelta: DEFAULT_REGION.longitudeDelta,
    };
  }, [deviceCoords?.lat, deviceCoords?.lng, ipLat, ipLng]);

  const animateToRegion = useCallback((lat: number, lng: number, delta = 0.08) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      350,
    );
  }, []);

  useEffect(() => {
    if (!selectedEvent?.location?.lat || !selectedEvent.location.lng) return;
    animateToRegion(selectedEvent.location.lat, selectedEvent.location.lng);
  }, [animateToRegion, selectedEvent?.location?.lat, selectedEvent?.location?.lng]);

  const handleRecenter = useCallback(() => {
    if (deviceCoords) {
      animateToRegion(deviceCoords.lat, deviceCoords.lng, 0.08);
      return;
    }
    if (ipLat != null && ipLng != null) {
      animateToRegion(ipLat, ipLng, 0.12);
      return;
    }
    animateToRegion(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude, DEFAULT_REGION.latitudeDelta);
  }, [animateToRegion, deviceCoords, ipLat, ipLng]);

  const sheetHeight = Math.min(Math.max(height * 0.62, 320), height - 120);
  const collapsedHeight = 150;
  const maxTranslate = Math.max(0, sheetHeight - collapsedHeight);
  const translateY = useRef(new Animated.Value(maxTranslate)).current;
  const translateYRef = useRef(maxTranslate);
  const panStartRef = useRef(0);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  useEffect(() => {
    translateY.setValue(maxTranslate);
    translateYRef.current = maxTranslate;
    setSheetExpanded(false);
  }, [maxTranslate, translateY]);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      translateYRef.current = value;
    });
    return () => translateY.removeListener(id);
  }, [translateY]);

  const snapSheet = useCallback(
    (expanded: boolean) => {
      Animated.spring(translateY, {
        toValue: expanded ? 0 : maxTranslate,
        useNativeDriver: true,
        friction: 8,
      }).start();
      setSheetExpanded(expanded);
    },
    [maxTranslate, translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dx) < 16,
        onPanResponderGrant: () => {
          panStartRef.current = translateYRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          const next = clamp(panStartRef.current + gesture.dy, 0, maxTranslate);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const endValue = clamp(panStartRef.current + gesture.dy, 0, maxTranslate);
          const shouldExpand = gesture.vy < -0.25 || endValue < maxTranslate * 0.5;
          snapSheet(shouldExpand);
        },
      }),
    [maxTranslate, snapSheet, translateY],
  );

  const mapTitle = useMemo(() => {
    if (city.trim()) return `Eventos em ${city.trim()}`;
    return "Eventos perto de ti";
  }, [city]);

  const listData: MapListItem[] = useMemo(() => {
    if (discoverQuery.isLoading) {
      return Array.from({ length: 4 }, (_, index) => ({ type: "skeleton" as const, key: `skeleton-${index}` }));
    }
    return filteredEvents.map((event) => ({ type: "event" as const, event }));
  }, [discoverQuery.isLoading, filteredEvents]);

  const handleSelectEvent = useCallback(
    (event: PublicEventCard) => {
      setSelectedEventId(event.id);
      if (event.location?.lat != null && event.location?.lng != null) {
        animateToRegion(event.location.lat, event.location.lng, 0.06);
      }
      snapSheet(true);
    },
    [animateToRegion, snapSheet],
  );

  const handleOpenEvent = useCallback(
    (event: PublicEventCard) => {
      handleSelectEvent(event);
      router.push({
        pathname: "/event/[slug]",
        params: {
          slug: event.slug,
          eventTitle: event.title,
          coverImageUrl: event.coverImageUrl ?? "",
          shortDescription: event.shortDescription ?? event.description ?? "",
          startsAt: event.startsAt ?? "",
          endsAt: event.endsAt ?? "",
          locationLabel: event.location?.formattedAddress ?? event.location?.city ?? "",
          priceLabel: formatPrice(event),
          categoryLabel: event.categories?.[0] ?? "EVENTO",
        },
      });
    },
    [handleSelectEvent, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MapListItem }) => {
      if (item.type === "skeleton") {
        return <GlassSurface intensity={50} style={{ marginBottom: 12, height: 84 }} />;
      }
      const event = item.event;
      const isSelected = event.id === selectedEventId;
      const distanceLabel = formatDistanceKm(event.location?.lat, event.location?.lng, distanceLat, distanceLng);
      return (
        <Pressable
          onPress={() => handleOpenEvent(event)}
          style={({ pressed }) => [
            { marginBottom: 12 },
            pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
          ]}
        >
          <GlassCard intensity={isSelected ? 64 : 54} highlight={isSelected} padding={12}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                {event.coverImageUrl ? (
                  <Image source={{ uri: event.coverImageUrl }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.55)" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text className="text-white text-sm font-semibold" numberOfLines={2}>
                  {event.title}
                </Text>
                <Text className="text-white/60 text-xs" numberOfLines={1}>
                  {formatEventDate(event.startsAt ?? null, event.endsAt ?? null)}
                </Text>
                <Text className="text-white/55 text-xs" numberOfLines={1}>
                  {event.location?.formattedAddress || event.location?.city || "Local a anunciar"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text className="text-white/80 text-xs font-semibold">{formatPrice(event)}</Text>
                  {distanceLabel ? (
                    <Text className="text-white/45 text-[11px]">· {distanceLabel}</Text>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </View>
          </GlassCard>
        </Pressable>
      );
    },
    [distanceLat, distanceLng, handleOpenEvent, handleSelectEvent, selectedEventId],
  );

  const keyExtractor = useCallback((item: MapListItem, index: number) => {
    if (item.type === "skeleton") return item.key;
    return `event-${item.event.id}-${index}`;
  }, []);

  if (Platform.OS !== "ios") {
    return (
      <LiquidBackground>
        <TopAppHeader />
        <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => safeBack(router, navigation)}
            className="flex-row items-center gap-2 mb-4"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
          </Pressable>
          <GlassCard intensity={55}>
            <Text className="text-white text-sm font-semibold mb-2">Mapa disponível no iOS</Text>
            <Text className="text-white/65 text-sm">
              Esta experiência usa MapKit. No Android mostramos o mapa externo.
            </Text>
          </GlassCard>
        </View>
      </LiquidBackground>
    );
  }

  return (
    <LiquidBackground variant="solid">
      <TopAppHeader />
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          mapType="mutedStandard"
          style={{ flex: 1 }}
          showsUserLocation={locationStatus === "granted"}
          showsMyLocationButton={false}
        >
          {markerEvents.map((event) => (
            <Marker
              key={`marker-${event.id}`}
              coordinate={{
                latitude: event.location?.lat ?? 0,
                longitude: event.location?.lng ?? 0,
              }}
              onPress={() => handleSelectEvent(event)}
            >
              <View
                style={[
                  styles.markerShell,
                  event.id === selectedEventId ? styles.markerShellActive : null,
                ]}
              >
                <Ionicons
                  name="sparkles"
                  size={16}
                  color={event.id === selectedEventId ? "#0b101a" : "rgba(245,250,255,0.9)"}
                />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={{ position: "absolute", top: topPadding, left: 20, right: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable
              onPress={() => safeBack(router, navigation)}
              style={({ pressed }) => [
                styles.controlButton,
                pressed ? styles.controlPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.95)" />
              <Text style={styles.controlLabel}>Voltar</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setFiltersOpen(true)}
                style={({ pressed }) => [styles.iconButton, pressed ? styles.controlPressed : null]}
              >
                <Ionicons name="options-outline" size={18} color="rgba(255,255,255,0.9)" />
              </Pressable>
              <Pressable
                onPress={handleRecenter}
                style={({ pressed }) => [styles.iconButton, pressed ? styles.controlPressed : null]}
              >
                <Ionicons name="locate-outline" size={18} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>
          </View>

          {locationStatus !== "granted" ? (
            <Pressable
              onPress={handleOpenSettings}
              style={({ pressed }) => [styles.locationPrompt, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.locationPromptLabel}>Ativar localização</Text>
            </Pressable>
          ) : null}

          {locationError ? (
            <GlassCard intensity={50} style={{ marginTop: 10 }}>
              <Text className="text-red-300 text-sm">{locationError}</Text>
            </GlassCard>
          ) : null}
        </View>

        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: sheetHeight,
            transform: [{ translateY }],
          }}
        >
          <View style={styles.sheetContainer}>
            <View
              {...panResponder.panHandlers}
              style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}
            >
              <Pressable onPress={() => snapSheet(!sheetExpanded)}>
                <View style={styles.sheetHandle} />
              </Pressable>
            </View>
            <View style={styles.sheetHeader}>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.sheetTitle}>{mapTitle}</Text>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeText}>ORYA</Text>
                  </View>
                </View>
                <Text style={styles.sheetSubtitle}>
                  {filteredEvents.length} eventos · {dateFilter === "all" ? "Qualquer data" : "Com filtros"}
                </Text>
              </View>
              <Pressable
                onPress={() => resetFilters()}
                style={({ pressed }) => [styles.resetButton, pressed ? styles.controlPressed : null]}
              >
                <Text style={styles.resetLabel}>Limpar</Text>
              </Pressable>
            </View>

            {discoverQuery.isError ? (
              <GlassCard intensity={52} style={{ marginHorizontal: 20, marginBottom: 12 }}>
                <Text className="text-red-300 text-sm mb-3">Não foi possível carregar o mapa.</Text>
                <Pressable
                  onPress={() => discoverQuery.refetch()}
                  className="rounded-xl bg-white/10 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassCard>
            ) : null}

            <FlatList
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 16,
              }}
              scrollEnabled={sheetExpanded}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                !discoverQuery.isLoading && !discoverQuery.isError ? (
                  <GlassSurface intensity={48} style={{ padding: 16 }}>
                    <Text className="text-white/70 text-sm">Sem eventos para estes filtros.</Text>
                    <Pressable
                      onPress={() => setFiltersOpen(true)}
                      className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    >
                      <Text className="text-white text-sm font-semibold text-center">Ajustar filtros</Text>
                    </Pressable>
                  </GlassSurface>
                ) : null
              }
            />
          </View>
        </Animated.View>
      </View>

      <FiltersBottomSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        distanceKm={distanceKm}
        onDistanceChange={setDistanceKm}
        date={dateFilter}
        onDateChange={setDateFilter}
        price={priceFilter}
        onPriceChange={setPriceFilter}
      />
    </LiquidBackground>
  );
}

const styles = {
  controlButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(8,12,20,0.7)",
  },
  controlLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(8,12,20,0.7)",
  },
  controlPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  locationPrompt: {
    marginTop: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    alignSelf: "flex-start" as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(10,14,24,0.8)",
  },
  locationPromptLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  sheetContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10,14,24,0.92)",
    overflow: "hidden" as const,
  },
  markerShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(12,18,30,0.88)",
    shadowColor: "#0b101a",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  markerShellActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(255,255,255,0.95)",
    shadowOpacity: 0.45,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  brandBadgeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "700" as const,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  sheetSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  resetLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600" as const,
  },
};
