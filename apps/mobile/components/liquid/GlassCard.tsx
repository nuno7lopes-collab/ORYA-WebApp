import { PropsWithChildren } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "@orya/shared";
import { GlassSurface } from "../ui/GlassSurface";

type GlassCardProps = PropsWithChildren<{
  className?: string;
  intensity?: number;
  padding?: number;
  highlight?: boolean;
  blurEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function GlassCard({
  children,
  className,
  intensity = 60,
  padding = tokens.spacing.lg,
  highlight = false,
  blurEnabled,
  style,
  contentStyle,
}: GlassCardProps) {
  return (
    <GlassSurface
      variant="card"
      className={className}
      intensity={intensity}
      padding={padding}
      tint="dark"
      blurEnabled={blurEnabled}
      style={[styles.base, highlight ? styles.highlight : null, style]}
      contentStyle={contentStyle}
      withGradient
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 22,
  },
  highlight: {
    borderColor: "rgba(167, 229, 255, 0.56)",
    shadowColor: "rgba(128, 216, 255, 0.78)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
});
