import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { SearchUser } from "./types";

type Props = {
  item: SearchUser;
  pending?: boolean;
  onFollow?: (userId: string) => void;
  onUnfollow?: (userId: string) => void;
};

export const SearchUserRow = memo(function SearchUserRow({
  item,
  pending,
  onFollow,
  onUnfollow,
}: Props) {
  const displayName = item.fullName || item.username || "Utilizador";
  const handle = item.username ? `@${item.username}` : "";
  const isRequested = Boolean(item.isRequested);
  const isFollowing = Boolean(item.isFollowing);
  const isActive = isRequested || isFollowing;
  const label = pending ? "A atualizar..." : isRequested ? "Pedido enviado" : isFollowing ? "A seguir" : "Seguir";

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
            <Image
              source={{ uri: item.avatarUrl }}
              style={{ width: 44, height: 44 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
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
        {onFollow && onUnfollow ? (
          <Pressable
            onPress={() => (isActive ? onUnfollow(item.id) : onFollow(item.id))}
            disabled={pending}
            className={
              isActive
                ? "rounded-xl border border-white/15 bg-white/5 px-3 py-2"
                : "rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-3 py-2"
            }
            style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
          >
            <Text
              className={isActive ? "text-white text-xs font-semibold" : "text-emerald-200 text-xs font-semibold"}
            >
              {label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
});
