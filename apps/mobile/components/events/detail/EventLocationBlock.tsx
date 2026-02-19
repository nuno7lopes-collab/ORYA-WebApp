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
        <View style={styles.row}>
          <Ionicons
            name="location-outline"
            size={16}
            color="rgba(234,246,255,0.72)"
          />
          <Text style={styles.rowText} numberOfLines={3}>
            {locationLabel}
          </Text>
        </View>
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
              size={22}
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
            size={18}
            color="rgba(246,252,255,0.96)"
          />
        </View>
      </Pressable>

      <Pressable
        onPress={onOpenMap}
        accessibilityRole="button"
        accessibilityLabel={openMapLabel}
        style={({ pressed }) => [styles.openRow, pressed ? styles.pressed : null]}
      >
        <View style={styles.openIconShell}>
          <Ionicons name="navigate-outline" size={16} color="#E7F6FF" />
        </View>
        <View style={styles.openTextWrap}>
          <Text style={styles.openTitle}>{openMapLabel}</Text>
          <Text style={styles.openSubtitle}>Apple Maps / Google Maps</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color="rgba(233,246,255,0.74)"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingBottom: 14,
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
    height: 194,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(14,22,33,0.85)",
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  previewOverlay: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(10,15,24,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  openRow: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  openIconShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(201,236,255,0.36)",
    backgroundColor: "rgba(178,226,255,0.24)",
  },
  openTextWrap: {
    flex: 1,
  },
  openTitle: {
    color: "#F3F9FF",
    fontSize: 14,
    fontWeight: "700",
  },
  openSubtitle: {
    color: "rgba(232,245,255,0.66)",
    fontSize: 12,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.88,
  },
});
