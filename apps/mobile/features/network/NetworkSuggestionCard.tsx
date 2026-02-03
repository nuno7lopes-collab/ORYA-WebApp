import { Image, Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "../../components/liquid/GlassCard";
import { SocialSuggestion } from "./types";

type Props = {
  item: SocialSuggestion;
  pending?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
};

export function NetworkSuggestionCard({ item, pending, onFollow, onUnfollow }: Props) {
  const fullName = item.fullName || item.username || "Utilizador";
  const subtitle = item.city
    ? `${item.city}${item.mutualsCount ? ` · ${item.mutualsCount} em comum` : ""}`
    : item.mutualsCount
      ? `${item.mutualsCount} em comum`
      : "Comunidade ORYA";

  const isFollowing = Boolean(item.isFollowing);

  return (
    <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.md }}>
      <View className="flex-row items-center gap-3">
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.08)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={{ width: 52, height: 52 }} />
          ) : (
            <Ionicons name="person" size={22} color="rgba(255,255,255,0.7)" />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text className="text-white text-base font-semibold" numberOfLines={1}>
            {fullName}
          </Text>
          {item.username ? <Text className="text-white/60 text-xs">@{item.username}</Text> : null}
          <Text className="text-white/55 text-xs mt-1" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <Pressable
          onPress={isFollowing ? onUnfollow : onFollow}
          disabled={pending}
          className={
            isFollowing
              ? "rounded-xl border border-white/15 bg-white/5 px-4 py-2"
              : "rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-4 py-2"
          }
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className={isFollowing ? "text-white text-xs font-semibold" : "text-emerald-200 text-xs font-semibold"}>
            {pending ? "A atualizar..." : isFollowing ? "A seguir" : "Seguir"}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}
