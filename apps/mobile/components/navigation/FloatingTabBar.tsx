import { Ionicons } from "../icons/Ionicons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { TouchData } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TabKey } from "./tabOrder";

const LEFT_TABS: Array<{
  key: string;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "agora", active: "flash", inactive: "flash-outline" },
  { key: "network", active: "people", inactive: "people-outline" },
  { key: "messages", active: "chatbubble-ellipses", inactive: "chatbubble-ellipses-outline" },
  { key: "profile", active: "person-circle", inactive: "person-circle-outline" },
];

const RIGHT_TAB = { key: "index", icon: "search" as keyof typeof Ionicons.glyphMap };
const TAB_LABELS: Record<string, string> = {
  agora: "Agora",
  messages: "Mensagens",
  network: "Rede",
  profile: "Perfil",
  index: "Descobrir",
};

export const TAB_BAR_HEIGHT = 50;
const RIGHT_PILL_SIZE = 44;
const ICON_SIZE = 22;
const ICON_NUDGE_Y = -0.5;
const ACTIVE_ICON_COLOR = "rgba(255,255,255,1)";
const INACTIVE_ICON_COLOR = "rgba(235,242,255,0.78)";
const TAB_SLOT_SIZE = 44;
const SLOTS_SIDE_PADDING = 18;
const BUBBLE_EXTRA = 30;

const PILL_GAP = 6;
const WRAPPER_PADDING = 12;
const TRACK_PADDING_X = 0;
const TRACK_PADDING_Y = 0;
const BUBBLE_GAP = 2;
const USE_REALTIME_BLUR = Platform.OS === "ios";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
type FloatingTabBarProps = {
  activeKey: TabKey;
  onSelect: (key: TabKey) => void;
  pagerProgress?: Animated.Value | Animated.AnimatedInterpolation<number>;
};

function GlassLayer({
  tint,
  intensity,
  fallbackColor,
  colors,
}: {
  tint: "light" | "dark";
  intensity: number;
  fallbackColor: string;
  colors: [string, string] | [string, string, string];
}) {
  return (
    <>
      {USE_REALTIME_BLUR ? (
        <BlurView tint={tint} intensity={intensity} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackColor }]} />
      )}
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

