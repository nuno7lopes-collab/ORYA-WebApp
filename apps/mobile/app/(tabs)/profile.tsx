import { Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { i18n } from "@orya/shared";

export default function ProfileScreen() {
  const t = i18n.pt.profile;
  const { user } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-6">{t.title}</Text>
      <Text className="text-white/70 text-sm">Email: {user?.email ?? "-"}</Text>
      <TouchableOpacity
        className="mt-6 rounded-xl bg-white/10 px-4 py-3 items-center"
        onPress={signOut}
      >
        <Text className="text-white">Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
