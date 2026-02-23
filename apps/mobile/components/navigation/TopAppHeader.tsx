import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";
import { useNotificationsUnread } from "../../features/notifications/hooks";
import { useAuth } from "../../lib/auth";
import { safePush } from "../../lib/navigation";
import type { TopBarScrollState } from "./useTopBarScroll";
import { TOP_APP_HEADER_HEIGHT } from "./topBarTokens";
import {
  NAV_BAR_BLUR_INTENSITY,
  NAV_BAR_MILK_ALPHA,
  sampleBackgroundColor,
  sampleBackgroundColorAlpha,
} from "./navColors";

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
  const { height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const [isReadyForUnread, setIsReadyForUnread] = useState(false);
  const renderNotifications = showNotifications ?? variant === "brand";
  const renderMessages = showMessages ?? variant === "brand";

  useEffect(() => {
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (active) setIsReadyForUnread(true);
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, []);

  const unreadQuery = useNotificationsUnread(
    session?.access_token ?? null,
    session?.user?.id ?? null,
    renderNotifications &&
      Boolean(session?.user?.id) &&
      isFocused &&
      isReadyForUnread,
  );
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const showBadge = unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const defaultTranslate = useRef(new Animated.Value(0)).current;
  const translateY = scrollState?.translateY ?? defaultTranslate;
  const topBreakProgress = useMemo(() => {
    if (screenHeight <= 0) {
      return 0;
    }
    return Math.min(1, Math.max(0, (insets.top + TOP_APP_HEADER_HEIGHT) / screenHeight));
  }, [insets.top, screenHeight]);
  const topBreakColor = useMemo(
    () => sampleBackgroundColor(topBreakProgress),
    [topBreakProgress],
  );
  const topOverlayColor = useMemo(
    () => sampleBackgroundColorAlpha(topBreakProgress, NAV_BAR_MILK_ALPHA),
    [topBreakProgress],
  );

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top,
        height: insets.top + TOP_APP_HEADER_HEIGHT,
        backgroundColor: "transparent",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.08)",
        shadowColor: "rgba(9,20,40,0.45)",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 22,
        elevation: 7,
      },
      { transform: [{ translateY }] },
    ],
    [insets.top, translateY],
  );

  const defaultRightActions =
    renderNotifications || renderMessages ? (
      <View style={styles.actions}>
        {renderNotifications ? (
          <View style={styles.iconWrap}>
            <Pressable
              onPressIn={() => safePush(router, "/notifications")}
              onPress={() => undefined}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
              hitSlop={10}
              unstable_pressDelay={0}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="notifications-outline" size={26} color="rgba(255,255,255,1)" />
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
            onPressIn={() => safePush(router, "/messages")}
            onPress={() => undefined}
            accessibilityRole="button"
            accessibilityLabel="Mensagens"
            hitSlop={10}
            unstable_pressDelay={0}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Ionicons name="chatbubble-ellipses" size={26} color="rgba(255,255,255,1)" />
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
      <View pointerEvents="none" style={styles.backdrop}>
        {Platform.OS === "ios" ? (
          <BlurView
            tint="default"
            intensity={NAV_BAR_BLUR_INTENSITY}
            style={[StyleSheet.absoluteFill, { backgroundColor: topBreakColor }]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: topBreakColor }]} />
        )}
        <View style={[styles.milkOverlay, { backgroundColor: topOverlayColor }]} />
      </View>
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
    overflow: "hidden",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  milkOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    color: "rgba(247,252,255,1)",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "rgba(247,252,255,1)",
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
    gap: 10,
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
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(208,235,255,0.22)",
  },
  iconPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
    backgroundColor: "rgba(255,255,255,0.2)",
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
});
