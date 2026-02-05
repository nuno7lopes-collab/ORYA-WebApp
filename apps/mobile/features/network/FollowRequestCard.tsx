import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { tokens } from "@orya/shared";
import { Ionicons } from "../../components/icons/Ionicons";
import { GlassCard } from "../../components/liquid/GlassCard";
import { FollowRequest } from "./types";

type Props = {
  item: FollowRequest;
  pending?: boolean;
  onAccept: (requestId: number) => void;
  onDecline: (requestId: number) => void;
};

const formatRelativeTime = (iso: string): string => {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "agora";
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSeconds < 60) return "agora";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `há ${diffDays} d`;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
};

export const FollowRequestCard = memo(function FollowRequestCard({
  item,
  pending,
  onAccept,
  onDecline,
}: Props) {
  const displayName = item.fullName || item.username || "Utilizador";
  const handle = item.username ? `@${item.username}` : "";
  const timeLabel = formatRelativeTime(item.createdAt);

  return (
    <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.sm }}>
      <View className="flex-row items-center gap-3">
        <View
          style={{
            width: 48,
            height: 48,
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
              style={{ width: 48, height: 48 }}
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
          <Text className="text-white/45 text-[10px] mt-1">{timeLabel}</Text>
        </View>
      </View>

      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={() => onDecline(item.id)}
          disabled={pending}
          className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2"
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className="text-white/70 text-xs font-semibold text-center">
            {pending ? "A processar..." : "Recusar"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onAccept(item.id)}
          disabled={pending}
          className="flex-1 rounded-xl border border-emerald-300/45 bg-emerald-400/20 px-3 py-2"
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className="text-emerald-200 text-xs font-semibold text-center">
            {pending ? "A processar..." : "Aceitar"}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
});
