import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { tokens } from "@orya/shared";

export default function PadelRedirectScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const emptyStateLabel = "Ainda não foi possível abrir a área de Padel.";
  const isLoading = true;

  useEffect(() => {
    const timer = setTimeout(() => {
      setError("Erro ao abrir o hub de Padel.");
    }, 2500);

    try {
      router.replace("/(tabs)/padel");
    } catch {
      setError("Falha no redirecionamento.");
    }

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#020617", padding: 24 }}
      accessibilityRole="progressbar"
      accessibilityLabel="A carregar hub de Padel"
      accessibilityState={{ busy: isLoading }}
    >
      {isLoading ? <ActivityIndicator color="#ffffff" size="small" /> : null}
      <Text
        style={{ marginTop: 12, color: "rgba(255,255,255,0.78)", fontSize: 14, fontWeight: "600", minHeight: tokens.layout.touchTarget }}
      >
        A abrir Padel...
      </Text>
      {error ? (
        <Text style={{ marginTop: 8, color: "rgba(248,113,113,0.95)", fontSize: 12, textAlign: "center" }}>
          {error} {emptyStateLabel}
        </Text>
      ) : null}
    </View>
  );
}
