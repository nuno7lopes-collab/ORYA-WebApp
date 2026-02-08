import { useEffect, useMemo, useRef, useState } from "react";
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
import { useDiscoverStore } from "../../features/discover/store";
import {
  fetchGeoAutocomplete,
  fetchGeoDetails,
  type MobileGeoAutocompleteItem,
} from "../../features/discover/location";

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  distanceKm: number;
  onDistanceChange: (value: number) => void;
  date: DiscoverDateFilter;
  onDateChange: (value: DiscoverDateFilter) => void;
  price: DiscoverPriceFilter;
  onPriceChange: (value: DiscoverPriceFilter) => void;
  showDistance?: boolean;
  eventType?: "all" | "events" | "padel";
  onEventTypeChange?: (value: "all" | "events" | "padel") => void;
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

const EVENT_TYPE_OPTIONS: Array<{ key: "all" | "events" | "padel"; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "events", label: "Eventos" },
  { key: "padel", label: "Padel" },
];

export function FiltersBottomSheet({
  visible,
  onClose,
  distanceKm,
  onDistanceChange,
  date,
  onDateChange,
  price,
  onPriceChange,
  showDistance = true,
  eventType,
  onEventTypeChange,
}: FilterSheetProps) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const locationLabel = useDiscoverStore((state) => state.locationLabel);
  const locationSource = useDiscoverStore((state) => state.locationSource);
  const city = useDiscoverStore((state) => state.city);
  const setLocation = useDiscoverStore((state) => state.setLocation);
  const clearLocation = useDiscoverStore((state) => state.clearLocation);
  const [locationQuery, setLocationQuery] = useState(locationLabel || city || "");
  const [locationSuggestions, setLocationSuggestions] = useState<MobileGeoAutocompleteItem[]>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [locationDetailsLoading, setLocationDetailsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationSearchSeq = useRef(0);
  const locationDetailsSeq = useRef(0);

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(320);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [opacity, translateY, visible]);

  useEffect(() => {
    if (!visible) return;
    setLocationQuery(locationLabel || city || "");
    setLocationSearchError(null);
  }, [visible, locationLabel, city]);

  useEffect(() => {
    const query = locationQuery.trim();
    if (!showSuggestions) return;
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError(null);
      return;
    }
    if (locationSearchTimeout.current) {
      clearTimeout(locationSearchTimeout.current);
    }
    const seq = ++locationSearchSeq.current;
    setLocationSearchError(null);
    locationSearchTimeout.current = setTimeout(async () => {
      setLocationSearchLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        if (locationSearchSeq.current === seq) {
          setLocationSuggestions(items);
        }
      } catch (err) {
        if (locationSearchSeq.current === seq) {
          setLocationSuggestions([]);
          setLocationSearchError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
        }
      } finally {
        if (locationSearchSeq.current === seq) {
          setLocationSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      if (locationSearchTimeout.current) {
        clearTimeout(locationSearchTimeout.current);
      }
    };
  }, [locationQuery, showSuggestions]);

  const pickString = (...values: Array<unknown>) => {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
    return null;
  };

  const pickCanonicalField = (canonical: Record<string, unknown> | null | undefined, keys: string[]) => {
    if (!canonical) return null;
    return pickString(...keys.map((key) => canonical[key]));
  };

  const handleSelectSuggestion = async (item: MobileGeoAutocompleteItem) => {
    setLocationDetailsLoading(true);
    setLocationSearchError(null);
    setShowSuggestions(false);
    setLocationQuery(item.label);
    const seq = ++locationDetailsSeq.current;
    try {
      const details = await fetchGeoDetails(item.providerId, {
        sourceProvider: item.sourceProvider ?? null,
        lat: item.lat,
        lng: item.lng,
      });
      if (locationDetailsSeq.current !== seq) return;
      const canonical = (details?.canonical as Record<string, unknown> | null) ?? null;
      const resolvedCity = pickString(
        details?.city,
        pickCanonicalField(canonical, ["city", "locality", "addressLine2", "region", "state"]),
        item.city,
      );
      const label = details?.formattedAddress || item.label;
      setLocation({
        city: resolvedCity ?? "",
        label,
        addressId: details?.addressId ?? null,
        lat: typeof details?.lat === "number" ? details?.lat : item.lat,
        lng: typeof details?.lng === "number" ? details?.lng : item.lng,
        source: "APPLE_MAPS",
      });
      setLocationQuery(label);
    } catch (err) {
      if (locationDetailsSeq.current === seq) {
        setLocationSearchError("Não foi possível validar esta morada.");
      }
    } finally {
      if (locationDetailsSeq.current === seq) {
        setLocationDetailsLoading(false);
      }
    }
  };

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
  const showEventType = typeof eventType === "string" && typeof onEventTypeChange === "function";

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

        {showDistance ? (
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
        ) : null}

        <View style={styles.block}>
          <View style={styles.locationHeader}>
            <Text style={styles.label}>Localização</Text>
            {locationSource !== "NONE" ? (
              <Text style={styles.locationSource}>
                {locationSource === "APPLE_MAPS" ? "Apple" : "IP"}
              </Text>
            ) : null}
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.65)" />
            <TextInput
              value={locationQuery}
              onChangeText={(value) => {
                setLocationQuery(value);
                setShowSuggestions(true);
                setLocationSearchError(null);
              }}
              placeholder="Procura uma localizacao"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            />
            {locationQuery ? (
              <Pressable
                onPress={() => {
                  setLocationQuery("");
                  setLocationSuggestions([]);
                  setLocationSearchError(null);
                  clearLocation();
                }}
                style={styles.clear}
              >
                <Ionicons name="close" size={12} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : null}
          </View>
          {locationDetailsLoading ? (
            <Text style={styles.helper}>A validar morada...</Text>
          ) : locationLabel ? (
            <Text style={styles.helper}>{locationLabel}</Text>
          ) : city ? (
            <Text style={styles.helper}>Localização: {city}</Text>
          ) : null}
          {locationSearchError ? <Text style={styles.errorText}>{locationSearchError}</Text> : null}
          {showSuggestions ? (
            <View style={styles.suggestions}>
              {locationSearchLoading ? (
                <Text style={styles.suggestionMuted}>A procurar...</Text>
              ) : locationSuggestions.length === 0 ? (
                <Text style={styles.suggestionMuted}>Sem resultados</Text>
              ) : (
                locationSuggestions.map((item) => (
                  <Pressable
                    key={item.providerId}
                    onPress={() => handleSelectSuggestion(item)}
                    style={styles.suggestionItem}
                  >
                    <Text style={styles.suggestionTitle}>{item.label}</Text>
                    <Text style={styles.suggestionSubtitle}>
                      {item.city || "—"}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Data</Text>
          <View style={styles.row}>
            {DATE_OPTIONS.map((option) =>
              renderOption(`date-${option.key}`, option.label, date === option.key, () => onDateChange(option.key)),
            )}
          </View>
        </View>

        {showEventType ? (
          <View style={styles.block}>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.row}>
              {EVENT_TYPE_OPTIONS.map((option) =>
                renderOption(
                  `event-type-${option.key}`,
                  option.label,
                  eventType === option.key,
                  () => onEventTypeChange(option.key),
                ),
              )}
            </View>
          </View>
        ) : null}

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
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationSource: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    letterSpacing: 1.2,
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
  errorText: {
    color: "rgba(255,180,180,0.9)",
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
  suggestions: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(6, 8, 14, 0.9)",
    paddingVertical: 6,
    maxHeight: 160,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  suggestionTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  suggestionSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginTop: 2,
  },
  suggestionMuted: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
