import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { SearchUser } from "./types";

type Props = {
  item: SearchUser;
};

export function SearchUserRow({ item }: Props) {
  const displayName = item.fullName || item.username || "Utilizador";
  const handle = item.username ? `@${item.username}` : "";

  return (
    <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.sm }}>
      <View className="flex-row items-center gap-3">
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.08)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={{ width: 44, height: 44 }} />
          ) : (
            <Ionicons name="person" size={20} color="rgba(255,255,255,0.7)" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {displayName}
          </Text>
          {handle ? <Text className="text-white/60 text-xs">{handle}</Text> : null}
        </View>
        <GlassPill label={item.isFollowing ? "A seguir" : "Ver"} variant="muted" />
      </View>
    </GlassCard>
  );
}
