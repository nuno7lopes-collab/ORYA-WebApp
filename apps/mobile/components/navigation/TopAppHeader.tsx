import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useNotificationsUnread } from "../../features/notifications/hooks";
import { useAuth } from "../../lib/auth";
import type { TopBarScrollState } from "./useTopBarScroll";
import { TOP_APP_HEADER_HEIGHT } from "./topBarTokens";

type TopAppHeaderVariant = "brand" | "title" | "custom";

type TopAppHeaderProps = {
  variant?: TopAppHeaderVariant;
  title?: string;
  titleAlign?: "left" | "center";
  leftSlot?: ReactNode;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  rightSlotMode?: "replace" | "append";
  scrollState?: TopBarScrollState;
  showNotifications?: boolean;
  showMessages?: boolean;
};

export function TopAppHeader({
  variant = "brand",
  title,
  titleAlign = "center",
  leftSlot,
  centerSlot,
  rightSlot,
  rightSlotMode = "replace",
  scrollState,
  showNotifications,
  showMessages,
}: TopAppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const unreadQuery = useNotificationsUnread(
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const showBadge = unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const defaultTranslate = useRef(new Animated.Value(0)).current;
  const translateY = scrollState?.translateY ?? defaultTranslate;
  const isElevated = scrollState?.isElevated ?? false;
  const renderNotifications = showNotifications ?? variant === "brand";
  const renderMessages = showMessages ?? variant === "brand";

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top,
        height: insets.top + TOP_APP_HEADER_HEIGHT,
      },
      isElevated ? styles.containerElevated : styles.containerTransparent,
      { transform: [{ translateY }] },
    ],
    [insets.top, isElevated, translateY],
  );
  const gradientStyle = useMemo(
    () => [
      styles.gradient,
      {
        height: insets.top + Math.round(TOP_APP_HEADER_HEIGHT * 0.8),
      },
    ],
    [insets.top],
  );
  const blurIntensity = isElevated ? 52 : 28;

  const defaultRightActions =
    renderNotifications || renderMessages ? (
      <View style={styles.actions}>
        {renderNotifications ? (
          <View style={styles.iconWrap}>
            <Pressable
              onPress={() => router.push("/notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
              hitSlop={10}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="heart-outline" size={24} color="rgba(255,255,255,1)" />
            </Pressable>
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {renderMessages ? (
          <Pressable
            onPress={() => router.push("/messages")}
            accessibilityRole="button"
            accessibilityLabel="Mensagens"
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="rgba(255,255,255,1)" />
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const brandNode = (
    <Text style={styles.brand} accessibilityRole="header">
      ORYA
    </Text>
  );

  const titleStyle = titleAlign === "center" ? [styles.title, styles.titleCentered] : styles.title;
  const titleNode = title ? (
    <Text style={titleStyle} numberOfLines={1}>
      {title}
    </Text>
  ) : null;

  const leftContent =
    variant === "brand" ? (
      leftSlot ?? brandNode
    ) : variant === "title" ? (
      titleAlign === "center" ? (
        leftSlot ?? null
      ) : (
        <View style={styles.titleRow}>
          {leftSlot}
          {titleNode}
        </View>
      )
    ) : (
      leftSlot ?? null
    );

  const centerContent =
    variant === "custom"
      ? centerSlot
      : variant === "title" && titleAlign === "center"
        ? titleNode
        : null;
  const rightContent =
    rightSlot && rightSlotMode === "append" && defaultRightActions ? (
      <View style={styles.rightRow}>
        {rightSlot}
        {defaultRightActions}
      </View>
    ) : (
      rightSlot ?? defaultRightActions
    );

  const isCustom = variant === "custom";
  const hasLeft = Boolean(leftContent);
  const hasRight = Boolean(rightContent);
  const leftStyle = isCustom && !hasLeft ? styles.sideEmpty : styles.left;
  const rightStyle = isCustom && !hasRight ? styles.sideEmpty : styles.right;

  return (
    <Animated.View style={containerStyle} pointerEvents="box-none">
      <BlurView tint="dark" intensity={blurIntensity} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(20, 28, 44, 0.35)", "rgba(8, 12, 20, 0.16)", "rgba(8, 12, 20, 0.0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={gradientStyle}
        pointerEvents="none"
      />
      <View style={styles.inner}>
        <View style={leftStyle}>{leftContent}</View>
        {centerContent ? (
          <View
            style={
              variant === "title" && titleAlign === "center"
                ? styles.centerAbsolute
                : isCustom
                  ? styles.centerFill
                  : styles.center
            }
            pointerEvents={variant === "title" && titleAlign === "center" ? "none" : "auto"}
          >
            {centerContent}
          </View>
        ) : null}
        <View style={rightStyle}>{rightContent}</View>
      </View>
      {isElevated ? <View style={styles.edgeFade} pointerEvents="none" /> : null}
    </Animated.View>
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
  },
  containerTransparent: {
    backgroundColor: "rgba(6, 10, 18, 0.42)",
  },
  containerElevated: {
    backgroundColor: "rgba(6, 10, 18, 0.88)",
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
    position: "relative",
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: TOP_APP_HEADER_HEIGHT,
  },
  sideEmpty: {
    width: 0,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: TOP_APP_HEADER_HEIGHT,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerFill: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
  },
  centerAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: TOP_APP_HEADER_HEIGHT,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brand: {
    color: "rgba(255,255,255,1)",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "rgba(255,255,255,1)",
    fontSize: 19,
    fontWeight: "700",
  },
  titleCentered: {
    textAlign: "center",
    maxWidth: "70%",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  iconPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  badge: {
    position: "absolute",
    top: -1,
    right: -1,
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
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
