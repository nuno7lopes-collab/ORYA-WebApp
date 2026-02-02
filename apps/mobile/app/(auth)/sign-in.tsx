import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";

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
      Alert.alert("Erro", err?.message ?? t.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0b101a] px-6 justify-center">
      <Text className="text-white text-3xl font-semibold mb-2">{t.signInTitle}</Text>
      <Text className="text-white/60 text-sm mb-8">Continua para a tua experiência ORYA.</Text>
      <GlassSurface intensity={55}>
        <Text className="text-white/70 text-xs uppercase tracking-[0.2em] mb-2">{t.email}</Text>
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
        <Text className="text-white/70 text-xs uppercase tracking-[0.2em] mb-2">{t.password}</Text>
        <TextInput
          className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-6"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={tokens.colors.textMuted}
          style={{ minHeight: tokens.layout.touchTarget }}
        />
        <TouchableOpacity
          className="bg-emerald-400 rounded-xl px-4 py-3 items-center"
          onPress={handleSignIn}
          disabled={loading}
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className="text-black font-semibold">{loading ? "A entrar..." : t.signIn}</Text>
        </TouchableOpacity>
      </GlassSurface>
    </View>
  );
}
