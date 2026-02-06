import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { AuthBackground } from "../../components/liquid/AuthBackground";
import { AuthButton } from "../../components/auth/AuthButton";
import { GlassCard } from "../../components/auth/GlassCard";
import { LegalLinks } from "../../components/auth/LegalLinks";
import { HelpSheet } from "../../components/auth/HelpSheet";
import { AccountLinkModal } from "../../components/auth/AccountLinkModal";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { AuthMethod, setLastAuthMethod } from "../../lib/authMethod";
import { trackEvent } from "../../lib/analytics";
import { getMobileEnv } from "../../lib/env";

WebBrowser.maybeCompleteAuthSession();

const ORYA_LOGO = require("../../assets/orya_logo.png");

const parseAuthUrl = (url: string) => {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const pick = (key: string) => {
    const value = (params as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0];
    return undefined;
  };
  return {
    code: pick("code"),
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
  };
};

const isAccountLinkError = (err: any) => {
  const message = String(err?.message ?? "").toLowerCase();
  const code = String(err?.code ?? "").toLowerCase();
  return (
    code.includes("email") && code.includes("exists") ||
    code.includes("user") && code.includes("exists") ||
    message.includes("already") && message.includes("registered") ||
    (message.includes("email") && message.includes("already")) ||
    message.includes("identity already exists")
  );
};

const isCancelError = (err: any) => err?.code === "ERR_CANCELED" || err?.code === "ERR_CANCELLED";

export default function AuthGatewayScreen() {
  const router = useRouter();
  const { loading, session } = useAuth();
  const redirectTo = useMemo(() => Linking.createURL("auth/callback"), []);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busyMethod, setBusyMethod] = useState<AuthMethod | null>(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const mountedRef = useRef(true);
  const emailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const env = getMobileEnv();
  const showDevHints = __DEV__ || env.appEnv !== "prod";
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const termsUrl = `${baseUrl}/termos`;
  const privacyUrl = `${baseUrl}/privacidade`;

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mountedRef.current) setAppleAvailable(available);
      })
      .catch(() => {
        if (mountedRef.current) setAppleAvailable(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      trackEvent("auth_screen_view");
    }
  }, [loading, session]);

  const setLastMethod = async (method: AuthMethod) => {
    await setLastAuthMethod(method);
  };

  const triggerHaptic = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore haptics failures.
    }
  };

  const handleAuthError = (provider: AuthMethod, err: any) => {
    if (isAccountLinkError(err)) {
      trackEvent(`auth_fail_${provider}`, { reason: "email_exists" });
      setLinkModalVisible(true);
      return;
    }
    const reason = String(err?.message ?? err ?? "unknown");
    trackEvent(`auth_fail_${provider}`, { reason });
    if (
      provider === "apple" &&
      (reason.includes("host.exp.Exponent") || reason.toLowerCase().includes("unacceptable audience"))
    ) {
      if (showDevHints) {
        Alert.alert("Apple Sign In", "O login com Apple não funciona no Expo Go. Usa um development build.");
      } else {
        Alert.alert("Não foi possível entrar.", "Tenta novamente.");
      }
      return;
    }
    Alert.alert("Não foi possível entrar.", "Tenta novamente.");
  };

  const handleApple = async () => {
    if (busyMethod) return;
    setBusyMethod("apple");
    await triggerHaptic();
    trackEvent("auth_tap_apple");
    trackEvent("auth_start_apple");
    setLastMethod("apple").catch(() => undefined);
    try {
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

      trackEvent("auth_success_apple");
      router.replace("/");
    } catch (err: any) {
      if (isCancelError(err)) {
        trackEvent("auth_cancel_apple");
        return;
      }
      handleAuthError("apple", err);
    } finally {
      if (mountedRef.current) setBusyMethod(null);
    }
  };

  const handleGoogle = async () => {
    if (busyMethod) return;
    setBusyMethod("google");
    await triggerHaptic();
    trackEvent("auth_tap_google");
    trackEvent("auth_start_google");
    setLastMethod("google").catch(() => undefined);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) {
        throw new Error("URL inválida para OAuth.");
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "cancel" || result.type === "dismiss") {
        trackEvent("auth_cancel_google");
        return;
      }

      if (result.type === "success" && result.url) {
        const { code, accessToken, refreshToken } = parseAuthUrl(result.url);
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
          throw new Error("Resposta OAuth inválida.");
        }

        trackEvent("auth_success_google");
        router.replace("/");
        return;
      }

      throw new Error("OAuth interrompido.");
    } catch (err: any) {
      handleAuthError("google", err);
    } finally {
      if (mountedRef.current) setBusyMethod(null);
    }
  };

  const handleEmail = async () => {
    if (busyMethod) return;
    setBusyMethod("email");
    await triggerHaptic();
    trackEvent("auth_tap_email");
    setLastMethod("email").catch(() => undefined);
    router.push("/auth/email");
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }
    emailTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setBusyMethod(null);
    }, 1200);
  };

  const handleLinkContinue = () => {
    setLinkModalVisible(false);
    router.push("/auth/email");
  };

  if (loading) {
    return (
      <AuthBackground>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" />
        </View>
      </AuthBackground>
    );
  }

  if (!loading && session) {
    return <Redirect href="/" />;
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={ORYA_LOGO} style={styles.brandSymbol} contentFit="contain" />
            <Text style={styles.brandWordmark}>ORYA</Text>
          </View>
          <Text style={styles.title}>Entra na ORYA</Text>
          <Text style={styles.subtitle}>Descobre serviços, eventos e experiências.</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.buttonStack}>
            {appleAvailable ? (
              <AuthButton
                label="Continuar com Apple"
                variant="apple"
                onPress={handleApple}
                loading={busyMethod === "apple"}
                disabled={Boolean(busyMethod)}
                accessibilityLabel="Continuar com Apple"
              />
            ) : null}
            <AuthButton
              label="Continuar com Google"
              variant="google"
              onPress={handleGoogle}
              loading={busyMethod === "google"}
              disabled={Boolean(busyMethod)}
              accessibilityLabel="Continuar com Google"
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </View>

          <AuthButton
            label="Continuar com e-mail"
            variant="email"
            onPress={handleEmail}
            loading={busyMethod === "email"}
            disabled={Boolean(busyMethod)}
            accessibilityLabel="Continuar com e-mail"
          />

          <View style={styles.legal}>
            <LegalLinks termsUrl={termsUrl} privacyUrl={privacyUrl} />
          </View>

          <Pressable
            onPress={() => setHelpVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Precisas de ajuda"
            style={styles.helpLink}
          >
            <Text style={styles.helpText}>Precisas de ajuda?</Text>
          </Pressable>
        </GlassCard>

      </ScrollView>

      <HelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <AccountLinkModal
        visible={linkModalVisible}
        onClose={() => setLinkModalVisible(false)}
        onContinueEmail={handleLinkContinue}
      />
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  header: {
    alignItems: "center",
    gap: 10,
    maxWidth: 320,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandSymbol: {
    width: 36,
    height: 36,
  },
  brandWordmark: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#ffffff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
  },
  buttonStack: {
    gap: 12,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  dividerText: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.5)",
  },
  legal: {
    marginTop: 6,
  },
  helpLink: {
    marginTop: 4,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  helpText: {
    fontSize: 12,
    color: "rgba(148, 214, 255, 0.9)",
    fontWeight: "600",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
