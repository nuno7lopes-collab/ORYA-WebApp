import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassPill } from "../../components/liquid/GlassPill";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "password" | "otp";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

export default function SignInScreen() {
  const t = i18n.pt.auth;
  const router = useRouter();
  const redirectTo = useMemo(() => Linking.createURL("/auth/callback"), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mode, setMode] = useState<AuthMode>("password");
  const [isSignUp, setIsSignUp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVariant, setOtpVariant] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    setErrorMessage(null);
    setMagicLinkSent(false);
    setOtpSent(false);
    setOtpCode("");
    setOtpVariant(null);
  }, [email]);

  const handleSignIn = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      if (!isValidEmail(email)) {
        throw new Error("Email inválido.");
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          router.replace("/");
          return;
        }
        Alert.alert("Confirma o email", "Enviámos um link de confirmação para o teu email.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.session) {
        throw new Error("Sessão não criada. Verifica o email e a password.");
      }
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      router.replace("/");
    } catch (err: any) {
      const message = err?.message ?? t.errorGeneric;
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Não foi possível obter o token da Apple.");
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      router.replace("/");
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED") return;
      const message = err?.message ?? "Erro ao entrar com Apple.";
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google") => {
    try {
      setErrorMessage(null);
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === "success" && result.url) {
          const parsed = Linking.parse(result.url);
          const params = parsed.queryParams ?? {};
          const code = typeof params.code === "string" ? params.code : undefined;
          const accessToken = typeof params.access_token === "string" ? params.access_token : undefined;
          const refreshToken = typeof params.refresh_token === "string" ? params.refresh_token : undefined;
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          } else if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          }
          router.replace("/");
          return;
        }
      }
    } catch (err: any) {
      const message = err?.message ?? "Erro ao autenticar.";
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      if (!isValidEmail(email)) {
        throw new Error("Email inválido.");
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      setOtpSent(false);
      setOtpVariant("link");
      Alert.alert("Enviado", "Enviámos um link mágico para o teu email.");
    } catch (err: any) {
      const message = err?.message ?? "Erro ao enviar magic link.";
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      if (!isValidEmail(email)) {
        throw new Error("Email inválido.");
      }
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      router.replace("/");
    } catch (err: any) {
      const message = err?.message ?? "Código inválido.";
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      if (!isValidEmail(email)) {
        throw new Error("Email inválido.");
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setOtpSent(true);
      setOtpVariant("code");
      Alert.alert("Código enviado", "Confirma o código enviado para o teu email.");
    } catch (err: any) {
      const message = err?.message ?? "Erro ao enviar código.";
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LiquidBackground variant="deep">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <View className="gap-6">
          <View>
            <Text className="text-white text-3xl font-semibold mb-2">{t.signInTitle}</Text>
            <Text className="text-white/60 text-sm">Continua para a tua experiência ORYA.</Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <GlassPill label="B2C" variant="accent" />
            <GlassPill label="Apple-like" variant="muted" />
          </View>

          <View className="gap-3">
            {appleAvailable ? (
              <Pressable
                onPress={handleApple}
                disabled={loading}
                style={({ pressed }) => [
                  {
                    minHeight: tokens.layout.touchTarget,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 10,
                    opacity: pressed || loading ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="logo-apple" size={18} color="#0b101a" />
                <Text className="text-black font-semibold">Entrar com Apple</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => handleOAuth("google")}
              disabled={loading}
              style={({ pressed }) => [
                {
                  minHeight: tokens.layout.touchTarget,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.2)",
                  backgroundColor: pressed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 10,
                },
              ]}
            >
              <Ionicons name="logo-google" size={18} color="white" />
              <Text className="text-white font-semibold">Entrar com Google</Text>
            </Pressable>
          </View>

          <GlassSurface intensity={55}>
            <Text className="text-white/70 text-xs uppercase tracking-[0.2em] mb-2">Email</Text>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemplo.pt"
              placeholderTextColor={tokens.colors.textMuted}
              style={{ minHeight: tokens.layout.touchTarget }}
            />

            <View className="flex-row gap-2 mb-4">
              {(["password", "otp"] as AuthMode[]).map((item) => {
                const active = mode === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setMode(item);
                      setOtpSent(false);
                      setOtpCode("");
                      setMagicLinkSent(false);
                    }}
                    className="flex-1 rounded-full border border-white/10"
                    style={{
                      minHeight: tokens.layout.touchTarget,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                      {item === "password" ? "Password" : "Código"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === "password" ? (
              <>
                <Text className="text-white/70 text-xs uppercase tracking-[0.2em] mb-2">Password</Text>
                <TextInput
                  className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={tokens.colors.textMuted}
                  style={{ minHeight: tokens.layout.touchTarget }}
                />
                <Pressable
                  className="bg-emerald-400 rounded-xl px-4 py-3 items-center"
                  onPress={handleSignIn}
                  disabled={loading || !email || !password}
                  style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                >
                  <Text className="text-black font-semibold">
                    {loading ? "A processar..." : isSignUp ? "Criar conta" : t.signIn}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsSignUp((prev) => !prev)}
                  disabled={loading}
                  className="mt-3"
                >
                  <Text className="text-xs text-white/70 text-center">
                    {isSignUp ? "Já tens conta? Entrar" : "Ainda não tens conta? Criar"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 items-center"
                  onPress={handleSendOtp}
                  disabled={loading || !email}
                  style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                >
                  <Text className="text-white font-semibold">{loading ? "A enviar..." : "Enviar código"}</Text>
                </Pressable>

                <Pressable onPress={handleMagicLink} disabled={loading || !email} className="mt-3">
                  <Text className="text-xs text-emerald-200 text-center">
                    {magicLinkSent ? "Link enviado" : "Enviar magic link"}
                  </Text>
                </Pressable>

                {otpSent ? (
                  <View className="mt-4 gap-2">
                    <Text className="text-white/60 text-xs uppercase tracking-[0.2em]">
                      Código recebido
                    </Text>
                    <TextInput
                      className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      placeholder="Código"
                      placeholderTextColor={tokens.colors.textMuted}
                      keyboardType="number-pad"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    />
                    <Pressable
                      onPress={handleOtpVerify}
                      disabled={loading || !otpCode || !email}
                      className="rounded-xl bg-emerald-400 px-4 py-3 items-center"
                    >
                      <Text className="text-black font-semibold">Validar código</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text className="mt-4 text-xs text-white/50 text-center">
                    {otpVariant === "link"
                      ? "O link também está no teu email."
                      : "Vamos enviar um código para confirmares a conta."}
                  </Text>
                )}
              </>
            )}

            {errorMessage ? <Text className="mt-4 text-xs text-rose-200">{errorMessage}</Text> : null}
          </GlassSurface>
        </View>
      </ScrollView>
    </LiquidBackground>
  );
}
