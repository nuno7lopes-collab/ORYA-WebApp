import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "../icons/Ionicons";

export type MapTemplateFilter = "all" | "PARTY" | "TALK" | "PADEL" | "VOLUNTEERING" | "OTHER";

type MapFiltersBarProps = {
  priceMin: number;
  priceMax: number | null;
  onPriceChange: (min: number, max: number | null) => void;
  templateType: MapTemplateFilter;
  onTemplateTypeChange: (value: MapTemplateFilter) => void;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
  onClear: () => void;
  compact?: boolean;
};

const PRICE_MIN = 0;
const PRICE_MAX = 200;
const PRICE_STEP = 1;
const SLIDER_THUMB_SIZE = 22;

const TEMPLATE_OPTIONS: Array<{ key: MapTemplateFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "PARTY", label: "Festa" },
  { key: "TALK", label: "Palestra" },
  { key: "PADEL", label: "Padel" },
  { key: "VOLUNTEERING", label: "Voluntariado" },
  { key: "OTHER", label: "Geral" },
];

const RANGE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  month: "long",
  year: "numeric",
});

const WEEKDAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const roundToStep = (value: number, step: number) => Math.round(value / step) * step;

const formatPriceLabel = (value: number | null, isMax = false) => {
  if (isMax && value == null) return "Sem limite";
  if (!isMax && value === 0) return "Gratuito";
  if (value == null) return "Sem limite";
  return `€${Math.round(value)}`;
};

const formatPriceLabelShort = (value: number | null, isMax = false) => {
  if (isMax && value == null) return "∞";
  if (!isMax && value === 0) return "Grátis";
  if (value == null) return "∞";
  return `€${Math.round(value)}`;
};

const formatRangeLabel = (start: Date | null, end: Date | null) => {
  if (start && end) return `${RANGE_DATE_FORMATTER.format(start)}–${RANGE_DATE_FORMATTER.format(end)}`;
  if (start) return `Desde ${RANGE_DATE_FORMATTER.format(start)}`;
  if (end) return `Até ${RANGE_DATE_FORMATTER.format(end)}`;
  return "Qualquer data";
};

const formatRangeLabelShort = (start: Date | null, end: Date | null) => {
  if (start && end) return `${RANGE_DATE_FORMATTER.format(start)}–${RANGE_DATE_FORMATTER.format(end)}`;
  if (start) return `Desde ${RANGE_DATE_FORMATTER.format(start)}`;
  if (end) return `Até ${RANGE_DATE_FORMATTER.format(end)}`;
  return "Qualquer";
};

type RangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (minValue: number, maxValue: number) => void;
};

