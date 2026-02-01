import { Text, View } from "react-native";
import { i18n } from "@orya/shared";

export default function TicketsScreen() {
  const t = i18n.pt.tickets;
  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-6">{t.title}</Text>
      <Text className="text-white/60">{t.empty}</Text>
    </View>
  );
}
