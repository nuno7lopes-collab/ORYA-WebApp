import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useNotificationsUnread } from "../../features/notifications/hooks";
import { useAuth } from "../../lib/auth";

export const TOP_APP_HEADER_HEIGHT = 54;
const ACTIONS_WIDTH = tokens.layout.touchTarget * 2 + 10;

export function TopAppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const unreadQuery = useNotificationsUnread(Boolean(session?.user?.id));
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const showBadge = unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top,
        height: insets.top + TOP_APP_HEADER_HEIGHT,
      },
    ],
    [insets.top],
  );
  const gradientStyle = useMemo(
    () => [
      styles.gradient,
      {
        height: insets.top + Math.round(TOP_APP_HEADER_HEIGHT * 0.6),
      },
    ],
    [insets.top],
  );

  return (
    <View style={containerStyle} pointerEvents="box-none">
      <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(20, 28, 44, 0.5)", "rgba(8, 12, 20, 0.18)", "rgba(8, 12, 20, 0.0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={gradientStyle}
        pointerEvents="none"
      />
      <View style={styles.inner}>
        <View style={styles.side} />
        <Text style={styles.title} accessibilityRole="header">
          ORYA
        </Text>
        <View style={styles.actions}>
          <View style={styles.iconWrap}>
            <Pressable
              onPress={() => router.push("/notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
              hitSlop={10}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="notifications" size={19} color="rgba(238,245,255,0.95)" />
            </Pressable>
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.push("/messages")}
            accessibilityRole="button"
            accessibilityLabel="Mensagens"
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Ionicons name="chatbubble-ellipses" size={19} color="rgba(238,245,255,0.95)" />
          </Pressable>
        </View>
      </View>
      <View style={styles.edgeFade} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    backgroundColor: "rgba(8, 12, 20, 0.55)",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  inner: {
    height: TOP_APP_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  side: {
    width: ACTIONS_WIDTH,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "rgba(245,250,255,0.98)",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 2.2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: ACTIONS_WIDTH,
    justifyContent: "flex-end",
    marginTop: 1,
  },
  iconWrap: {
    position: "relative",
  },
  iconButton: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#ff4757",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(8,12,20,0.8)",
  },
  badgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "700",
  },
  edgeFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