const RangeSlider = ({ min, max, step = 1, valueMin, valueMax, onChange }: RangeSliderProps) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const usableWidth = Math.max(trackWidth - SLIDER_THUMB_SIZE, 1);
  const valueMinRef = useRef(valueMin);
  const valueMaxRef = useRef(valueMax);
  const trackRef = useRef<View | null>(null);
  const trackLeft = useRef(0);

  useEffect(() => {
    valueMinRef.current = valueMin;
    valueMaxRef.current = valueMax;
  }, [valueMin, valueMax]);

  const valueToX = useCallback(
    (value: number) => {
      if (!trackWidth) return 0;
      return ((value - min) / (max - min)) * usableWidth;
    },
    [max, min, trackWidth, usableWidth],
  );

  const updateTrackLeft = useCallback(() => {
    if (!trackRef.current) return;
    trackRef.current.measureInWindow((x) => {
      trackLeft.current = x;
    });
  }, []);

  const positionToValue = useCallback(
    (pageX: number) => {
      if (!trackWidth) return min;
      const x = clamp(pageX - trackLeft.current - SLIDER_THUMB_SIZE / 2, 0, usableWidth);
      const ratio = clamp(x / usableWidth, 0, 1);
      const raw = min + ratio * (max - min);
      return clamp(raw, min, max);
    },
    [max, min, trackWidth, usableWidth],
  );

  const handleMoveMin = useCallback(
    (pageX: number) => {
      if (!trackWidth) return;
      const raw = positionToValue(pageX);
      const clamped = Math.min(raw, valueMaxRef.current);
      onChange(clamped, valueMaxRef.current);
    },
    [onChange, positionToValue, trackWidth],
  );

  const handleMoveMax = useCallback(
    (pageX: number) => {
      if (!trackWidth) return;
      const raw = positionToValue(pageX);
      const clamped = Math.max(raw, valueMinRef.current);
      onChange(valueMinRef.current, clamped);
    },
    [onChange, positionToValue, trackWidth],
  );

  const minPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          updateTrackLeft();
        },
        onPanResponderMove: (_, gesture) => handleMoveMin(gesture.moveX),
      }),
    [handleMoveMin, updateTrackLeft],
  );

  const maxPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          updateTrackLeft();
        },
        onPanResponderMove: (_, gesture) => handleMoveMax(gesture.moveX),
      }),
    [handleMoveMax, updateTrackLeft],
  );

  const minX = valueToX(valueMin);
  const maxX = valueToX(valueMax);
  const rangeLeft = minX + SLIDER_THUMB_SIZE / 2;
  const rangeRight = maxX + SLIDER_THUMB_SIZE / 2;

  return (
    <View style={styles.sliderWrapper}>
      <View
        ref={trackRef}
        style={styles.sliderTrack}
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
          requestAnimationFrame(updateTrackLeft);
        }}
      >
        <View
          style={[
            styles.sliderRange,
            {
              left: rangeLeft,
              width: Math.max(0, rangeRight - rangeLeft),
            },
          ]}
        />
        <View
          style={[styles.sliderThumb, { left: minX }]}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          {...minPan.panHandlers}
        >
          <View style={styles.sliderThumbInner} />
        </View>
        <View
          style={[styles.sliderThumb, { left: maxX }]}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          {...maxPan.panHandlers}
        >
          <View style={styles.sliderThumbInner} />
        </View>
      </View>
    </View>
  );
};

const FilterModal = ({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) => (
  <Modal transparent visible={visible} animationType="fade">
    <View style={styles.modalRoot}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.modalCard}>
        <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </View>
  </Modal>
);

const buildMonthGrid = (currentMonth: Date) => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const start = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekday = (start.getDay() + 6) % 7; // Monday = 0
  const cells: Array<Date | null> = [];
  for (let i = 0; i < weekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  return cells;
};

