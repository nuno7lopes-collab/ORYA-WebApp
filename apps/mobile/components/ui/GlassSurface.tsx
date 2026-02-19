import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "@orya/shared";

type GlassSurfaceVariant = "card" | "surface" | "auth";

export type GlassSurfaceProps = PropsWithChildren<{
  variant?: GlassSurfaceVariant;
  className?: string;
  intensity?: number;
  padding?: number;
  tint?: "dark" | "light";
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
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
  const isCard = variant === "card";
  const isAuth = variant === "auth";
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
            isAuth
              ? ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.26)"]
              : isCard
                ? ["rgba(255,255,255,0.18)", "rgba(190,232,255,0.08)", "rgba(0,0,0,0.3)"]
                : ["rgba(255,255,255,0.16)", "rgba(205,236,255,0.06)", "rgba(0,0,0,0.26)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.95 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          styles.highlightLine,
          isAuth ? styles.highlightLineAuth : null,
          isCard ? styles.highlightLineCard : null,
        ]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.innerVignette}
      />
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
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(10, 14, 24, 0.6)",
    shadowColor: "rgba(0,0,0,0.6)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 4,
  },
  surface: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12, 18, 30, 0.55)",
  },
  card: {
    borderColor: "rgba(186, 227, 255, 0.2)",
    backgroundColor: "rgba(12, 19, 30, 0.66)",
  },
  auth: {
    borderRadius: 22,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(9, 14, 24, 0.76)",
    shadowColor: "rgba(0,0,0,0.55)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
  highlightLine: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.32)",
    opacity: 0.6,
  },
  highlightLineCard: {
    backgroundColor: "rgba(190, 232, 255, 0.48)",
    opacity: 0.72,
  },
  highlightLineAuth: {
    backgroundColor: "rgba(255,255,255,0.54)",
    opacity: 0.82,
  },
  innerVignette: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.65,
  },
  blur: {
    borderRadius: tokens.radius.xl,
  },
});
