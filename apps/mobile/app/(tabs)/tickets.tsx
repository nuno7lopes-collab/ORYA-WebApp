import { Text, View } from "react-native";
import { i18n } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";

export default function TicketsScreen() {
  const t = i18n.pt.tickets;
  return (
    <LiquidBackground>
      <View className="flex-1 px-6 pt-14">
        <Text className="text-white text-2xl font-semibold mb-2">{t.title}</Text>
        <Text className="text-white/60 text-sm mb-5">A tua carteira de bilhetes e histórico.</Text>

        <SectionHeader title="Ativos" />
        <GlassSurface intensity={52} padding={16}>
          <Text className="text-white/70 text-sm">{t.empty}</Text>
        </GlassSurface>

        <View className="mt-6">
          <SectionHeader title="Histórico" />
          <GlassSurface intensity={45} padding={16}>
            <Text className="text-white/60 text-sm">
              As compras anteriores aparecem aqui assim que concluirmos a carteira mobile.
            </Text>
          </GlassSurface>
        </View>
      </View>
    </LiquidBackground>
  );
}
