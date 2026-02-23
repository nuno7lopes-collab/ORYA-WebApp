import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@orya/shared";

type LiquidBackgroundProps = PropsWithChildren;

type GradientTuple = readonly [string, string, ...string[]];

const BACKGROUND_GRADIENT: GradientTuple = [
  tokens.colors.background,
  tokens.colors.backgroundElevated,
  tokens.colors.backgroundDeep,
];

export function LiquidBackground({ children }: LiquidBackgroundProps) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={BACKGROUND_GRADIENT} style={StyleSheet.absoluteFill} />
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
