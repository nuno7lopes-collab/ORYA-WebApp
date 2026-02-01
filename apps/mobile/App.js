import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Notifications from "expo-notifications";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });
    };
    init();
  }, []);

  const signInWithApple = async () => {
    try {
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple login sem identityToken.");
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (err) {
      Alert.alert("Apple Sign-In falhou", err?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const registerPush = async () => {
    try {
      if (Platform.OS !== "ios") {
        Alert.alert("Push", "Push APNs só no iOS.");
        return;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert("Push", "Permissão de notificações não concedida.");
        return;
      }
      const token = await Notifications.getExpoPushTokenAsync();
      setPushToken(token.data);
      Alert.alert("Push token", token.data);
    } catch (err) {
      Alert.alert("Push", err?.message ?? "Erro a obter push token.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ORYA Mobile (Expo)</Text>
      <Text style={styles.subtitle}>Sign‑In with Apple + APNs (local build)</Text>
      {session ? (
        <View style={styles.card}>
          <Text style={styles.label}>Sessão ativa</Text>
          <Text style={styles.value}>{session.user.email}</Text>
          <Text onPress={signOut} style={styles.link}>
            Terminar sessão
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Entrar</Text>
          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={10}
              style={{ width: 260, height: 48 }}
              onPress={signInWithApple}
              disabled={loading}
            />
          )}
          {Platform.OS !== "ios" && <Text style={styles.muted}>Apple Sign‑In apenas no iOS.</Text>}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Push (APNs)</Text>
        <Text style={styles.muted}>Registar token para testes locais.</Text>
        <Text onPress={registerPush} style={styles.link}>
          Registar Push Token
        </Text>
        {pushToken && <Text style={styles.value}>{pushToken}</Text>}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b101a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 6,
  },
  subtitle: {
    color: "#9bb0c6",
    fontSize: 13,
    marginBottom: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
    marginBottom: 14,
  },
  label: {
    color: "#c9d6e2",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  value: {
    color: "#fff",
    fontSize: 13,
    marginTop: 8,
  },
  muted: {
    color: "#95a4b5",
    fontSize: 12,
  },
  link: {
    color: "#5cd0ff",
    fontSize: 13,
    marginTop: 12,
  },
});
