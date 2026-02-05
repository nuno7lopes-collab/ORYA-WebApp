import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
const CARD_RADIUS = 22;

type GlassCardProps = PropsWithChildren<{
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  intensity?: number;
}>;

export function GlassCard({ children, style, contentStyle, intensity = 70 }: GlassCardProps) {
  return (
    <View style={[styles.shell, style]}>
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.16)",
          "rgba(255,255,255,0.04)",
          "rgba(0,0,0,0.22)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.overlay} pointerEvents="none" />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11, 16, 26, 0.55)",
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.55)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 12, 20, 0.55)",
  },
  content: {
    padding: 20,
    gap: 12,
    position: "relative",
  },
});
