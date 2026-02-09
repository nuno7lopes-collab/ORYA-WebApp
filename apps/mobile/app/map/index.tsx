import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { tokens } from "@orya/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
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
import { formatDistanceKm, getDistanceKm } from "../../lib/geo";
import { safeBack } from "../../lib/navigation";
import type { PublicEventCard } from "@orya/shared";
import { MapFiltersBar, type MapTemplateFilter } from "../../components/discover/MapFiltersBar";

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

const RANGE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
});

const SHEET_HANDLE_HEIGHT = 16;
const SCROLL_ENABLE_OFFSET = 36;

const formatEventDate = (startsAt?: string | null, endsAt?: string | null) => {
  if (!startsAt) return null;
  try {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return null;
    const startLabel = EVENT_DATE_FORMATTER.format(start);
    if (!endsAt) return startLabel;
    const end = new Date(endsAt);
    if (Number.isNaN(end.getTime())) return startLabel;
    return `${startLabel}–${EVENT_DATE_FORMATTER.format(end)}`;
  } catch {
    return null;
  }
};

const formatPrice = (event: PublicEventCard) => {
  if (event.isGratis) return "Grátis";
  if (typeof event.priceFrom === "number") return `Desde ${event.priceFrom.toFixed(0)}€`;
  return null;
};

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const clampWorklet = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(Math.max(value, min), max);
};

type MapListItem =
  | { type: "skeleton"; key: string }
  | { type: "event"; event: PublicEventCard };

