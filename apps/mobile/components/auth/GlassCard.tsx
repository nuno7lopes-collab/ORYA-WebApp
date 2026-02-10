import { PropsWithChildren } from "react";
import { ViewStyle } from "react-native";
import { GlassSurface } from "../ui/GlassSurface";

type GlassCardProps = PropsWithChildren<{
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  intensity?: number;
}>;

export function GlassCard({ children, style, contentStyle, intensity = 70 }: GlassCardProps) {
  return (
    <GlassSurface
      variant="auth"
      intensity={intensity}
      padding={20}
      style={style}
      contentStyle={[{ gap: 12, position: "relative", zIndex: 10 }, contentStyle]}
      withGradient
    >
      {children}
    </GlassSurface>
  );
}
