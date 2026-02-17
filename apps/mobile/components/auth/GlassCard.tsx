import { PropsWithChildren } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { GlassSurface } from "../ui/GlassSurface";

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
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