export default function MapScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(18);
  const { height } = useWindowDimensions();
  const bottomPadding = Math.max(insets.bottom + 24, 24);

  const [dataReady, setDataReady] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [templateType, setTemplateType] = useState<MapTemplateFilter>("all");
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [listScrollEnabled, setListScrollEnabled] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const centerModeRef = useRef<"none" | "ip" | "device">("none");

  const city = useDiscoverStore((state) => state.city);
  const locationAddressId = useDiscoverStore((state) => state.locationAddressId);
  const locationLat = useDiscoverStore((state) => state.locationLat);
  const locationLng = useDiscoverStore((state) => state.locationLng);
  const locationSource = useDiscoverStore((state) => state.locationSource);
  const setLocation = useDiscoverStore((state) => state.setLocation);

  const shouldFetchLocation = dataReady && locationSource === "NONE";
  const { data: ipLocation } = useIpLocation(shouldFetchLocation);
  const ipLat = ipLocation?.approxLatLon?.lat ?? null;
  const ipLng = ipLocation?.approxLatLon?.lon ?? null;

  const distanceLat = deviceCoords?.lat ?? locationLat ?? ipLat;
  const distanceLng = deviceCoords?.lng ?? locationLng ?? ipLng;
  const locationResolveRef = useRef(false);

  const formatDateParam = (value: Date | null) => {
    if (!value) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const startDateParam = formatDateParam(rangeStart);
  const endDateParam = formatDateParam(rangeEnd);
  const templateTypesParam = templateType === "all" ? null : templateType;
  const priceMinParam = priceMin > 0 ? priceMin : null;
  const priceMaxParam = priceMax != null ? priceMax : null;
  const debouncedRegion = useDebouncedValue(mapRegion, 700);

  const bounds = useMemo(() => {
    if (!debouncedRegion) return null;
    const { latitude, longitude, latitudeDelta, longitudeDelta } = debouncedRegion;
    const clampLat = (value: number) => Math.min(90, Math.max(-90, value));
    const wrapLng = (value: number) => {
      let v = value;
      while (v > 180) v -= 360;
      while (v < -180) v += 360;
      return v;
    };
    const north = clampLat(latitude + latitudeDelta / 2);
    const south = clampLat(latitude - latitudeDelta / 2);
    const east = wrapLng(longitude + longitudeDelta / 2);
    const west = wrapLng(longitude - longitudeDelta / 2);
    return { north, south, east, west };
  }, [debouncedRegion]);

  const shouldUpdateRegion = useCallback(
    (next: Region) => {
      if (!mapRegion) return true;
      const centerDistance = getDistanceKm(
        mapRegion.latitude,
        mapRegion.longitude,
        next.latitude,
        next.longitude,
      );
      const deltaChange =
        Math.abs(mapRegion.latitudeDelta - next.latitudeDelta) +
        Math.abs(mapRegion.longitudeDelta - next.longitudeDelta);
      return (centerDistance != null && centerDistance > 0.15) || deltaChange > 0.02;
    },
    [mapRegion],
  );

  const queryEnabled = dataReady && bounds != null;
  const discoverQuery = useDiscoverMapEvents(
    {
      q: "",
      type: "all",
      date: "all",
      city: "",
      limit: 60,
      startDate: startDateParam ?? undefined,
      endDate: endDateParam ?? undefined,
      templateTypes: templateTypesParam ?? undefined,
      priceMin: priceMinParam,
      priceMax: priceMaxParam,
      north: bounds?.north ?? undefined,
      south: bounds?.south ?? undefined,
      east: bounds?.east ?? undefined,
      west: bounds?.west ?? undefined,
    },
    queryEnabled,
  );

  const events = useMemo(() => {
    const items = discoverQuery.data?.items ?? [];
    return items
      .filter((item) => item.type === "event")
      .map((item) => (item.type === "event" ? item.event : null))
      .filter((item): item is PublicEventCard => Boolean(item));
  }, [discoverQuery.data?.items]);

  const eventsInBounds = useMemo(() => {
    if (!bounds) return events;
    const { north, south, east, west } = bounds;
    return events.filter((event) => {
      const lat = event.location?.lat;
      const lng = event.location?.lng;
      if (lat == null || lng == null) return false;
      if (lat < south || lat > north) return false;
      if (west <= east) {
        return lng >= west && lng <= east;
      }
      return lng >= west || lng <= east;
    });
  }, [bounds, events]);

  const distanceOrigin = useMemo(() => {
    const region = debouncedRegion ?? mapRegion;
    if (region?.latitude != null && region?.longitude != null) {
      if (distanceLat != null && distanceLng != null) {
        const distanceFromUser = getDistanceKm(
          region.latitude,
          region.longitude,
          distanceLat,
          distanceLng,
        );
        if (distanceFromUser != null && distanceFromUser > 2) {
          return { lat: region.latitude, lng: region.longitude };
        }
        return { lat: distanceLat, lng: distanceLng };
      }
      return { lat: region.latitude, lng: region.longitude };
    }
    if (distanceLat != null && distanceLng != null) return { lat: distanceLat, lng: distanceLng };
    return null;
  }, [debouncedRegion, distanceLat, distanceLng, mapRegion]);

  const filteredEvents = useMemo(() => {
    const base = eventsInBounds;
    if (!distanceOrigin) return base;
    const { lat, lng } = distanceOrigin;
    return [...base].sort((a, b) => {
      const distA = getDistanceKm(a.location?.lat, a.location?.lng, lat, lng);
      const distB = getDistanceKm(b.location?.lat, b.location?.lng, lat, lng);
      if (distA == null && distB == null) return 0;
      if (distA == null) return 1;
      if (distB == null) return -1;
      return distA - distB;
    });
  }, [distanceOrigin, eventsInBounds]);

  const isEmpty =
    queryEnabled && !discoverQuery.isLoading && !discoverQuery.isError && filteredEvents.length === 0;

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

  const requestDeviceLocation = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status === "undetermined") {
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

  useFocusEffect(
    useCallback(() => {
      setDataReady(true);
      requestDeviceLocation();
      return () => {
        setDataReady(false);
      };
    }, [requestDeviceLocation]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        requestDeviceLocation();
      }
    });
    return () => subscription.remove();
  }, [requestDeviceLocation]);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setMapReady(true);
    }
  }, []);

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

  const handleOpenExternalMap = useCallback(() => {
    const cityLabel = city?.trim() || ipLocation?.city || "Eventos ORYA";
    const lat = distanceOrigin?.lat ?? initialRegion.latitude;
    const lng = distanceOrigin?.lng ?? initialRegion.longitude;
    let url: string | null = null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const label = encodeURIComponent(cityLabel);
      if (Platform.OS === "android") {
        url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
      } else {
        url = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
      }
    } else if (cityLabel) {
      if (Platform.OS === "android") {
        url = `geo:0,0?q=${encodeURIComponent(cityLabel)}`;
      } else {
        url = `http://maps.apple.com/?q=${encodeURIComponent(cityLabel)}`;
      }
    }
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
  }, [city, distanceOrigin?.lat, distanceOrigin?.lng, initialRegion.latitude, initialRegion.longitude, ipLocation?.city]);

  const animateToRegion = useCallback((lat: number, lng: number, delta = 0.08) => {
    const nextRegion = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    if (Platform.OS === "ios") {
      mapRef.current?.animateToRegion(nextRegion, 350);
    }
    setMapRegion(nextRegion);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    if (deviceCoords && centerModeRef.current !== "device") {
      animateToRegion(deviceCoords.lat, deviceCoords.lng, 0.08);
      centerModeRef.current = "device";
      return;
    }
    if (!deviceCoords && ipLat != null && ipLng != null && centerModeRef.current === "none") {
      animateToRegion(ipLat, ipLng, 0.12);
      centerModeRef.current = "ip";
    }
  }, [animateToRegion, deviceCoords, ipLat, ipLng, mapReady]);

  useEffect(() => {
    if (!mapReady || mapRegion) return;
    setMapRegion(initialRegion);
  }, [initialRegion, mapReady, mapRegion]);

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

  const bottomInset = Platform.OS === "ios" ? Math.max(insets.bottom + 14, 24) : 0;
  const sheetMaxHeight = Math.min(Math.max(height * 0.82, 360), height - 120);
  const sheetMidHeight = Math.min(Math.max(height * 0.34, 220), sheetMaxHeight - 80);
  const sheetMinHeight = Math.max(84, bottomInset + SHEET_HANDLE_HEIGHT + 16);
  const effectiveMaxHeight = isEmpty ? sheetMidHeight : sheetMaxHeight;
  const sheetHeight = useSharedValue(sheetMinHeight);
  const minHeight = useSharedValue(sheetMinHeight);
  const midHeight = useSharedValue(sheetMidHeight);
  const maxHeight = useSharedValue(effectiveMaxHeight);
  const lastSnapRef = useRef(0);
  const lastSnapIndex = useSharedValue(0);
  const gestureStart = useSharedValue(sheetMinHeight);

  useEffect(() => {
    minHeight.value = sheetMinHeight;
    midHeight.value = sheetMidHeight;
    maxHeight.value = effectiveMaxHeight;
    sheetHeight.value = clampValue(sheetHeight.value, sheetMinHeight, effectiveMaxHeight);
    if (isEmpty && lastSnapRef.current === 2) {
      lastSnapRef.current = 1;
      lastSnapIndex.value = 1;
    }
  }, [
    effectiveMaxHeight,
    isEmpty,
    maxHeight,
    midHeight,
    minHeight,
    sheetHeight,
    sheetMaxHeight,
    sheetMidHeight,
    sheetMinHeight,
    lastSnapIndex,
  ]);

  useAnimatedReaction(
    () => sheetHeight.value > minHeight.value + SCROLL_ENABLE_OFFSET,
    (enabled, prev) => {
      if (enabled !== prev) {
        runOnJS(setListScrollEnabled)(enabled);
      }
    },
    [minHeight],
  );

  const triggerHaptic = useCallback((index: number) => {
    const feedback =
      index === 0
        ? Haptics.ImpactFeedbackStyle.Light
        : index === 1
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
    Haptics.impactAsync(feedback).catch(() => undefined);
  }, []);

  const setLastSnap = useCallback((index: number) => {
    lastSnapRef.current = index;
  }, []);

  const snapToIndex = useCallback(
    (index: number) => {
      const resolvedIndex = isEmpty && index === 2 ? 1 : index;
      const dest =
        resolvedIndex === 2 ? sheetMaxHeight : resolvedIndex === 1 ? sheetMidHeight : sheetMinHeight;
      if (lastSnapRef.current !== resolvedIndex) {
        lastSnapRef.current = resolvedIndex;
        lastSnapIndex.value = resolvedIndex;
        triggerHaptic(resolvedIndex);
      }
      sheetHeight.value = withSpring(dest, { damping: 26, stiffness: 320 });
    },
    [isEmpty, lastSnapIndex, sheetHeight, sheetMaxHeight, sheetMidHeight, sheetMinHeight, triggerHaptic],
  );

  const openSheet = useCallback(() => {
    if (Platform.OS === "ios") {
      snapToIndex(1);
    }
  }, [snapToIndex]);


  const sheetProgress = useDerivedValue(() => {
    const range = Math.max(maxHeight.value - minHeight.value, 1);
    return (sheetHeight.value - minHeight.value) / range;
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(sheetProgress.value, [0, 1], [0.2, 1], Extrapolate.CLAMP);
    const opacity = interpolate(progress, [0, 1], [0.08, 0.55]);
    const radius = interpolate(progress, [0, 1], [6, 16]);
    const offset = interpolate(progress, [0, 1], [4, 12]);
    return {
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offset },
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    };
  });

  const blurAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(sheetProgress.value, [0, 1], [0, 0.9], Extrapolate.CLAMP),
    };
  });

  const sheetPositionStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          gestureStart.value = sheetHeight.value;
        })
        .onUpdate((event) => {
          const next = clampWorklet(
            gestureStart.value - event.translationY,
            minHeight.value,
            maxHeight.value,
          );
          sheetHeight.value = next;
        })
        .onEnd((event) => {
          const projected = clampWorklet(
            sheetHeight.value - event.velocityY * 0.2,
            minHeight.value,
            maxHeight.value,
          );
          let dest = minHeight.value;
          let nextIndex = 0;
          let smallest = Math.abs(projected - dest);
          const midDistance = Math.abs(projected - midHeight.value);
          if (midDistance < smallest) {
            smallest = midDistance;
            dest = midHeight.value;
            nextIndex = 1;
          }
          const maxDistance = Math.abs(projected - maxHeight.value);
          if (maxDistance < smallest) {
            dest = maxHeight.value;
            nextIndex = 2;
          }
          if (isEmpty) {
            dest = midHeight.value;
            nextIndex = 1;
          }
          sheetHeight.value = withSpring(dest, { damping: 26, stiffness: 320 });
          if (lastSnapIndex.value !== nextIndex) {
            lastSnapIndex.value = nextIndex;
            runOnJS(setLastSnap)(nextIndex);
            runOnJS(triggerHaptic)(nextIndex);
          }
        }),
    [
      gestureStart,
      sheetHeight,
      minHeight,
      midHeight,
      maxHeight,
      isEmpty,
      triggerHaptic,
      setLastSnap,
      lastSnapIndex,
    ],
  );

  const mapTitle = "Eventos no mapa";

  const rangeLabel = useMemo(() => {
    const format = (value: Date) => RANGE_DATE_FORMATTER.format(value);
    if (rangeStart && rangeEnd) return `${format(rangeStart)}–${format(rangeEnd)}`;
    if (rangeStart) return `Desde ${format(rangeStart)}`;
    if (rangeEnd) return `Até ${format(rangeEnd)}`;
    return "Qualquer data";
  }, [rangeEnd, rangeStart]);

  const clearMapFilters = useCallback(() => {
    setPriceMin(0);
    setPriceMax(null);
    setTemplateType("all");
    setRangeStart(null);
    setRangeEnd(null);
  }, []);

  const sheetHeader = useMemo(
    () => (
      <View>
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderInfo}>
            <View style={styles.sheetHeaderTitleRow}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {mapTitle}
              </Text>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>ORYA</Text>
              </View>
            </View>
            <View style={styles.sheetHeaderSubtitleRow}>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {filteredEvents.length} eventos · {rangeLabel}
              </Text>
              {discoverQuery.isFetching ? (
                <View style={styles.sheetHeaderLoading}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                  <Text style={styles.sheetSubtitle}>A carregar…</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={clearMapFilters}
            style={({ pressed }) => [styles.resetButton, pressed ? styles.controlPressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Limpar filtros"
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
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : null}
      </View>
    ),
    [
      clearMapFilters,
      discoverQuery.isError,
      discoverQuery.isFetching,
      discoverQuery.refetch,
      filteredEvents.length,
      mapTitle,
      rangeLabel,
    ],
  );


  const listData: MapListItem[] = useMemo(() => {
    if (!queryEnabled || discoverQuery.isLoading) {
      return Array.from({ length: 4 }, (_, index) => ({ type: "skeleton" as const, key: `skeleton-${index}` }));
    }
    return filteredEvents.map((event) => ({ type: "event" as const, event }));
  }, [discoverQuery.isLoading, filteredEvents, queryEnabled]);

  const allowListScroll = listScrollEnabled && !isEmpty;

  const handleSelectEvent = useCallback(
    (event: PublicEventCard) => {
      setSelectedEventId(event.id);
      if (event.location?.lat != null && event.location?.lng != null) {
        animateToRegion(event.location.lat, event.location.lng, 0.06);
      }
      openSheet();
    },
    [animateToRegion, openSheet],
  );

  const handleOpenEvent = useCallback(
    (event: PublicEventCard) => {
      handleSelectEvent(event);
      router.push({
        pathname: "/event/[slug]",
        params: {
          slug: event.slug,
          source: "map",
          eventTitle: event.title,
          coverImageUrl: event.coverImageUrl ?? "",
          shortDescription: event.shortDescription ?? event.description ?? "",
          startsAt: event.startsAt ?? "",
          endsAt: event.endsAt ?? "",
          locationLabel: event.location?.formattedAddress ?? event.location?.city ?? "",
          priceLabel: formatPrice(event) ?? "",
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
      const distanceLabel = formatDistanceKm(
        event.location?.lat,
        event.location?.lng,
        distanceOrigin?.lat,
        distanceOrigin?.lng,
      );
      const dateLabel = formatEventDate(event.startsAt ?? null, event.endsAt ?? null);
      const locationLabel = event.location?.formattedAddress || event.location?.city || null;
      const priceLabel = formatPrice(event);
      return (
        <Pressable
          onPress={() => handleOpenEvent(event)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir evento ${event.title}`}
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
                {dateLabel ? (
                  <Text className="text-white/60 text-xs" numberOfLines={1}>
                    {dateLabel}
                  </Text>
                ) : null}
                {locationLabel ? (
                  <Text className="text-white/55 text-xs" numberOfLines={1}>
                    {locationLabel}
                  </Text>
                ) : null}
                {(priceLabel || distanceLabel) ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {priceLabel ? (
                      <Text className="text-white/80 text-xs font-semibold">{priceLabel}</Text>
                    ) : null}
                    {distanceLabel ? (
                      <Text className="text-white/45 text-[11px]">· {distanceLabel}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </View>
          </GlassCard>
        </Pressable>
      );
    },
    [distanceOrigin, handleOpenEvent, selectedEventId],
  );

  const keyExtractor = useCallback((item: MapListItem, index: number) => {
    if (item.type === "skeleton") return item.key;
    return `event-${item.event.id}-${index}`;
  }, []);

  if (Platform.OS !== "ios") {
    return (
      <LiquidBackground>
        <TopAppHeader />
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: bottomPadding }}
          ListHeaderComponent={
            <View>
              <Pressable
                onPress={() => safeBack(router, navigation, "/(tabs)/index")}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                className="flex-row items-center gap-2"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
              </Pressable>
              <View style={{ marginTop: 10, marginBottom: 12 }}>
                <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "700" }}>Mapa</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  No Android mostramos uma lista geográfica. Abre o mapa externo se quiseres ver no mapa.
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <MapFiltersBar
                    priceMin={priceMin}
                    priceMax={priceMax}
                    onPriceChange={(min, max) => {
                      setPriceMin(min);
                      setPriceMax(max);
                    }}
                    templateType={templateType}
                    onTemplateTypeChange={setTemplateType}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onRangeChange={(start, end) => {
                      setRangeStart(start);
                      setRangeEnd(end);
                    }}
                    onClear={clearMapFilters}
                    compact
                  />
                </View>
                <Pressable
                  onPress={handleRecenter}
                  accessibilityRole="button"
                  accessibilityLabel="Recentrar mapa"
                  style={({ pressed }) => [styles.iconButton, pressed ? styles.controlPressed : null]}
                >
                  <Ionicons name="locate-outline" size={18} color="rgba(255,255,255,0.9)" />
                </Pressable>
              </View>

              <Pressable
                onPress={handleOpenExternalMap}
                accessibilityRole="button"
                accessibilityLabel="Abrir mapa externo"
                style={({ pressed }) => [
                  styles.locationPrompt,
                  { alignSelf: "flex-start", marginTop: 10 },
                  pressed ? styles.controlPressed : null,
                ]}
              >
                <Ionicons name="map-outline" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.locationPromptLabel}>Abrir mapa externo</Text>
              </Pressable>

              {locationStatus !== "granted" ? (
                <Pressable
                  onPress={handleOpenSettings}
                  accessibilityRole="button"
                  accessibilityLabel="Ativar localização"
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

              <View style={{ marginTop: 10 }}>{sheetHeader}</View>
            </View>
          }
          ListEmptyComponent={
            queryEnabled && !discoverQuery.isLoading && !discoverQuery.isError ? (
              <GlassSurface intensity={48} style={{ padding: 16, marginTop: 12 }}>
                <Text className="text-white/70 text-sm">Sem eventos nesta área.</Text>
                <Pressable
                  onPress={clearMapFilters}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Limpar filtros</Text>
                </Pressable>
              </GlassSurface>
            ) : null
          }
          refreshing={discoverQuery.isFetching}
          onRefresh={() => discoverQuery.refetch()}
          removeClippedSubviews={Platform.OS === "android"}
          showsVerticalScrollIndicator={false}
        />
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
          onMapReady={() => setMapReady(true)}
          onRegionChangeComplete={(region) => {
            if (shouldUpdateRegion(region)) {
              setMapRegion(region);
            }
          }}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => safeBack(router, navigation, "/(tabs)/index")}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={({ pressed }) => [
                styles.controlButton,
                pressed ? styles.controlPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.95)" />
              <Text style={styles.controlLabel}>Voltar</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <MapFiltersBar
                priceMin={priceMin}
                priceMax={priceMax}
                onPriceChange={(min, max) => {
                  setPriceMin(min);
                  setPriceMax(max);
                }}
                templateType={templateType}
                onTemplateTypeChange={setTemplateType}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onRangeChange={(start, end) => {
                  setRangeStart(start);
                  setRangeEnd(end);
                }}
                onClear={clearMapFilters}
                compact
              />
            </View>
            <Pressable
              onPress={handleRecenter}
              accessibilityRole="button"
              accessibilityLabel="Recentrar mapa"
              style={({ pressed }) => [styles.iconButton, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="locate-outline" size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>

          {locationStatus !== "granted" ? (
            <Pressable
              onPress={handleOpenSettings}
              accessibilityRole="button"
              accessibilityLabel="Ativar localização"
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

          <View style={{ marginTop: 8 }} />
        </View>

        <Animated.View
          style={[
            styles.sheetWrapper,
            { bottom: bottomInset },
            sheetPositionStyle,
          ]}
        >
          <Animated.View style={[styles.sheetBackground, sheetAnimatedStyle]}>
            <GestureDetector gesture={panGesture}>
              <View style={styles.sheetHandleContainer}>
                <View style={styles.sheetHandleIndicator} />
              </View>
            </GestureDetector>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, blurAnimatedStyle]}>
              <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFillObject} />
            </Animated.View>
            <FlatList
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={{ flex: 1 }}
              scrollEnabled={allowListScroll}
              bounces={allowListScroll}
              alwaysBounceVertical={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: bottomInset > 0 ? 20 : insets.bottom + 16,
                paddingTop: 0,
                flexGrow: 1,
                justifyContent: isEmpty ? "center" : "flex-start",
              }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={sheetHeader}
              stickyHeaderIndices={[0]}
              ListEmptyComponent={
                isEmpty ? (
                  <GlassSurface intensity={48} style={{ padding: 16 }}>
                    <Text className="text-white/70 text-sm">Sem eventos nesta área.</Text>
                    <Pressable
                      onPress={clearMapFilters}
                      className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    >
                      <Text className="text-white text-sm font-semibold text-center">Limpar filtros</Text>
                    </Pressable>
                  </GlassSurface>
                ) : null
              }
            />
          </Animated.View>
        </Animated.View>
      </View>
    </LiquidBackground>
  );
}

const styles = {
  controlButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(10,14,24,0.65)",
  },
  controlLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(10,14,24,0.65)",
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
  sheetBackground: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10,14,24,0.92)",
    overflow: "hidden" as const,
    flex: 1,
  },
  sheetWrapper: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
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
  sheetHandleContainer: {
    height: SHEET_HANDLE_HEIGHT,
    paddingTop: 6,
    paddingBottom: 0,
    paddingHorizontal: 0,
    alignItems: "center" as const,
    justifyContent: "flex-start" as const,
  },
  sheetHandleIndicator: {
    width: 40,
    height: 3,
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
  sheetHeaderInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sheetHeaderTitleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  sheetHeaderSubtitleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    flexWrap: "wrap" as const,
  },
  sheetHeaderLoading: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700" as const,
    flexShrink: 1,
  },
  sheetSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
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
