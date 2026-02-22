import { Ionicons } from "../icons/Ionicons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@orya/shared";
import type { TabKey } from "./tabOrder";

const TABS: Array<{
  key: TabKey;
  label: string;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "agora", label: "Agora", active: "home", inactive: "home-outline" },
  { key: "index", label: "Descobrir", active: "search", inactive: "search-outline" },
  { key: "network", label: "Rede", active: "people", inactive: "people-outline" },
  {
    key: "messages",
    label: "Mensagens",
    active: "chatbubble-ellipses",
    inactive: "chatbubble-ellipses-outline",
  },
  { key: "profile", label: "Perfil", active: "person-circle", inactive: "person-circle-outline" },
];

export const TAB_BAR_HEIGHT = 50;
const ICON_SIZE = 24;
const ICON_NUDGE_Y = -0.5;
const ACTIVE_ICON_COLOR = "rgba(248,252,255,1)";
const INACTIVE_ICON_COLOR = "rgba(228,240,255,0.8)";
const TAB_SLOT_SIZE = 44;
const NAV_BAR_BG = tokens.colors.background;

type FloatingTabBarProps = {
  activeKey: TabKey;
  onSelect: (key: TabKey) => void;
};

export function FloatingTabBar({ activeKey, onSelect }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={[styles.bar, { paddingBottom: safeBottom }]}>
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
    backgroundColor: NAV_BAR_BG,
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
