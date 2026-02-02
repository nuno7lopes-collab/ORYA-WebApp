import { Text, View } from "react-native";
import { i18n } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";

export default function TicketsScreen() {
  const t = i18n.pt.tickets;
  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-4">{t.title}</Text>
      <GlassSurface intensity={45}>
        <Text className="text-white/70">{t.empty}</Text>
      </GlassSurface>
    </View>
  );
}
