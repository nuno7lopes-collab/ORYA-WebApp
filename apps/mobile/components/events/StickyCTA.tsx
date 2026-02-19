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
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 14 }]}>
      <LinearGradient
        colors={["rgba(8,12,20,0)", "rgba(7,12,21,0.7)", "rgba(7,12,21,0.96)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.contentWrap, { paddingHorizontal }]}>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 22,
  },
  contentWrap: {
    gap: 10,
  },
  content: {
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 22,
    backgroundColor: "rgba(10, 15, 25, 0.76)",
    padding: 12,
    shadowColor: "rgba(0,0,0,0.6)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 5,
  },
});
