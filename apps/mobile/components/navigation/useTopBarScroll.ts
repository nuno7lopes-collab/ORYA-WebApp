import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOP_APP_HEADER_HEIGHT } from "./topBarTokens";

type TopBarScrollOptions = {
  hideOnScroll?: boolean;
  elevationOffset?: number;
  hideOffset?: number;
  showOffset?: number;
};

export type TopBarScrollState = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  translateY: Animated.Value;
  isElevated: boolean;
  isHidden: boolean;
  height: number;
};

const DEFAULT_OPTIONS: Required<TopBarScrollOptions> = {
  hideOnScroll: true,
  elevationOffset: 12,
  hideOffset: 18,
  showOffset: 24,
};

const BOTTOM_REVEAL_SLOP = 12;
const MIN_SCROLL_DELTA = 1.5;
const SHOW_VELOCITY_THRESHOLD = -100;
const HIDE_VELOCITY_THRESHOLD = 0.35;
const SNAP_VISIBILITY_THRESHOLD = 0.55;
const TRANSITION_DURATION = 260;
const MAX_TRAVEL_STEP = 24;
const TOGGLE_COOLDOWN_MS = 320;

export const useTopBarScroll = (options: TopBarScrollOptions = {}): TopBarScrollState => {
  const insets = useSafeAreaInsets();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const translateY = useRef(new Animated.Value(0)).current;
  const [isElevated, setIsElevated] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const lastOffsetRef = useRef(0);
  const isHiddenRef = useRef(false);
  const isElevatedRef = useRef(false);
  const lastDirectionRef = useRef<"up" | "down" | "none">("none");
  const translateValueRef = useRef(0);
  const upTravelRef = useRef(0);
  const downTravelRef = useRef(0);
  const lastToggleAtRef = useRef(0);
  const lastMaxOffsetRef = useRef(0);

  const headerHeight = insets.top + TOP_APP_HEADER_HEIGHT;

  const applyHidden = useCallback(
    (nextHidden: boolean, offsetY: number, force = false) => {
      if (isHiddenRef.current === nextHidden) return;
      if (!force) {
        const now = Date.now();
        if (now - lastToggleAtRef.current < TOGGLE_COOLDOWN_MS) return;
        lastToggleAtRef.current = now;
      } else {
        lastToggleAtRef.current = Date.now();
      }
      isHiddenRef.current = nextHidden;
      setIsHidden(nextHidden);
      if (nextHidden) {
        downTravelRef.current = 0;
      } else {
        upTravelRef.current = 0;
        lastMaxOffsetRef.current = offsetY;
      }
      Animated.timing(translateY, {
        toValue: nextHidden ? -headerHeight : 0,
        duration: TRANSITION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [headerHeight, translateY],
  );

  const applyElevated = useCallback((next: boolean) => {
    if (isElevatedRef.current === next) return;
    isElevatedRef.current = next;
    setIsElevated(next);
  }, []);

  useEffect(() => {
    if (!isHiddenRef.current) return;
    translateY.setValue(-headerHeight);
  }, [headerHeight, translateY]);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      translateValueRef.current = value;
    });
    return () => {
      translateY.removeListener(id);
    };
  }, [translateY]);

  const resolveVisibilityRatio = useCallback(() => {
    if (!headerHeight) return isHiddenRef.current ? 0 : 1;
    const hiddenAmount = Math.min(1, Math.max(0, Math.abs(translateValueRef.current) / headerHeight));
    return 1 - hiddenAmount;
  }, [headerHeight]);

  const snapByVelocity = useCallback(
    (offsetY: number, velocityY: number, params: { isNearBottom: boolean; maxOffset: number }) => {
      if (!opts.hideOnScroll) return;
      if (params.maxOffset <= 0) {
        applyHidden(false, offsetY, true);
        return;
      }
      if (offsetY <= 2) {
        applyHidden(false, offsetY, true);
        return;
      }
      if (
        velocityY <= SHOW_VELOCITY_THRESHOLD &&
        upTravelRef.current >= opts.showOffset &&
        offsetY <= lastMaxOffsetRef.current - opts.showOffset
      ) {
        applyHidden(false, offsetY);
        return;
      }
      if (velocityY >= HIDE_VELOCITY_THRESHOLD && downTravelRef.current >= opts.hideOffset * 0.5) {
        applyHidden(true, offsetY);
        return;
      }
      if (params.isNearBottom && velocityY >= 0) {
        applyHidden(true, offsetY);
        return;
      }
      if (Math.abs(velocityY) < 0.08) return;
      const ratio = resolveVisibilityRatio();
      applyHidden(ratio < SNAP_VISIBILITY_THRESHOLD, offsetY);
    },
    [applyHidden, opts.hideOnScroll, resolveVisibilityRatio],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
      const lastOffset = lastOffsetRef.current;
      const delta = offsetY - lastOffset;
      const prevDirection = lastDirectionRef.current;
      const contentHeight = event.nativeEvent.contentSize?.height ?? 0;
      const viewportHeight = event.nativeEvent.layoutMeasurement?.height ?? 0;
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const distanceToBottom = maxOffset - offsetY;
      const isNearBottom = maxOffset > 0 && distanceToBottom <= BOTTOM_REVEAL_SLOP;
      lastOffsetRef.current = offsetY;
      const absDelta = Math.abs(delta);
      const direction = delta > 0 ? "down" : delta < 0 ? "up" : "none";
      if (direction !== "none" && absDelta >= MIN_SCROLL_DELTA) {
        lastDirectionRef.current = direction;
      }
      if (direction === "down") {
        lastMaxOffsetRef.current = Math.max(lastMaxOffsetRef.current, offsetY);
      } else if (direction === "up" && prevDirection !== "up") {
        lastMaxOffsetRef.current = Math.max(lastMaxOffsetRef.current, offsetY);
      }

      if (offsetY <= 2) {
        applyElevated(false);
        if (opts.hideOnScroll) applyHidden(false, offsetY, true);
        return;
      }

      if (offsetY > opts.elevationOffset) {
        applyElevated(true);
      } else if (offsetY <= 4) {
        applyElevated(false);
      }

      if (!opts.hideOnScroll) return;
      if (absDelta < MIN_SCROLL_DELTA) return;

      if (direction === "down" && !isHiddenRef.current && isNearBottom) {
        applyHidden(true, offsetY);
        return;
      }

      if (direction === "down") {
        if (prevDirection !== "down") {
          downTravelRef.current = 0;
        }
        downTravelRef.current += Math.min(absDelta, MAX_TRAVEL_STEP);
        upTravelRef.current = 0;
        if (downTravelRef.current > opts.hideOffset) {
          applyHidden(true, offsetY);
        }
      }

      if (direction === "up") {
        if (prevDirection !== "up") {
          upTravelRef.current = 0;
        }
        upTravelRef.current += Math.min(absDelta, MAX_TRAVEL_STEP);
        downTravelRef.current = 0;
        if (upTravelRef.current > opts.showOffset && offsetY <= lastMaxOffsetRef.current - opts.showOffset) {
          applyHidden(false, offsetY);
        }
      }
    },
    [applyElevated, applyHidden, opts.elevationOffset, opts.hideOffset, opts.hideOnScroll, opts.showOffset],
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!opts.hideOnScroll) return;
      const velocity = event.nativeEvent.velocity?.y ?? 0;
      const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
      const contentHeight = event.nativeEvent.contentSize?.height ?? 0;
      const viewportHeight = event.nativeEvent.layoutMeasurement?.height ?? 0;
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const distanceToBottom = maxOffset - offsetY;
      const isNearBottom = maxOffset > 0 && distanceToBottom <= BOTTOM_REVEAL_SLOP;
      snapByVelocity(offsetY, velocity, { isNearBottom, maxOffset });
    },
    [opts.hideOnScroll, snapByVelocity],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!opts.hideOnScroll) return;
      const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
      const contentHeight = event.nativeEvent.contentSize?.height ?? 0;
      const viewportHeight = event.nativeEvent.layoutMeasurement?.height ?? 0;
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const distanceToBottom = maxOffset - offsetY;
      const isNearBottom = maxOffset > 0 && distanceToBottom <= BOTTOM_REVEAL_SLOP;
      const velocity = event.nativeEvent.velocity?.y ?? 0;
      snapByVelocity(offsetY, velocity, { isNearBottom, maxOffset });
    },
    [opts.hideOnScroll, snapByVelocity],
  );

  return {
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
    translateY,
    isElevated,
    isHidden,
    height: headerHeight,
  };
};
