import { memo, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { Ionicons } from "../../components/icons/Ionicons";
import { SocialSuggestion } from "./types";

type Props = {
  items: SocialSuggestion[];
  pendingUserId?: string | null;
  onFollow: (userId: string) => void;
  onDismiss: (userId: string) => void;
};

const AVATAR_SIZE = 112;

const buildReason = (item: SocialSuggestion) => {
  if (item.reason?.type === "SAME_EVENT_TICKET") {
    const title = item.reason.event?.title;
    return title ? `Vai ao mesmo evento: ${title}` : "Vai ao mesmo evento que tu";
  }
  if (item.reason?.type === "SAME_EVENT_FAVORITE") {
    const title = item.reason.event?.title;
    return title ? `Interesse no evento: ${title}` : "Interesse no mesmo evento";
  }
  const mutuals = item.mutualsCount ?? 0;
  if (mutuals > 0) {
    return `${mutuals} amigo${mutuals === 1 ? "" : "s"} em comum`;
  }
  return null;
};

export const NetworkPeopleDeck = memo(function NetworkPeopleDeck({
  items,
  pendingUserId,
  onFollow,
  onDismiss,
}: Props) {
  const router = useRouter();
  const current = items[0];

  const openProfile = useCallback(() => {
    if (!current?.username) return;
    router.push({ pathname: "/[username]", params: { username: current.username } });
  }, [current?.username, router]);

  const handleSwipe = useCallback(
    (action: "follow" | "dismiss") => {
      if (!current) return;
      setTimeout(() => {
        if (action === "follow") {
          onFollow(current.id);
        }
        onDismiss(current.id);
      }, 160);
    },
    [current, onDismiss, onFollow],
  );

  if (!current) {
    return (
      <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.lg }}>
        <Text className="text-white text-sm font-semibold">Sem pessoas agora.</Text>
        <Pressable
          onPress={() => router.push("/search")}
          className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
          style={{ minHeight: tokens.layout.touchTarget }}
          accessibilityRole="button"
          accessibilityLabel="Pesquisar pessoas"
        >
          <Text className="text-white text-sm font-semibold text-center">Pesquisar pessoas</Text>
        </Pressable>
      </GlassCard>
    );
  }

  const fullName = current.fullName || current.username || "Utilizador";
  const handle = current.username ? `@${current.username}` : null;
  const reason = buildReason(current);
  const isPending = pendingUserId === current.id;
  const canFollow = !current.isFollowing && !current.isRequested;
  const followLabel = isPending
    ? "A seguir..."
    : current.isRequested
      ? "Pedido enviado"
      : current.isFollowing
        ? "A seguir"
        : "Seguir";
  const rightDisabled = isPending || !canFollow;

  return (
    <GlassCard padding={tokens.spacing.lg} style={{ marginBottom: tokens.spacing.lg }}>
      {reason ? (
        <View className="mb-3">
          <View className="rounded-full border border-white/15 bg-white/5 px-3 py-1 self-start">
            <Text className="text-white/80 text-[11px]">{reason}</Text>
          </View>
        </View>
      ) : null}

      <View className="items-center">
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil de ${fullName}`}
          hitSlop={10}
        >
          <AvatarCircle size={AVATAR_SIZE} uri={current.avatarUrl} iconName="person" />
        </Pressable>
        <Text className="text-white text-xl font-semibold mt-4" numberOfLines={1}>
          {fullName}
        </Text>
        {handle ? (
          <Text className="text-white/60 text-sm" numberOfLines={1}>
            {handle}
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between mt-6">
        <View className="items-center">
          <Pressable
            onPress={() => handleSwipe("dismiss")}
            accessibilityRole="button"
            accessibilityLabel={`Passar ${fullName}`}
            className="items-center justify-center border border-white/20 bg-white/5"
            style={{ width: 60, height: 60, borderRadius: 30 }}
            hitSlop={10}
          >
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        <View />

        <View className="items-center">
          <Pressable
            onPress={() => handleSwipe("follow")}
            disabled={rightDisabled}
            accessibilityRole="button"
            accessibilityLabel={`${followLabel} ${fullName}`}
            accessibilityState={{ disabled: rightDisabled }}
            className="items-center justify-center border border-sky-300/50 bg-sky-400/20"
            style={{ width: 60, height: 60, borderRadius: 30, opacity: rightDisabled ? 0.55 : 1 }}
            hitSlop={10}
          >
            <Ionicons
              name={canFollow ? "person-add-outline" : "checkmark"}
              size={24}
              color={canFollow ? "rgba(186, 230, 253, 0.9)" : "rgba(186, 230, 253, 0.9)"}
            />
          </Pressable>
        </View>
      </View>
    </GlassCard>
  );
});
