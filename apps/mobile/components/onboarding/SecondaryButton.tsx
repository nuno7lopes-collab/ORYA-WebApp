import { Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "@orya/shared";

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function SecondaryButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.shell,
        {
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          backgroundColor: pressed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
        },
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: tokens.layout.touchTarget,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
});
