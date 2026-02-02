import { Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";

export default function ProfileScreen() {
  const t = i18n.pt.profile;
  const { user } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <LiquidBackground>
      <View className="flex-1 px-6 pt-14">
        <Text className="text-white text-2xl font-semibold mb-2">{t.title}</Text>
        <Text className="text-white/60 text-sm mb-5">Conta pessoal e preferências.</Text>

        <SectionHeader title="Conta" />
        <GlassSurface intensity={52} padding={16}>
          <Text className="text-white/75 text-sm">Email</Text>
          <Text className="text-white text-base font-semibold mt-1">{user?.email ?? "-"}</Text>
        </GlassSurface>

        <View className="mt-6">
          <SectionHeader title="Segurança" />
          <GlassSurface intensity={48} padding={16}>
            <Text className="text-white/70 text-sm">
              2FA e sessões avançadas chegam na próxima fase do mobile.
            </Text>
          </GlassSurface>
        </View>

        <TouchableOpacity
          className="mt-6 rounded-2xl bg-white/10 px-4 py-3 items-center border border-white/15"
          onPress={signOut}
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className="text-white font-semibold">Sair</Text>
        </TouchableOpacity>
      </View>
    </LiquidBackground>
  );
}
