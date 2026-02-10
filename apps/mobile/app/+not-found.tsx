import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0b1014" }}>
      <Text style={{ color: "white", fontSize: 20, fontWeight: "700", textAlign: "center" }}>
        Rota não encontrada
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginTop: 8 }}>
        {pathname || "/"}
      </Text>
      <Pressable
        onPress={() => router.replace("/agora")}
        style={{
          marginTop: 16,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Ir para Agora"
      >
        <Text style={{ color: "white", fontWeight: "600" }}>Ir para Agora</Text>
      </Pressable>
    </View>
  );
}
