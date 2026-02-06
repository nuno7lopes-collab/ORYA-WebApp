import { StyleSheet, Switch, Text, View } from "react-native";
import { tokens } from "@orya/shared";

type SettingsToggleProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
};

export function SettingsToggle({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: SettingsToggleProps) {
  return (
    <View style={[styles.row, disabled ? styles.disabled : null]}>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: "rgba(255,255,255,0.18)",
          true: "rgba(107,255,255,0.45)",
        }}
        thumbColor={value ? "#F5F9FF" : "#E1E7F2"}
        ios_backgroundColor="rgba(255,255,255,0.18)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    minHeight: tokens.layout.touchTarget,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    lineHeight: 16,
  },
  disabled: {
    opacity: 0.6,
  },
});
