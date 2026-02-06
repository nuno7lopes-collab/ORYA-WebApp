import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";
import { DiscoverDateFilter, DiscoverPriceFilter } from "../../features/discover/types";

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  distanceKm: number;
  onDistanceChange: (value: number) => void;
  city: string;
  onCityChange: (value: string) => void;
  onCityReset: () => void;
  date: DiscoverDateFilter;
  onDateChange: (value: DiscoverDateFilter) => void;
  price: DiscoverPriceFilter;
  onPriceChange: (value: DiscoverPriceFilter) => void;
};

const DISTANCE_OPTIONS = [5, 10, 25, 50];

const DATE_OPTIONS: Array<{ key: DiscoverDateFilter; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "weekend", label: "Fim‑de‑semana" },
  { key: "upcoming", label: "Próximos 7 dias" },
  { key: "all", label: "Qualquer data" },
];

const PRICE_OPTIONS: Array<{ key: DiscoverPriceFilter; label: string }> = [
  { key: "free", label: "Grátis" },
  { key: "paid", label: "Pagos" },
  { key: "soon", label: "Preço em breve" },
  { key: "all", label: "Todos" },
];

export function FiltersBottomSheet({
  visible,
  onClose,
  distanceKm,
  onDistanceChange,
  city,
  onCityChange,
  onCityReset,
  date,
  onDateChange,
  price,
  onPriceChange,
}: FilterSheetProps) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(320);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [opacity, translateY, visible]);

  const renderOption = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        active ? styles.optionActive : null,
        pressed ? styles.optionPressed : null,
      ]}
    >
      <Text style={active ? styles.optionTextActive : styles.optionText}>{label}</Text>
    </Pressable>
  );

  const distanceLabel = useMemo(() => `${distanceKm} km`, [distanceKm]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.overlayDim, { opacity }]} />
      </Pressable>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
        <View style={styles.sheetHandle} />
        <View style={styles.header}>
          <Text style={styles.title}>Filtros</Text>
          <Pressable onPress={onClose} style={styles.close} hitSlop={10}>
            <Ionicons name="close" size={18} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Distância</Text>
          <View style={styles.row}>
            {DISTANCE_OPTIONS.map((value) =>
              renderOption(
                `distance-${value}`,
                `${value}km`,
                distanceKm === value,
                () => onDistanceChange(value),
              ),
            )}
          </View>
          <Text style={styles.helper}>Perto de ti · {distanceLabel}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Cidade / Local</Text>
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.65)" />
            <TextInput
              value={city}
              onChangeText={onCityChange}
              placeholder="Lisboa, Porto, Faro..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />
            {city ? (
              <Pressable onPress={onCityReset} style={styles.clear}>
                <Ionicons name="close" size={12} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Data</Text>
          <View style={styles.row}>
            {DATE_OPTIONS.map((option) =>
              renderOption(`date-${option.key}`, option.label, date === option.key, () => onDateChange(option.key)),
            )}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Preço</Text>
          <View style={styles.row}>
            {PRICE_OPTIONS.map((option) =>
              renderOption(`price-${option.key}`, option.label, price === option.key, () => onPriceChange(option.key)),
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10, 14, 24, 0.92)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  block: {
    marginBottom: 16,
    gap: 10,
  },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: tokens.layout.touchTarget - 8,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(170, 220, 255, 0.6)",
  },
  optionPressed: {
    opacity: 0.9,
  },
  optionText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  optionTextActive: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  helper: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    minHeight: tokens.layout.touchTarget - 10,
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
});
