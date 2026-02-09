import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { FollowRequest } from "./types";
import { useRouter } from "expo-router";

type Props = {
  item: FollowRequest;
  pending?: boolean;
  onAccept: (requestId: number) => void;
  onDecline: (requestId: number) => void;
};

const REQUEST_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
});

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
  return REQUEST_DATE_FORMATTER.format(new Date(timestamp));
};

export const FollowRequestCard = memo(function FollowRequestCard({
  item,
  pending,
  onAccept,
  onDecline,
}: Props) {
  const router = useRouter();
  const displayName = item.fullName || item.username || "Utilizador";
  const handle = item.username ? `@${item.username}` : "";
  const timeLabel = formatRelativeTime(item.createdAt);
  const canOpenProfile = Boolean(item.username);
  const openProfile = () => {
    if (!item.username) return;
    router.push({ pathname: "/[username]", params: { username: item.username } });
  };

  return (
    <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.sm }}>
      <View className="flex-row items-center">
        <Pressable
          onPress={openProfile}
          disabled={!canOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={canOpenProfile ? `Abrir perfil de ${displayName}` : "Perfil indisponível"}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
        >
          <AvatarCircle size={48} uri={item.avatarUrl} iconName="person" />

          <View style={{ flex: 1 }}>
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {displayName}
            </Text>
            {handle ? <Text className="text-white/60 text-xs">{handle}</Text> : null}
            <Text className="text-white/45 text-[10px] mt-1">{timeLabel}</Text>
          </View>
        </Pressable>
      </View>

      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={() => onDecline(item.id)}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={`Recusar pedido de ${displayName}`}
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
          accessibilityRole="button"
          accessibilityLabel={`Aceitar pedido de ${displayName}`}
          className="flex-1 rounded-xl border border-sky-300/45 bg-sky-400/20 px-3 py-2"
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className="text-sky-200 text-xs font-semibold text-center">
            {pending ? "A processar..." : "Aceitar"}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
});
