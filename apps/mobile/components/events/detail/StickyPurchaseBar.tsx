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

  const isCompact = viewportWidth <= 390;
  const isReady = ctaState === "READY";
  const isDisabled = disabled || loading;
  const safeLabel = ctaLabel?.trim() || t("events:tickets.cta.state.ready");
  const iconName = resolveCtaIconName(ctaState);
  const iconColor = isReady ? "#0A1018" : "#EAF63A";

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <LinearGradient
        colors={["rgba(10,15,20,0)", "rgba(10,15,20,0.76)", "rgba(10,15,20,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.contentWrap}>
        <View style={styles.content}>
          <View
            style={[
              styles.row,
              isCompact ? styles.rowCompact : null,
              isDisabled ? styles.rowDisabled : null,
            ]}
          >
            <View style={[styles.priceWrap, isCompact ? styles.priceWrapCompact : null]}>
              <Text
                style={[styles.priceText, isCompact ? styles.priceTextCompact : null]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {priceLabel}
              </Text>
            </View>

            <Pressable
              onPress={onPress}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={t("events:tickets.cta.accessibility", {
                label: safeLabel,
                price: priceLabel,
              })}
              accessibilityState={{ disabled: isDisabled }}
              style={[
                styles.ctaChip,
                isCompact ? styles.ctaChipCompact : null,
                isReady ? styles.ctaReady : styles.ctaMuted,
                isDisabled ? styles.ctaDisabled : null,
              ]}
            >
              <View style={styles.ctaContent}>
                {loading ? <ActivityIndicator size="small" color={iconColor} /> : null}
                <Text
                  style={[
                    styles.ctaText,
                    isCompact ? styles.ctaTextCompact : null,
                    isReady ? styles.ctaTextReady : null,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {loading ? t("events:tickets.cta.processing") : safeLabel}
                </Text>
                {!loading ? (
                  <Ionicons name={iconName} size={isCompact ? 14 : 15} color={iconColor} />
                ) : null}
              </View>
            </Pressable>
          </View>
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
    paddingTop: 12,
  },
  contentWrap: {
    paddingHorizontal: 16,
  },
  content: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 18,
    backgroundColor: "rgba(9,14,24,0.92)",
    padding: 7,
    shadowColor: "rgba(0,0,0,0.64)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 6,
  },
  row: {
    width: "100%",
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(220,238,255,0.18)",
    backgroundColor: "rgba(8,13,20,0.58)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    overflow: "hidden",
  },
  rowCompact: {
    minHeight: 52,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 8,
  },
  rowDisabled: {
    opacity: 0.9,
  },
  priceWrap: {
    minWidth: 74,
    maxWidth: "34%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 6,
  },
  priceWrapCompact: {
    minWidth: 68,
    maxWidth: "32%",
    paddingLeft: 4,
  },
  priceText: {
    color: "#F6FAFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.15,
  },
  priceTextCompact: {
    fontSize: 16,
  },
  ctaChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  ctaChipCompact: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ctaReady: {
    backgroundColor: "#EAF63A",
    borderColor: "rgba(238,250,68,0.9)",
  },
  ctaMuted: {
    backgroundColor: "rgba(226,242,92,0.16)",
    borderColor: "rgba(232,246,128,0.54)",
  },
  ctaDisabled: {
    opacity: 0.72,
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minWidth: 0,
    width: "100%",
  },
  ctaText: {
    color: "#EAF63A",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
    flexShrink: 1,
    minWidth: 0,
  },
  ctaTextCompact: {
    fontSize: 12,
  },
  ctaTextReady: {
    color: "#0A1018",
  },
});
