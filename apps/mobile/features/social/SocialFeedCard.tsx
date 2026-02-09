import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassPill } from "../../components/liquid/GlassPill";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { DiscoverEventCard } from "../discover/DiscoverEventCard";
import { SocialFeedItem } from "./types";
import { useRouter } from "expo-router";

type Props = {
  item: SocialFeedItem;
  index?: number;
  userLat?: number | null;
  userLon?: number | null;
};

const FEED_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
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
  return FEED_DATE_FORMATTER.format(new Date(timestamp));
};

export const SocialFeedCard = memo(function SocialFeedCard({
  item,
  index = 0,
  userLat,
  userLon,
}: Props) {
  const router = useRouter();
  const orgName = item.organization.name || "Organização";
  const timeLabel = formatRelativeTime(item.createdAt);
  const handleOrgPress = () => {
    if (item.organization.username) {
      router.push({ pathname: "/[username]", params: { username: item.organization.username } });
    }
  };

  return (
    <View className="mb-6">
      <GlassSurface intensity={44} padding={tokens.spacing.md} className="mb-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleOrgPress}
            accessibilityRole="button"
            accessibilityLabel={`Abrir organização ${orgName}`}
          >
            <AvatarCircle
              size={46}
              uri={item.organization.avatarUrl}
              iconName="business"
              backgroundColor="rgba(255,255,255,0.12)"
            />
          </Pressable>

          <Pressable
            onPress={handleOrgPress}
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel={`Abrir organização ${orgName}`}
          >
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {orgName}
            </Text>
            {item.organization.username ? (
              <Text className="text-white/55 text-xs" numberOfLines={1}>
                @{item.organization.username}
              </Text>
            ) : null}
          </Pressable>

          <View className="items-end">
            <GlassPill label="Evento" variant="muted" />
            <Text className="text-white/45 text-[10px] mt-1">{timeLabel}</Text>
          </View>
        </View>
      </GlassSurface>

      <DiscoverEventCard
        item={item.event}
        itemType="event"
        variant="feed"
        index={index}
        userLat={userLat}
        userLon={userLon}
        source="network"
      />
    </View>
  );
});
