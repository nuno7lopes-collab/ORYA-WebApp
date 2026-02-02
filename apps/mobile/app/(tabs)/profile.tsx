import { Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";

export default function ProfileScreen() {
  const t = i18n.pt.profile;
  const { user } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-4">{t.title}</Text>
      <GlassSurface intensity={45}>
        <Text className="text-white/70 text-sm">Email: {user?.email ?? "-"}</Text>
      </GlassSurface>
      <TouchableOpacity
        className="mt-4 rounded-xl bg-white/10 px-4 py-3 items-center border border-white/10"
        onPress={signOut}
        style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
      >
        <Text className="text-white">Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
