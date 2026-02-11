import { BlurView } from "expo-blur";
import { PropsWithChildren } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { tokens } from "@orya/shared";

type GlassPillProps = PropsWithChildren<{
  label: string;
  variant?: "neutral" | "accent" | "muted";
}>;

const variants: Record<NonNullable<GlassPillProps["variant"]>, { bg: string; border: string; text: string }> = {
  neutral: {
    bg: "rgba(0,0,0,0.35)",
    border: "rgba(255,255,255,0.25)",
    text: tokens.colors.text,
  },
  accent: {
    bg: "rgba(14, 116, 144, 0.55)",
    border: "rgba(148, 214, 255, 0.5)",
    text: "#A7F3FF",
  },
  muted: {
    bg: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.18)",
    text: tokens.colors.textSubtle,
  },
};

export function GlassPill({ label, variant = "neutral", children }: GlassPillProps) {
  const palette = variants[variant];
  const shouldBlur = Platform.OS === "ios";
  return (
    <View style={[styles.shell, { borderColor: palette.border, backgroundColor: palette.bg }]}>
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
  },
  blur: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});
