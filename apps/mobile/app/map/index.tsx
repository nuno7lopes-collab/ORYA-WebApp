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
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
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
import { useFocusFrameMonitor } from "../../components/perf/useFocusFrameMonitor";
import { LocationPermissionModal } from "../../components/location/LocationPermissionModal";
import { useReservableClubs } from "../../features/bookings/hooks";
import type { BookingClubCard } from "../../features/bookings/types";
import { useAuth } from "../../lib/auth";
import { getDistanceKm, formatDistanceKm } from "../../lib/geo";
import { getLocationPermissionState, requestLocationConsent } from "../../lib/locationConsent";
import { buildMapTargets } from "../../lib/mapLinks";
import { resolveMediaUri } from "../../lib/media";
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { resolveSafeHttpUrl } from "../../lib/externalUrl";

const DEFAULT_REGION: Region = {
  latitude: 38.7223,
  longitude: -9.1393,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

const MapPressable = (props: ComponentProps<typeof Pressable>) => (
  <Pressable unstable_pressDelay={0} {...props} />
);

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatMoney = (amountCents?: number | null, currency = "EUR") => {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) return null;
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(amountCents / 100);
};

const formatCourts = (count: number) =>
  `${count} ${count === 1 ? "campo" : "campos"}`;

type ClubListItem =
  | { type: "skeleton"; key: string }
  | { type: "club"; club: BookingClubCard };

type ClubAvatarPinProps = {
  avatarUri: string | null;
  active: boolean;
  source: "FOLLOWING" | "NEARBY";
};

