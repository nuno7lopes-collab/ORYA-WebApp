import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@orya/shared";

type StickyPurchaseBarProps = {
  priceLabel: string;
  buttonLabel: string;
  disabled?: boolean;
  loading?: boolean;
  helperText?: string | null;
  onPress: () => void;
};

export function StickyPurchaseBar({
  priceLabel,
  buttonLabel,
  disabled = false,
  loading = false,
  helperText = null,
  onPress,
}: StickyPurchaseBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <LinearGradient
        colors={["rgba(10,15,20,0)", "rgba(10,15,20,0.74)", "rgba(10,15,20,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.contentWrap}>
        <View style={styles.content}>
          <Text style={styles.price} numberOfLines={1}>
            {priceLabel}
          </Text>
          <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            accessibilityState={{ disabled: disabled || loading }}
            style={({ pressed }) => [
              styles.button,
              disabled ? styles.buttonDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color="#0A1018" />
                <Text style={styles.buttonText}>A processar…</Text>
              </View>
            ) : (
              <Text style={styles.buttonText} numberOfLines={1}>
                {buttonLabel}
              </Text>
            )}
          </Pressable>
        </View>
        {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 22,
  },
  contentWrap: {
    paddingHorizontal: 20,
    gap: 8,
  },
  content: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 22,
    backgroundColor: "rgba(10, 15, 25, 0.82)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: "rgba(0,0,0,0.6)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 5,
  },
  price: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: "#F6FAFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  button: {
    minHeight: tokens.layout.touchTarget,
    minWidth: 152,
    maxWidth: "64%",
    flexShrink: 1,
    borderRadius: 16,
    backgroundColor: "#EAF63A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: "#0A1018",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  helper: {
    color: "rgba(224,240,255,0.62)",
    fontSize: 12,
    textAlign: "center",
  },
});
