import { PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@orya/shared";

type SettingsModalProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmInputLabel?: string;
  confirmInputValue?: string;
  onConfirmInputChange?: (value: string) => void;
  confirmPlaceholder?: string;
}>;

export function SettingsModal({
  visible,
  title,
  subtitle,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDisabled,
  confirmLoading,
  confirmInputLabel,
  confirmInputValue,
  onConfirmInputChange,
  confirmPlaceholder,
  children,
}: SettingsModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
          {confirmInputLabel ? (
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>{confirmInputLabel}</Text>
              <TextInput
                value={confirmInputValue}
                onChangeText={onConfirmInputChange}
                placeholder={confirmPlaceholder}
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.button, styles.secondary]}>
              <Text style={[styles.buttonText, styles.secondaryText]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={confirmDisabled || confirmLoading}
              style={[
                styles.button,
                styles.danger,
                (confirmDisabled || confirmLoading) && styles.disabled,
              ]}
            >
              <Text style={[styles.buttonText, styles.dangerText]}>
                {confirmLoading ? "A apagar..." : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  card: {
    width: "100%",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(13,18,28,0.96)",
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  title: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 18,
  },
  inputBlock: {
    gap: 6,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    color: "rgba(255,255,255,0.9)",
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "flex-end",
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  secondary: {
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  danger: {
    borderColor: "rgba(255, 74, 112, 0.6)",
    backgroundColor: "rgba(255, 74, 112, 0.2)",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryText: {
    color: "rgba(255,255,255,0.9)",
  },
  dangerText: {
    color: "#FFE3EA",
  },
  disabled: {
    opacity: 0.5,
  },
});
