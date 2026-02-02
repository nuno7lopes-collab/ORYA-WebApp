import { BlurView } from "expo-blur";
import { PropsWithChildren } from "react";
import { View } from "react-native";
import { tokens } from "@orya/shared";

type GlassSurfaceProps = PropsWithChildren<{
  className?: string;
  intensity?: number;
}>;

export function GlassSurface({ children, className, intensity = 50 }: GlassSurfaceProps) {
  return (
    <View
      className={className}
      style={{
        borderRadius: tokens.radius.xl,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        overflow: "hidden",
        backgroundColor: tokens.colors.glass,
      }}
    >
      <BlurView intensity={intensity} tint="dark" style={{ padding: tokens.spacing.lg }}>
        {children}
      </BlurView>
    </View>
  );
}
