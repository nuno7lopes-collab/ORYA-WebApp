import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@orya/shared";

type LiquidBackgroundProps = PropsWithChildren<{
  variant?: "default" | "deep";
}>;

const gradientVariants: Record<NonNullable<LiquidBackgroundProps["variant"]>, string[]> = {
  default: ["#0b101a", "#0f1626", "#0b101a"],
  deep: ["#070b12", "#0b1220", "#111b2f"],
};

export function LiquidBackground({ children, variant = "default" }: LiquidBackgroundProps) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradientVariants[variant]} style={StyleSheet.absoluteFill} />
      <View style={styles.orbTop} />
      <View style={styles.orbRight} />
      <View style={styles.orbBottom} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    flex: 1,
  },
  orbTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(56, 189, 248, 0.18)",
  },
  orbRight: {
    position: "absolute",
    top: 120,
    right: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -140,
    left: 40,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
});
