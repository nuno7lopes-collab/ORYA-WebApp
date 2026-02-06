import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "../icons/Ionicons";
import { useFavoritesStore } from "../../features/favorites/store";
import { toggleFavoriteRemote } from "../../features/favorites/api";

type FavoriteToggleProps = {
  eventId: number;
  size?: number;
  variant?: "icon" | "button";
  label?: string;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FavoriteToggle({
  eventId,
  size = 20,
  variant = "icon",
  label = "Favoritar",
  onToggle,
  disabled,
  style,
}: FavoriteToggleProps) {
  const isFavorite = useFavoritesStore((state) => state.isFavorite(eventId));
  const toggle = useFavoritesStore((state) => state.toggleFavorite);
  const setFavorite = useFavoritesStore((state) => state.setFavorite);

  const handlePress = async () => {
    if (disabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore haptics errors
    }
    const next = toggle(eventId, true);
    onToggle?.(next);
    try {
      const result = await toggleFavoriteRemote(eventId, true);
      if (result?.isFavorite) {
        setFavorite(eventId, true, result.favorite?.notify ?? true);
      } else {
        setFavorite(eventId, false, true);
      }
    } catch {
      setFavorite(eventId, !next, true);
    }
  };

  if (variant === "button") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.button,
          style,
          isFavorite ? styles.buttonActive : null,
          pressed && !disabled ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <View style={styles.buttonContent}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={size}
            color={isFavorite ? "#0b0f17" : "#0b0f17"}
          />
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        style,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Ionicons
        name={isFavorite ? "heart" : "heart-outline"}
        size={size}
        color={isFavorite ? "#ff6b6b" : "rgba(255,255,255,0.85)"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 14, 24, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.28)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  buttonActive: {
    backgroundColor: "#e2efff",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#0b0f17",
    fontWeight: "700",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
