import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { tokens } from "@orya/shared";

type GlassCardProps = PropsWithChildren<{
  className?: string;
  intensity?: number;
  padding?: number;
  highlight?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}>;

export function GlassCard({
  children,
  className,
  intensity = 60,
  padding = tokens.spacing.lg,
  highlight = false,
  style,
  contentStyle,
}: GlassCardProps) {
  return (
    <View
      className={className}
      style={[
        styles.shell,
        highlight ? styles.highlight : null,
        style,
      ]}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.18)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.blur, { padding }, contentStyle]}
      >
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
    backgroundColor: tokens.colors.surface,
  },
  blur: {
    borderRadius: tokens.radius.xl,
  },
  highlight: {
    borderColor: "rgba(148, 214, 255, 0.45)",
    shadowColor: "rgba(148, 214, 255, 0.6)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
});
