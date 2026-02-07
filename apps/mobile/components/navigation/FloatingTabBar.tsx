import { Ionicons } from "../icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
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

const LEFT_TABS: Array<{
  key: string;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "agora", active: "flash", inactive: "flash-outline" },
  { key: "tickets", active: "ticket", inactive: "ticket-outline" },
  { key: "network", active: "people", inactive: "people-outline" },
  { key: "profile", active: "person-circle", inactive: "person-circle-outline" },
];

const RIGHT_TAB = { key: "index", icon: "search" as keyof typeof Ionicons.glyphMap };

export const TAB_BAR_HEIGHT = 60;
const RIGHT_PILL_SIZE = 56;
const ICON_SIZE = 24;
const ICON_NUDGE_Y = -1;
const TAB_SLOT_SIZE = 52;
const SLOTS_SIDE_PADDING = 23;
const BUBBLE_EXTRA = 40;

const PILL_GAP = 10;
const WRAPPER_PADDING = 16;
const TRACK_PADDING_X = 0;
const TRACK_PADDING_Y = 0;
const BUBBLE_GAP = 3;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const safeBottom = Math.max(insets.bottom, 10) + 10;

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

  const currentRouteName = state.routes[state.index]?.name;
  const activeLeftIndex = LEFT_TABS.findIndex((tab) => tab.key === currentRouteName);
  const rightActive = currentRouteName === RIGHT_TAB.key;

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
            if (routeKey && routeKey !== currentRouteName) {
              navigation.navigate(routeKey);
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
    [
      activeLeftIndex,
      animatePress,
      currentRouteName,
      navigation,
      setBubbleToIndex,
      updateBubbleFromTouch,
    ],
  );

  const visualLeftIndex = dragIndex ?? (activeLeftIndex >= 0 ? activeLeftIndex : null);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: safeBottom }]}>
      <View style={[styles.row, { width: rowWidth }]}>
        <View style={[styles.leftPill, { flex: 1 }]}>
          <View pointerEvents="none" style={styles.pillFillWrap}>
            <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
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
                        opacity: bubbleOpacity,
                        width: bubbleWidth,
                        transform: [{ translateX: bubbleX }],
                      },
                    ]}
                  >
                    <Animated.View style={[styles.bubble, { transform: [{ scale: bubbleScale }] }]}>
                      <View pointerEvents="none" style={styles.bubbleFillWrap}>
                        <BlurView tint="light" intensity={16} style={StyleSheet.absoluteFill} />
                        <LinearGradient
                          colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
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
                        accessibilityRole="button"
                        accessibilityState={isActive ? { selected: true } : {}}
                        hitSlop={10}
                        onLayout={(event) => handleSlotLayout(index, event)}
                        style={({ pressed }) => [styles.tabSlot, pressed && styles.tabPressed]}
                        onPress={() => {
                          if (tab.key !== currentRouteName) {
                            navigation.navigate(tab.key);
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
                            color={isActive ? "rgba(255,255,255,0.98)" : "rgba(220,230,245,0.68)"}
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
          accessibilityRole="button"
          accessibilityState={rightActive ? { selected: true } : {}}
          style={({ pressed }) => [styles.rightPill, pressed && styles.tabPressed]}
          hitSlop={10}
          onPress={() => {
            navigation.navigate(RIGHT_TAB.key, { search: "1" });
          }}
        >
          <View style={styles.rightCircle}>
            <View pointerEvents="none" style={styles.rightFillWrap}>
              <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={["rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={styles.rightBorder} pointerEvents="none" />
            {rightActive && (
              <View pointerEvents="none" style={styles.rightBubble}>
                <View pointerEvents="none" style={styles.bubbleFillWrap}>
                  <BlurView tint="light" intensity={16} style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>
            )}
            <View style={styles.iconBox}>
              <Ionicons
                name={RIGHT_TAB.icon}
                size={ICON_SIZE}
                color={rightActive ? "rgba(255,255,255,0.98)" : "rgba(220,230,245,0.68)"}
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
    backgroundColor: "rgba(14,18,28,0.45)",
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
    borderColor: "rgba(255,255,255,0.08)",
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
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
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
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
});
