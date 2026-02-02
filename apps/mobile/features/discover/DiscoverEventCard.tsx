import { Link } from "expo-router";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { PublicEventCard, tokens } from "@orya/shared";

type Props = {
  item: PublicEventCard;
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

export function DiscoverEventCard({ item }: Props) {
  const category = item.categories?.[0] ?? "EVENTO";
  const location = item.location?.city ?? item.location?.name ?? "Local a anunciar";
  const date = formatDateRange(item.startsAt, item.endsAt);
  const isHighlighted = Boolean(item.isHighlighted);

  return (
    <Link href={{ pathname: "/event/[slug]", params: { slug: item.slug } }} asChild push>
      <Pressable
        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
        style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] })}
      >
        <GlassSurface className="mb-3" intensity={52}>
          <View className="gap-3">
            <View className="overflow-hidden rounded-2xl border border-white/10">
              {item.coverImageUrl ? (
                <ImageBackground
                  source={{ uri: item.coverImageUrl }}
                  resizeMode="cover"
                  style={{ height: 156, justifyContent: "space-between" }}
                >
                  <View className="flex-row items-center justify-between px-3 pt-3">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-full border border-white/30 bg-black/35 px-2 py-1">
                        <Text className="text-[10px] font-semibold tracking-[0.08em] text-white">{category}</Text>
                      </View>
                      {isHighlighted ? (
                        <View className="rounded-full border border-[#6EE7FF]/40 bg-[#0f2a37]/70 px-2 py-1">
                          <Text className="text-[10px] font-semibold tracking-[0.08em] text-[#9DE8FF]">DESTAQUE</Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="rounded-full border border-white/30 bg-black/35 px-2 py-1">
                      <Text className="text-[10px] font-semibold text-white">{resolveStatusLabel(item.status)}</Text>
                    </View>
                  </View>
                </ImageBackground>
              ) : (
                <View
                  style={{
                    height: 156,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    justifyContent: "space-between",
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.md,
                  }}
                >
                  <View className="flex-row items-center gap-2 self-start">
                    <View className="rounded-full border border-white/30 bg-black/35 px-2 py-1">
                      <Text className="text-[10px] font-semibold tracking-[0.08em] text-white">{category}</Text>
                    </View>
                    {isHighlighted ? (
                      <View className="rounded-full border border-[#6EE7FF]/40 bg-[#0f2a37]/70 px-2 py-1">
                        <Text className="text-[10px] font-semibold tracking-[0.08em] text-[#9DE8FF]">DESTAQUE</Text>
                      </View>
                    ) : null}
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
                <Text className="text-sm text-white/70" numberOfLines={2}>
                  {item.shortDescription}
                </Text>
              ) : null}

              <Text className="text-xs text-white/60">{date}</Text>
              <Text className="text-xs text-white/55">{location}</Text>

              <View className="flex-row items-center justify-between pt-1">
                <Text className="text-xs text-white/70">{item.hostName ?? "ORYA"}</Text>
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
                  <Text className="text-xs font-semibold text-white">{formatPrice(item)}</Text>
                </View>
              </View>
            </View>
          </View>
        </GlassSurface>
      </Pressable>
    </Link>
  );
}
