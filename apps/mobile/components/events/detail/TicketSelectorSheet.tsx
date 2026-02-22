import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../../icons/Ionicons";
import { formatCurrency } from "../../../lib/formatters";
import { tokens, useTranslation } from "@orya/shared";

export type TicketSelectorItem = {
  id: number;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  quantity: number;
  maxQuantity: number;
  availabilityLabel: string | null;
  limitLabel?: string | null;
  statusLabel: string;
  disabled: boolean;
  disabledReason?: string | null;
};

type TicketSelectorSheetProps = {
  visible: boolean;
  title?: string;
  items: TicketSelectorItem[];
  totalCents: number;
  currency: string;
  submitLabel?: string;
  onClose: () => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
  onSubmit: () => void;
  emptyStateMessage?: string | null;
};

export function TicketSelectorSheet({
  visible,
  title,
  items,
  totalCents,
  currency,
  submitLabel,
  onClose,
  onIncrement,
  onDecrement,
  onSubmit,
  emptyStateMessage,
}: TicketSelectorSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(420)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const resolvedTitle = title ?? t("events:tickets.title");
  const resolvedSubmitLabel = submitLabel ?? t("events:tickets.sheet.submit.default");
  const resolvedEmptyStateMessage =
    emptyStateMessage ?? t("events:tickets.unavailableNow");

  const selectedQuantity = items.reduce(
    (total, item) => total + Math.max(0, item.quantity),
    0,
  );
  const showSubmit = selectedQuantity > 0;
  const submitDisabled = !showSubmit;
  const footerBottomPadding = Math.max(10, insets.bottom + 6);
  const sheetHeightRatio = items.length <= 2 ? 0.66 : items.length <= 3 ? 0.72 : 0.8;
  const sheetHeight = Math.max(
    420,
    Math.min(viewportHeight * sheetHeightRatio, viewportHeight - (insets.top + 20)),
  );

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(420);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("events:tickets.sheet.closeSelection")}
      >
        <Animated.View style={[styles.overlayDim, { opacity }]} />
      </Pressable>

      <Animated.View
        style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}
      >
        <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} />

        <View style={styles.sheetInner}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{resolvedTitle}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.close")}
              style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
            >
              <Ionicons name="close" size={18} color="rgba(240,247,255,0.92)" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="ticket-outline" size={20} color="rgba(229,242,255,0.72)" />
                <Text style={styles.emptyStateText}>{resolvedEmptyStateMessage}</Text>
              </View>
            ) : (
              items.map((item) => (
                <View
                  key={`ticket-sheet-${item.id}`}
                  style={[styles.ticketRow, item.disabled ? styles.ticketRowDisabled : null]}
                >
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    {item.description ? (
                      <Text style={styles.ticketDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={styles.ticketBottomRow}>
                      <Text style={styles.ticketPrice}>
                        {item.priceCents <= 0
                          ? t("common:price.free")
                          : formatCurrency(item.priceCents / 100, item.currency)}
                      </Text>

                      {item.limitLabel ? (
                        <Text style={styles.ticketLimit} numberOfLines={1}>
                          {item.limitLabel}
                        </Text>
                      ) : null}

                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => onDecrement(item.id)}
                          disabled={item.quantity === 0 || item.disabled}
                          style={({ pressed }) => [
                            styles.stepperBtn,
                            item.quantity === 0 || item.disabled
                              ? styles.stepperBtnDisabled
                              : null,
                            pressed ? styles.pressed : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t("events:tickets.sheet.decrement", {
                            name: item.name,
                          })}
                          accessibilityState={{
                            disabled: item.quantity === 0 || item.disabled,
                          }}
                        >
                          <Ionicons name="remove" size={18} color="rgba(237,246,255,0.96)" />
                        </Pressable>

                        <Text style={styles.stepperValue}>{item.quantity}</Text>

                        <Pressable
                          onPress={() => onIncrement(item.id)}
                          disabled={item.disabled || item.quantity >= item.maxQuantity}
                          style={({ pressed }) => [
                            styles.stepperBtn,
                            item.disabled || item.quantity >= item.maxQuantity
                              ? styles.stepperBtnDisabled
                              : null,
                            pressed ? styles.pressed : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t("events:tickets.sheet.increment", {
                            name: item.name,
                          })}
                          accessibilityState={{
                            disabled: item.disabled || item.quantity >= item.maxQuantity,
                          }}
                        >
                          <Ionicons name="add" size={18} color="rgba(237,246,255,0.96)" />
                        </Pressable>
                      </View>
                    </View>

                    {item.disabled && item.disabledReason ? (
                      <Text style={styles.disabledReason} numberOfLines={2}>
                        {item.disabledReason}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
            <View style={styles.footerTopRow}>
              <Text style={styles.footerHint}>Total</Text>
              <Text style={styles.footerTotal}>{formatCurrency(totalCents / 100, currency)}</Text>
            </View>

            {showSubmit ? (
              <Pressable
                onPress={onSubmit}
                disabled={submitDisabled}
                accessibilityRole="button"
                accessibilityLabel={resolvedSubmitLabel}
                accessibilityState={{ disabled: submitDisabled }}
                style={({ pressed }) => [
                  styles.submitBtn,
                  submitDisabled ? styles.submitBtnDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={styles.submitReady}>
                  <Text style={styles.submitText}>{resolvedSubmitLabel}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#0A1018" />
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,12,0.86)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#090E18",
  },
  sheetInner: {
    flex: 1,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(226,241,255,0.38)",
    marginTop: 8,
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: "#F3F9FF",
    fontSize: 18,
    fontWeight: "800",
  },
  close: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  ticketRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 12,
  },
  ticketRowDisabled: {
    opacity: 0.62,
  },
  ticketInfo: {
    flex: 1,
    gap: 4,
  },
  ticketName: {
    color: "#F4F9FF",
    fontSize: 15,
    fontWeight: "700",
  },
  ticketDescription: {
    color: "rgba(226,240,255,0.62)",
    fontSize: 12,
    lineHeight: 17,
  },
  ticketBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  ticketPrice: {
    color: "rgba(242,249,255,0.95)",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginRight: "auto",
  },
  ticketLimit: {
    color: "rgba(255,227,122,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(232,246,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: "center",
    color: "#F4F9FF",
    fontSize: 18,
    fontWeight: "800",
  },
  disabledReason: {
    color: "rgba(255,214,124,0.92)",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyStateText: {
    flex: 1,
    color: "rgba(234,244,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,13,22,0.98)",
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  footerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerHint: {
    color: "rgba(221,238,255,0.66)",
    fontSize: 12,
    fontWeight: "600",
  },
  footerTotal: {
    color: "#F4F9FF",
    fontSize: 20,
    fontWeight: "800",
  },
  submitBtn: {
    minHeight: tokens.layout.touchTarget,
    borderRadius: 16,
    backgroundColor: "#EAF63A",
    borderWidth: 1,
    borderColor: "rgba(238,250,68,0.9)",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 11,
    shadowColor: "#EAF63A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: "rgba(234,246,58,0.28)",
    borderColor: "rgba(238,250,68,0.35)",
  },
  submitText: {
    color: "#0A1018",
    fontSize: 15,
    fontWeight: "800",
  },
  submitReady: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: {
    opacity: 0.86,
  },
});
