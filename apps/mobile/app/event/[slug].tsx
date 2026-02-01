import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function EventDetail() {
  const { slug } = useLocalSearchParams();

  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-2">Evento</Text>
      <Text className="text-white/60">{String(slug)}</Text>
      <Text className="text-white/70 mt-6">
        Detalhe do evento (checkout será integrado na Fase 2.2).
      </Text>
    </View>
  );
}
