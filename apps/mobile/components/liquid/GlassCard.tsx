import { PropsWithChildren } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { tokens } from "@orya/shared";
import { GlassSurface } from "../ui/GlassSurface";

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
    <GlassSurface
      variant="card"
      className={className}
      intensity={intensity}
      padding={padding}
      tint="dark"
      style={[highlight ? styles.highlight : null, style]}
      contentStyle={contentStyle}
      withGradient
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  highlight: {
    borderColor: "rgba(148, 214, 255, 0.45)",
    shadowColor: "rgba(148, 214, 255, 0.6)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
});
