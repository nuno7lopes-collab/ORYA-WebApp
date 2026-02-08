import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { SearchOrganization } from "./types";
import { useRouter } from "expo-router";

type Props = {
  item: SearchOrganization;
  pending?: boolean;
  onFollow?: (organizationId: number) => void;
  onUnfollow?: (organizationId: number) => void;
};

export const SearchOrganizationRow = memo(function SearchOrganizationRow({
  item,
  pending,
  onFollow,
  onUnfollow,
}: Props) {
  const router = useRouter();
  const displayName = item.publicName || item.businessName || item.username || "Organização";
  const handle = item.username ? `@${item.username}` : "";
  const subtitle = [handle, item.city].filter(Boolean).join(" · ");
  const isFollowing = Boolean(item.isFollowing);
  const label = pending ? "A atualizar..." : isFollowing ? "A seguir" : "Seguir";

  return (
    <GlassCard padding={tokens.spacing.md} style={{ marginBottom: tokens.spacing.sm }}>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            if (item.username) {
              router.push({ pathname: "/[username]", params: { username: item.username } });
            }
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
        >
          <AvatarCircle size={44} uri={item.brandingAvatarUrl} iconName="business" />
          <View style={{ flex: 1 }}>
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {displayName}
            </Text>
            {subtitle ? <Text className="text-white/60 text-xs">{subtitle}</Text> : null}
          </View>
        </Pressable>
        {onFollow && onUnfollow ? (
          <Pressable
            onPress={() => (isFollowing ? onUnfollow(item.id) : onFollow(item.id))}
            disabled={pending}
            className={
              isFollowing
                ? "rounded-xl border border-white/15 bg-white/5 px-3 py-2"
                : "rounded-xl border border-sky-300/45 bg-sky-400/20 px-3 py-2"
            }
            style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
          >
            <Text
              className={isFollowing ? "text-white text-xs font-semibold" : "text-sky-200 text-xs font-semibold"}
            >
              {label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
});
