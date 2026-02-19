import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "../icons/Ionicons";

type Props = {
  size: number;
  uri?: string | null;
  iconName?: string;
  iconColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  ring?: boolean;
  ringColors?: readonly [string, string, string?];
  style?: StyleProp<ViewStyle>;
};

export function AvatarCircle({
  size,
  uri,
  iconName = "person",
  iconColor = "rgba(255,255,255,0.7)",
  backgroundColor = "rgba(255,255,255,0.08)",
  borderColor = "rgba(255,255,255,0.12)",
  borderWidth = 0.8,
  ring = true,
  ringColors = ["#FF00C8", "#B08CFF", "#6BFFFF"],
  style,
}: Props) {
  const ringInset = ring ? Math.max(1, Math.round(size * 0.022 * 10) / 10) : 0;
  const innerSize = Math.max(8, size - ringInset * 2);
  const iconSize = Math.max(12, Math.round(innerSize * 0.42));
  const resolvedRingColors: readonly [string, string, string] = [
    ringColors[0],
    ringColors[1],
    ringColors[2] ?? ringColors[0],
  ];

  return (
    <View style={[{ width: size, height: size }, style]}>
      {ring ? (
        <LinearGradient
          colors={resolvedRingColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            padding: ringInset,
            shadowColor: "#FF00C8",
            shadowOpacity: 0.16,
            shadowRadius: Math.max(4, Math.round(size * 0.14)),
            shadowOffset: { width: 0, height: 0 },
            elevation: 2,
          }}
        >
          <View
            style={{
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              overflow: "hidden",
              backgroundColor,
              borderWidth,
              borderColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: innerSize, height: innerSize }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ) : (
              <Ionicons name={iconName} size={iconSize} color={iconColor} />
            )}
          </View>
        </LinearGradient>
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
            backgroundColor,
            borderWidth,
            borderColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: size, height: size }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <Ionicons name={iconName} size={iconSize} color={iconColor} />
          )}
        </View>
      )}
    </View>
  );
}
