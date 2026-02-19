import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "../../icons/Ionicons";
import { formatCurrency } from "../../../lib/formatters";
import { tokens } from "@orya/shared";

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
};

type TicketSelectorSheetProps = {
  visible: boolean;
  title?: string;
  items: TicketSelectorItem[];
  totalCents: number;
  currency: string;
  canSubmit: boolean;
  submitting: boolean;
  onClose: () => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
  onSubmit: () => void;
};

export function TicketSelectorSheet({
  visible,
  title = "Comprar bilhetes",
  items,
  totalCents,
  currency,
  canSubmit,
  submitting,
  onClose,
  onIncrement,
  onDecrement,
  onSubmit,
}: TicketSelectorSheetProps) {
  const translateY = useRef(new Animated.Value(380)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(380);
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
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar seleção de bilhetes">
        <Animated.View style={[styles.overlayDim, { opacity }]} />
      </Pressable>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} />
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
          >
            <Ionicons name="close" size={18} color="rgba(240,247,255,0.92)" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {items.map((item) => (
            <View
              key={`ticket-sheet-${item.id}`}
              style={[styles.ticketRow, item.disabled ? styles.ticketRowDisabled : null]}
            >
              <View style={styles.ticketInfo}>
                <View style={styles.ticketHead}>
                  <Text style={styles.ticketName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.quantity > 0 ? (
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>{item.quantity}</Text>
                    </View>
                  ) : null}
                </View>
                {item.description ? (
                  <Text style={styles.ticketDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.ticketMetaRow}>
                  <Text style={styles.ticketPrice}>
                    {item.priceCents <= 0 ? "Grátis" : formatCurrency(item.priceCents / 100, item.currency)}
                  </Text>
                  <Text style={styles.ticketStatus}>{item.statusLabel}</Text>
                  {item.availabilityLabel ? (
                    <Text style={styles.ticketAvailability} numberOfLines={1}>
                      {item.availabilityLabel}
                    </Text>
                  ) : null}
                  {item.limitLabel ? (
                    <Text style={styles.ticketLimit} numberOfLines={1}>
                      {item.limitLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.counter}>
                <Pressable
                  onPress={() => onDecrement(item.id)}
                  disabled={item.quantity === 0 || item.disabled}
                  style={({ pressed }) => [
                    styles.counterBtn,
                    item.quantity === 0 || item.disabled ? styles.counterBtnDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover bilhete ${item.name}`}
                  accessibilityState={{ disabled: item.quantity === 0 || item.disabled }}
                >
                  <Ionicons name="remove" size={16} color="rgba(237,246,255,0.92)" />
                </Pressable>
                <Text style={styles.counterValue}>{item.quantity}</Text>
                <Pressable
                  onPress={() => onIncrement(item.id)}
                  disabled={item.disabled || item.quantity >= item.maxQuantity}
                  style={({ pressed }) => [
                    styles.counterBtn,
                    item.disabled || item.quantity >= item.maxQuantity
                      ? styles.counterBtnDisabled
                      : null,
                    pressed ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar bilhete ${item.name}`}
                  accessibilityState={{
                    disabled: item.disabled || item.quantity >= item.maxQuantity,
                  }}
                >
                  <Ionicons name="add" size={16} color="rgba(237,246,255,0.92)" />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerHint}>Total</Text>
            <Text style={styles.footerTotal}>
              {formatCurrency(totalCents / 100, currency)}
            </Text>
          </View>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit || submitting}
            accessibilityRole="button"
            accessibilityLabel="Finalizar compra"
            accessibilityState={{ disabled: !canSubmit || submitting }}
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit ? styles.submitBtnDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {submitting ? (
              <View style={styles.submitBusy}>
                <ActivityIndicator size="small" color="#0a1018" />
                <Text style={styles.submitText}>A processar…</Text>
              </View>
            ) : (
              <Text style={styles.submitText}>Finalizar compra</Text>
            )}
          </Pressable>
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
    backgroundColor: "rgba(2,6,12,0.66)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "84%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(6,10,18,0.96)",
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
  pressed: {
    opacity: 0.86,
  },
  listContent: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 18,
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
  ticketHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticketName: {
    flex: 1,
    color: "#F4F9FF",
    fontSize: 15,
    fontWeight: "700",
  },
  qtyBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(107,255,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(177,255,255,0.74)",
  },
  qtyBadgeText: {
    color: "#DFFDFF",
    fontSize: 11,
    fontWeight: "800",
  },
  ticketDescription: {
    color: "rgba(226,240,255,0.62)",
    fontSize: 12,
    lineHeight: 17,
  },
  ticketMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  ticketPrice: {
    color: "rgba(242,249,255,0.95)",
    fontSize: 14,
    fontWeight: "700",
  },
  ticketStatus: {
    color: "rgba(213,237,255,0.62)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  ticketAvailability: {
    color: "rgba(123,255,240,0.86)",
    fontSize: 11,
    fontWeight: "600",
  },
  ticketLimit: {
    color: "rgba(255,227,122,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  counter: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  counterBtnDisabled: {
    opacity: 0.44,
  },
  counterValue: {
    color: "#F4F9FF",
    fontSize: 14,
    fontWeight: "800",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,12,22,0.95)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerHint: {
    color: "rgba(221,238,255,0.66)",
    fontSize: 12,
    fontWeight: "600",
  },
  footerTotal: {
    color: "#F4F9FF",
    fontSize: 22,
    fontWeight: "800",
  },
  submitBtn: {
    minHeight: tokens.layout.touchTarget,
    borderRadius: 16,
    backgroundColor: "#EAF63A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: "#0A1018",
    fontSize: 16,
    fontWeight: "800",
  },
  submitBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
