import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "../icons/Ionicons";
import { tokens } from "@orya/shared";
import { safePush } from "../../lib/navigation";

type TopTicketsButtonProps = {
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function TopTicketsButton({ onPress, accessibilityLabel = "Bilhetes" }: TopTicketsButtonProps) {
  const router = useRouter();
  const handlePress = onPress ?? (() => safePush(router, "/tickets"));

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
          backgroundColor: "rgba(255,255,255,0.14)",
          borderWidth: 1,
          borderColor: "rgba(208,235,255,0.28)",
          shadowColor: "rgba(0,0,0,0.45)",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
          elevation: 3,
        },
        pressed ? { opacity: 0.92, backgroundColor: "rgba(255,255,255,0.24)", transform: [{ scale: 0.97 }] } : null,
      ]}
    >
      <Ionicons name="ticket-outline" size={24} color="rgba(255,255,255,1)" />
    </Pressable>
  );
}
