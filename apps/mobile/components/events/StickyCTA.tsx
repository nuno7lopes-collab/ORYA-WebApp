import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type StickyCTAProps = PropsWithChildren<{
  paddingHorizontal?: number;
}>;

export function StickyCTA({ children, paddingHorizontal = 20 }: StickyCTAProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 16 }]}>
      <LinearGradient
        colors={["rgba(11,16,26,0)", "rgba(11,16,26,0.75)", "rgba(11,16,26,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingHorizontal }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 18,
  },
  content: {
    gap: 10,
  },
});
