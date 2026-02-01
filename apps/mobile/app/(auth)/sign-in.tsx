import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { i18n } from "@orya/shared";

export default function SignInScreen() {
  const t = i18n.pt.auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert("Erro", err?.message ?? "Falha no login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0b101a] px-6 justify-center">
      <Text className="text-white text-2xl font-semibold mb-6">{t.signInTitle}</Text>
      <Text className="text-white/70 text-xs uppercase tracking-[0.2em] mb-2">{t.email}</Text>
      <TextInput
        className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="email@exemplo.pt"
        placeholderTextColor="#9aa3b2"
      />
      <Text className="text-white/70 text-xs uppercase tracking-[0.2em] mb-2">{t.password}</Text>
      <TextInput
        className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-6"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor="#9aa3b2"
      />
      <TouchableOpacity
        className="bg-emerald-400 rounded-xl px-4 py-3 items-center"
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text className="text-black font-semibold">
          {loading ? "A entrar..." : t.signIn}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
