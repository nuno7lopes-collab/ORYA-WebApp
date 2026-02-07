import { FlatList, Pressable, Text, View } from "react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import { useChatThreads } from "../../features/chat/hooks";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Image } from "expo-image";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(24);
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const threadsQuery = useChatThreads(Boolean(session?.user?.id), accessToken);
  const items = threadsQuery.data?.items ?? [];

  const formatDate = (value?: string | null) => {
    if (!value) return "Data por anunciar";
    try {
      return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
      }).format(new Date(value));
    } catch {
      return "Data por anunciar";
    }
  };

  const resolveStatusLabel = (status?: string | null) => {
    if (status === "OPEN") return "Chat aberto";
    if (status === "ANNOUNCEMENTS") return "Anúncios";
    if (status === "READ_ONLY") return "Só leitura";
    return "Fechado";
  };

  return (
    <LiquidBackground>
      <TopAppHeader />
      <FlatList
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        data={items}
        keyExtractor={(item) => item.threadId}
        onRefresh={() => {
          if (session?.user?.id) threadsQuery.refetch();
        }}
        refreshing={threadsQuery.isFetching}
        ListHeaderComponent={
          <View className="pb-4">
            <Pressable
              onPress={() => safeBack(router, navigation)}
              className="flex-row items-center gap-2"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
            </Pressable>
            <Text className="text-white text-lg font-semibold mt-4">Mensagens</Text>
            <Text className="text-white/60 text-sm mt-1">
              Conversas dos eventos em que participas.
            </Text>
          </View>
        }
        ListEmptyComponent={
          !session?.user?.id ? (
            <GlassCard intensity={55}>
              <Text className="text-white text-sm font-semibold mb-2">Inicia sessão</Text>
              <Text className="text-white/65 text-sm">
                Entra na tua conta para veres as mensagens do evento.
              </Text>
              <Pressable
                onPress={() => router.push("/auth")}
                className="mt-4 rounded-2xl bg-white/90 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                  Entrar
                </Text>
              </Pressable>
            </GlassCard>
          ) : threadsQuery.isLoading ? (
            <View className="gap-3">
              {Array.from({ length: 3 }, (_, idx) => (
                <GlassSkeleton key={`chat-skel-${idx}`} height={86} />
              ))}
            </View>
          ) : threadsQuery.isError ? (
            <GlassCard intensity={55}>
              <Text className="text-red-300 text-sm mb-2">Não foi possível carregar os chats.</Text>
              <Pressable
                onPress={() => threadsQuery.refetch()}
                className="rounded-2xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
              </Pressable>
            </GlassCard>
          ) : (
            <GlassCard intensity={50}>
              <Text className="text-white/70 text-sm">
                Ainda não tens chats ativos. Compra um bilhete para desbloquear o chat do evento.
              </Text>
            </GlassCard>
          )
        }
        renderItem={({ item }) => {
          const event = item.event;
          const lastMessage = item.lastMessage;
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/messages/[threadId]",
                  params: {
                    threadId: item.threadId,
                    eventId: String(event.id),
                    title: event.title,
                    coverImageUrl: event.coverImageUrl ?? "",
                    startsAt: event.startsAt ?? "",
                    endsAt: event.endsAt ?? "",
                  },
                })
              }
              className="mb-3"
            >
              <GlassCard intensity={58} padding={14}>
                <View className="flex-row gap-3">
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {event.coverImageUrl ? (
                      <Image source={{ uri: event.coverImageUrl }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.6)" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text className="text-white/60 text-xs">
                      {formatDate(event.startsAt)} · {event.locationFormattedAddress || "Local a anunciar"}
                    </Text>
                    <Text className="text-white/65 text-xs" numberOfLines={1}>
                      {lastMessage
                        ? lastMessage.body
                        : "Sem mensagens por enquanto."}
                    </Text>
                  </View>
                  <View className="items-end justify-between">
                    <Text className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                      {resolveStatusLabel(item.status)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />
    </LiquidBackground>
  );
}
