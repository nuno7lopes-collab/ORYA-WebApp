import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { tokens } from "@orya/shared";

type GlassSurfaceVariant = "card" | "surface" | "auth";

export type GlassSurfaceProps = PropsWithChildren<{
  variant?: GlassSurfaceVariant;
  className?: string;
  intensity?: number;
  padding?: number;
  tint?: "dark" | "light";
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  withGradient?: boolean;
  blurEnabled?: boolean;
}>;

export function GlassSurface({
  children,
  className,
  variant = "surface",
  intensity = 52,
  padding = tokens.spacing.lg,
  tint = "dark",
  style,
  contentStyle,
  withGradient = true,
  blurEnabled,
}: GlassSurfaceProps) {
  const shouldBlur = blurEnabled ?? Platform.OS !== "android";
  const shellStyle = [
    styles.shell,
    variant === "surface" ? styles.surface : null,
    variant === "card" ? styles.card : null,
    variant === "auth" ? styles.auth : null,
    style,
  ];

  return (
    <View className={className} style={shellStyle}>
      {withGradient ? (
        <LinearGradient
          colors={
            variant === "auth"
              ? ["rgba(255,255,255,0.16)", "rgba(0,0,0,0.2)"]
              : ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.2)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {shouldBlur ? (
        <BlurView
          intensity={intensity}
          tint={tint}
          style={[styles.blur, { padding }, contentStyle]}
        >
          {children}
        </BlurView>
      ) : (
        <View style={[styles.blur, { padding }, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.glass,
  },
  surface: {
    backgroundColor: tokens.colors.glass,
  },
  card: {
    backgroundColor: tokens.colors.surface,
  },
  auth: {
    borderRadius: 22,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(9, 14, 22, 0.72)",
    shadowColor: "rgba(0,0,0,0.55)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  blur: {
    borderRadius: tokens.radius.xl,
  },
});
