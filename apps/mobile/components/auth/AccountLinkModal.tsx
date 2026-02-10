import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard } from "./GlassCard";
import { useTranslation } from "@orya/shared";

type AccountLinkModalProps = {
  visible: boolean;
  onClose: () => void;
  onContinueEmail: () => void;
};

export function AccountLinkModal({ visible, onClose, onContinueEmail }: AccountLinkModalProps) {
  const { t } = useTranslation();
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>{t("auth.accountLinkTitle")}</Text>
          <Text style={styles.body}>{t("auth.accountLinkBody")}</Text>
          <Pressable onPress={onContinueEmail} accessibilityRole="button" style={styles.primaryButton}>
            <Text style={styles.primaryText}>{t("auth.accountLinkContinue")}</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{t("auth.accountLinkCancel")}</Text>
          </Pressable>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(6, 10, 16, 0.6)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  primaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0b0f17",
  },
  secondaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
  },
});
