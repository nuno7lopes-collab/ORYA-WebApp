import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { tokens } from "@orya/shared";

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const router = useRouter();
  const [message, setMessage] = useState("A validar sessão...");

  useEffect(() => {
    const run = async () => {
      if (params?.error) {
        setMessage(params.error_description ?? "Não foi possível autenticar.");
        return;
      }
      const code = Array.isArray(params.code) ? params.code[0] : params.code;
      const accessToken = Array.isArray(params.access_token) ? params.access_token[0] : params.access_token;
      const refreshToken = Array.isArray(params.refresh_token) ? params.refresh_token[0] : params.refresh_token;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message ?? "Falha ao criar sessão.");
          return;
        }
        router.replace("/");
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setMessage(error.message ?? "Falha ao criar sessão.");
          return;
        }
        router.replace("/");
        return;
      }

      setMessage("Código inválido.");
    };
    run();
  }, [params, router]);

  return (
    <LiquidBackground variant="deep">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <GlassSurface intensity={60} padding={24} style={{ width: "100%", maxWidth: 360 }}>
          <View style={{ alignItems: "center", gap: tokens.spacing.md }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 6, color: "white", textAlign: "center" }}>{message}</Text>
          </View>
        </GlassSurface>
      </View>
    </LiquidBackground>
  );
}
