import { useEffect, useMemo, useRef, useState } from "react";
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
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthBackground } from "../../components/liquid/AuthBackground";
import { GlassCard } from "../../components/auth/GlassCard";
import { Ionicons } from "../../components/icons/Ionicons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { ApiError, api, unwrapApiResponse } from "../../lib/api";
import { trackEvent } from "../../lib/analytics";
import { setLastAuthMethod } from "../../lib/authMethod";
import { normalizeUsernameInput } from "../../lib/username";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { tokens, useTranslation } from "@orya/shared";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const buildRecoveryRedirect = () => {
  const base = Linking.createURL("auth/callback");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}type=recovery`;
};

const parseAuthError = (err: any, t: (key: string) => string) => {
  const message = String(err?.message ?? err ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return { kind: "invalid_credentials", message: t("auth:email.errors.invalidCredentials") };
  }
  if (lower.includes("email") && lower.includes("confirm")) {
    return { kind: "email_not_confirmed", message: t("auth:email.errors.emailNotConfirmed") };
  }
  if (lower.includes("user") && lower.includes("already") || lower.includes("already registered")) {
    return { kind: "user_exists", message: t("auth:email.errors.userExists") };
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return { kind: "signup_disabled", message: t("auth:email.errors.signupDisabled") };
  }
  if (lower.includes("password")) {
    if (lower.includes("least") || lower.includes("mín") || lower.includes("min")) {
      return { kind: "invalid_password", message: t("auth:email.errors.passwordMin") };
    }
    return { kind: "invalid_password", message: message || t("auth:email.errors.invalidPassword") };
  }
  if (lower.includes("email")) {
    return { kind: "invalid_email", message: t("auth:email.errors.invalidEmail") };
  }
  return { kind: "unknown", message: t("auth:email.errors.unknown") };
};


export default function AuthEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ next?: string }>();
  const { loading: authLoading, session } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  const normalizedIdentifier = identifier.trim();
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedUsername = normalizeUsernameInput(identifier);
  const emailValid = isValidEmail(normalizedEmail);
  const hasAtSymbol = normalizedIdentifier.includes("@");
  const canBeUsernameIdentifier = !hasAtSymbol || normalizedIdentifier.startsWith("@");
  const signInIdentifierValid =
    emailValid || (canBeUsernameIdentifier && normalizedUsername.length >= 3);
  const identifierValid = isSignUp ? emailValid : signInIdentifierValid;
  const passwordValid = isSignUp ? password.length >= 6 : password.length > 0;
  const canSubmit = identifierValid && passwordValid;
  const isSubmitDisabled = loading || !canSubmit;
  const compactLayout = screenWidth < 370;
  const tallScreen = screenHeight >= 820;
  const identifierInvalid = identifier.length > 0 && !identifierValid;
  const identifierLabel = isSignUp ? t("common:labels.email") : t("auth:email.identifierLabel");
  const identifierPlaceholder = isSignUp
    ? t("auth:emailPlaceholder")
    : t("auth:email.identifierPlaceholder");
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
    try {
      const normalizedEmail = normalizeEmail(identifier);
      if (isSignUp && !isValidEmail(normalizedEmail)) {
        setFormError(t("auth:email.errors.invalidEmail"));
        trackEvent("auth_fail_email", { reason: "invalid_email" });
        return;
      }
      if (!isSignUp && !signInIdentifierValid) {
        setFormError(t("auth:email.errors.invalidIdentifier"));
        trackEvent("auth_fail_email", { reason: "invalid_identifier" });
        return;
      }
      if (!password) {
        setFormError(t("auth:email.errors.emptyPassword"));
        trackEvent("auth_fail_email", { reason: "empty_password" });
        return;
      }

      trackEvent("auth_start_email", { mode: isSignUp ? "signup" : "password" });

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        });
        if (error) throw error;
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          trackEvent("auth_success_email", { mode: "signup" });
          router.replace(nextRoute ?? "/");
          return;
        }
        trackEvent("auth_success_email", { mode: "signup_pending" });
        setInfoMessage(t("auth:email.linkSent"));
        setIsSignUp(false);
        Alert.alert(t("auth:email.confirmEmailTitle"), t("auth:email.confirmEmailBody"));
        return;
      }

      const loginRaw = await api.requestRaw("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: emailValid ? normalizedEmail : normalizedUsername,
          password,
        }),
      });
      const loginData = unwrapApiResponse<{ session?: { access_token?: string; refresh_token?: string } }>(
        loginRaw.data,
        loginRaw.status,
      );
      const accessToken = loginData?.session?.access_token;
      const refreshToken = loginData?.session?.refresh_token;
      if (!accessToken || !refreshToken) throw new Error(t("auth:email.errors.sessionMissing"));
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      trackEvent("auth_success_email", { mode: "password" });
      router.replace(nextRoute ?? "/");
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          trackEvent("auth_fail_email", { reason: "invalid_credentials" });
          setFormError(t("auth:email.errors.invalidCredentials"));
          return;
        }
        if (err.code === "EMAIL_NOT_CONFIRMED") {
          trackEvent("auth_fail_email", { reason: "email_not_confirmed" });
          setFormError(t("auth:email.errors.emailNotConfirmed"));
          return;
        }
        if (err.code === "RATE_LIMITED" || err.code === "THROTTLED") {
          trackEvent("auth_fail_email", { reason: "rate_limited" });
          setFormError(t("auth:email.errors.rateLimited"));
          return;
        }
      }
      const parsed = parseAuthError(err, t);
      trackEvent("auth_fail_email", { reason: parsed.kind });

      if (parsed.kind === "invalid_credentials") {
        setFormError(t("auth:email.errors.invalidCredentials"));
        return;
      }

      if (parsed.kind === "user_exists") {
        setFormError(t("auth:email.errors.userExistsSignIn"));
        if (isSignUp) setIsSignUp(false);
        return;
      }

      if (parsed.kind === "email_not_confirmed") {
        setFormError(t("auth:email.errors.emailNotConfirmed"));
        return;
      }

      setFormError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (loading || resetting) return;
    const normalized = normalizeEmail(identifier);
    if (!isValidEmail(normalized)) {
      setFormError(t("auth:email.errors.invalidEmail"));
      return;
    }
    setResetting(true);
    setFormError(null);
    setInfoMessage(null);
    try {
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: buildRecoveryRedirect(),
      });
      setInfoMessage(t("auth:email.errors.resetSent"));
    } catch {
      setFormError(t("auth:email.errors.resetFailed"));
    } finally {
      setResetting(false);
    }
  };

  if (!authLoading && session) {
    return <Redirect href={nextRoute ?? "/"} />;
  }

  if (authLoading) {
    return (
      <AuthBackground>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" />
        </View>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <View style={styles.readabilityLayer} pointerEvents="none">
        <LinearGradient
          colors={["rgba(2,6,12,0.58)", "rgba(4,10,18,0.22)", "rgba(2,6,12,0.62)"]}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={[
              styles.container,
              compactLayout ? styles.containerCompact : null,
              {
                paddingTop: insets.top + (tallScreen ? 30 : 20),
                paddingBottom: Math.max(insets.bottom + 28, 40),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => safeBack(router, navigation, "/auth")}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.back")}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(210, 233, 255, 0.95)" />
            </Pressable>

            <View style={styles.centerBlock}>
              <View style={[styles.header, compactLayout ? styles.headerCompact : null]}>
                <Text style={styles.eyebrow}>ORYA</Text>
                <Text style={styles.title}>{t("auth:email.title")}</Text>
              </View>

              <GlassCard style={compactLayout ? styles.cardCompact : styles.card} intensity={84}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{identifierLabel}</Text>
                  <View style={[styles.inputShell, identifierInvalid ? styles.inputShellError : null]}>
                    <TextInput
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={isSignUp ? "email-address" : "default"}
                      textContentType={isSignUp ? "emailAddress" : "username"}
                      autoComplete={isSignUp ? "email" : "username"}
                      value={identifier}
                      onChangeText={setIdentifier}
                      placeholder={identifierPlaceholder}
                      placeholderTextColor="rgba(225,235,252,0.52)"
                      accessibilityLabel={identifierLabel}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t("common:labels.password")}</Text>
                  <View style={[styles.inputShell, styles.inputWrap]}>
                    <TextInput
                      ref={passwordInputRef}
                      style={[styles.input, styles.inputWithIcon]}
                      secureTextEntry={!passwordVisible}
                      textContentType={isSignUp ? "newPassword" : "password"}
                      autoComplete="password"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(225,235,252,0.52)"
                      accessibilityLabel={t("common:labels.password")}
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        if (canSubmit) handleEmailAuth();
                      }}
                    />
                    <Pressable
                      onPress={() => setPasswordVisible((prev) => !prev)}
                      style={styles.passwordToggle}
                      accessibilityLabel={
                        passwordVisible ? t("auth:email.hidePassword") : t("auth:email.showPassword")
                      }
                    >
                      <Ionicons
                        name={passwordVisible ? "eye-off" : "eye"}
                        size={18}
                        color="rgba(220,232,255,0.82)"
                      />
                    </Pressable>
                  </View>
                </View>

                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
                <Text style={styles.helperText}>{t("auth:email.helper")}</Text>

                <Pressable
                  onPress={handleEmailAuth}
                  disabled={isSubmitDisabled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSubmitDisabled, busy: loading }}
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
                        {isSignUp ? t("auth:email.signUp") : t("auth:email.signIn")}
                      </Text>
                    )}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setIsSignUp((prev) => !prev)}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading }}
                  style={styles.toggleLink}
                >
                  <Text style={styles.toggleText}>
                    {isSignUp ? t("auth:email.toggleToSignIn") : t("auth:email.toggleToSignUp")}
                  </Text>
                </Pressable>

                {!isSignUp ? (
                  <Pressable
                    onPress={handlePasswordReset}
                    disabled={loading || resetting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading || resetting, busy: resetting }}
                    style={styles.resetLink}
                  >
                    <Text style={styles.resetText}>
                      {resetting ? t("auth:email.sendingReset") : t("auth:email.resetPassword")}
                    </Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    gap: 16,
  },
  containerCompact: {
    paddingHorizontal: 16,
    gap: 12,
  },
  backButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(198, 223, 255, 0.28)",
    backgroundColor: "rgba(128, 173, 238, 0.14)",
  },
  centerBlock: {
    flexGrow: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  header: {
    alignItems: "center",
    gap: 10,
    maxWidth: 360,
  },
  headerCompact: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: "rgba(215,232,255,0.9)",
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
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
  card: {
    width: "100%",
    maxWidth: 400,
  },
  cardCompact: {
    width: "100%",
    maxWidth: 380,
  },
  fieldGroup: {
    gap: 8,
  },
  errorText: {
    marginTop: 2,
    color: "rgba(255, 170, 170, 0.98)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  infoText: {
    marginTop: 2,
    color: "rgba(175, 224, 255, 0.95)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  helperText: {
    marginTop: 4,
    color: "rgba(230,238,252,0.79)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "rgba(225,237,255,0.76)",
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(211, 228, 255, 0.28)",
    backgroundColor: "rgba(234,243,255,0.13)",
    paddingHorizontal: 14,
  },
  inputShellError: {
    borderColor: "rgba(255, 171, 171, 0.68)",
    backgroundColor: "rgba(250, 125, 125, 0.12)",
  },
  input: {
    minHeight: 52,
    color: "#f7fbff",
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  inputWrap: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
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
    minWidth: 32,
    alignItems: "center",
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
    backgroundColor: "rgba(246,249,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
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
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
    color: "#0b0f17",
    textAlign: "center",
  },
  primaryTextDisabled: {
    color: "rgba(11, 15, 23, 0.45)",
  },
  toggleLink: {
    marginTop: 8,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125, 198, 255, 0.34)",
    backgroundColor: "rgba(88, 162, 255, 0.11)",
    justifyContent: "center",
  },
  toggleText: {
    fontSize: 13,
    color: "rgba(187, 225, 255, 0.98)",
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  resetLink: {
    marginTop: 6,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(184, 208, 255, 0.26)",
    backgroundColor: "rgba(214, 230, 255, 0.08)",
    justifyContent: "center",
  },
  resetText: {
    fontSize: 13,
    color: "rgba(222, 235, 255, 0.92)",
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
