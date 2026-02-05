import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/auth/GlassCard";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { trackEvent } from "../../lib/analytics";
import { setLastAuthMethod } from "../../lib/authMethod";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const parseAuthError = (err: any) => {
  const message = String(err?.message ?? err ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return { kind: "invalid_credentials", message: "Email ou password incorretos." };
  }
  if (lower.includes("email") && lower.includes("confirm")) {
    return { kind: "email_not_confirmed", message: "Confirma o email antes de continuar." };
  }
  if (lower.includes("user") && lower.includes("already") || lower.includes("already registered")) {
    return { kind: "user_exists", message: "Já existe uma conta com este email." };
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return { kind: "signup_disabled", message: "Registo temporariamente indisponível." };
  }
  if (lower.includes("password")) {
    return { kind: "invalid_password", message: message || "Password inválida." };
  }
  if (lower.includes("email")) {
    return { kind: "invalid_email", message: "Email inválido." };
  }
  return { kind: "unknown", message: "Não foi possível entrar. Tenta novamente." };
};

export default function AuthEmailScreen() {
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    setLastAuthMethod("email").catch(() => undefined);
  }, []);

  const triggerHaptic = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore haptics failures.
    }
  };

  const handleEmailAuth = async () => {
    if (loading) return;
    await triggerHaptic();
    setLoading(true);
    setFormError(null);
    setInfoMessage(null);
    setShowResend(false);
    try {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        setFormError("Email inválido.");
        trackEvent("auth_fail_email", { reason: "invalid_email" });
        return;
      }
      if (!password) {
        setFormError("Preenche a password.");
        trackEvent("auth_fail_email", { reason: "empty_password" });
        return;
      }
      trackEvent("auth_start_email", { mode: isSignUp ? "signup" : "password" });

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: Linking.createURL("auth/callback"),
          },
        });
        if (error) throw error;
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          trackEvent("auth_success_email", { mode: "signup" });
          router.replace("/");
          return;
        }
        trackEvent("auth_success_email", { mode: "signup_pending" });
        setInfoMessage("Confirma o email. Enviámos um link para terminares o registo.");
        Alert.alert("Confirma o email", "Enviámos um link de confirmação para o teu email.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (!data?.session) throw new Error("Sessão não criada.");
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      trackEvent("auth_success_email", { mode: "password" });
      router.replace("/");
    } catch (err: any) {
      const parsed = parseAuthError(err);
      trackEvent("auth_fail_email", { reason: parsed.kind });

      if (parsed.kind === "invalid_credentials") {
        setFormError("Email ou password incorretos.");
        return;
      }

      if (parsed.kind === "user_exists") {
        setFormError("Já existe uma conta com este email. Entra com a tua password.");
        if (isSignUp) setIsSignUp(false);
        return;
      }

      if (parsed.kind === "email_not_confirmed") {
        setFormError("Confirma o email para continuar.");
        setShowResend(true);
        return;
      }

      setFormError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading) return;
    setLoading(true);
    setFormError(null);
    try {
      await supabase.auth.resend({ type: "signup", email: normalizeEmail(email) });
      setInfoMessage("Link reenviado. Verifica o email.");
      setShowResend(false);
    } catch {
      setFormError("Não foi possível reenviar o email.");
    } finally {
      setLoading(false);
    }
  };

  if (!authLoading && session) {
    return <Redirect href="/" />;
  }

  if (authLoading) {
    return (
      <LiquidBackground variant="deep">
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" />
        </View>
      </LiquidBackground>
    );
  }

  return (
    <LiquidBackground variant="deep">
      <View style={styles.backgroundLayer} pointerEvents="none">
        <LinearGradient
          colors={["rgba(40, 60, 120, 0.28)", "transparent"]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.nebulaOne}
        />
        <LinearGradient
          colors={["rgba(90, 120, 200, 0.22)", "transparent"]}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 1, y: 1 }}
          style={styles.nebulaTwo}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0.04)", "transparent"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>

        <View style={styles.centerBlock}>
          <View style={styles.header}>
            <Text style={styles.title}>Entrar com e-mail</Text>
            <Text style={styles.subtitle}>Usa o teu e-mail para continuar na ORYA.</Text>
          </View>

          <GlassCard style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemplo.pt"
                placeholderTextColor="rgba(255,255,255,0.35)"
                accessibilityLabel="Email"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                textContentType={isSignUp ? "newPassword" : "password"}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                accessibilityLabel="Password"
              />
            </View>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
            {showResend ? (
              <Pressable onPress={handleResend} disabled={loading} style={styles.resendLink}>
                <Text style={styles.resendText}>Reenviar email de confirmação</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleEmailAuth}
              disabled={loading}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !loading ? styles.primaryPressed : null,
                loading ? styles.primaryDisabled : null,
              ]}
            >
            {loading ? (
              <ActivityIndicator color="#0b0f17" />
            ) : (
              <Text style={styles.primaryText}>{isSignUp ? "Criar conta" : "Entrar"}</Text>
            )}
          </Pressable>

            <Pressable
              onPress={() => setIsSignUp((prev) => !prev)}
              disabled={loading}
              accessibilityRole="button"
              style={styles.toggleLink}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? "Já tens conta? Entrar" : "Ainda não tens conta? Criar"}
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </ScrollView>
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 16,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  nebulaOne: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -90,
    right: -130,
  },
  nebulaTwo: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    bottom: -120,
    left: -140,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    color: "rgba(148, 214, 255, 0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  centerBlock: {
    flexGrow: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  header: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 380,
  },
  fieldGroup: {
    gap: 8,
  },
  errorText: {
    marginTop: 6,
    color: "rgba(248, 113, 113, 0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  infoText: {
    marginTop: 6,
    color: "rgba(148, 214, 255, 0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  resendLink: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 44,
    justifyContent: "center",
  },
  resendText: {
    fontSize: 12,
    color: "rgba(148, 214, 255, 0.9)",
    fontWeight: "600",
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.6)",
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    color: "#ffffff",
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 54,
    width: "100%",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(12, 18, 28, 0.18)",
    shadowColor: "rgba(0,0,0,0.32)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 3,
  },
  primaryPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b0f17",
    textAlign: "center",
  },
  toggleLink: {
    marginTop: 6,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  toggleText: {
    fontSize: 12,
    color: "rgba(148, 214, 255, 0.85)",
    fontWeight: "600",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
