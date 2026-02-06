import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { tokens } from "@orya/shared";

type SettingsButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type SettingsButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  variant?: SettingsButtonVariant;
  style?: ViewStyle;
};

const variants: Record<SettingsButtonVariant, { background: string; border: string; text: string }> = {
  primary: {
    background: "rgba(245, 249, 255, 0.92)",
    border: "rgba(255,255,255,0.5)",
    text: "#0b0f16",
  },
  secondary: {
    background: "rgba(255,255,255,0.14)",
    border: "rgba(255,255,255,0.3)",
    text: "rgba(255,255,255,0.95)",
  },
  ghost: {
    background: "transparent",
    border: "rgba(255,255,255,0.18)",
    text: "rgba(255,255,255,0.92)",
  },
  danger: {
    background: "rgba(255, 74, 112, 0.28)",
    border: "rgba(255, 74, 112, 0.65)",
    text: "#FFF0F4",
  },
};

export function SettingsButton({
  label,
  onPress,
  disabled,
  loading,
  loadingLabel,
  variant = "primary",
  style,
}: SettingsButtonProps) {
  const palette = variants[variant];
  const isDisabled = Boolean(disabled || loading);
  const resolvedPalette = (() => {
    if (!isDisabled) return palette;
    switch (variant) {
      case "primary":
        return {
          background: "rgba(245, 249, 255, 0.6)",
          border: "rgba(255,255,255,0.35)",
          text: "rgba(10,15,22,0.7)",
        };
      case "secondary":
        return {
          background: "rgba(255,255,255,0.05)",
          border: "rgba(255,255,255,0.15)",
          text: "rgba(255,255,255,0.65)",
        };
      case "danger":
        return {
          background: "rgba(255, 74, 112, 0.14)",
          border: "rgba(255, 74, 112, 0.35)",
          text: "rgba(255, 227, 234, 0.75)",
        };
      case "ghost":
      default:
        return {
          background: "transparent",
          border: "rgba(255,255,255,0.12)",
          text: "rgba(255,255,255,0.6)",
        };
    }
  })();
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: resolvedPalette.background,
          borderColor: resolvedPalette.border,
        },
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[styles.label, { color: resolvedPalette.text }]}>
        {loading ? loadingLabel ?? "A guardar..." : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.layout.touchTarget,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
