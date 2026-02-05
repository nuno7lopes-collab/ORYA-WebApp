import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
const CARD_RADIUS = 22;

type GlassCardProps = PropsWithChildren<{
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  intensity?: number;
}>;

export function GlassCard({ children, style, contentStyle, intensity = 70 }: GlassCardProps) {
  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(9, 14, 22, 0.72)",
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.55)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  content: {
    padding: 20,
    gap: 12,
    position: "relative",
    zIndex: 10,
  },
});
