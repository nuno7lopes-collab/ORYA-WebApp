import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@orya/shared";
import { Ionicons } from "../../icons/Ionicons";
import type { TicketCtaState } from "../../../features/events/detailState";

type StickyPurchaseBarProps = {
  priceLabel: string;
  ctaState: TicketCtaState;
  ctaLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

const resolveCtaIconName = (state: TicketCtaState) => {
  if (state === "READY") return "ticket-outline";
  if (state === "INVITE_LOCKED") return "lock-closed-outline";
  if (state === "ENDED") return "ban-outline";
  if (state === "COMING_SOON") return "time-outline";
  return "alert-circle-outline";
};

export function StickyPurchaseBar({
  priceLabel,
  ctaState,
  ctaLabel,
  disabled = false,
  loading = false,
  onPress,
}: StickyPurchaseBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const isCompact = viewportWidth <= 380;
  const isUltraCompact = viewportWidth <= 350;
  const isLarge = viewportWidth >= 430;
  const isReady = ctaState === "READY";
  const isDisabled = disabled || loading;
  const iconName = resolveCtaIconName(ctaState);
  const safeLabel = ctaLabel?.trim() || t("events:tickets.cta.state.ready");
  const iconColor = isReady ? "#0A1018" : "#EAF63A";

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <LinearGradient
        colors={["rgba(10,15,20,0)", "rgba(10,15,20,0.74)", "rgba(10,15,20,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.contentWrap}>
        <View style={styles.content}>
          <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={t("events:tickets.cta.accessibility", {
              label: safeLabel,
              price: priceLabel,
            })}
            accessibilityState={{ disabled: isDisabled }}
            style={({ pressed }) => [
              styles.ctaRow,
              isLarge ? styles.ctaRowLarge : null,
              isCompact ? styles.ctaRowCompact : null,
              isDisabled ? styles.ctaRowDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View
              style={[
                styles.priceWrap,
                isLarge ? styles.priceWrapLarge : null,
                isCompact ? styles.priceWrapCompact : null,
              ]}
            >
              <Text
                style={[
                  styles.price,
                  isLarge ? styles.priceLarge : null,
                  isCompact ? styles.priceCompact : null,
                  isUltraCompact ? styles.priceUltraCompact : null,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {priceLabel}
              </Text>
            </View>
            <View
              style={[
                styles.ctaChip,
                isLarge ? styles.ctaChipLarge : null,
                isCompact ? styles.ctaChipCompact : null,
                isUltraCompact ? styles.ctaChipUltraCompact : null,
                isReady ? styles.ctaChipReady : styles.ctaChipMuted,
              ]}
            >
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={iconColor} />
                  <Text
                    style={[
                      styles.buttonText,
                      isLarge ? styles.buttonTextLarge : null,
                      isCompact ? styles.buttonTextCompact : null,
                      isReady ? styles.buttonTextReady : null,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.84}
                  >
                    {t("events:tickets.cta.processing")}
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text
                    style={[
                      styles.buttonText,
                      isLarge ? styles.buttonTextLarge : null,
                      isCompact ? styles.buttonTextCompact : null,
                      isReady ? styles.buttonTextReady : null,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.84}
                  >
                    {safeLabel}
                  </Text>
                  <Ionicons
                    name={iconName}
                    size={isCompact ? 14 : 15}
                    color={iconColor}
                  />
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
  },
  contentWrap: {
    paddingHorizontal: 20,
  },
  content: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    backgroundColor: "rgba(9, 14, 24, 0.88)",
    padding: 8,
    shadowColor: "rgba(0,0,0,0.6)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 5,
  },
  ctaRow: {
    width: "100%",
    minHeight: 54,
    borderRadius: 16,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: "rgba(8,13,20,0.58)",
    borderWidth: 1,
    borderColor: "rgba(220,238,255,0.18)",
    overflow: "hidden",
    gap: 8,
  },
  ctaRowCompact: {
    minHeight: 50,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  ctaRowLarge: {
    minHeight: 56,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  ctaRowDisabled: {
    opacity: 0.88,
  },
  priceWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 2,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  priceWrapCompact: {
    paddingHorizontal: 9,
  },
  priceWrapLarge: {
    paddingHorizontal: 14,
  },
  price: {
    color: "#F6FAFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  priceCompact: {
    fontSize: 18,
  },
  priceUltraCompact: {
    fontSize: 17,
  },
  priceLarge: {
    fontSize: 20,
  },
  ctaChip: {
    minWidth: 136,
    maxWidth: "56%",
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ctaChipCompact: {
    paddingHorizontal: 10,
    minWidth: 120,
  },
  ctaChipUltraCompact: {
    paddingHorizontal: 8,
    minWidth: 108,
    maxWidth: "58%",
  },
  ctaChipLarge: {
    paddingHorizontal: 16,
  },
  ctaChipReady: {
    backgroundColor: "#EAF63A",
    borderColor: "rgba(238,250,68,0.88)",
  },
  ctaChipMuted: {
    backgroundColor: "rgba(226,242,92,0.16)",
    borderColor: "rgba(232,246,128,0.54)",
  },
  pressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: "#EAF63A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
    flexShrink: 1,
    minWidth: 0,
  },
  buttonTextCompact: {
    fontSize: 14,
  },
  buttonTextLarge: {
    fontSize: 16,
  },
  buttonTextReady: {
    color: "#0A1018",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minWidth: 0,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
