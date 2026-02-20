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
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
  },
});

const toneStyles = StyleSheet.create({
  base: {
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  soft: {
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.012)",
  },
  accent: {
    borderColor: "rgba(126,228,255,0.34)",
    backgroundColor: "rgba(77,199,255,0.08)",
  },
  live: {
    borderColor: "rgba(255,115,145,0.3)",
    backgroundColor: "rgba(255,115,145,0.08)",
  },
});
