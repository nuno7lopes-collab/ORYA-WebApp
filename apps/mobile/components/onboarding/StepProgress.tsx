import { StyleSheet, View } from "react-native";

type StepProgressProps = {
  total: number;
  current: number;
  accessibilityLabel?: string;
};

export function StepProgress({ total, current, accessibilityLabel }: StepProgressProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
      accessibilityLabel={accessibilityLabel ?? `Passo ${current + 1} de ${total}`}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <View
            key={`step-${idx}`}
            style={[
              styles.dot,
              done ? styles.dotDone : active ? styles.dotActive : styles.dotInactive,
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
    height: 8,
    borderRadius: 999,
  },
  dotDone: {
    width: 18,
    backgroundColor: "rgba(188, 224, 255, 0.72)",
  },
  dotActive: {
    width: 30,
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  dotInactive: {
    width: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
