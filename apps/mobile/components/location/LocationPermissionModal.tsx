import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { tokens, useTranslation } from "@orya/shared";
import { GlassCard } from "../auth/GlassCard";
import { Ionicons } from "../icons/Ionicons";
import { PrimaryButton } from "../onboarding/PrimaryButton";
import { SecondaryButton } from "../onboarding/SecondaryButton";
import { useMemo } from "react";
import { useIpLocation } from "../../features/onboarding/hooks";

type LocationPermissionModalProps = {
  visible: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  canAskAgain?: boolean;
  onAllow: () => void;
  onSkip: () => void;
  onOpenSettings?: () => void;
};

export function LocationPermissionModal({
  visible,
  busy,
  errorMessage,
  canAskAgain = true,
  onAllow,
  onSkip,
  onOpenSettings,
}: LocationPermissionModalProps) {
  const { t } = useTranslation();
  const ipLocationQuery = useIpLocation(visible);

  const locationPreview = useMemo(() => {
    const data = ipLocationQuery.data;
    if (!data) return null;
    const parts = [data.city, data.region, data.country].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    );
    if (parts.length === 0) return null;
    return parts.join(", ");
  }, [ipLocationQuery.data]);

  const primaryLabel = canAskAgain
    ? busy
      ? t("common:actions.saving")
      : t("onboarding:location.allowShort")
    : t("settings:notifications.pushOpenSettings");

  const handlePrimaryPress = () => {
    if (!canAskAgain && onOpenSettings) {
      onOpenSettings();
      return;
    }
    onAllow();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <Text style={styles.title}>{t("onboarding:location.title")}</Text>
          <Text style={styles.subtitle}>{t("onboarding:location.subtitle")}</Text>

          {locationPreview ? (
            <View style={styles.locationPreviewRow}>
              <Ionicons name="navigate-circle" size={16} color="rgba(145, 198, 255, 0.92)" />
              <Text style={styles.locationPreviewText}>
                {t("onboarding:location.approxLocation", { location: locationPreview })}
              </Text>
            </View>
          ) : ipLocationQuery.isLoading ? (
            <View style={styles.locationPreviewRow}>
              <ActivityIndicator size="small" color="rgba(200,210,230,0.85)" />
              <Text style={styles.locationPreviewText}>{t("onboarding:location.detecting")}</Text>
            </View>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={primaryLabel}
              onPress={handlePrimaryPress}
              disabled={Boolean(busy)}
              loading={canAskAgain && Boolean(busy)}
              accessibilityLabel={primaryLabel}
            />
            <SecondaryButton
              label={t("onboarding:location.notNow")}
              onPress={onSkip}
              disabled={Boolean(busy)}
              accessibilityLabel={t("onboarding:location.notNow")}
            />
          </View>
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
    backgroundColor: "rgba(6, 10, 16, 0.62)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
  },
  cardContent: {
    gap: 16,
    padding: 22,
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    fontFamily: tokens.typography.fontFamily?.headingBold ?? "System",
  },
  subtitle: {
    color: "rgba(220, 228, 244, 0.8)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  actions: {
    gap: 10,
  },
  locationPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(140, 190, 255, 0.25)",
    backgroundColor: "rgba(120, 175, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationPreviewText: {
    color: "rgba(219,234,255,0.92)",
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
    flexShrink: 1,
  },
  errorText: {
    color: "rgba(255,180,180,0.9)",
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
});
