import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard } from "./GlassCard";
import { useTranslation } from "@orya/shared";

type HelpSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function HelpSheet({ visible, onClose }: HelpSheetProps) {
  const { t } = useTranslation();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <GlassCard>
            <Text style={styles.title}>{t("auth:helpSheet.title")}</Text>
            <Text style={styles.body}>{t("auth:helpSheet.body1")}</Text>
            <Text style={styles.body}>{t("auth:helpSheet.body2")}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
              <Text style={styles.closeText}>{t("auth:helpSheet.close")}</Text>
            </Pressable>
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(5, 8, 12, 0.55)",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  closeButton: {
    marginTop: 6,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  closeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
