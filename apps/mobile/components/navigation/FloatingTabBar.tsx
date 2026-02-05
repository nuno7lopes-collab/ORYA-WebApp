import { Ionicons } from "../icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@orya/shared";

type TabLayout = { x: number; width: number };

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> =
  {
    agora: { active: "flash", inactive: "flash-outline" },
    index: { active: "compass", inactive: "compass-outline" },
    tickets: { active: "ticket", inactive: "ticket-outline" },
    network: { active: "people", inactive: "people-outline" },
    profile: { active: "person-circle", inactive: "person-circle-outline" },
  };

export const TAB_BAR_HEIGHT = 66;

function getLabel(routeName: string, options: BottomTabBarProps["descriptors"][string]["options"]) {
  if (typeof options.tabBarLabel === "string") return options.tabBarLabel;
  if (typeof options.title === "string") return options.title;
  return routeName;
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const bubbleX = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const [bubbleWidth, setBubbleWidth] = useState(0);

  const safeBottom = Math.max(insets.bottom, 10) + 6;
  const barPadding = 10;
  const bubbleInset = 4;

  const handleLayout = useCallback((key: string, layout: TabLayout) => {
    setLayouts((prev) => {
      if (prev[key]?.x === layout.x && prev[key]?.width === layout.width) return prev;
      return { ...prev, [key]: layout };
    });
  }, []);

  useEffect(() => {
    const focusedKey = state.routes[state.index]?.key;
    const layout = focusedKey ? layouts[focusedKey] : undefined;
    if (!layout) return;
    const targetX = layout.x + bubbleInset;
    const targetW = Math.max(layout.width - bubbleInset * 2, 0);
    setBubbleWidth(targetW);
    Animated.parallel([
      Animated.spring(bubbleX, {
        toValue: targetX,
        useNativeDriver: true,
        damping: 22,
        stiffness: 210,
        mass: 0.7,
        overshootClamping: false,
        restDisplacementThreshold: 0.6,
        restSpeedThreshold: 0.6,
      }),
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [layouts, state.index, state.routes]);

  const routes = useMemo(() => state.routes, [state.routes]);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: safeBottom }]}>
      <View style={styles.shadow} />
      <View style={styles.container}>
        <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(111, 255, 255, 0.06)", "rgba(118, 86, 255, 0.14)", "rgba(11, 16, 26, 0.55)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topSheen} pointerEvents="none" />
        <View style={styles.border} pointerEvents="none" />
        <View style={[styles.row, { paddingHorizontal: barPadding }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              {
                opacity: bubbleOpacity,
                transform: [{ translateX: bubbleX }],
                width: bubbleWidth,
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.26)", "rgba(255, 255, 255, 0.12)", "rgba(255,255,255,0.04)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.bubbleGloss} />
            <View style={styles.bubbleEdge} />
          </Animated.View>
          {routes.map((route, index) => {
            const options = descriptors[route.key]?.options ?? {};
            const isFocused = state.index === index;
            const label = getLabel(route.name, options);
            const icon = ICONS[route.name] ?? ICONS.index;
            const iconName = isFocused ? icon.active : icon.inactive;
            const resolvedIcon =
              (Ionicons as any)?.glyphMap?.[iconName] ? iconName : "help-circle";

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: "tabLongPress", target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                onLayout={(event) => handleLayout(route.key, event.nativeEvent.layout)}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.item,
                  isFocused && styles.itemActive,
                  pressed && styles.itemPressed,
                ]}
              >
                <Ionicons
                  name={resolvedIcon}
                  size={22}
                  color={isFocused ? tokens.colors.text : "rgba(235, 244, 255, 0.82)"}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color: isFocused ? tokens.colors.text : "rgba(235, 244, 255, 0.82)" },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
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
    alignItems: "center",
    paddingHorizontal: 16,
  },
  container: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 999,
    overflow: "hidden",
    paddingVertical: 10,
    backgroundColor: "rgba(10, 14, 24, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    minWidth: 54,
    gap: 3,
    minHeight: tokens.layout.touchTarget + 6,
  },
  itemActive: {
    transform: [{ translateY: -1 }],
  },
  itemPressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  bubble: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "rgba(111, 255, 255, 0.5)",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  bubbleGloss: {
    position: "absolute",
    top: 2,
    left: 8,
    right: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  bubbleEdge: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 4,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(6, 12, 20, 0.35)",
  },
  topSheen: {
    position: "absolute",
    top: 0,
    left: 8,
    right: 8,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  shadow: {
    position: "absolute",
    top: -8,
    bottom: -8,
    left: -4,
    right: -4,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
});
