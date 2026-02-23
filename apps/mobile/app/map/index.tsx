import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { Ionicons } from "../../components/icons/Ionicons";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useDiscoverStore } from "../../features/discover/store";
import { useDebouncedValue, useDiscoverMapEvents } from "../../features/discover/hooks";
import { useIpLocation } from "../../features/onboarding/hooks";
import { resolveCityToAddress } from "../../features/discover/location";
import { LocationPermissionModal } from "../../components/location/LocationPermissionModal";
import { getLocationPermissionState, requestLocationConsent } from "../../lib/locationConsent";
import { formatDistanceKm, getDistanceKm } from "../../lib/geo";
import { resolveMediaUri } from "../../lib/media";
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { resolveSafeHttpUrl } from "../../lib/externalUrl";
import type { PublicEventCard } from "@orya/shared";
import { MapFiltersBar, type MapTemplateFilter } from "../../components/discover/MapFiltersBar";
import { useFocusFrameMonitor } from "../../components/perf/useFocusFrameMonitor";
import { buildMapTargets } from "../../lib/mapLinks";

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

const SHEET_HANDLE_HEIGHT = 28;
const SHEET_HANDLE_DRAG_AREA = SHEET_HANDLE_HEIGHT + 18;
const MAP_CARD_SPACING = 18;
const MAP_CLUSTER_MIN_EVENTS = 10;
const MAP_CLUSTER_MIN_DELTA = 0.18;
const MAP_CLUSTER_MIN_POINTS_PER_CELL = 3;
const MAP_LIST_INITIAL_RENDER = 5;
const MAP_LIST_BATCH_RENDER = 5;
const MAP_LIST_WINDOW_SIZE = 4;
const MAP_LIST_BATCHING_PERIOD_MS = 16;

const MapPressable = (props: ComponentProps<typeof Pressable>) => (
  <Pressable unstable_pressDelay={0} {...props} />
);

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

type MapMarkerItem =
  | { type: "event"; event: PublicEventCard; lat: number; lng: number }
  | { type: "cluster"; key: string; lat: number; lng: number; count: number; events: PublicEventCard[] };

const buildClusteredMarkers = (events: PublicEventCard[], region: Region | null): MapMarkerItem[] => {
  const points = events
    .map((event) => {
      const lat = event.location?.lat;
      const lng = event.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return { event, lat, lng };
    })
    .filter((item): item is { event: PublicEventCard; lat: number; lng: number } => item !== null);

  const singleMarkers = points.map((point) => ({ type: "event" as const, ...point }));

  if (!region || points.length <= 1) {
    return singleMarkers;
  }

  const viewportArea = Math.max(region.latitudeDelta * region.longitudeDelta, 0.0001);
  const density = points.length / viewportArea;
  const shouldClusterByZoom =
    region.latitudeDelta >= MAP_CLUSTER_MIN_DELTA ||
    region.longitudeDelta >= MAP_CLUSTER_MIN_DELTA;
  const shouldClusterByDensity = density >= 240;

  if (
    points.length < MAP_CLUSTER_MIN_EVENTS ||
    (!shouldClusterByZoom && !shouldClusterByDensity)
  ) {
    return singleMarkers;
  }

  const cellsByKey = new Map<string, Array<{ event: PublicEventCard; lat: number; lng: number }>>();
  const gridDivisor =
    region.longitudeDelta >= 0.9 ? 7 : region.longitudeDelta >= 0.4 ? 8 : 9;
  const latStep = Math.max(region.latitudeDelta / gridDivisor, 0.028);
  const lngStep = Math.max(region.longitudeDelta / gridDivisor, 0.028);

  for (const point of points) {
    const latBucket = Math.floor(point.lat / latStep);
    const lngBucket = Math.floor(point.lng / lngStep);
    const key = `${latBucket}:${lngBucket}`;
    const list = cellsByKey.get(key) ?? [];
    list.push(point);
    cellsByKey.set(key, list);
  }

  const markers: MapMarkerItem[] = [];
  for (const [cellKey, clusterPoints] of cellsByKey.entries()) {
    if (clusterPoints.length < MAP_CLUSTER_MIN_POINTS_PER_CELL) {
      for (const single of clusterPoints) {
        markers.push({ type: "event", event: single.event, lat: single.lat, lng: single.lng });
      }
      continue;
    }
    const avgLat =
      clusterPoints.reduce((acc, item) => acc + item.lat, 0) / clusterPoints.length;
    const avgLng =
      clusterPoints.reduce((acc, item) => acc + item.lng, 0) / clusterPoints.length;
    markers.push({
      type: "cluster",
      key: `cluster-${cellKey}-${clusterPoints.length}`,
      lat: avgLat,
      lng: avgLng,
      count: clusterPoints.length,
      events: clusterPoints.map((item) => item.event),
    });
  }

  return markers;
};

