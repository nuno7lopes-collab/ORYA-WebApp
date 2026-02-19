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

export function EventLocationBlock({
  startsAtLabel,
  locationLabel,
  latitude,
  longitude,
  onOpenMap,
  openMapLabel = "Abrir no mapa",
}: EventLocationBlockProps) {
  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const region = hasCoordinates
    ? buildPreviewRegion(latitude as number, longitude as number)
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

      <Pressable
        onPress={onOpenMap}
        accessibilityRole="button"
        accessibilityLabel={openMapLabel}
        style={({ pressed }) => [
          styles.previewShell,
          pressed ? styles.pressed : null,
        ]}
      >
        {region ? (
          <MapView
            provider={PROVIDER_DEFAULT}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            initialRegion={region}
            region={region}
            mapType="mutedStandard"
            showsPointsOfInterest={false}
            showsBuildings={false}
            showsTraffic={false}
            showsCompass={false}
            showsScale={false}
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
        ) : (
          <View style={styles.previewFallback}>
            <Ionicons
              name="map-outline"
              size={26}
              color="rgba(228,244,255,0.84)"
            />
            <Text style={styles.previewFallbackText} numberOfLines={2}>
              Preview de mapa indisponivel para este evento.
            </Text>
          </View>
        )}
        <View style={styles.previewOverlay}>
          <Ionicons
            name="open-outline"
            size={19}
            color="rgba(246,252,255,0.96)"
          />
        </View>
      </Pressable>

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
  previewFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  previewFallbackText: {
    textAlign: "center",
    color: "rgba(226,240,255,0.72)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  previewOverlay: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(10,15,24,0.68)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.88,
  },
});
