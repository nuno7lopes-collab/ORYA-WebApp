import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { GlassSurface } from "../../components/glass/GlassSurface";

export default function EventDetail() {
  const { slug } = useLocalSearchParams();

  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-2">Evento</Text>
      <Text className="text-white/60 mb-4">{String(slug)}</Text>
      <GlassSurface intensity={45}>
        <Text className="text-white/70">
          Detalhe do evento e checkout entram na próxima iteração (Fase 2.2).
        </Text>
      </GlassSurface>
    </View>
  );
}
