import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { tokens } from "@orya/shared";

type GlassSkeletonProps = {
  className?: string;
  height?: number;
};

export function GlassSkeleton({ className, height = 120 }: GlassSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.65,
          duration: tokens.motion.normal,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: tokens.motion.normal,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={className}
      style={{
        height,
        borderRadius: tokens.radius.xl,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        opacity,
      }}
    >
      <View style={{ flex: 1 }} />
    </Animated.View>
  );
}
