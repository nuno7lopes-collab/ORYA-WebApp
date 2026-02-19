import { Image } from "expo-image";
import { Ionicons } from "../../icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

type EventHeroSquareProps = {
  coverUri: string | null;
  title: string | null;
};

export function EventHeroSquare({ coverUri, title }: EventHeroSquareProps) {
  return (
    <View style={styles.shell}>
      {coverUri ? (
        <Image
          source={{ uri: coverUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.58)" />
          <Text style={styles.fallbackText} numberOfLines={2}>
            {title ?? "Evento"}
          </Text>
        </View>
      )}
      <View pointerEvents="none" style={styles.innerFrame} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    backgroundColor: "rgba(10,16,26,0.72)",
  },
  fallbackText: {
    color: "rgba(236,247,255,0.78)",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
  },
  innerFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
});

