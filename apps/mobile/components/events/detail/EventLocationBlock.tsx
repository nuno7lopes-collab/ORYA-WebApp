import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { Ionicons } from "../../icons/Ionicons";

type EventLocationBlockProps = {
  startsAtLabel: string | null;
  locationLabel: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onOpenMap: () => void;
  openMapLabel?: string;
};

const buildPreviewRegion = (
  latitude: number,
  longitude: number,
): Region => ({
  latitude,
  longitude,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});

const isFiniteCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export function EventLocationBlock({
  startsAtLabel,
  locationLabel,
  latitude,
  longitude,
  onOpenMap,
  openMapLabel = "Abrir no mapa",
}: EventLocationBlockProps) {
  const parsedLatitude =
    typeof latitude === "number" ? latitude : Number(latitude ?? Number.NaN);
  const parsedLongitude =
    typeof longitude === "number"
      ? longitude
      : Number(longitude ?? Number.NaN);
  const hasCoordinates = isFiniteCoordinate(parsedLatitude, parsedLongitude);
  const region = hasCoordinates
    ? buildPreviewRegion(parsedLatitude, parsedLongitude)
    : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Local</Text>
      {startsAtLabel ? (
        <View style={styles.row}>
          <Ionicons
            name="time-outline"
            size={16}
            color="rgba(234,246,255,0.78)"
          />
          <Text style={styles.rowText}>{startsAtLabel}</Text>
        </View>
      ) : null}
      {locationLabel ? (
        <Pressable
          onPress={onOpenMap}
          accessibilityRole="button"
          accessibilityLabel={openMapLabel}
          style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color="rgba(234,246,255,0.72)"
          />
          <Text style={styles.rowText} numberOfLines={3}>
            {locationLabel}
          </Text>
        </Pressable>
      ) : null}

      {region ? (
        <Pressable
          onPress={onOpenMap}
          accessibilityRole="button"
          accessibilityLabel={openMapLabel}
          style={({ pressed }) => [
            styles.previewShell,
            pressed ? styles.pressed : null,
          ]}
        >
          <MapView
            key={`event-map-${region.latitude}-${region.longitude}`}
            provider={PROVIDER_DEFAULT}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            initialRegion={region}
            mapType="standard"
            showsPointsOfInterest={false}
            showsBuildings={false}
            showsTraffic={false}
            showsCompass={false}
            showsScale={false}
            showsIndoors={false}
            showsMyLocationButton={false}
            loadingEnabled
            toolbarEnabled={false}
            rotateEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: region.latitude,
                longitude: region.longitude,
              }}
            />
          </MapView>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 13,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingBottom: 16,
  },
  title: {
    color: "#F4F9FF",
    fontSize: 16,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowText: {
    flex: 1,
    color: "rgba(236,246,255,0.86)",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
  },
  previewShell: {
    marginTop: 4,
    height: 208,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(14,22,33,0.92)",
  },
  pressed: {
    opacity: 0.88,
  },
});
