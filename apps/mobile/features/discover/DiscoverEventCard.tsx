import { Link } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { PublicEventCard, tokens } from "@orya/shared";

type Props = {
  item: PublicEventCard;
};

const formatPrice = (item: PublicEventCard): string => {
  if (item.isGratis) return "Grátis";
  if (typeof item.priceFrom === "number") return `Desde ${item.priceFrom.toFixed(0)}€`;
  return "Preço por anunciar";
};

const formatDate = (startsAt?: string): string => {
  if (!startsAt) return "Data por anunciar";
  try {
    const date = new Date(startsAt);
    return new Intl.DateTimeFormat("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "Data por anunciar";
  }
};

export function DiscoverEventCard({ item }: Props) {
  return (
    <Link href={`/event/${item.slug}`} asChild>
      <TouchableOpacity activeOpacity={0.9}>
        <GlassSurface className="mb-3" intensity={45}>
          <View className="gap-2">
            <Text className="text-white text-lg font-semibold" numberOfLines={2}>
              {item.title}
            </Text>
            {item.shortDescription ? (
              <Text className="text-white/65 text-sm" numberOfLines={2}>
                {item.shortDescription}
              </Text>
            ) : null}
            <View className="flex-row items-center justify-between pt-1">
              <Text className="text-white/70 text-xs">{formatDate(item.startsAt)}</Text>
              <View
                style={{
                  minHeight: tokens.layout.touchTarget,
                  borderRadius: tokens.radius.lg,
                  backgroundColor: tokens.colors.glassStrong,
                  borderWidth: 1,
                  borderColor: tokens.colors.borderStrong,
                  paddingHorizontal: tokens.spacing.md,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-white text-xs font-semibold">{formatPrice(item)}</Text>
              </View>
            </View>
            {item.location?.city ? (
              <Text className="text-white/55 text-xs">{item.location.city}</Text>
            ) : null}
          </View>
        </GlassSurface>
      </TouchableOpacity>
    </Link>
  );
}
