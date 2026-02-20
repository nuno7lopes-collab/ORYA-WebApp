import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AuthBackground } from "../../components/liquid/AuthBackground";
import { GlassCard } from "../../components/auth/GlassCard";
import { Ionicons } from "../../components/icons/Ionicons";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { safeBack } from "../../lib/navigation";
import { trackEvent } from "../../lib/analytics";
import { tokens, useTranslation } from "@orya/shared";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ next?: string }>();
  const { loading: authLoading, session } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const newPasswordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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

  const handleSavePassword = async () => {
    if (saving) return;
    setErrorMessage(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(t("auth:resetPassword.errors.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(t("auth:resetPassword.errors.passwordMismatch"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      trackEvent("auth_success_email", { mode: "password_reset" });
      Alert.alert(
        t("auth:resetPassword.successTitle"),
        t("auth:resetPassword.successBody"),
      );
      router.replace(nextRoute ?? "/");
    } catch (err: any) {
      const raw = String(err?.message ?? "").toLowerCase();
      if (raw.includes("password") && (raw.includes("least") || raw.includes("min"))) {
        setErrorMessage(t("auth:resetPassword.errors.passwordMin"));
      } else {
        setErrorMessage(t("auth:resetPassword.errors.updateFailed"));
      }
      trackEvent("auth_fail_email", { reason: "password_reset_failed" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <AuthBackground>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" />
        </View>
      </AuthBackground>
    );
  }

  if (!session) {
    return <Redirect href={{ pathname: "/auth", params: nextRoute ? { next: nextRoute } : {} }} />;
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
              {
                paddingTop: insets.top + 24,
                paddingBottom: Math.max(insets.bottom + 28, 40),
              },
            ]}
            keyboardShouldPersistTaps="always"
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
              <View style={styles.header}>
                <Text style={styles.title}>{t("auth:resetPassword.title")}</Text>
                <Text style={styles.subtitle}>{t("auth:resetPassword.subtitle")}</Text>
              </View>

              <GlassCard style={styles.card} intensity={84}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t("auth:resetPassword.newPassword")}</Text>
                  <Pressable
                    style={styles.inputShell}
                    onPress={() => newPasswordInputRef.current?.focus()}
                    accessible={false}
                  >
                    <TextInput
                      ref={newPasswordInputRef}
                      style={styles.input}
                      secureTextEntry
                      textContentType="newPassword"
                      autoComplete="new-password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(225,235,252,0.52)"
                      accessibilityLabel={t("auth:resetPassword.newPassword")}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                    />
                  </Pressable>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t("auth:resetPassword.confirmPassword")}</Text>
                  <Pressable
                    style={styles.inputShell}
                    onPress={() => confirmPasswordInputRef.current?.focus()}
                    accessible={false}
                  >
                    <TextInput
                      ref={confirmPasswordInputRef}
                      style={styles.input}
                      secureTextEntry
                      textContentType="newPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(225,235,252,0.52)"
                      accessibilityLabel={t("auth:resetPassword.confirmPassword")}
                      returnKeyType="go"
                      onSubmitEditing={handleSavePassword}
                    />
                  </Pressable>
                </View>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Pressable
                  onPress={handleSavePassword}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: saving, busy: saving }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !saving ? styles.primaryPressed : null,
                  ]}
                >
                  <View style={[styles.primaryInner, saving ? styles.primaryDisabled : null]}>
                    {saving ? (
                      <ActivityIndicator color="#0b0f17" />
                    ) : (
                      <Text style={styles.primaryText}>{t("auth:resetPassword.save")}</Text>
                    )}
                  </View>
                </Pressable>
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
    fontSize: 14,
    color: "rgba(235,241,251,0.86)",
    textAlign: "center",
    lineHeight: 20,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
    maxWidth: 340,
  },
  card: {
    width: "100%",
    maxWidth: 400,
  },
  fieldGroup: {
    gap: 8,
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
  input: {
    minHeight: 52,
    width: "100%",
    color: "#f7fbff",
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  errorText: {
    marginTop: 2,
    color: "rgba(255, 170, 170, 0.98)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
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
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
