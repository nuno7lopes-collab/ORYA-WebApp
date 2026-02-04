import { Image } from "expo-image";
import { Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassPill } from "../../components/liquid/GlassPill";
import { DiscoverEventCard } from "../discover/DiscoverEventCard";
import { SocialFeedItem } from "./types";

type Props = {
  item: SocialFeedItem;
  index?: number;
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

export function SocialFeedCard({ item, index = 0 }: Props) {
  const orgName = item.organization.name || "Organização";
  const timeLabel = formatRelativeTime(item.createdAt);

  return (
    <View className="mb-6">
      <GlassSurface intensity={44} padding={tokens.spacing.md} className="mb-3">
        <View className="flex-row items-center gap-3">
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.12)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {item.organization.avatarUrl ? (
              <Image source={{ uri: item.organization.avatarUrl }} style={{ width: 46, height: 46 }} />
            ) : (
              <Ionicons name="business" size={20} color="rgba(255,255,255,0.7)" />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {orgName}
            </Text>
            {item.organization.username ? (
              <Text className="text-white/55 text-xs" numberOfLines={1}>
                @{item.organization.username}
              </Text>
            ) : null}
          </View>

          <View className="items-end">
            <GlassPill label="Evento" variant="muted" />
            <Text className="text-white/45 text-[10px] mt-1">{timeLabel}</Text>
          </View>
        </View>
      </GlassSurface>

      <DiscoverEventCard item={item.event} itemType="event" variant="feed" index={index} />
    </View>
  );
}