type MapEventThumbProps = {
  coverUri: string | null;
  isPadel: boolean;
};

function MapEventThumb({ coverUri, isPadel }: MapEventThumbProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const hasCover = Boolean(coverUri) && !coverFailed;

  useEffect(() => {
    setCoverFailed(false);
  }, [coverUri]);

  return (
    <View style={styles.eventThumb}>
      {hasCover ? (
        <Image
          source={{ uri: coverUri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View style={styles.eventThumbFallback}>
          <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.55)" />
        </View>
      )}
      <View pointerEvents="none" style={styles.eventThumbFrame} />
      {isPadel ? (
        <View style={styles.eventThumbTag}>
          <Text style={styles.eventThumbTagText}>TORNEIO</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerPadding = useTopHeaderPadding(18);
  const topPadding = Platform.OS === "ios" ? insets.top + 10 : headerPadding;
  const { height } = useWindowDimensions();
  useFocusFrameMonitor("screen_map");
  const bottomPadding = Math.max(insets.bottom + 24, 24);

  const [dataReady, setDataReady] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalBusy, setLocationModalBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [templateType, setTemplateType] = useState<MapTemplateFilter>("all");
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(true);
  const [isSheetInteracting, setIsSheetInteracting] = useState(false);
  const [isMapInteractionLocked, setIsMapInteractionLocked] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const listRef = useRef<FlatList<MapListItem> | null>(null);
  const centerModeRef = useRef<"none" | "ip" | "device">("none");
  const interactionIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapStopTimestampRef = useRef<number | null>(null);
  const pendingStabilityMetricRef = useRef(false);

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
  const debouncedRegion = useDebouncedValue(mapRegion, 100);
  const activeRegion = debouncedRegion ?? mapRegion;

  const bounds = useMemo(() => {
    if (!activeRegion) return null;
    const { latitude, longitude, latitudeDelta, longitudeDelta } = activeRegion;
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
  }, [activeRegion]);

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
      lat: activeRegion?.latitude ?? undefined,
      lng: activeRegion?.longitude ?? undefined,
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
    const region = activeRegion;
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
  }, [activeRegion, distanceLat, distanceLng]);

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
  const clusteredMarkers = useMemo(
    () => buildClusteredMarkers(markerEvents, activeRegion),
    [activeRegion, markerEvents],
  );

  useEffect(() => {
    if (!pendingStabilityMetricRef.current) return;
    if (discoverQuery.isFetching) return;
    if (mapStopTimestampRef.current == null) return;
    const durationMs = Date.now() - mapStopTimestampRef.current;
    pendingStabilityMetricRef.current = false;
    mapStopTimestampRef.current = null;
    console.info("[metric] map_stop_to_content_stable_ms", {
      durationMs,
      events: filteredEvents.length,
      markers: clusteredMarkers.length,
    });
  }, [clusteredMarkers.length, discoverQuery.isFetching, filteredEvents.length]);

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
          label: details.formattedAddress ?? ipLocation.city ?? "",
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
      const permission = await getLocationPermissionState();
      setLocationStatus(permission.permissionStatus);
      setLocationCanAskAgain(permission.canAskAgain);
      if (permission.permissionStatus !== Location.PermissionStatus.GRANTED) {
        setDeviceCoords(null);
        return;
      }

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

  const handleOpenLocationModal = useCallback(() => {
    setLocationError(null);
    getLocationPermissionState()
      .then((permission) => setLocationCanAskAgain(permission.canAskAgain))
      .catch(() => undefined);
    setLocationModalVisible(true);
  }, []);

  const handleLocationAllow = useCallback(async () => {
    if (locationModalBusy) return;
    setLocationModalBusy(true);
    setLocationError(null);
    try {
      const result = await requestLocationConsent({ intent: "allow" });
      setLocationStatus(result.permissionStatus);
      setLocationCanAskAgain(result.canAskAgain);
      await requestDeviceLocation();
      setLocationModalVisible(false);
    } catch {
      setLocationError("Não foi possível obter a localização.");
    } finally {
      setLocationModalBusy(false);
    }
  }, [locationModalBusy, requestDeviceLocation]);

  const handleLocationSkip = useCallback(async () => {
    if (locationModalBusy) return;
    setLocationModalBusy(true);
    setLocationError(null);
    try {
      await requestLocationConsent({ intent: "skip" });
    } catch {
      // ignore network errors for modal dismissal
    } finally {
      setLocationModalBusy(false);
      setLocationModalVisible(false);
    }
  }, [locationModalBusy]);

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
    const lat = distanceOrigin?.lat ?? initialRegion.latitude ?? null;
    const lng = distanceOrigin?.lng ?? initialRegion.longitude ?? null;
    const targets = buildMapTargets({
      label: cityLabel,
      query: cityLabel,
      lat,
      lng,
    });
    if (!targets) return;
    const preferred = Platform.OS === "ios" ? targets.apple : targets.android;
    Linking.canOpenURL(preferred)
      .then((canOpen) => {
        if (canOpen) {
          return Linking.openURL(preferred);
        }
        const webUrl = resolveSafeHttpUrl(targets.web);
        if (!webUrl) return undefined;
        return Linking.canOpenURL(webUrl).then((canOpenWeb) => {
          if (!canOpenWeb) return undefined;
          return Linking.openURL(webUrl);
        });
      })
      .catch(() => undefined);
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

  const markSheetInteractionStart = useCallback(() => {
    if (interactionIdleTimerRef.current) {
      clearTimeout(interactionIdleTimerRef.current);
      interactionIdleTimerRef.current = null;
    }
    setIsSheetInteracting(true);
  }, []);

  const markSheetInteractionEnd = useCallback((delayMs = 120) => {
    if (interactionIdleTimerRef.current) {
      clearTimeout(interactionIdleTimerRef.current);
    }
    interactionIdleTimerRef.current = setTimeout(() => {
      setIsSheetInteracting(false);
      interactionIdleTimerRef.current = null;
    }, delayMs);
  }, []);

  useEffect(
    () => () => {
      if (interactionIdleTimerRef.current) {
        clearTimeout(interactionIdleTimerRef.current);
      }
    },
    [],
  );

  const bottomInset = Platform.OS === "ios" ? Math.max(insets.bottom + 14, 24) : 0;
  const isLandscape = height < 520;
  const sheetMaxHeight = Math.min(Math.max(height * (isLandscape ? 0.7 : 0.82), 300), height - 120);
  const sheetMidHeight = Math.min(Math.max(height * (isLandscape ? 0.28 : 0.34), 200), sheetMaxHeight - 80);
  const sheetMinHeight = Math.max(84, bottomInset + SHEET_HANDLE_HEIGHT + 16);
  const effectiveMaxHeight = isEmpty ? sheetMidHeight : sheetMaxHeight;
  const sheetHeight = useSharedValue(sheetMinHeight);
  const minHeight = useSharedValue(sheetMinHeight);
  const midHeight = useSharedValue(sheetMidHeight);
  const maxHeight = useSharedValue(effectiveMaxHeight);
  const lastSnapRef = useRef(0);
  const lastSnapIndex = useSharedValue(0);
  const gestureStart = useSharedValue(sheetMinHeight);
  const scrollY = useSharedValue(0);
  const startedInHandle = useSharedValue(false);
  const setLastSnap = useCallback(
    (index: number) => {
      lastSnapRef.current = index;
      setIsSheetCollapsed(index === 0);
      setIsMapInteractionLocked(index === 2);
      if (index === 0) {
        scrollY.value = 0;
      }
    },
    [scrollY],
  );

  useEffect(() => {
    minHeight.value = sheetMinHeight;
    midHeight.value = sheetMidHeight;
    maxHeight.value = effectiveMaxHeight;
    sheetHeight.value = clampValue(sheetHeight.value, sheetMinHeight, effectiveMaxHeight);
    if (isEmpty && lastSnapRef.current === 2) {
      setLastSnap(1);
      lastSnapIndex.value = 1;
    }
  }, [
    effectiveMaxHeight,
    isEmpty,
    maxHeight,
    midHeight,
    minHeight,
    setLastSnap,
    sheetHeight,
    sheetMaxHeight,
    sheetMidHeight,
    sheetMinHeight,
    lastSnapIndex,
  ]);

  const syncCollapsedState = useCallback(
    (collapsed: boolean) => {
      setIsSheetCollapsed(collapsed);
      if (collapsed && lastSnapRef.current !== 0) {
        lastSnapRef.current = 0;
        lastSnapIndex.value = 0;
        setIsMapInteractionLocked(false);
        scrollY.value = 0;
      }
    },
    [lastSnapIndex, scrollY],
  );

  useAnimatedReaction(
    () => sheetHeight.value <= minHeight.value + 1,
    (collapsed, prev) => {
      if (collapsed !== prev) {
        runOnJS(syncCollapsedState)(collapsed);
      }
    },
    [minHeight, syncCollapsedState],
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

  const snapToIndex = useCallback(
    (index: number) => {
      const resolvedIndex = isEmpty && index === 2 ? 1 : index;
      const dest =
        resolvedIndex === 2 ? sheetMaxHeight : resolvedIndex === 1 ? sheetMidHeight : sheetMinHeight;
      if (lastSnapRef.current !== resolvedIndex) {
        setLastSnap(resolvedIndex);
        lastSnapIndex.value = resolvedIndex;
        triggerHaptic(resolvedIndex);
      }
      sheetHeight.value = withSpring(dest, { damping: 26, stiffness: 320 });
    },
    [isEmpty, lastSnapIndex, setLastSnap, sheetHeight, sheetMaxHeight, sheetMidHeight, sheetMinHeight, triggerHaptic],
  );

  const openSheet = useCallback(() => {
    if (Platform.OS === "ios" && lastSnapRef.current === 0) {
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

  const fabAnimatedStyle = useAnimatedStyle(() => {
    const offset = sheetHeight.value + 16;
    const maxRise = height - insets.top - 110;
    const clampedOffset = Math.min(offset, Math.max(maxRise, 120));
    const opacity = interpolate(sheetProgress.value, [0.85, 1], [1, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY: -clampedOffset }],
    };
  });

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      runOnJS(markSheetInteractionStart)();
    },
    onEndDrag: () => {
      runOnJS(markSheetInteractionEnd)();
    },
    onMomentumBegin: () => {
      runOnJS(markSheetInteractionStart)();
    },
    onMomentumEnd: () => {
      runOnJS(markSheetInteractionEnd)();
    },
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart((event) => {
          cancelAnimation(sheetHeight);
          gestureStart.value = sheetHeight.value;
          startedInHandle.value = event.y <= SHEET_HANDLE_DRAG_AREA;
          if (startedInHandle.value) {
            runOnJS(markSheetInteractionStart)();
          }
        })
        .onUpdate((event) => {
          const atMax = sheetHeight.value >= maxHeight.value - 1;
          if (!startedInHandle.value) return;
          if (atMax && event.translationY < 0) return;
          const next = clampWorklet(
            gestureStart.value - event.translationY,
            minHeight.value,
            maxHeight.value,
          );
          sheetHeight.value = next;
        })
        .onEnd((event) => {
          const canSnap = startedInHandle.value;
          startedInHandle.value = false;
          runOnJS(markSheetInteractionEnd)();
          if (!canSnap) return;
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
        })
        .onFinalize(() => {
          startedInHandle.value = false;
          runOnJS(markSheetInteractionEnd)();
        }),
    [
      gestureStart,
      maxHeight,
      minHeight,
      midHeight,
      isEmpty,
      lastSnapIndex,
      markSheetInteractionEnd,
      markSheetInteractionStart,
      scrollGesture,
      scrollY,
      setLastSnap,
      sheetHeight,
      triggerHaptic,
    ],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(isSheetCollapsed)
        .onEnd(() => {
          runOnJS(snapToIndex)(1);
        }),
    [isSheetCollapsed, snapToIndex],
  );

  const sheetGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, tapGesture),
    [panGesture, tapGesture],
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
      <View style={styles.sheetHeaderSticky}>
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
          <MapPressable
            onPress={clearMapFilters}
            style={({ pressed }) => [styles.resetButton, pressed ? styles.controlPressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Limpar filtros"
          >
            <Text style={styles.resetLabel}>Limpar</Text>
          </MapPressable>
        </View>

        {discoverQuery.isError ? (
          <GlassCard intensity={52} style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <Text className="text-red-300 text-sm mb-3">Não foi possível carregar o mapa.</Text>
            <MapPressable
              onPress={() => discoverQuery.refetch()}
              className="rounded-xl bg-white/10 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </MapPressable>
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
    if (!queryEnabled || (discoverQuery.isLoading && !discoverQuery.data)) {
      return Array.from({ length: 4 }, (_, index) => ({ type: "skeleton" as const, key: `skeleton-${index}` }));
    }
    return filteredEvents.map((event) => ({ type: "event" as const, event }));
  }, [discoverQuery.data, discoverQuery.isLoading, filteredEvents, queryEnabled]);

  const allowListScroll = !isSheetCollapsed && !isEmpty;

  const handleSelectEvent = useCallback(
    (event: PublicEventCard) => {
      setSelectedEventId(event.id);
      const index = filteredEvents.findIndex((item) => item.id === event.id);
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
      }
      if (event.location?.lat != null && event.location?.lng != null) {
        animateToRegion(event.location.lat, event.location.lng, 0.06);
      }
      openSheet();
    },
    [animateToRegion, filteredEvents, openSheet],
  );

  const handleClusterPress = useCallback(
    (cluster: Extract<MapMarkerItem, { type: "cluster" }>) => {
      const nextDelta = Math.max((mapRegion?.latitudeDelta ?? 0.12) * 0.55, 0.02);
      animateToRegion(cluster.lat, cluster.lng, nextDelta);
      const firstEvent = cluster.events[0];
      if (firstEvent) {
        setSelectedEventId(firstEvent.id);
      }
      openSheet();
    },
    [animateToRegion, mapRegion?.latitudeDelta, openSheet],
  );

  const handleOpenEvent = useCallback(
    (event: PublicEventCard) => {
      safePush(router, {
        pathname: "/event/[slug]",
        params: {
          slug: event.slug,
          source: "map",
          eventTitle: event.title,
          coverImageUrl: resolveMediaUri(event.coverImageUrl ?? null) ?? "",
          shortDescription: event.shortDescription ?? event.description ?? "",
          startsAt: event.startsAt ?? "",
          endsAt: event.endsAt ?? "",
          locationLabel: event.location?.formattedAddress ?? event.location?.city ?? "",
          priceLabel: formatPrice(event) ?? "",
          categoryLabel: event.categories?.[0] ?? "EVENTO",
        },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MapListItem }) => {
      if (item.type === "skeleton") {
        return (
          <GlassSurface
            intensity={50}
            blurEnabled={!isSheetInteracting}
            style={{ marginBottom: MAP_CARD_SPACING, height: 84 }}
          />
        );
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
      const coverUri = resolveMediaUri(event.coverImageUrl ?? null);
      const isPadel = Boolean(event.tournament) || (event.categories ?? []).includes("PADEL");
      return (
        <MapPressable
          onPress={() => handleOpenEvent(event)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir evento ${event.title}`}
          style={({ pressed }) => [
            { marginBottom: MAP_CARD_SPACING },
            pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
          ]}
        >
          <GlassCard
            intensity={isSelected ? 64 : 54}
            highlight={isSelected}
            padding={12}
            blurEnabled={!isSheetInteracting}
          >
            <View style={{ flexDirection: "row", gap: 12 }}>
              <MapEventThumb coverUri={coverUri} isPadel={isPadel} />
              <View style={{ flex: 1, gap: 8 }}>
                <Text className="text-white text-sm font-semibold" numberOfLines={2}>
                  {event.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <GlassPill
                    label={isPadel ? "TORNEIO" : "EVENTO"}
                    variant={isPadel ? "accent" : "muted"}
                  />
                  {dateLabel ? <GlassPill label={dateLabel} variant="muted" /> : null}
                </View>
                {locationLabel ? (
                  <Text className="text-white/55 text-xs" numberOfLines={1}>
                    {locationLabel}
                  </Text>
                ) : null}
                {(priceLabel || distanceLabel) ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {priceLabel ? (
                      <Text className="text-white/82 text-xs font-semibold">{priceLabel}</Text>
                    ) : null}
                    {distanceLabel ? (
                      <Text className="text-white/55 text-[11px]">· {distanceLabel}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </View>
          </GlassCard>
        </MapPressable>
      );
    },
    [distanceOrigin, handleOpenEvent, isSheetInteracting, selectedEventId],
  );

  const keyExtractor = useCallback((item: MapListItem) => {
    if (item.type === "skeleton") return item.key;
    return `event-${item.event.id}`;
  }, []);

  const handleScrollToIndexFailed = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  if (Platform.OS !== "ios") {
    return (
      <LiquidBackground>
        <TopAppHeader variant="title" title="Mapa" showNotifications={false} showMessages={false} />
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialNumToRender={MAP_LIST_INITIAL_RENDER}
          maxToRenderPerBatch={MAP_LIST_BATCH_RENDER}
          windowSize={MAP_LIST_WINDOW_SIZE}
          updateCellsBatchingPeriod={MAP_LIST_BATCHING_PERIOD_MS}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: bottomPadding }}
          ListHeaderComponent={
            <View>
              <MapPressable
                onPress={() => safeBack(router, navigation, TAB_PATHNAMES.index)}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                style={{
                  width: tokens.layout.touchTarget,
                  height: tokens.layout.touchTarget,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
              </MapPressable>
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
                <MapPressable
                  onPress={handleRecenter}
                  accessibilityRole="button"
                  accessibilityLabel="Recentrar mapa"
                  style={({ pressed }) => [styles.iconButton, pressed ? styles.controlPressed : null]}
                >
                  <Ionicons name="locate-outline" size={18} color="rgba(255,255,255,0.9)" />
                </MapPressable>
              </View>

              <MapPressable
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
              </MapPressable>

              {locationStatus !== "granted" ? (
                <MapPressable
                  onPress={handleOpenLocationModal}
                  accessibilityRole="button"
                  accessibilityLabel="Ativar localização"
                  style={({ pressed }) => [styles.locationPrompt, pressed ? styles.controlPressed : null]}
                >
                  <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.locationPromptLabel}>Ativar localização</Text>
                </MapPressable>
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
                <MapPressable
                  onPress={clearMapFilters}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Limpar filtros</Text>
                </MapPressable>
              </GlassSurface>
            ) : null
          }
          refreshing={discoverQuery.isFetching}
          onRefresh={() => discoverQuery.refetch()}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
        />
        <LocationPermissionModal
          visible={locationModalVisible}
          busy={locationModalBusy}
          errorMessage={locationError}
          canAskAgain={locationCanAskAgain}
          onAllow={handleLocationAllow}
          onSkip={handleLocationSkip}
          onOpenSettings={handleOpenSettings}
        />
      </LiquidBackground>
    );
  }

  return (
    <LiquidBackground variant="solid">
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          mapType="mutedStandard"
          style={{ flex: 1 }}
          scrollEnabled={!isMapInteractionLocked}
          zoomEnabled={!isMapInteractionLocked}
          rotateEnabled={!isMapInteractionLocked}
          pitchEnabled={!isMapInteractionLocked}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsTraffic={false}
          showsCompass={false}
          showsScale={false}
          showsUserLocation={locationStatus === "granted"}
          showsMyLocationButton={false}
          onMapReady={() => setMapReady(true)}
          onRegionChangeComplete={(region) => {
            if (shouldUpdateRegion(region)) {
              mapStopTimestampRef.current = Date.now();
              pendingStabilityMetricRef.current = true;
              setMapRegion(region);
            }
          }}
        >
          {clusteredMarkers.map((marker) => {
            if (marker.type === "cluster") {
              return (
                <Marker
                  key={marker.key}
                  coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                  onPress={() => handleClusterPress(marker)}
                >
                  <View style={styles.clusterShell}>
                    <Text style={styles.clusterCount}>{marker.count}</Text>
                  </View>
                </Marker>
              );
            }

            const event = marker.event;
            const isPadelMarker =
              Boolean(event.tournament) ||
              (event.categories ?? []).includes("PADEL");
            const active = event.id === selectedEventId;
            return (
              <Marker
                key={`marker-${event.id}`}
                coordinate={{
                  latitude: marker.lat,
                  longitude: marker.lng,
                }}
                onPress={() => handleSelectEvent(event)}
              >
                <View
                  style={[
                    styles.markerShell,
                    active ? styles.markerShellActive : null,
                  ]}
                >
                  <Ionicons
                    name={isPadelMarker ? "tennisball" : "sparkles"}
                    size={16}
                    color={active ? "#0b101a" : "rgba(245,250,255,0.9)"}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>

        <View style={{ position: "absolute", top: topPadding, left: 20, right: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MapPressable
              onPress={() => safeBack(router, navigation, TAB_PATHNAMES.index)}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.controlPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(245,250,255,0.95)" />
            </MapPressable>
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
          </View>

          {locationStatus !== "granted" ? (
            <MapPressable
              onPress={handleOpenLocationModal}
              accessibilityRole="button"
              accessibilityLabel="Ativar localização"
              style={({ pressed }) => [styles.locationPrompt, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.locationPromptLabel}>Ativar localização</Text>
            </MapPressable>
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
            sheetPositionStyle,
          ]}
        >
          <GestureDetector gesture={sheetGesture}>
            <Animated.View style={[styles.sheetBackground, sheetAnimatedStyle]}>
              <View pointerEvents="none" style={styles.sheetTopLine} />
              <View style={styles.sheetHandleContainer}>
                <View style={styles.sheetHandleIndicator} />
              </View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, blurAnimatedStyle]}>
              <BlurView
                tint="dark"
                intensity={isSheetInteracting ? 14 : 30}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
              <GestureDetector gesture={scrollGesture}>
                <Animated.FlatList
                  ref={listRef}
                  data={listData}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  style={{ flex: 1 }}
                  scrollEnabled={allowListScroll}
                  bounces={allowListScroll}
                  alwaysBounceVertical={false}
                  pointerEvents={isSheetCollapsed ? "none" : "auto"}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                  onScrollToIndexFailed={handleScrollToIndexFailed}
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: Math.max(insets.bottom + 16, 20),
                    paddingTop: 10,
                    flexGrow: 1,
                    justifyContent: isEmpty ? "center" : "flex-start",
                  }}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={MAP_LIST_INITIAL_RENDER}
                  maxToRenderPerBatch={MAP_LIST_BATCH_RENDER}
                  windowSize={MAP_LIST_WINDOW_SIZE}
                  updateCellsBatchingPeriod={MAP_LIST_BATCHING_PERIOD_MS}
                  removeClippedSubviews
                  ListHeaderComponent={sheetHeader}
                  stickyHeaderIndices={[0]}
                  ListEmptyComponent={
                    isEmpty ? (
                      <GlassSurface intensity={48} style={{ padding: 16 }}>
                        <Text className="text-white/70 text-sm">Sem eventos nesta área.</Text>
                        <MapPressable
                          onPress={clearMapFilters}
                          className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                          style={{ minHeight: tokens.layout.touchTarget }}
                        >
                          <Text className="text-white text-sm font-semibold text-center">Limpar filtros</Text>
                        </MapPressable>
                      </GlassSurface>
                    ) : null
                  }
                />
              </GestureDetector>
            </Animated.View>
          </GestureDetector>
        </Animated.View>

        <Animated.View style={[styles.fabWrapper, fabAnimatedStyle]}>
          <MapPressable
            onPress={handleRecenter}
            accessibilityRole="button"
            accessibilityLabel="Recentrar mapa"
            style={({ pressed }) => [styles.fabButton, pressed ? styles.controlPressed : null]}
          >
            <GlassSurface
              intensity={52}
              padding={0}
              style={styles.fabSurface}
              contentStyle={styles.fabContent}
            >
              <Ionicons name="locate" size={19} color="rgba(245,250,255,0.95)" style={styles.fabIcon} />
            </GlassSurface>
          </MapPressable>
        </Animated.View>
        <LocationPermissionModal
          visible={locationModalVisible}
          busy={locationModalBusy}
          errorMessage={locationError}
          canAskAgain={locationCanAskAgain}
          onAllow={handleLocationAllow}
          onSkip={handleLocationSkip}
          onOpenSettings={handleOpenSettings}
        />
      </View>
    </LiquidBackground>
  );
}

const styles = {
  backButton: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.3)",
    backgroundColor: "rgba(9,14,24,0.82)",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  iconButton: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.28)",
    backgroundColor: "rgba(9,14,24,0.78)",
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
    paddingVertical: 10,
    minHeight: tokens.layout.touchTarget,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.24)",
    backgroundColor: "rgba(9,14,24,0.82)",
  },
  locationPromptLabel: {
    color: "rgba(236,246,255,0.9)",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  sheetBackground: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(198,230,255,0.18)",
    backgroundColor: "rgba(8,13,23,0.95)",
    overflow: "hidden" as const,
    flex: 1,
  },
  sheetTopLine: {
    position: "absolute" as const,
    left: 16,
    right: 16,
    top: 0,
    height: 1,
    borderRadius: 999,
    backgroundColor: "rgba(222,242,255,0.32)",
    zIndex: 2,
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
    borderColor: "rgba(214,238,255,0.56)",
    backgroundColor: "rgba(12,18,30,0.88)",
    shadowColor: "#0b101a",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  markerShellActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(188,229,255,0.98)",
    shadowOpacity: 0.45,
  },
  clusterShell: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(188,229,255,0.96)",
    backgroundColor: "rgba(22,42,64,0.92)",
    shadowColor: "#0b101a",
    shadowOpacity: 0.38,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  clusterCount: {
    color: "#eef8ff",
    fontSize: 12,
    fontWeight: "700" as const,
  },
  sheetHandleContainer: {
    height: SHEET_HANDLE_HEIGHT,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 0,
    alignItems: "center" as const,
    justifyContent: "flex-start" as const,
  },
  sheetHandleIndicator: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(224,242,255,0.46)",
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.16)",
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
  sheetHeaderSticky: {
    backgroundColor: "rgba(8,13,23,0.97)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(206,233,255,0.12)",
    paddingTop: 4,
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
    color: "rgba(231,244,255,0.68)",
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: tokens.layout.touchTarget,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  resetLabel: {
    color: "rgba(236,246,255,0.9)",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  fabWrapper: {
    position: "absolute" as const,
    right: 20,
    bottom: 0,
    zIndex: 12,
  },
  fabButton: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: 999,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  fabSurface: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
  },
  fabContent: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 22,
  },
  fabIcon: {
    marginLeft: 0.5,
    marginTop: 0.5,
  },
  eventThumb: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden" as const,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  eventThumbFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  eventThumbFallback: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  eventThumbTag: {
    position: "absolute" as const,
    top: 6,
    left: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.34)",
    backgroundColor: "rgba(9,14,24,0.72)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  eventThumbTagText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 9,
    fontWeight: "700" as const,
  },
};
