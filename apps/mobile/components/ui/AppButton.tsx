import { Pressable, Text, type ViewStyle } from "react-native";
import { tokens } from "@orya/shared";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  variant?: AppButtonVariant;
  style?: ViewStyle;
};

const variants: Record<AppButtonVariant, { background: string; border: string; text: string }> = {
  primary: {
    background: "rgba(245, 249, 255, 0.95)",
    border: "rgba(255,255,255,0.55)",
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

export function AppButton({
  label,
  onPress,
  disabled,
  loading,
  loadingLabel,
  variant = "primary",
  style,
}: AppButtonProps) {
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
      accessibilityRole="button"
      accessibilityLabel={loading ? loadingLabel ?? label : label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
          backgroundColor: resolvedPalette.background,
          borderColor: resolvedPalette.border,
        },
        pressed && !isDisabled ? { transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      <Text
        style={{
          color: resolvedPalette.text,
          fontSize: 14,
          fontWeight: "700",
          letterSpacing: 0.2,
          fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
        }}
      >
        {loading ? loadingLabel ?? label : label}
      </Text>
    </Pressable>
  );
}
