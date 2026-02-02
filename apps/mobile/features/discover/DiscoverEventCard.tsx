import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useRef } from "react";
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PublicEventCard, tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";

type Props = {
  item: PublicEventCard;
  variant?: "feed" | "featured";
};

const formatPrice = (item: PublicEventCard): string => {
  if (item.isGratis) return "Grátis";
  if (typeof item.priceFrom === "number") return `Desde ${item.priceFrom.toFixed(0)}€`;
  return "Preço em breve";
};

const formatDateRange = (startsAt?: string, endsAt?: string): string => {
  if (!startsAt) return "Data por anunciar";
  try {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;

    const date = new Intl.DateTimeFormat("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(start);

    const startTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);

    if (!end || Number.isNaN(end.getTime())) return `${date} · ${startTime}`;

    const endTime = new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(end);

    return `${date} · ${startTime}–${endTime}`;
  } catch {
    return "Data por anunciar";
  }
};

const resolveStatusLabel = (status?: PublicEventCard["status"]) => {
  switch (status) {
    case "CANCELLED":
      return "Cancelado";
    case "PAST":
      return "Terminado";
    case "DRAFT":
      return "Rascunho";
    default:
      return "Ativo";
  }
};

export function DiscoverEventCard({ item, variant = "feed" }: Props) {
  const category = item.categories?.[0] ?? "EVENTO";
  const location = item.location?.city ?? item.location?.name ?? "Local a anunciar";
  const date = formatDateRange(item.startsAt, item.endsAt);
  const isHighlighted = Boolean(item.isHighlighted);
  const isFeatured = variant === "featured";
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 7,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  };

  return (
    <Link href={{ pathname: "/event/[slug]", params: { slug: item.slug } }} asChild push>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} android_ripple={{ color: "rgba(255,255,255,0.08)" }}>
        <Animated.View
          style={{
            transform: [{ scale }],
            width: isFeatured ? 280 : "auto",
          }}
        >
          <GlassCard
            className={isFeatured ? "mr-4" : "mb-4"}
            intensity={isFeatured ? 65 : 58}
            padding={isFeatured ? tokens.spacing.md : tokens.spacing.lg}
            highlight={isHighlighted || isFeatured}
          >
            <View className="gap-3">
              <View className="overflow-hidden rounded-2xl border border-white/10">
                {item.coverImageUrl ? (
                  <ImageBackground
                    source={{ uri: item.coverImageUrl }}
                    resizeMode="cover"
                    style={{ height: isFeatured ? 190 : 168, justifyContent: "space-between" }}
                  >
                    <LinearGradient
                      colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.65)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ ...StyleSheet.absoluteFillObject }}
                    />
                    <View className="flex-row items-center justify-between px-3 pt-3">
                      <View className="flex-row items-center gap-2">
                        <GlassPill label={category} />
                        {isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                      </View>
                      <GlassPill label={resolveStatusLabel(item.status)} variant="muted" />
                    </View>
                    <View className="px-3 pb-3">
                      {isFeatured ? (
                        <Text className="text-white text-base font-semibold" numberOfLines={2}>
                          {item.title}
                        </Text>
                      ) : null}
                    </View>
                  </ImageBackground>
                ) : (
                  <View
                    style={{
                      height: isFeatured ? 190 : 168,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      justifyContent: "space-between",
                      paddingHorizontal: tokens.spacing.md,
                      paddingVertical: tokens.spacing.md,
                    }}
                  >
                    <View className="flex-row items-center gap-2 self-start">
                      <GlassPill label={category} />
                      {isHighlighted ? <GlassPill label="DESTAQUE" variant="accent" /> : null}
                    </View>
                    <Text className="text-white/55 text-xs">Imagem do evento em breve</Text>
                  </View>
                )}
              </View>

              <View className="gap-2">
                <Text className="text-lg font-semibold text-white" numberOfLines={2}>
                  {item.title}
                </Text>
                {item.shortDescription ? (
                  <Text className="text-sm text-white/70" numberOfLines={isFeatured ? 3 : 2}>
                    {item.shortDescription}
                  </Text>
                ) : null}

                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
                  <Text className="text-xs text-white/60">{date}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.55)" />
                  <Text className="text-xs text-white/55">{location}</Text>
                </View>

                <View className="flex-row items-center justify-between pt-1">
                  <Text className="text-xs text-white/70">{item.hostName ?? "ORYA"}</Text>
                  <GlassPill label={formatPrice(item)} variant={item.isGratis ? "accent" : "muted"} />
                </View>
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      </Pressable>
    </Link>
  );
}
