import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";

type TopTicketsButtonProps = {
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function TopTicketsButton({ onPress, accessibilityLabel = "Bilhetes" }: TopTicketsButtonProps) {
  const router = useRouter();
  const handlePress = onPress ?? (() => router.push("/wallet"));

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          borderRadius: tokens.layout.touchTarget / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
        },
        pressed ? { opacity: 0.92, backgroundColor: "rgba(255,255,255,0.18)" } : null,
      ]}
    >
      <Ionicons name="ticket-outline" size={24} color="rgba(255,255,255,1)" />
    </Pressable>
  );
}
