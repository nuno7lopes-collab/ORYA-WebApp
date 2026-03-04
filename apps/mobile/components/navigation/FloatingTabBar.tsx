import { useMemo } from "react";
import { Ionicons } from "../icons/Ionicons";
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import type { TabKey } from "./tabOrder";
import {
  NAV_BAR_BLUR_INTENSITY,
  NAV_BAR_MILK_ALPHA,
  sampleBackgroundColor,
  sampleBackgroundColorAlpha,
} from "./navColors";

const TABS: Array<{
  key: TabKey;
  label: string;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "inicio", label: "Início", active: "home", inactive: "home-outline" },
  { key: "competir", label: "Competir", active: "trophy", inactive: "trophy-outline" },
  { key: "reservas", label: "Reservas", active: "calendar", inactive: "calendar-outline" },
  {
    key: "comunidade",
    label: "Comunidade",
    active: "chatbubble-ellipses",
    inactive: "chatbubble-ellipses-outline",
  },
  { key: "perfil", label: "Perfil", active: "person-circle", inactive: "person-circle-outline" },
];

export const TAB_BAR_HEIGHT = 50;
const ICON_SIZE = 24;
const ICON_NUDGE_Y = -0.5;
const ACTIVE_ICON_COLOR = "rgba(248,252,255,1)";
const INACTIVE_ICON_COLOR = "rgba(228,240,255,0.8)";
const TAB_SLOT_SIZE = 44;

type FloatingTabBarProps = {
  activeKey: TabKey;
  onSelect: (key: TabKey) => void;
};

export function FloatingTabBar({ activeKey, onSelect }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const safeBottom = Math.max(insets.bottom, 8);
  const bottomBreakProgress = useMemo(() => {
    if (screenHeight <= 0) {
      return 1;
    }
    const barStartY = screenHeight - (TAB_BAR_HEIGHT + safeBottom);
    return Math.min(1, Math.max(0, barStartY / screenHeight));
  }, [safeBottom, screenHeight]);
  const bottomBreakColor = useMemo(
    () => sampleBackgroundColor(bottomBreakProgress),
    [bottomBreakProgress],
  );
  const bottomOverlayColor = useMemo(
    () => sampleBackgroundColorAlpha(bottomBreakProgress, NAV_BAR_MILK_ALPHA),
    [bottomBreakProgress],
  );

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={[styles.bar, { paddingBottom: safeBottom }]}>
        <View pointerEvents="none" style={styles.backdrop}>
          {Platform.OS === "ios" ? (
            <BlurView
              tint="default"
              intensity={NAV_BAR_BLUR_INTENSITY}
              style={[StyleSheet.absoluteFill, { backgroundColor: bottomBreakColor }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bottomBreakColor }]} />
          )}
          <View style={[styles.milkOverlay, { backgroundColor: bottomOverlayColor }]} />
        </View>
        <View style={styles.slotsRow}>
          {TABS.map((tab) => {
            const isActive = activeKey === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityHint={`Abrir ${tab.label}`}
                accessibilityState={isActive ? { selected: true } : {}}
                hitSlop={10}
                unstable_pressDelay={0}
                style={({ pressed }) => [styles.tabSlot, pressed && styles.tabPressed]}
                onPress={() => {
                  if (tab.key !== activeKey) {
                    onSelect(tab.key);
                  }
                }}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name={isActive ? tab.active : tab.inactive}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    minHeight: TAB_BAR_HEIGHT,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    shadowColor: "rgba(9,20,40,0.48)",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 12,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  milkOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  slotsRow: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  tabSlot: {
    width: TAB_SLOT_SIZE,
    minHeight: TAB_SLOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 30,
    height: 30,
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
});