function ClubAvatarPin({ avatarUri, active, source }: ClubAvatarPinProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const hasAvatar = Boolean(avatarUri) && !avatarFailed;

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);

  return (
    <View style={styles.pinWrapper}>
      <View
        style={[
          styles.pinCircle,
          source === "FOLLOWING" ? styles.pinCircleFollowing : null,
          active ? styles.pinCircleActive : null,
        ]}
      >
        {hasAvatar ? (
          <Image
            source={{ uri: avatarUri as string }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <View style={styles.pinFallback}>
            <Ionicons name="business-outline" size={16} color="rgba(235,246,255,0.88)" />
          </View>
        )}
        <View pointerEvents="none" style={styles.pinFrame} />
      </View>
      <View
        style={[
          styles.pinPointer,
          source === "FOLLOWING" ? styles.pinPointerFollowing : null,
          active ? styles.pinPointerActive : null,
        ]}
      />
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const headerPadding = useTopHeaderPadding(16);
  const topPadding = Platform.OS === "ios" ? insets.top + 10 : headerPadding;
  const bottomPadding = Math.max(insets.bottom + 20, 20);
  const { height } = useWindowDimensions();
  useFocusFrameMonitor("screen_map_clubs");

  const { session } = useAuth();
  const accessReady = Boolean(session?.user?.id);

  const clubsQuery = useReservableClubs(
    {
      userId: session?.user?.id ?? null,
      accessToken: session?.access_token ?? null,
    },
    isFocused || accessReady,
  );

  const clubs = clubsQuery.data?.items ?? [];

  const [selectedClubUsername, setSelectedClubUsername] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalBusy, setLocationModalBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const mapRef = useRef<MapView | null>(null);
  const centerModeRef = useRef<"none" | "device" | "club">("none");

  const firstClubCoords = useMemo(() => {
    const withCoords = clubs.find(
      (club) => isFiniteCoordinate(club.latitude) && isFiniteCoordinate(club.longitude),
    );
    if (!withCoords) return null;
    return { lat: withCoords.latitude as number, lng: withCoords.longitude as number };
  }, [clubs]);

  const initialRegion = useMemo(() => {
    if (deviceCoords) {
      return {
        latitude: deviceCoords.lat,
        longitude: deviceCoords.lng,
        latitudeDelta: 0.14,
        longitudeDelta: 0.14,
      };
    }
    if (firstClubCoords) {
      return {
        latitude: firstClubCoords.lat,
        longitude: firstClubCoords.lng,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      };
    }
    return DEFAULT_REGION;
  }, [deviceCoords, firstClubCoords]);

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
      requestDeviceLocation();
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

  useEffect(() => {
    if (!clubs.length) {
      setSelectedClubUsername(null);
      return;
    }
    if (!clubs.some((club) => club.orgUsername === selectedClubUsername)) {
      setSelectedClubUsername(clubs[0].orgUsername);
    }
  }, [clubs, selectedClubUsername]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.orgUsername === selectedClubUsername) ?? null,
    [clubs, selectedClubUsername],
  );

  const sortByProximity = useCallback(
    (left: BookingClubCard, right: BookingClubCard) => {
      if (left.source !== right.source) return left.source === "FOLLOWING" ? -1 : 1;

      const originLat = deviceCoords?.lat ?? mapRegion?.latitude;
      const originLng = deviceCoords?.lng ?? mapRegion?.longitude;
      if (isFiniteCoordinate(originLat) && isFiniteCoordinate(originLng)) {
        const leftDistance = getDistanceKm(left.latitude, left.longitude, originLat, originLng);
        const rightDistance = getDistanceKm(right.latitude, right.longitude, originLat, originLng);
        if (leftDistance != null && rightDistance != null) {
          if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        } else if (leftDistance != null) {
          return -1;
        } else if (rightDistance != null) {
          return 1;
        }
      }

      return left.clubName.localeCompare(right.clubName, "pt-PT");
    },
    [deviceCoords?.lat, deviceCoords?.lng, mapRegion?.latitude, mapRegion?.longitude],
  );

  const sortedClubs = useMemo(() => [...clubs].sort(sortByProximity), [clubs, sortByProximity]);

  const clubMarkers = useMemo(
    () =>
      sortedClubs.filter(
        (club) => isFiniteCoordinate(club.latitude) && isFiniteCoordinate(club.longitude),
      ),
    [sortedClubs],
  );

  const listData: ClubListItem[] = useMemo(() => {
    if (clubsQuery.isLoading && !clubsQuery.data) {
      return Array.from({ length: 4 }, (_, index) => ({
        type: "skeleton" as const,
        key: `club-skeleton-${index}`,
      }));
    }
    return sortedClubs.map((club) => ({ type: "club" as const, club }));
  }, [clubsQuery.data, clubsQuery.isLoading, sortedClubs]);

  const animateToRegion = useCallback((lat: number, lng: number, delta = 0.08) => {
    const nextRegion: Region = {
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
      animateToRegion(deviceCoords.lat, deviceCoords.lng, 0.09);
      centerModeRef.current = "device";
      return;
    }

    if (!deviceCoords && firstClubCoords && centerModeRef.current === "none") {
      animateToRegion(firstClubCoords.lat, firstClubCoords.lng, 0.16);
      centerModeRef.current = "club";
    }
  }, [animateToRegion, deviceCoords, firstClubCoords, mapReady]);

  useEffect(() => {
    if (!mapReady || mapRegion) return;
    setMapRegion(initialRegion);
  }, [initialRegion, mapReady, mapRegion]);

  const handleSelectClub = useCallback(
    (club: BookingClubCard) => {
      setSelectedClubUsername(club.orgUsername);
      if (isFiniteCoordinate(club.latitude) && isFiniteCoordinate(club.longitude)) {
        animateToRegion(club.latitude, club.longitude, 0.06);
      }
    },
    [animateToRegion],
  );

  const handleOpenClub = useCallback(
    (club: BookingClubCard) => {
      if (!club.orgUsername?.trim()) return;
      safePush(router, {
        pathname: "/reservas/club/[username]",
        params: { username: club.orgUsername.trim() },
      });
    },
    [router],
  );

  const openExternalMapForClub = useCallback(
    (club?: BookingClubCard | null) => {
      const targetClub = club ?? selectedClub;
      const label = targetClub?.clubName?.trim() || "Clubes ORYA";
      const query = targetClub?.address?.trim() || targetClub?.city?.trim() || label;
      const lat =
        targetClub && isFiniteCoordinate(targetClub.latitude)
          ? targetClub.latitude
          : mapRegion?.latitude ?? null;
      const lng =
        targetClub && isFiniteCoordinate(targetClub.longitude)
          ? targetClub.longitude
          : mapRegion?.longitude ?? null;

      const targets = buildMapTargets({
        label,
        query,
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
    },
    [mapRegion?.latitude, mapRegion?.longitude, selectedClub],
  );

  const handleRecenter = useCallback(() => {
    if (deviceCoords) {
      animateToRegion(deviceCoords.lat, deviceCoords.lng, 0.09);
      return;
    }

    if (selectedClub && isFiniteCoordinate(selectedClub.latitude) && isFiniteCoordinate(selectedClub.longitude)) {
      animateToRegion(selectedClub.latitude, selectedClub.longitude, 0.08);
      return;
    }

    if (firstClubCoords) {
      animateToRegion(firstClubCoords.lat, firstClubCoords.lng, 0.16);
      return;
    }

    animateToRegion(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude, DEFAULT_REGION.latitudeDelta);
  }, [animateToRegion, deviceCoords, firstClubCoords, selectedClub]);

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
      // ignorar erros de rede ao fechar o modal
    } finally {
      setLocationModalBusy(false);
      setLocationModalVisible(false);
    }
  }, [locationModalBusy]);

  const renderClubRow = useCallback(
    ({ item }: { item: ClubListItem }) => {
      if (item.type === "skeleton") {
        return <GlassSurface intensity={52} style={{ marginBottom: 12, height: 88 }} />;
      }

      const club = item.club;
      const selected = club.orgUsername === selectedClubUsername;
      const coverUri = resolveMediaUri(club.coverImageUrl ?? club.avatarUrl ?? null);
      const distance = formatDistanceKm(
        club.latitude,
        club.longitude,
        deviceCoords?.lat ?? mapRegion?.latitude,
        deviceCoords?.lng ?? mapRegion?.longitude,
      );
      const price = formatMoney(club.minPriceCents, club.currency ?? "EUR");

      return (
        <MapPressable
          onPress={() => handleOpenClub(club)}
          onLongPress={() => handleSelectClub(club)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir clube ${club.clubName}`}
          style={({ pressed }) => [
            styles.clubCard,
            selected ? styles.clubCardSelected : null,
            pressed ? styles.controlPressed : null,
          ]}
        >
          <View style={styles.clubCoverWrap}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : (
              <View style={styles.clubCoverFallback}>
                <Ionicons name="business-outline" size={18} color="rgba(236,246,255,0.74)" />
              </View>
            )}
            <View pointerEvents="none" style={styles.clubCoverFrame} />
          </View>

          <View style={styles.clubCardBody}>
            <View style={styles.clubRowTop}>
              <Text style={styles.clubTitle} numberOfLines={1}>
                {club.clubName}
              </Text>
              <View
                style={[
                  styles.sourcePill,
                  club.source === "FOLLOWING" ? styles.sourcePillFollowing : styles.sourcePillNearby,
                ]}
              >
                <Text style={styles.sourcePillText}>
                  {club.source === "FOLLOWING" ? "Seguido" : "Perto"}
                </Text>
              </View>
            </View>

            {club.address || club.city ? (
              <Text style={styles.clubAddress} numberOfLines={1}>
                {club.address || club.city}
              </Text>
            ) : null}

            <View style={styles.clubRowMeta}>
              <Text style={styles.clubMetaText}>{formatCourts(Math.max(1, club.courtsCount))}</Text>
              {price ? <Text style={styles.clubMetaText}>· Desde {price}</Text> : null}
              {distance ? <Text style={styles.clubMetaMuted}>· {distance}</Text> : null}
            </View>
          </View>

          <View style={styles.cardChevronWrap}>
            <Ionicons name="chevron-forward" size={18} color="rgba(234,246,255,0.52)" />
          </View>
        </MapPressable>
      );
    },
    [
      deviceCoords?.lat,
      deviceCoords?.lng,
      handleOpenClub,
      handleSelectClub,
      mapRegion?.latitude,
      mapRegion?.longitude,
      selectedClubUsername,
    ],
  );

  const keyExtractor = useCallback((item: ClubListItem) => {
    if (item.type === "skeleton") return item.key;
    return `club-${item.club.orgUsername}`;
  }, []);

  const listEmpty = !clubsQuery.isLoading && !clubsQuery.isError && sortedClubs.length === 0;
  const mapTitle = "Clubes perto";
  const sheetHeight = Math.min(Math.max(height * 0.36, 250), 360);

  if (Platform.OS !== "ios") {
    return (
      <LiquidBackground>
        <TopAppHeader variant="title" title="Mapa" showNotifications={false} showMessages={false} />
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderClubRow}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
          refreshing={clubsQuery.isFetching}
          onRefresh={() => clubsQuery.refetch()}
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <MapPressable
                onPress={() => safeBack(router, navigation, TAB_PATHNAMES.inicio)}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                style={styles.androidBack}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(245,250,255,0.95)" />
              </MapPressable>

              <GlassCard intensity={56} style={{ marginTop: 10 }}>
                <View style={{ gap: 10 }}>
                  <View style={styles.androidHeaderRow}>
                    <Text style={styles.androidTitle}>{mapTitle}</Text>
                    <View style={styles.brandBadge}>
                      <Text style={styles.brandBadgeText}>ORYA</Text>
                    </View>
                  </View>
                  <Text style={styles.androidSubtitle}>
                    Lista de clubes perto de ti. No Android podes abrir o mapa externo para navegação.
                  </Text>

                  <View style={styles.androidActionsRow}>
                    <MapPressable
                      onPress={() => openExternalMapForClub(selectedClub)}
                      style={({ pressed }) => [styles.inlineAction, pressed ? styles.controlPressed : null]}
                      accessibilityRole="button"
                      accessibilityLabel="Abrir mapa externo"
                    >
                      <Ionicons name="map-outline" size={16} color="rgba(236,246,255,0.92)" />
                      <Text style={styles.inlineActionLabel}>Abrir mapa</Text>
                    </MapPressable>

                    <MapPressable
                      onPress={handleRecenter}
                      style={({ pressed }) => [styles.inlineAction, pressed ? styles.controlPressed : null]}
                      accessibilityRole="button"
                      accessibilityLabel="Recentrar"
                    >
                      <Ionicons name="locate-outline" size={16} color="rgba(236,246,255,0.92)" />
                      <Text style={styles.inlineActionLabel}>Recentrar</Text>
                    </MapPressable>
                  </View>

                  {locationStatus !== "granted" ? (
                    <MapPressable
                      onPress={handleOpenLocationModal}
                      accessibilityRole="button"
                      accessibilityLabel="Ativar localização"
                      style={({ pressed }) => [styles.locationPrompt, pressed ? styles.controlPressed : null]}
                    >
                      <Ionicons name="location-outline" size={16} color="rgba(236,246,255,0.92)" />
                      <Text style={styles.locationPromptLabel}>Ativar localização</Text>
                    </MapPressable>
                  ) : null}
                </View>
              </GlassCard>
            </View>
          }
          ListEmptyComponent={
            listEmpty ? (
              <GlassSurface intensity={48} style={{ padding: 16, marginTop: 6 }}>
                <Text style={styles.emptyTitle}>Ainda não encontrámos clubes nesta área.</Text>
                <Text style={styles.emptySubtitle}>Tenta novamente daqui a pouco ou ativa localização.</Text>
              </GlassSurface>
            ) : null
          }
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
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsTraffic={false}
          showsCompass={false}
          showsScale={false}
          showsUserLocation={locationStatus === "granted"}
          showsMyLocationButton={false}
          onMapReady={() => setMapReady(true)}
          onRegionChangeComplete={(region) => setMapRegion(region)}
        >
          {clubMarkers.map((club) => {
            const active = club.orgUsername === selectedClubUsername;
            const avatarUri = resolveMediaUri(club.avatarUrl ?? null);
            return (
              <Marker
                key={`club-marker-${club.orgUsername}`}
                coordinate={{
                  latitude: club.latitude as number,
                  longitude: club.longitude as number,
                }}
                onPress={() => handleSelectClub(club)}
                anchor={{ x: 0.5, y: 1 }}
              >
                <ClubAvatarPin avatarUri={avatarUri} active={active} source={club.source} />
              </Marker>
            );
          })}
        </MapView>

        <View style={[styles.topOverlay, { top: topPadding }]}>
          <View style={styles.topOverlayRow}>
            <MapPressable
              onPress={() => safeBack(router, navigation, TAB_PATHNAMES.inicio)}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={({ pressed }) => [styles.topIconButton, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(245,250,255,0.96)" />
            </MapPressable>

            <GlassCard intensity={50} style={styles.titleCard}>
              <View style={styles.titleCardRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.titleText} numberOfLines={1}>
                    {mapTitle}
                  </Text>
                  <Text style={styles.titleSubtext} numberOfLines={1}>
                    {sortedClubs.length} clubes disponíveis para reservar
                  </Text>
                </View>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandBadgeText}>ORYA</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          <View style={styles.topOverlayActions}>
            <MapPressable
              onPress={() => openExternalMapForClub(selectedClub)}
              accessibilityRole="button"
              accessibilityLabel="Abrir mapa externo"
              style={({ pressed }) => [styles.roundAction, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="map-outline" size={18} color="rgba(236,246,255,0.94)" />
            </MapPressable>

            <MapPressable
              onPress={handleRecenter}
              accessibilityRole="button"
              accessibilityLabel="Recentrar mapa"
              style={({ pressed }) => [styles.roundAction, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="locate-outline" size={18} color="rgba(236,246,255,0.94)" />
            </MapPressable>
          </View>

          {locationStatus !== "granted" ? (
            <MapPressable
              onPress={handleOpenLocationModal}
              accessibilityRole="button"
              accessibilityLabel="Ativar localização"
              style={({ pressed }) => [styles.locationPrompt, pressed ? styles.controlPressed : null]}
            >
              <Ionicons name="location-outline" size={16} color="rgba(236,246,255,0.92)" />
              <Text style={styles.locationPromptLabel}>Ativar localização</Text>
            </MapPressable>
          ) : null}

          {locationError ? (
            <GlassCard intensity={48} style={{ marginTop: 10 }}>
              <Text style={styles.errorText}>{locationError}</Text>
            </GlassCard>
          ) : null}
        </View>

        <View style={[styles.sheet, { height: sheetHeight + insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Clubes no mapa</Text>
            {clubsQuery.isFetching ? <ActivityIndicator size="small" color="rgba(235,246,255,0.7)" /> : null}
          </View>

          {clubsQuery.isError ? (
            <GlassCard intensity={50} style={{ marginHorizontal: 16, marginBottom: 10 }}>
              <Text style={styles.errorText}>Não foi possível carregar os clubes.</Text>
              <MapPressable
                onPress={() => clubsQuery.refetch()}
                style={({ pressed }) => [styles.retryButton, pressed ? styles.controlPressed : null]}
                accessibilityRole="button"
                accessibilityLabel="Tentar novamente"
              >
                <Text style={styles.retryLabel}>Tentar novamente</Text>
              </MapPressable>
            </GlassCard>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderClubRow}
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingBottom: Math.max(insets.bottom + 10, 14),
                paddingTop: 4,
              }}
              ListEmptyComponent={
                listEmpty ? (
                  <GlassSurface intensity={48} style={{ padding: 16, marginTop: 8 }}>
                    <Text style={styles.emptyTitle}>Ainda não encontrámos clubes nesta área.</Text>
                    <Text style={styles.emptySubtitle}>Ajusta a localização e tenta novamente.</Text>
                  </GlassSurface>
                ) : null
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

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

const styles = StyleSheet.create({
  controlPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  topOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 10,
    zIndex: 14,
  },
  topOverlayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topOverlayActions: {
    flexDirection: "row",
    alignSelf: "flex-end",
    gap: 8,
  },
  topIconButton: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(202,232,255,0.32)",
    backgroundColor: "rgba(9,14,24,0.84)",
  },
  roundAction: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(202,232,255,0.24)",
    backgroundColor: "rgba(9,14,24,0.82)",
  },
  titleCard: {
    flex: 1,
    minHeight: tokens.layout.touchTarget,
    justifyContent: "center",
  },
  titleCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  titleSubtext: {
    color: "rgba(230,244,255,0.72)",
    fontSize: 11,
    marginTop: 2,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(196,228,255,0.32)",
    backgroundColor: "rgba(124,214,255,0.14)",
  },
  brandBadgeText: {
    color: "rgba(245,251,255,0.9)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  locationPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: tokens.layout.touchTarget,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(202,232,255,0.26)",
    backgroundColor: "rgba(8,14,23,0.85)",
  },
  locationPromptLabel: {
    color: "rgba(236,246,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(198,230,255,0.22)",
    backgroundColor: "rgba(8,13,23,0.95)",
    overflow: "hidden",
    shadowColor: "#02050a",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 18,
  },
  sheetHandle: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(224,242,255,0.5)",
    alignSelf: "center",
    marginTop: 9,
    marginBottom: 8,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  clubCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200,228,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
    minHeight: 82,
  },
  clubCardSelected: {
    borderColor: "rgba(164,228,255,0.58)",
    backgroundColor: "rgba(121,210,255,0.16)",
  },
  clubCoverWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  clubCoverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clubCoverFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
  },
  clubCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  clubRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clubTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  sourcePill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  sourcePillFollowing: {
    borderColor: "rgba(151,231,255,0.5)",
    backgroundColor: "rgba(113,214,255,0.2)",
  },
  sourcePillNearby: {
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  sourcePillText: {
    color: "rgba(246,251,255,0.9)",
    fontSize: 10,
    fontWeight: "700",
  },
  clubAddress: {
    color: "rgba(231,244,255,0.66)",
    fontSize: 12,
  },
  clubRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
  },
  clubMetaText: {
    color: "rgba(233,246,255,0.82)",
    fontSize: 11,
    fontWeight: "600",
  },
  clubMetaMuted: {
    color: "rgba(233,246,255,0.56)",
    fontSize: 11,
  },
  cardChevronWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pinWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(10,17,28,0.92)",
    borderWidth: 2,
    borderColor: "rgba(224,242,255,0.82)",
    shadowColor: "#07111d",
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
  },
  pinCircleFollowing: {
    borderColor: "rgba(140,227,255,0.95)",
  },
  pinCircleActive: {
    transform: [{ scale: 1.08 }],
    borderColor: "#ffffff",
    shadowOpacity: 0.55,
  },
  pinFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pinFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  pinPointer: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(224,242,255,0.88)",
  },
  pinPointerFollowing: {
    borderTopColor: "rgba(140,227,255,0.98)",
  },
  pinPointerActive: {
    borderTopColor: "#ffffff",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "rgba(230,244,255,0.68)",
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: "rgba(255,194,194,0.96)",
    fontSize: 13,
  },
  retryButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(204,229,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.08)",
    minHeight: tokens.layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  retryLabel: {
    color: "rgba(237,247,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
  },
  androidBack: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  androidHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  androidTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  androidSubtitle: {
    color: "rgba(230,244,255,0.72)",
    fontSize: 12,
  },
  androidActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: tokens.layout.touchTarget,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(202,232,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  inlineActionLabel: {
    color: "rgba(237,247,255,0.92)",
    fontSize: 12,
    fontWeight: "600",
  },
});
