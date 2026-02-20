import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";
import TicketsScreen from "../../app/tickets/index";

type ProfileTicketsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function ProfileTicketsSheet({ visible, onClose }: ProfileTicketsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const [rendered, setRendered] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(Math.round(windowHeight * 0.92));
  const hiddenOffset = Math.max(sheetHeight + 24, windowHeight * 0.78);
  const closeThreshold = Math.max(110, sheetHeight * 0.22);

  const backdropOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, hiddenOffset],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [hiddenOffset, translateY],
  );

  const animateOpen = () => {
    translateY.stopAnimation();
    translateY.setValue(hiddenOffset);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 24,
      stiffness: 240,
      mass: 0.8,
      overshootClamping: false,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start();
  };

  const animateClose = (done?: () => void) => {
    translateY.stopAnimation();
    Animated.timing(translateY, {
      toValue: hiddenOffset,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      done?.();
    });
  };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      requestAnimationFrame(animateOpen);
      return;
    }
    if (!rendered) return;
    animateClose(() => setRendered(false));
  }, [visible, rendered, hiddenOffset]);

  useEffect(() => {
    if (rendered) return;
    translateY.setValue(hiddenOffset);
  }, [hiddenOffset, rendered, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx) && gesture.dy > 5,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy <= 0) return;
          translateY.setValue(Math.min(gesture.dy, hiddenOffset));
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.dy >= closeThreshold || gesture.vy > 1.05;
          if (shouldClose) {
            onClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 240,
            mass: 0.8,
            overshootClamping: false,
            restDisplacementThreshold: 0.5,
            restSpeedThreshold: 0.5,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 240,
            mass: 0.8,
            overshootClamping: false,
            restDisplacementThreshold: 0.5,
            restSpeedThreshold: 0.5,
          }).start();
        },
      }),
    [closeThreshold, hiddenOffset, onClose, translateY],
  );

  if (!rendered) return null;

  return (
    <Modal transparent visible={rendered} animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fechar bilhetes" />
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: backdropOpacity }]} />

        <Animated.View
          style={[
            styles.sheet,
            {
              height: Math.max(Math.round(windowHeight * 0.88), 520),
              transform: [{ translateY }],
            },
          ]}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
            setSheetHeight((prev) => (Math.abs(prev - nextHeight) < 4 ? prev : nextHeight));
          }}
        >
          <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
          <View style={styles.sheetHeaderDrag} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Bilhetes</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeButton, pressed ? styles.closeButtonPressed : null]}
              accessibilityRole="button"
              accessibilityLabel="Fechar bilhetes"
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.95)" />
            </Pressable>
          </View>

          <View style={styles.content}>
            <TicketsScreen showBackButton={false} embedded />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,15,0.64)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(208,235,255,0.22)",
    backgroundColor: "rgba(7,12,20,0.92)",
  },
  sheetHeaderDrag: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  header: {
    minHeight: tokens.layout.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    color: "rgba(250,252,255,0.98)",
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: tokens.layout.touchTarget,
    height: tokens.layout.touchTarget,
    borderRadius: tokens.layout.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  closeButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  content: {
    flex: 1,
  },
});
