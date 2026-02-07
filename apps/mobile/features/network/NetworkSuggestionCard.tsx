import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { tokens } from "@orya/shared";
import { Ionicons } from "../../components/icons/Ionicons";
import { GlassCard } from "../../components/liquid/GlassCard";
import { SocialSuggestion } from "./types";
import { useRouter } from "expo-router";

type Props = {
  item: SocialSuggestion;
  pending?: boolean;
  onFollow: (targetUserId: string) => void;
  onUnfollow: (targetUserId: string) => void;
};

export const NetworkSuggestionCard = memo(function NetworkSuggestionCard({
  item,
  pending,
  onFollow,
  onUnfollow,
}: Props) {
  const router = useRouter();
  const fullName = item.fullName || item.username || "Utilizador";
  const subtitle = item.city
    ? `${item.city}${item.mutualsCount ? ` · ${item.mutualsCount} em comum` : ""}`
    : item.mutualsCount
      ? `${item.mutualsCount} em comum`
      : "Comunidade ORYA";

  const isRequested = Boolean(item.isRequested);
  const isFollowing = Boolean(item.isFollowing);
  const isActive = isFollowing || isRequested;
  const label = pending ? "A atualizar..." : isRequested ? "Pedido enviado" : isFollowing ? "A seguir" : "Seguir";

  return (
    <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.md }}>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            if (item.username) router.push(`/${item.username}`);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
        >
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
              <Image
                source={{ uri: item.avatarUrl }}
                style={{ width: 52, height: 52 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
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
        </Pressable>

        <Pressable
          onPress={() => (isActive ? onUnfollow(item.id) : onFollow(item.id))}
          disabled={pending}
          className={
            isActive
              ? "rounded-xl border border-white/15 bg-white/5 px-4 py-2"
              : "rounded-xl border border-sky-300/45 bg-sky-400/20 px-4 py-2"
          }
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className={isActive ? "text-white text-xs font-semibold" : "text-sky-200 text-xs font-semibold"}>
            {label}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
});
