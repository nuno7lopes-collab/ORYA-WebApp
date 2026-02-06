import { Linking, Pressable, Text, View } from "react-native";
import { useMemo } from "react";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { Ionicons } from "../../components/icons/Ionicons";
import { useIpLocation } from "../../features/onboarding/hooks";
import { tokens } from "@orya/shared";
import { useRouter } from "expo-router";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";

export default function MapScreen() {
  const topPadding = useTopHeaderPadding(24);
  const isFocused = useIsFocused();
  const { data: ipLocation } = useIpLocation(isFocused);
  const router = useRouter();
  const navigation = useNavigation();
  const query = useMemo(() => {
    const city = ipLocation?.city ?? "";
    return city ? `eventos em ${city}` : "eventos ORYA";
  }, [ipLocation?.city]);
  const mapUrl = useMemo(
    () => `http://maps.apple.com/?q=${encodeURIComponent(query)}`,
    [query],
  );

  const handleOpenMap = async () => {
    try {
      await Linking.openURL(mapUrl);
    } catch {
      // ignore
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader />
      <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20 }}>
        <Pressable
          onPress={() => safeBack(router, navigation)}
          className="flex-row items-center gap-2 mb-4"
          style={{ minHeight: tokens.layout.touchTarget }}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
        </Pressable>
        <GlassCard intensity={55}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="map-outline" size={18} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Mapa</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Abre o mapa para ver eventos com pins próximos de ti.
            </Text>
            <Pressable
              onPress={handleOpenMap}
              className="rounded-2xl bg-white/90 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget, alignItems: "center" }}
            >
              <Text style={{ color: "#0b101a", fontWeight: "700" }}>Abrir mapa</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </LiquidBackground>
  );
}