export function FloatingTabBar({ activeKey, onSelect, pagerProgress }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const safeBottom = Math.max(insets.bottom, 8) + 8;

  const bubbleX = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const trackRef = useRef<View>(null);
  const trackPageXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const latestTouchRef = useRef<TouchData | null>(null);
  const draggingRef = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const maxRowWidth = Math.max(windowWidth - WRAPPER_PADDING * 2, 0);
  const rightPillWidth = RIGHT_PILL_SIZE;
  const rowWidth = maxRowWidth;
  const [trackWidth, setTrackWidth] = useState(0);
  const innerTrackWidth = trackWidth || 0;
  const slotWidthFallback = TAB_SLOT_SIZE;
  const [slotLayouts, setSlotLayouts] = useState<Array<{ x: number; width: number } | null>>(
    () => LEFT_TABS.map(() => null),
  );
  const hasSlotMetrics = slotLayouts.every(Boolean);
  const slotCenters = useMemo(() => {
    if (!hasSlotMetrics) return null;
    return slotLayouts.map((slot) => (slot ? slot.x + slot.width / 2 : 0));
  }, [hasSlotMetrics, slotLayouts]);
  const slotWidth = hasSlotMetrics ? slotLayouts[0]!.width : slotWidthFallback;
  const bubbleWidth = slotWidth + BUBBLE_EXTRA;

  const activeLeftIndex = LEFT_TABS.findIndex((tab) => tab.key === activeKey);
  const rightActive = activeKey === RIGHT_TAB.key;

  const handleSlotLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setSlotLayouts((prev) => {
      const current = prev[index];
      if (current && current.x === x && current.width === width) {
        return prev;
      }
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  }, []);

  const setBubbleToIndex = useCallback(
    (index: number, animated = true) => {
      if (!slotWidth || !bubbleWidth) return;
      const center = slotCenters
        ? slotCenters[index]
        : SLOTS_SIDE_PADDING + slotWidthFallback * (index + 0.5);
      const targetX = center - bubbleWidth / 2;
      if (animated) {
        Animated.spring(bubbleX, {
          toValue: targetX,
          useNativeDriver: true,
          damping: 20,
          stiffness: 240,
          mass: 0.7,
          overshootClamping: false,
          restDisplacementThreshold: 0.5,
          restSpeedThreshold: 0.5,
        }).start();
      } else {
        bubbleX.setValue(targetX);
      }
    },
    [bubbleWidth, bubbleX, slotCenters, slotWidth, slotWidthFallback],
  );

  useEffect(() => {
    if (!slotWidth) return;
    if (activeLeftIndex >= 0) {
      setBubbleToIndex(activeLeftIndex, false);
      Animated.timing(bubbleOpacity, {
        toValue: 0.28,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(bubbleOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [activeLeftIndex, bubbleOpacity, setBubbleToIndex, slotWidth]);

  const bubbleFollowX = useMemo(() => {
    if (!pagerProgress) return bubbleX;
    const fallbackCenters = LEFT_TABS.map((_, index) => SLOTS_SIDE_PADDING + slotWidthFallback * (index + 0.5));
    const centers = slotCenters ?? fallbackCenters;
    const outputRange = centers.map((center) => center - bubbleWidth / 2);
    const inputRange = centers.map((_, index) => index);
    return pagerProgress.interpolate({
      inputRange,
      outputRange,
      extrapolate: "clamp",
    });
  }, [bubbleWidth, bubbleX, pagerProgress, slotCenters, slotWidthFallback]);

  const bubbleFollowOpacity = useMemo(() => {
    if (!pagerProgress) return bubbleOpacity;
    const lastLeftIndex = Math.max(LEFT_TABS.length - 1, 0);
    const fadeStart = Math.max(0, lastLeftIndex - 0.4);
    const fadeMid = lastLeftIndex + 0.15;
    const fadeEnd = lastLeftIndex + 0.55;
    return Animated.multiply(
      bubbleOpacity,
      pagerProgress.interpolate({
        inputRange: [0, fadeStart, fadeMid, fadeEnd],
        outputRange: [1, 1, 0.4, 0],
        extrapolate: "clamp",
      }),
    );
  }, [bubbleOpacity, pagerProgress]);

  const rightBubbleOpacity = useMemo(() => {
    if (!pagerProgress) return rightActive ? 1 : 0;
    const lastLeftIndex = Math.max(LEFT_TABS.length - 1, 0);
    const rightIndex = lastLeftIndex + 1;
    const showStart = Math.max(0, lastLeftIndex - 0.3);
    const showMid = lastLeftIndex + 0.1;
    const showNear = rightIndex - 0.4;
    return pagerProgress.interpolate({
      inputRange: [showStart, showMid, showNear, rightIndex],
      outputRange: [0, 0.2, 0.75, 1],
      extrapolate: "clamp",
    });
  }, [pagerProgress, rightActive]);

  const rightBubbleScale = useMemo(() => {
    if (!pagerProgress) return 1;
    const lastLeftIndex = Math.max(LEFT_TABS.length - 1, 0);
    const rightIndex = lastLeftIndex + 1;
    const scaleStart = Math.max(0, lastLeftIndex - 0.3);
    const scaleMid = rightIndex - 0.6;
    return pagerProgress.interpolate({
      inputRange: [scaleStart, scaleMid, rightIndex],
      outputRange: [0.92, 1, 1.02],
      extrapolate: "clamp",
    });
  }, [pagerProgress]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      trackRef.current?.measureInWindow((x) => {
        trackPageXRef.current = x;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [windowWidth, safeBottom]);

  const animatePress = useCallback(
    (pressed: boolean) => {
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 260,
          mass: 0.6,
          overshootClamping: false,
          restDisplacementThreshold: 0.4,
          restSpeedThreshold: 0.4,
        }),
        Animated.timing(bubbleOpacity, {
          toValue: pressed ? 0.85 : 0.28,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [bubbleOpacity, bubbleScale],
  );

  const updateDragIndex = useCallback(
    (index: number) => {
      if (dragIndexRef.current !== index) {
        dragIndexRef.current = index;
        setDragIndex(index);
      }
    },
    [],
  );

  const updateBubbleFromLocation = useCallback(
    (locationX: number) => {
      if (!slotWidth || !bubbleWidth || !innerTrackWidth) return;
      const minX = slotCenters ? slotCenters[0] - bubbleWidth / 2 : 0;
      const maxX = slotCenters
        ? slotCenters[LEFT_TABS.length - 1] - bubbleWidth / 2
        : innerTrackWidth - bubbleWidth;
      const nextX = clamp(locationX - bubbleWidth / 2, minX, maxX);
      bubbleX.setValue(nextX);

      const center = nextX + bubbleWidth / 2;
      let nextIndex = 0;
      if (slotCenters) {
        let closestDistance = Math.abs(center - slotCenters[0]);
        for (let i = 1; i < slotCenters.length; i += 1) {
          const distance = Math.abs(center - slotCenters[i]);
          if (distance < closestDistance) {
            closestDistance = distance;
            nextIndex = i;
          }
        }
      } else {
        const rawIndex = Math.round((center - SLOTS_SIDE_PADDING) / slotWidthFallback - 0.5);
        nextIndex = clamp(rawIndex, 0, LEFT_TABS.length - 1);
      }
      updateDragIndex(nextIndex);
    },
    [bubbleWidth, bubbleX, innerTrackWidth, slotCenters, slotWidth, slotWidthFallback, updateDragIndex],
  );

  const updateBubbleFromTouch = useCallback(
    (touch: TouchData) => {
      const localX =
        Number.isFinite(touch.absoluteX) && trackPageXRef.current
          ? touch.absoluteX - trackPageXRef.current
          : touch.x;
      if (Number.isFinite(localX)) {
        updateBubbleFromLocation(localX);
      }
    },
    [updateBubbleFromLocation],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minPointers(1)
        .maxPointers(2)
        .minDistance(6)
        .failOffsetY([-12, 12])
        .shouldCancelWhenOutside(false)
        .simultaneousWithExternalGesture(Gesture.Native())
        .onTouchesDown((event) => {
          if (pointerIdRef.current == null && event.allTouches.length) {
            pointerIdRef.current = event.allTouches[0].id;
            latestTouchRef.current = event.allTouches[0];
          }
        })
        .onTouchesMove((event) => {
          const pointerId = pointerIdRef.current;
          if (pointerId == null) return;
          const touch = event.allTouches.find((candidate) => candidate.id === pointerId);
          if (!touch) return;
          latestTouchRef.current = touch;
          if (!draggingRef.current) return;
          updateBubbleFromTouch(touch);
        })
        .onTouchesUp((event) => {
          const pointerId = pointerIdRef.current;
          if (pointerId == null) return;
          if (event.changedTouches.some((touch) => touch.id === pointerId)) {
            pointerIdRef.current = null;
            latestTouchRef.current = null;
          }
        })
        .onTouchesCancelled(() => {
          pointerIdRef.current = null;
          latestTouchRef.current = null;
        })
        .onStart(() => {
          draggingRef.current = true;
          animatePress(true);
          if (latestTouchRef.current) {
            updateBubbleFromTouch(latestTouchRef.current);
          }
        })
        .onEnd(() => {
          const targetIndex = dragIndexRef.current ?? activeLeftIndex;
          if (targetIndex != null && targetIndex >= 0) {
            const routeKey = LEFT_TABS[targetIndex]?.key;
            if (routeKey && routeKey !== activeKey) {
              onSelect(routeKey as TabKey);
            } else if (routeKey) {
              setBubbleToIndex(targetIndex);
            }
          }
        })
        .onFinalize(() => {
          draggingRef.current = false;
          animatePress(false);
          pointerIdRef.current = null;
          latestTouchRef.current = null;
          dragIndexRef.current = null;
          setDragIndex(null);
        }),
    [activeLeftIndex, activeKey, animatePress, onSelect, setBubbleToIndex, updateBubbleFromTouch],
  );

  const visualLeftIndex = dragIndex ?? (activeLeftIndex >= 0 ? activeLeftIndex : null);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: safeBottom }]}>
      <View style={[styles.row, { width: rowWidth }]}>
        <View style={[styles.leftPill, { flex: 1 }]}>
          <View pointerEvents="none" style={styles.pillFillWrap}>
            <GlassLayer
              tint="dark"
              intensity={50}
              fallbackColor="rgba(10, 15, 24, 0.88)"
              colors={["rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"]}
            />
          </View>
          <View style={styles.pillBorder} pointerEvents="none" />

          <View
            ref={trackRef}
            style={styles.track}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              setTrackWidth((prev) => (prev === width ? prev : width));
              trackRef.current?.measureInWindow((x) => {
                trackPageXRef.current = x;
              });
            }}
          >
            <GestureDetector gesture={panGesture}>
              <View
                style={[
                  styles.trackInner,
                  innerTrackWidth ? { width: innerTrackWidth } : null,
                ]}
              >
                {slotWidth > 0 && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.bubbleTrack,
                      {
                        opacity: bubbleFollowOpacity,
                        width: bubbleWidth,
                        transform: [{ translateX: dragIndex != null ? bubbleX : bubbleFollowX }],
                      },
                    ]}
                  >
                    <Animated.View style={[styles.bubble, { transform: [{ scale: bubbleScale }] }]}>
                      <View pointerEvents="none" style={styles.bubbleFillWrap}>
                        <GlassLayer
                          tint="light"
                          intensity={16}
                          fallbackColor="rgba(255,255,255,0.18)"
                          colors={["rgba(255,255,255,0.36)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]}
                        />
                      </View>
                    </Animated.View>
                  </Animated.View>
                )}

                <View style={styles.slotsRow}>
                  {LEFT_TABS.map((tab, index) => {
                    const isActive = visualLeftIndex === index && !rightActive;
                    const iconName = isActive ? tab.active : tab.inactive;
                    return (
                      <Pressable
                        key={tab.key}
                        accessibilityRole="tab"
                        accessibilityLabel={TAB_LABELS[tab.key] ?? tab.key}
                        accessibilityHint={`Abrir ${TAB_LABELS[tab.key] ?? tab.key}`}
                        accessibilityState={isActive ? { selected: true } : {}}
                        hitSlop={10}
                        onLayout={(event) => handleSlotLayout(index, event)}
                        style={({ pressed }) => [styles.tabSlot, pressed && styles.tabPressed]}
                        onPress={() => {
                          if (tab.key !== activeKey) {
                            onSelect(tab.key as TabKey);
                          }
                          if (slotWidth) setBubbleToIndex(index);
                        }}
                        onPressIn={() => {
                          if (draggingRef.current) return;
                          animatePress(true);
                        }}
                        onPressOut={() => {
                          if (draggingRef.current) return;
                          animatePress(false);
                        }}
                      >
                        <View style={styles.iconBox}>
                          <Ionicons
                            name={iconName}
                            size={ICON_SIZE}
                            color={isActive ? ACTIVE_ICON_COLOR : INACTIVE_ICON_COLOR}
                            style={styles.iconGlyph}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </GestureDetector>
          </View>
        </View>

        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={TAB_LABELS[RIGHT_TAB.key]}
          accessibilityHint={`Abrir ${TAB_LABELS[RIGHT_TAB.key]}`}
          accessibilityState={rightActive ? { selected: true } : {}}
          style={({ pressed }) => [styles.rightPill, pressed && styles.tabPressed]}
          hitSlop={10}
          onPress={() => {
            onSelect(RIGHT_TAB.key as TabKey);
          }}
        >
          <View style={styles.rightCircle}>
            <View pointerEvents="none" style={styles.rightFillWrap}>
              <GlassLayer
                tint="dark"
                intensity={50}
                fallbackColor="rgba(10, 15, 24, 0.88)"
                colors={["rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"]}
              />
            </View>
            <View style={styles.rightBorder} pointerEvents="none" />
            {rightActive || pagerProgress ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.rightBubble,
                  {
                    opacity: rightBubbleOpacity as any,
                    transform: [{ scale: rightBubbleScale as any }],
                  },
                ]}
              >
                <View pointerEvents="none" style={styles.bubbleFillWrap}>
                  <GlassLayer
                    tint="light"
                    intensity={16}
                    fallbackColor="rgba(255,255,255,0.18)"
                    colors={["rgba(255,255,255,0.36)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]}
                  />
                </View>
              </Animated.View>
            ) : null}
            <View style={styles.iconBox}>
              <Ionicons
                name={RIGHT_TAB.icon}
                size={ICON_SIZE}
                color={rightActive ? ACTIVE_ICON_COLOR : INACTIVE_ICON_COLOR}
                style={styles.iconGlyph}
              />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: WRAPPER_PADDING,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: PILL_GAP,
  },
  leftPill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
    backgroundColor: "rgba(14,18,28,0.6)",
  },
  track: {
    flex: 1,
    paddingHorizontal: TRACK_PADDING_X,
    paddingVertical: TRACK_PADDING_Y,
    alignItems: "stretch",
  },
  trackInner: {
    height: "100%",
    position: "relative",
    width: "100%",
  },
  rightPill: {
    height: RIGHT_PILL_SIZE,
    width: RIGHT_PILL_SIZE,
    minWidth: RIGHT_PILL_SIZE,
    maxWidth: RIGHT_PILL_SIZE,
    aspectRatio: 1,
    borderRadius: RIGHT_PILL_SIZE / 2,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  pillFillWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  rightCircle: {
    width: RIGHT_PILL_SIZE,
    height: RIGHT_PILL_SIZE,
    borderRadius: RIGHT_PILL_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rightFillWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RIGHT_PILL_SIZE / 2,
    overflow: "hidden",
  },
  rightBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RIGHT_PILL_SIZE / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  bubbleTrack: {
    position: "absolute",
    top: BUBBLE_GAP,
    bottom: BUBBLE_GAP,
    left: 0,
  },
  bubble: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  bubbleFillWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: "hidden",
  },
  slotsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SLOTS_SIDE_PADDING,
  },
  tabSlot: {
    width: TAB_SLOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    lineHeight: ICON_SIZE,
    ...(Platform.OS === "android" ? { includeFontPadding: false, textAlignVertical: "center" } : null),
    transform: [{ translateY: ICON_NUDGE_Y }],
  },
  tabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  rightBubble: {
    position: "absolute",
    top: BUBBLE_GAP,
    bottom: BUBBLE_GAP,
    left: BUBBLE_GAP,
    right: BUBBLE_GAP,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
});
