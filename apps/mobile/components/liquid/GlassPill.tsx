import { BlurView } from "expo-blur";
import { PropsWithChildren } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { tokens } from "@orya/shared";

type GlassPillProps = PropsWithChildren<{
  label: string;
  variant?: "neutral" | "accent" | "muted";
}>;

const variants: Record<
  NonNullable<GlassPillProps["variant"]>,
  { bg: string; border: string; text: string; glow?: string }
> = {
  neutral: {
    bg: "rgba(6,10,18,0.5)",
    border: "rgba(255,255,255,0.26)",
    text: tokens.colors.text,
    glow: "rgba(255,255,255,0.08)",
  },
  accent: {
    bg: "rgba(89, 198, 255, 0.24)",
    border: "rgba(170, 227, 255, 0.75)",
    text: "#E7F8FF",
    glow: "rgba(122, 217, 255, 0.24)",
  },
  muted: {
    bg: "rgba(255,255,255,0.1)",
    border: "rgba(255,255,255,0.2)",
    text: "rgba(235,245,255,0.88)",
    glow: "rgba(255,255,255,0.06)",
  },
};

export function GlassPill({ label, variant = "neutral", children }: GlassPillProps) {
  const palette = variants[variant];
  const shouldBlur = Platform.OS === "ios";
  return (
    <View style={[styles.shell, { borderColor: palette.border, backgroundColor: palette.bg }]}>
      <View pointerEvents="none" style={[styles.topLine, { backgroundColor: palette.glow }]} />
      {shouldBlur ? (
        <BlurView intensity={40} tint="dark" style={styles.blur}>
          {children}
          <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
        </BlurView>
      ) : (
        <View style={styles.blur}>
          {children}
          <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  topLine: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 0,
    height: 1,
    borderRadius: 999,
    opacity: 0.95,
  },
  blur: {
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
