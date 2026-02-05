import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@orya/shared";

type LiquidBackgroundProps = PropsWithChildren<{
  variant?: "solid" | "default" | "deep";
}>;

type GradientTuple = readonly [string, string, ...string[]];

const gradientVariants: Record<NonNullable<LiquidBackgroundProps["variant"]>, GradientTuple> = {
  solid: ["#0b101a", "#0b101a"],
  default: ["#0b101a", "#0f1626", "#0b101a"],
  deep: ["#070b12", "#0b1220", "#111b2f"],
};

export function LiquidBackground({
  children,
  variant = "solid",
}: LiquidBackgroundProps) {
  return (
    <View style={styles.root}>
      {variant !== "solid" ? (
        <LinearGradient colors={gradientVariants[variant]} style={StyleSheet.absoluteFill} />
      ) : null}
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
