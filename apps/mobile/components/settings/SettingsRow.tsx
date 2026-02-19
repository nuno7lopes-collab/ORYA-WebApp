import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@orya/shared";

type SettingsRowProps = PropsWithChildren<{
  label: string;
  description?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}>;

export function SettingsRow({
  label,
  description,
  onPress,
  disabled,
  trailing,
  children,
}: SettingsRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      disabled={disabled}
      style={[styles.row, disabled ? styles.disabled : null]}
    >
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {children}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Wrapper>
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
  trailing: {
    alignItems: "flex-end",
  },
  disabled: {
    opacity: 0.6,
  },
});
