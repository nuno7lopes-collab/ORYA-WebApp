import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "../icons/Ionicons";

type Props = {
  size: number;
  uri?: string | null;
  iconName?: string;
  iconColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function AvatarCircle({
  size,
  uri,
  iconName = "person",
  iconColor = "rgba(255,255,255,0.7)",
  backgroundColor = "rgba(255,255,255,0.08)",
  borderColor = "rgba(255,255,255,0.12)",
  borderWidth = 1,
  style,
}: Props) {
  const iconSize = Math.max(12, Math.round(size * 0.42));

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor,
          borderWidth,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
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
  );
}
