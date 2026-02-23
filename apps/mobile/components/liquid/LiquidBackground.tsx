import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@orya/shared";

type LiquidBackgroundProps = PropsWithChildren<{
  variant?: "solid" | "default" | "deep";
}>;

type GradientTuple = readonly [string, string, ...string[]];

const gradientVariants: Record<NonNullable<LiquidBackgroundProps["variant"]>, GradientTuple> = {
  solid: [tokens.colors.background, tokens.colors.backgroundElevated, tokens.colors.backgroundDeep],
  default: [tokens.colors.background, tokens.colors.backgroundElevated, tokens.colors.backgroundDeep],
  deep: [tokens.colors.background, tokens.colors.backgroundElevated, tokens.colors.backgroundDeep],
};

export function LiquidBackground({
  children,
  variant = "default",
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
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
});
