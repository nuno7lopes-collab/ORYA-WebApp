import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@orya/shared";

type LiquidBackgroundProps = PropsWithChildren<{
  variant?: "solid" | "default" | "deep";
}>;

type GradientTuple = readonly [string, string, ...string[]];

const FUNDO_1_GRADIENT: GradientTuple = ["#0b1014", "#0d1320", "#101826"];

const gradientVariants: Record<NonNullable<LiquidBackgroundProps["variant"]>, GradientTuple> = {
  solid: FUNDO_1_GRADIENT,
  default: FUNDO_1_GRADIENT,
  deep: FUNDO_1_GRADIENT,
};

export function LiquidBackground({
  children,
  variant = "deep",
}: LiquidBackgroundProps) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradientVariants[variant]} style={StyleSheet.absoluteFill} />
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
});