const isSameDay = (a: Date | null, b: Date | null) => {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const isBetween = (value: Date, start: Date | null, end: Date | null) => {
  if (!start || !end) return false;
  const time = new Date(value).setHours(0, 0, 0, 0);
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(0, 0, 0, 0);
  return time > startTime && time < endTime;
};

const isPastDay = (value: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day < today;
};

export function MapFiltersBar({
  priceMin,
  priceMax,
  onPriceChange,
  templateType,
  onTemplateTypeChange,
  rangeStart,
  rangeEnd,
  onRangeChange,
  onClear,
  compact = false,
}: MapFiltersBarProps) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const [draftMin, setDraftMin] = useState(priceMin);
  const [draftMax, setDraftMax] = useState(priceMax ?? PRICE_MAX);
  const [maxUnlimited, setMaxUnlimited] = useState(priceMax == null);

  const [draftStart, setDraftStart] = useState<Date | null>(rangeStart);
  const [draftEnd, setDraftEnd] = useState<Date | null>(rangeEnd);
  const [currentMonth, setCurrentMonth] = useState<Date>(rangeStart ?? new Date());

  const typeLabel = useMemo(() => {
    const found = TEMPLATE_OPTIONS.find((option) => option.key === templateType);
    return found?.label ?? "Todos";
  }, [templateType]);

  useEffect(() => {
    if (!priceOpen) return;
    setDraftMin(priceMin);
    setDraftMax(priceMax ?? PRICE_MAX);
    setMaxUnlimited(priceMax == null);
  }, [priceOpen, priceMax, priceMin]);

  useEffect(() => {
    if (!dateOpen) return;
    setDraftStart(rangeStart);
    setDraftEnd(rangeEnd);
    setCurrentMonth(rangeStart ?? rangeEnd ?? new Date());
  }, [dateOpen, rangeEnd, rangeStart]);

  const priceLabel = useMemo(() => {
    const formatter = compact ? formatPriceLabelShort : formatPriceLabel;
    const minLabel = formatter(priceMin, false);
    const maxLabel = formatter(priceMax, true);
    return `${minLabel} – ${maxLabel}`;
  }, [compact, priceMax, priceMin]);

  const dateLabel = useMemo(
    () => (compact ? formatRangeLabelShort(rangeStart, rangeEnd) : formatRangeLabel(rangeStart, rangeEnd)),
    [compact, rangeEnd, rangeStart],
  );

  const handlePriceChange = (minValue: number, maxValue: number) => {
    setDraftMin(minValue);
    setDraftMax(maxValue);
    if (maxValue >= PRICE_MAX) {
      setMaxUnlimited(true);
      return;
    }
    if (maxUnlimited && maxValue < PRICE_MAX) {
      setMaxUnlimited(false);
    }
  };

  const applyPrice = () => {
    const normalizedMin = clamp(roundToStep(draftMin, PRICE_STEP), PRICE_MIN, PRICE_MAX);
    const normalizedMax =
      maxUnlimited || draftMax >= PRICE_MAX
        ? null
        : clamp(roundToStep(draftMax, PRICE_STEP), PRICE_MIN, PRICE_MAX);
    onPriceChange(normalizedMin, normalizedMax);
    setPriceOpen(false);
  };

  const applyDateRange = () => {
    onRangeChange(draftStart, draftEnd);
    setDateOpen(false);
  };

  const clearDateRange = () => {
    setDraftStart(null);
    setDraftEnd(null);
  };

  const selectDay = (value: Date) => {
    if (isPastDay(value)) return;
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(value);
      setDraftEnd(null);
      return;
    }
    if (draftStart && !draftEnd) {
      if (value < draftStart) {
        setDraftStart(value);
      } else {
        setDraftEnd(value);
      }
    }
  };

  const monthCells = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const barWrapperStyle = compact ? [styles.barWrapper, styles.barWrapperCompact] : styles.barWrapper;
  const barScrollStyle = compact
    ? [styles.barScrollContent, styles.barScrollContentCompact]
    : styles.barScrollContent;
  const chipStyle = compact ? [styles.chip, styles.chipCompact] : styles.chip;
  const chipLabelStyle = compact ? [styles.chipLabel, styles.chipLabelCompact] : styles.chipLabel;
  const chipValueStyle = compact ? [styles.chipValue, styles.chipValueCompact] : styles.chipValue;
  const clearChipStyle = compact ? [styles.chip, styles.chipCompact, styles.clearChip] : [styles.chip, styles.clearChip];

  return (
    <>
      <View style={barWrapperStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={barScrollStyle}
        >
          <Pressable onPress={() => setPriceOpen(true)} style={chipStyle}>
            <Text style={chipLabelStyle}>Preço</Text>
            <Text style={chipValueStyle} numberOfLines={2}>
              {priceLabel}
            </Text>
          </Pressable>

          <Pressable onPress={() => setTypeOpen(true)} style={chipStyle}>
            <Text style={chipLabelStyle}>Tipo</Text>
            <Text style={chipValueStyle} numberOfLines={2}>
              {typeLabel}
            </Text>
          </Pressable>

          <Pressable onPress={() => setDateOpen(true)} style={chipStyle}>
            <Text style={chipLabelStyle}>Data</Text>
            <Text style={chipValueStyle} numberOfLines={2}>
              {dateLabel}
            </Text>
          </Pressable>

          <Pressable onPress={onClear} style={clearChipStyle}>
            <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.clearChipText}>Limpar</Text>
          </Pressable>
        </ScrollView>
      </View>

      <FilterModal visible={priceOpen} onClose={() => setPriceOpen(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Preço</Text>
          <View style={styles.priceLabelsRow}>
            <Text style={styles.priceLabel}>{formatPriceLabel(draftMin, false)}</Text>
            <Text style={styles.priceLabel}>{formatPriceLabel(maxUnlimited ? null : draftMax, true)}</Text>
          </View>
          <RangeSlider
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            valueMin={draftMin}
            valueMax={draftMax}
            onChange={handlePriceChange}
          />
          <View style={styles.modalFooter}>
            <Pressable onPress={() => setPriceOpen(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={applyPrice} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Aplicar</Text>
            </Pressable>
          </View>
        </View>
      </FilterModal>

      <FilterModal visible={typeOpen} onClose={() => setTypeOpen(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Tipo de evento</Text>
          <View style={styles.typeList}>
            {TEMPLATE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  onTemplateTypeChange(option.key);
                  setTypeOpen(false);
                }}
                style={[styles.typeRow, templateType === option.key ? styles.typeRowActive : null]}
              >
                <Text style={templateType === option.key ? styles.typeRowTextActive : styles.typeRowText}>
                  {option.label}
                </Text>
                {templateType === option.key ? (
                  <Ionicons name="checkmark" size={16} color="#0b101a" />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </FilterModal>

      <FilterModal visible={dateOpen} onClose={() => setDateOpen(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Datas</Text>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              style={styles.calendarNav}
            >
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <Text style={styles.calendarTitle}>{MONTH_FORMATTER.format(currentMonth)}</Text>
            <Pressable
              onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              style={styles.calendarNav}
            >
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekLabel}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {monthCells.map((cell, index) => {
              if (!cell) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }
              const isStart = isSameDay(cell, draftStart);
              const isEnd = isSameDay(cell, draftEnd);
              const inRange = isBetween(cell, draftStart, draftEnd);
              const isPast = isPastDay(cell);
              return (
                <Pressable
                  key={cell.toISOString()}
                  onPress={() => selectDay(cell)}
                  disabled={isPast}
                  style={[
                    styles.dayCell,
                    isStart || isEnd ? styles.dayCellSelected : null,
                    inRange ? styles.dayCellInRange : null,
                    isPast ? styles.dayCellDisabled : null,
                  ]}
                >
                  <Text
                    style={
                      isPast
                        ? styles.dayCellTextDisabled
                        : isStart || isEnd
                        ? styles.dayCellTextSelected
                        : inRange
                          ? styles.dayCellTextInRange
                          : styles.dayCellText
                    }
                  >
                    {cell.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.modalFooter}>
            <Pressable onPress={clearDateRange} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Limpar</Text>
            </Pressable>
            <Pressable onPress={applyDateRange} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Aplicar</Text>
            </Pressable>
          </View>
        </View>
      </FilterModal>
    </>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    paddingVertical: 6,
  },
  barWrapperCompact: {
    paddingVertical: 0,
  },
  barScrollContent: {
    gap: 10,
    paddingHorizontal: 2,
  },
  barScrollContentCompact: {
    gap: 8,
  },
  chip: {
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(10,14,24,0.5)",
    alignItems: "flex-start",
    gap: 2,
  },
  chipCompact: {
    minWidth: 76,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  chipLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.4,
  },
  chipValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  chipValueCompact: {
    fontSize: 10,
  },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderColor: "rgba(255,255,255,0.18)",
  },
  clearChipText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(10, 14, 24, 0.9)",
  },
  modalContent: {
    padding: 16,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  priceLabelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  priceLabel: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: "600",
  },
  sliderWrapper: {
    paddingVertical: 8,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
  },
  sliderRange: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(110, 210, 255, 0.9)",
  },
  sliderThumb: {
    position: "absolute",
    width: SLIDER_THUMB_SIZE,
    height: SLIDER_THUMB_SIZE,
    borderRadius: SLIDER_THUMB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    top: -9,
  },
  sliderThumbInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(11,16,26,0.9)",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 18,
  },
  primaryButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(110, 210, 255, 0.9)",
  },
  primaryButtonLabel: {
    color: "#0b101a",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonLabel: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  typeList: {
    gap: 8,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  typeRowActive: {
    backgroundColor: "rgba(110, 210, 255, 0.9)",
    borderColor: "rgba(110, 210, 255, 0.9)",
  },
  typeRowText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "600",
  },
  typeRowTextActive: {
    color: "#0b101a",
    fontSize: 13,
    fontWeight: "700",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  calendarNav: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  weekLabel: {
    width: "14.28%",
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  dayCellSelected: {
    backgroundColor: "rgba(110, 210, 255, 0.95)",
  },
  dayCellInRange: {
    backgroundColor: "rgba(110, 210, 255, 0.25)",
  },
  dayCellDisabled: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dayCellText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  dayCellTextDisabled: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 12,
    fontWeight: "600",
  },
  dayCellTextSelected: {
    color: "#0b101a",
    fontSize: 12,
    fontWeight: "700",
  },
  dayCellTextInRange: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
});
