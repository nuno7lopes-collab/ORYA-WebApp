import { PropsWithChildren } from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";

type PadelSectionProps = PropsWithChildren<{
  tone?: "base" | "soft" | "accent" | "live";
  style?: StyleProp<ViewStyle>;
}>;

export function PadelSection({
  tone = "base",
  style,
  children,
}: PadelSectionProps) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
});

const toneStyles = StyleSheet.create({
  base: {
    borderColor: "rgba(154,195,255,0.24)",
    backgroundColor: "rgba(11,18,30,0.52)",
  },
  soft: {
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  accent: {
    borderColor: "rgba(128,223,255,0.48)",
    backgroundColor: "rgba(77,199,255,0.12)",
  },
  live: {
    borderColor: "rgba(255,115,145,0.44)",
    backgroundColor: "rgba(255,115,145,0.12)",
  },
});
