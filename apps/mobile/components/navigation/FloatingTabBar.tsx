import { Ionicons } from "../icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
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

const PILL_GAP = 10;
const WRAPPER_PADDING = 16;
const TRACK_PADDING_X = 12;
const TRACK_PADDING_Y = 8;
const MAX_LEFT_PILL_WIDTH = 260;
const BUBBLE_INSET = 3;
const EDGE_GAP = 0;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const safeBottom = Math.max(insets.bottom, 10) + 10;

  const bubbleX = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const bubbleXValue = useRef(0);
  const draggingRef = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const maxRowWidth = Math.max(Math.min(windowWidth - WRAPPER_PADDING * 2, 560), 0);
  const rightPillWidth = RIGHT_PILL_SIZE;
  const leftPillWidth = Math.max(
    Math.min(maxRowWidth - rightPillWidth - PILL_GAP, MAX_LEFT_PILL_WIDTH),
    0,
  );
  const rowWidth = leftPillWidth + rightPillWidth + PILL_GAP;
  const [trackWidth, setTrackWidth] = useState(0);
  const slotWidth = trackWidth ? trackWidth / LEFT_TABS.length : 0;
  const bubbleWidth = Math.max(slotWidth - (BUBBLE_INSET * 2 + EDGE_GAP * 2), 0);

  const slotCentersRef = useRef<number[]>([]);
  const [slotVersion, setSlotVersion] = useState(0);

  const currentRouteName = state.routes[state.index]?.name;
  const activeLeftIndex = LEFT_TABS.findIndex((tab) => tab.key === currentRouteName);
  const rightActive = currentRouteName === RIGHT_TAB.key;

  useEffect(() => {
    const id = bubbleX.addListener(({ value }) => {
      bubbleXValue.current = value;
    });
    return () => bubbleX.removeListener(id);
  }, [bubbleX]);

  const setBubbleToIndex = useCallback(
    (index: number, animated = true) => {
      if (!slotWidth || !bubbleWidth || !trackWidth) return;
      const center = slotCentersRef.current[index];
      const rawX =
        typeof center === "number"
          ? center - bubbleWidth / 2
          : slotWidth * index + BUBBLE_INSET + EDGE_GAP;
      const minX = BUBBLE_INSET + EDGE_GAP;
      const maxX = trackWidth - BUBBLE_INSET - EDGE_GAP - bubbleWidth;
      const targetX = clamp(rawX, minX, maxX);
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
    [bubbleWidth, bubbleX, slotWidth, trackWidth],
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
  }, [activeLeftIndex, bubbleOpacity, setBubbleToIndex, slotVersion, slotWidth]);

  const animatePress = useCallback(
    (pressed: boolean) => {
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: pressed ? 1.06 : 1,
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
      if (!slotWidth || !bubbleWidth) return;
      const minX = BUBBLE_INSET + EDGE_GAP;
      const maxX = trackWidth - BUBBLE_INSET - EDGE_GAP - bubbleWidth;
      const nextX = clamp(locationX - bubbleWidth / 2, minX, maxX);
      bubbleX.setValue(nextX);

      const center = nextX + bubbleWidth / 2;
      const centers = slotCentersRef.current;
      let nextIndex = 0;
      if (centers.length === LEFT_TABS.length && centers.every((value) => typeof value === "number")) {
        let minDistance = Number.POSITIVE_INFINITY;
        centers.forEach((value, index) => {
          const distance = Math.abs(center - value);
          if (distance < minDistance) {
            minDistance = distance;
            nextIndex = index;
          }
        });
      } else {
        const rawIndex = Math.round(center / slotWidth - 0.5);
        nextIndex = clamp(rawIndex, 0, LEFT_TABS.length - 1);
      }
      updateDragIndex(nextIndex);
    },
    [bubbleWidth, bubbleX, slotWidth, trackWidth, updateDragIndex],
  );

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        trackWidth > 0 && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dy) < 10,
      onMoveShouldSetPanResponder: (_, gesture) =>
        trackWidth > 0 && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dy) < 10,
      onPanResponderGrant: (event) => {
        if (!slotWidth) return;
        draggingRef.current = true;
        animatePress(true);
        const locationX = event.nativeEvent.locationX;
        updateBubbleFromLocation(locationX);
      },
      onPanResponderMove: (event) => {
        const locationX = event.nativeEvent.locationX;
        updateBubbleFromLocation(locationX);
      },
      onPanResponderRelease: () => {
        const targetIndex = dragIndexRef.current ?? activeLeftIndex;
        draggingRef.current = false;
        animatePress(false);
        dragIndexRef.current = null;
        setDragIndex(null);
        if (targetIndex != null && targetIndex >= 0) {
          const routeKey = LEFT_TABS[targetIndex]?.key;
          if (routeKey && routeKey !== currentRouteName) {
            navigation.navigate(routeKey);
          } else if (routeKey) {
            setBubbleToIndex(targetIndex);
          }
        }
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        animatePress(false);
        dragIndexRef.current = null;
        setDragIndex(null);
      },
    })
  , [
    activeLeftIndex,
    animatePress,
    currentRouteName,
    navigation,
    setBubbleToIndex,
    slotWidth,
    trackWidth,
    updateBubbleFromLocation,
  ]);

  const visualLeftIndex = dragIndex ?? (activeLeftIndex >= 0 ? activeLeftIndex : null);

  return (
      <View pointerEvents="box-none" style={[styles.wrapper, { bottom: safeBottom }]}>
      <View style={[styles.row, { width: rowWidth }]}>
        <View style={[styles.leftPill, { width: leftPillWidth }]}>
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

          <View style={styles.track}>
            <View
              style={styles.trackInner}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                setTrackWidth((prev) => (prev === width ? prev : width));
              }}
              {...panResponder.panHandlers}
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
                      style={({ pressed }) => [styles.tabSlot, pressed && styles.tabPressed]}
                      onLayout={(event) => {
                        const layout = event.nativeEvent.layout;
                        const center = layout.x + layout.width / 2;
                        if (slotCentersRef.current[index] !== center) {
                          slotCentersRef.current[index] = center;
                          setSlotVersion((value) => value + 1);
                        }
                      }}
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
                          size={24}
                          color={isActive ? "rgba(255,255,255,0.98)" : "rgba(220,230,245,0.68)"}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
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
                size={24}
                color={rightActive ? "rgba(255,255,255,0.98)" : "rgba(220,230,245,0.68)"}
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
  },
  trackInner: {
    flex: 1,
    position: "relative",
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
    top: BUBBLE_INSET,
    bottom: BUBBLE_INSET,
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
  },
  tabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  rightBubble: {
    position: "absolute",
    top: BUBBLE_INSET,
    bottom: BUBBLE_INSET,
    left: BUBBLE_INSET,
    right: BUBBLE_INSET,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
});
