import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/auth/GlassCard";
import { Ionicons } from "../../components/icons/Ionicons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { trackEvent } from "../../lib/analytics";
import { setLastAuthMethod } from "../../lib/authMethod";
import { api, unwrapApiResponse } from "../../lib/api";

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
    if (lower.includes("least") || lower.includes("mín") || lower.includes("min")) {
      return { kind: "invalid_password", message: "A password deve ter pelo menos 6 caracteres." };
    }
    return { kind: "invalid_password", message: message || "Password inválida." };
  }
  if (lower.includes("email")) {
    return { kind: "invalid_email", message: "Email inválido." };
  }
  return { kind: "unknown", message: "Não foi possível entrar. Tenta novamente." };
};

const checkEmailExists = async (email: string): Promise<boolean> => {
  const response = await api.request<unknown>("/api/auth/check-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const payload = unwrapApiResponse<{ exists?: boolean }>(response);
  return Boolean(payload?.exists);
};

export default function AuthEmailScreen() {
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [checkedEmail, setCheckedEmail] = useState("");
  const passwordInputRef = useRef<TextInput>(null);

  const normalizedEmail = normalizeEmail(email);
  const emailValid = isValidEmail(normalizedEmail);
  const passwordValid = isSignUp ? password.length >= 6 : password.length > 0;
  const canSubmit = emailValid && passwordValid;
  const isSubmitDisabled = loading || !canSubmit;

  useEffect(() => {
    setLastAuthMethod("email").catch(() => undefined);
  }, []);

  useEffect(() => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setEmailExists(null);
      setCheckedEmail("");
      return;
    }
    if (checkedEmail && checkedEmail !== normalized) {
      setEmailExists(null);
    }
  }, [checkedEmail, email]);

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

      let resolvedExists = emailExists;
      if (resolvedExists == null || checkedEmail !== normalizedEmail) {
        try {
          resolvedExists = await checkEmailExists(normalizedEmail);
          setEmailExists(resolvedExists);
          setCheckedEmail(normalizedEmail);
        } catch {
          resolvedExists = checkedEmail === normalizedEmail ? emailExists : null;
        }
      }

      if (!isSignUp && resolvedExists === false) {
        setIsSignUp(true);
        setFormError("Ainda não tens conta. Cria uma agora.");
        trackEvent("auth_fail_email", { reason: "no_account" });
        return;
      }
      if (isSignUp && resolvedExists === true) {
        setIsSignUp(false);
        setFormError("Já existe uma conta com este email. Entra com a tua password.");
        trackEvent("auth_fail_email", { reason: "user_exists" });
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
        setInfoMessage("Link enviado. Confirma o email e entra com a tua password.");
        setShowResend(true);
        setIsSignUp(false);
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
        if (!isSignUp) {
          const normalized = normalizeEmail(email);
          let exists = emailExists;
          if (checkedEmail !== normalized || exists == null) {
            try {
              exists = await checkEmailExists(normalized);
              setEmailExists(exists);
              setCheckedEmail(normalized);
            } catch {
              exists = checkedEmail === normalized ? emailExists : null;
            }
          }
          if (exists === false) {
            setFormError("Ainda não tens conta. Cria uma agora.");
            setIsSignUp(true);
          } else {
            setFormError("Email ou password incorretos.");
          }
        } else {
          setFormError("Email ou password incorretos.");
        }
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

  const handlePasswordReset = async () => {
    if (loading || resetting) return;
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setFormError("Email inválido.");
      return;
    }
    setResetting(true);
    setFormError(null);
    setInfoMessage(null);
    try {
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: Linking.createURL("auth/callback"),
      });
      setInfoMessage("Enviámos um link para recuperar a password.");
    } catch {
      setFormError("Não foi possível enviar o email de recuperação.");
    } finally {
      setResetting(false);
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@exemplo.pt"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    accessibilityLabel="Email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      ref={passwordInputRef}
                      style={[styles.input, styles.inputWithIcon]}
                      secureTextEntry={!passwordVisible}
                      textContentType={isSignUp ? "newPassword" : "password"}
                      autoComplete="password"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      accessibilityLabel="Password"
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        if (canSubmit) handleEmailAuth();
                      }}
                    />
                    <Pressable
                      onPress={() => setPasswordVisible((prev) => !prev)}
                      style={styles.passwordToggle}
                      accessibilityLabel={passwordVisible ? "Esconder password" : "Mostrar password"}
                    >
                      <Ionicons
                        name={passwordVisible ? "eye-off" : "eye"}
                        size={18}
                        color="rgba(255,255,255,0.65)"
                      />
                    </Pressable>
                  </View>
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
                  disabled={isSubmitDisabled}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !isSubmitDisabled ? styles.primaryPressed : null,
                  ]}
                >
                  <View style={[styles.primaryInner, isSubmitDisabled ? styles.primaryDisabled : null]}>
                    {loading ? (
                      <ActivityIndicator color="#0b0f17" />
                    ) : (
                      <Text style={[styles.primaryText, isSubmitDisabled ? styles.primaryTextDisabled : null]}>
                        {isSignUp ? "Criar conta" : "Entrar"}
                      </Text>
                    )}
                  </View>
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

                {!isSignUp ? (
                  <Pressable
                    onPress={handlePasswordReset}
                    disabled={loading || resetting}
                    accessibilityRole="button"
                    style={styles.resetLink}
                  >
                    <Text style={styles.resetText}>
                      {resetting ? "A enviar link..." : "Recuperar password"}
                    </Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  inputWrap: {
    position: "relative",
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    minHeight: 44,
  },
  primaryButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 5,
  },
  primaryInner: {
    minHeight: 54,
    width: "100%",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
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
    backgroundColor: "rgba(255,255,255,0.75)",
    borderColor: "rgba(255,255,255,0.6)",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b0f17",
    textAlign: "center",
  },
  primaryTextDisabled: {
    color: "rgba(11, 15, 23, 0.45)",
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
  resetLink: {
    marginTop: 2,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  resetText: {
    fontSize: 12,
    color: "rgba(200, 220, 255, 0.85)",
    fontWeight: "600",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
