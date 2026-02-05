import { StyleSheet, View } from "react-native";

type StepProgressProps = {
  total: number;
  current: number;
};

export function StepProgress({ total, current }: StepProgressProps) {
  return (
    <View style={styles.row} accessibilityLabel={`Passo ${current + 1} de ${total}`}>
      {Array.from({ length: total }).map((_, idx) => {
        const active = idx === current;
        return (
          <View
            key={`step-${idx}`}
            style={[
              styles.dot,
              active ? styles.dotActive : styles.dotInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  dotActive: {
    width: 26,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  dotInactive: {
    width: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
});
