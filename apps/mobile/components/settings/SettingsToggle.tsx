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
        accessibilityLabel={label}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 0,
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
    color: "rgba(255,255,255,0.96)",
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.6,
  },
});
