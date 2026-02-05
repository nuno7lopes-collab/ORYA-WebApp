import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { trackEvent } from "../../lib/analytics";

type ParsedAuth = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  errorDescription?: string;
};

const parseAuthUrl = (url: string): ParsedAuth => {
  const parsed = Linking.parse(url);
  const params = { ...(parsed.queryParams ?? {}) } as Record<string, string | string[] | undefined>;
  const fragment = url.split("#")[1];

  if (fragment) {
    const fragmentParams = new URLSearchParams(fragment);
    fragmentParams.forEach((value, key) => {
      if (!params[key]) params[key] = value;
    });
  }

  const pick = (key: string) => {
    const value = params[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0];
    return undefined;
  };

  return {
    code: pick("code"),
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
    error: pick("error"),
    errorDescription: pick("error_description"),
  };
};

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const searchParams = useLocalSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("A confirmar o teu e-mail...");
  const handledRef = useRef(false);

  const fallbackUrl = useMemo(() => {
    const entries = Object.entries(searchParams ?? {});
    if (!entries.length) return null;
    const query = new URLSearchParams();
    entries.forEach(([key, value]) => {
      if (typeof value === "string") query.append(key, value);
      if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    });
    const base = Linking.createURL("auth/callback");
    const qs = query.toString();
    return qs ? `${base}?${qs}` : null;
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const handleUrl = async (url: string | null) => {
      if (!url || handledRef.current) return;
      handledRef.current = true;

      const { code, accessToken, refreshToken, error, errorDescription } = parseAuthUrl(url);
      if (error) {
        trackEvent("auth_fail_email", { reason: error });
        setStatus("error");
        setMessage(errorDescription || "Não foi possível confirmar o email.");
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          throw new Error("Resposta de confirmação inválida.");
        }

        trackEvent("auth_success_email", { mode: "confirm" });
        router.replace("/");
      } catch (err: any) {
        trackEvent("auth_fail_email", { reason: "callback_error" });
        if (!active) return;
        setStatus("error");
        setMessage("Não foi possível confirmar o email. Tenta novamente.");
      }
    };

    const start = async () => {
      const initialUrl = await Linking.getInitialURL();
      await handleUrl(initialUrl ?? fallbackUrl);
    };

    start();

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [fallbackUrl, router]);

  if (!authLoading && session) {
    return <Redirect href="/" />;
  }

  return (
    <LiquidBackground variant="deep">
      <View style={styles.container}>
        {status === "loading" ? (
          <>
            <ActivityIndicator color="rgba(255,255,255,0.8)" />
            <Text style={styles.message}>{message}</Text>
          </>
        ) : (
          <>
            <Text style={styles.message}>{message}</Text>
            <Pressable
              onPress={() => router.replace("/auth")}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.buttonText}>Voltar ao login</Text>
            </Pressable>
          </>
        )}
      </View>
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  message: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
