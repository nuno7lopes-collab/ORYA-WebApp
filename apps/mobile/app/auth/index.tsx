import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { safePush } from "../../lib/navigation";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthBackground } from "../../components/liquid/AuthBackground";
import { AuthButton } from "../../components/auth/AuthButton";
import { GlassCard } from "../../components/auth/GlassCard";
import { LegalLinks } from "../../components/auth/LegalLinks";
import { AccountLinkModal } from "../../components/auth/AccountLinkModal";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { AuthMethod, setLastAuthMethod } from "../../lib/authMethod";
import { trackEvent } from "../../lib/analytics";
import { getMobileEnv } from "../../lib/env";
import { tokens, useTranslation } from "@orya/shared";

WebBrowser.maybeCompleteAuthSession();

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
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ next?: string }>();
  const { loading, session } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busyMethod, setBusyMethod] = useState<AuthMethod | null>(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const mountedRef = useRef(true);
  const emailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const env = getMobileEnv();
  const showDevHints = __DEV__ || env.appEnv !== "prod";
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const compactLayout = screenWidth < 370;
  const tallScreen = screenHeight >= 820;
  const termsUrl = `${baseUrl}/termos`;
  const privacyUrl = `${baseUrl}/privacidade`;
  const nextRoute = useMemo(() => {
    const raw = params.next;
    const normalize = (value: string) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    if (Array.isArray(raw)) return raw[0] ? normalize(raw[0]) : null;
    if (typeof raw === "string" && raw.trim().length > 0) return normalize(raw);
    return null;
  }, [params.next]);
  const redirectTo = useMemo(() => {
    const base = Linking.createURL("auth/callback");
    return nextRoute ? `${base}?next=${encodeURIComponent(nextRoute)}` : base;
  }, [nextRoute]);

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
        Alert.alert(t("auth:errorGeneric"), t("auth:devAppleHint"));
      } else {
        Alert.alert(t("auth:errorGeneric"), t("auth:errorRetry"));
      }
      return;
    }
    Alert.alert(t("auth:errorGeneric"), t("auth:errorRetry"));
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
      router.replace(nextRoute ?? "/");
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
        router.replace(nextRoute ?? "/");
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
    safePush(router, { pathname: "/auth/email", params: nextRoute ? { next: nextRoute } : {} });
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }
    emailTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setBusyMethod(null);
    }, 1200);
  };

  const handleLinkContinue = () => {
    setLinkModalVisible(false);
    safePush(router, { pathname: "/auth/email", params: nextRoute ? { next: nextRoute } : {} });
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
    return <Redirect href={nextRoute ?? "/"} />;
  }

  return (
    <AuthBackground>
      <View style={styles.readabilityLayer} pointerEvents="none">
        <LinearGradient
          colors={["rgba(2,6,12,0.55)", "rgba(4,10,18,0.2)", "rgba(2,6,12,0.6)"]}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          compactLayout ? styles.containerCompact : null,
          {
            paddingTop: insets.top + (tallScreen ? 44 : 28),
            paddingBottom: Math.max(insets.bottom + 28, 40),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, compactLayout ? styles.headerCompact : null]}>
          <Text style={styles.title}>{t("auth:heroTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth:heroSubtitle")}</Text>
        </View>

        <GlassCard style={compactLayout ? styles.cardCompact : styles.card} intensity={82}>
          <View style={styles.buttonStack}>
            {appleAvailable ? (
              <AuthButton
                label={t("auth:apple")}
                variant="apple"
                onPress={handleApple}
                loading={busyMethod === "apple"}
                disabled={Boolean(busyMethod)}
                accessibilityLabel={t("auth:apple")}
              />
            ) : null}
            <AuthButton
              label={t("auth:google")}
              variant="google"
              onPress={handleGoogle}
              loading={busyMethod === "google"}
              disabled={Boolean(busyMethod)}
              accessibilityLabel={t("auth:google")}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t("auth:divider")}</Text>
            <View style={styles.divider} />
          </View>

          <AuthButton
            label={t("auth:emailButton")}
            variant="email"
            onPress={handleEmail}
            loading={busyMethod === "email"}
            disabled={Boolean(busyMethod)}
            accessibilityLabel={t("auth:emailButton")}
          />

          <View style={styles.legal}>
            <LegalLinks termsUrl={termsUrl} privacyUrl={privacyUrl} />
          </View>
        </GlassCard>
      </ScrollView>

      <AccountLinkModal
        visible={linkModalVisible}
        onClose={() => setLinkModalVisible(false)}
        onContinueEmail={handleLinkContinue}
      />
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  readabilityLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flexGrow: 1,
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  containerCompact: {
    paddingHorizontal: 16,
    gap: 20,
  },
  header: {
    alignItems: "center",
    gap: 12,
    maxWidth: 360,
    width: "100%",
  },
  headerCompact: {
    gap: 10,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: tokens.typography.fontFamily?.headingBold ?? "System",
    letterSpacing: tokens.typography.letterSpacing?.tight ?? -0.2,
    color: "#ffffff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(235,241,251,0.86)",
    textAlign: "center",
    lineHeight: 22,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
    maxWidth: 340,
  },
  card: {
    width: "100%",
    maxWidth: 400,
  },
  cardCompact: {
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
    backgroundColor: "rgba(226,236,255,0.26)",
  },
  dividerText: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: "rgba(226,236,255,0.74)",
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  legal: {
    marginTop: 8,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
