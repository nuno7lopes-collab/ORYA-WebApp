import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "../components/icons/Ionicons";
import { LiquidBackground } from "../components/liquid/LiquidBackground";
import { GlassCard } from "../components/liquid/GlassCard";
import { GlassSkeleton } from "../components/glass/GlassSkeleton";
import { useAuth } from "../lib/auth";
import { usePublicProfile, usePublicProfileEvents } from "../features/profile/hooks";
import { useNetworkActions, useOrganizationFollowActions } from "../features/network/hooks";
import { useTabBarPadding } from "../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../components/navigation/useTopHeaderPadding";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../lib/navigation";
import { tokens } from "@orya/shared";
import { SectionHeader } from "../components/liquid/SectionHeader";
import { EventCardSquare, EventCardSquareSkeleton } from "../components/events/EventCardSquare";

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ username?: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const profileQuery = usePublicProfile(username, accessToken);
  const eventsQuery = usePublicProfileEvents(username, accessToken, Boolean(username));
  const userActions = useNetworkActions();
  const orgActions = useOrganizationFollowActions();
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(16);

  const data = profileQuery.data ?? null;
  const profile = data?.profile ?? null;
  const isUser = data?.type === "user";
  const isSelf = Boolean(data?.isSelf);
  const coverUrl = profile?.coverUrl ?? null;
  const avatarUrl = profile?.avatarUrl ?? null;

  const followLabel = useMemo(() => {
    if (!data?.viewer) return "Seguir";
    if (data.viewer.isRequested) return "Pedido enviado";
    if (data.viewer.isFollowing) return "A seguir";
    return "Seguir";
  }, [data?.viewer]);

  const handleFollowPress = () => {
    if (!data || !profile) return;
    if (isSelf) return;
    if (isUser) {
      const userId = String(profile.id);
      if (data.viewer?.isFollowing || data.viewer?.isRequested) {
        userActions.unfollow(userId);
      } else {
        userActions.follow(userId);
      }
    } else {
      const orgId = Number(profile.id);
      if (Number.isNaN(orgId)) return;
      if (data.viewer?.isFollowing) {
        orgActions.unfollow(orgId);
      } else {
        orgActions.follow(orgId);
      }
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: tabBarPadding }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => safeBack(router, navigation)}
          className="flex-row items-center gap-2"
          style={{ minHeight: tokens.layout.touchTarget }}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
        </Pressable>
        {profileQuery.isLoading ? (
          <View className="gap-3">
            <GlassSkeleton height={180} />
            <GlassSkeleton height={120} />
            <GlassSkeleton height={140} />
          </View>
        ) : !profile || profileQuery.isError ? (
          <GlassCard intensity={50}>
            <Text className="text-red-300 text-sm mb-3">Não foi possível carregar o perfil.</Text>
            <Pressable
              onPress={() => profileQuery.refetch()}
              className="rounded-xl bg-white/10 px-4 py-3"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="gap-4">
            <View style={{ position: "relative" }}>
              <View
                style={{
                  height: 180,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              >
                {coverUrl ? (
                  <Image
                    source={{ uri: coverUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={160}
                  />
                ) : null}
              </View>
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -38,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.85)",
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 76, height: 76 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name={isUser ? "person" : "business"} size={28} color="rgba(255,255,255,0.8)" />
                  )}
                </View>
              </View>
            </View>

            <View style={{ paddingTop: 48, alignItems: "center", gap: 6 }}>
              <Text className="text-white text-2xl font-semibold" numberOfLines={1}>
                {profile.fullName ?? "Perfil"}
              </Text>
              {profile.username ? (
                <Text className="text-white/60 text-sm">@{profile.username}</Text>
              ) : null}
              {profile.bio ? (
                <Text className="text-white/70 text-sm text-center" numberOfLines={3}>
                  {profile.bio}
                </Text>
              ) : null}
            </View>

            <View className="flex-row justify-center gap-8">
              <View className="items-center">
                <Text className="text-white text-base font-semibold">{data?.counts.followers ?? 0}</Text>
                <Text className="text-white/60 text-xs">Seguidores</Text>
              </View>
              <View className="items-center">
                <Text className="text-white text-base font-semibold">{data?.counts.following ?? 0}</Text>
                <Text className="text-white/60 text-xs">A seguir</Text>
              </View>
              <View className="items-center">
                <Text className="text-white text-base font-semibold">{data?.counts.events ?? 0}</Text>
                <Text className="text-white/60 text-xs">Eventos</Text>
              </View>
            </View>

            {!isSelf ? (
              <Pressable
                onPress={handleFollowPress}
                className={
                  data?.viewer?.isFollowing || data?.viewer?.isRequested
                    ? "rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                    : "rounded-2xl border border-sky-300/45 bg-sky-400/20 px-4 py-3"
                }
              >
                <Text
                  className={
                    data?.viewer?.isFollowing || data?.viewer?.isRequested
                      ? "text-white text-sm font-semibold text-center"
                      : "text-sky-200 text-sm font-semibold text-center"
                  }
                >
                  {followLabel}
                </Text>
              </Pressable>
            ) : null}

            {profile.city ? (
              <GlassCard intensity={50}>
                <Text className="text-white/80 text-sm">{profile.city}</Text>
              </GlassCard>
            ) : null}

            <View className="pt-2">
              <SectionHeader title="Eventos" subtitle="Próximos e anteriores" />
              {eventsQuery.isLoading ? (
                <View className="pt-3 gap-3">
                  <EventCardSquareSkeleton />
                  <EventCardSquareSkeleton />
                </View>
              ) : eventsQuery.isError ? (
                <GlassCard intensity={50} className="mt-3">
                  <Text className="text-white/70 text-sm">
                    Não foi possível carregar os eventos deste perfil.
                  </Text>
                </GlassCard>
              ) : (
                <View className="pt-3 gap-3">
                  {(eventsQuery.data?.upcoming ?? []).length > 0 ? (
                    <View>
                      <Text className="text-white/70 text-xs mb-2">Próximos</Text>
                      {(eventsQuery.data?.upcoming ?? []).map((event, index) => (
                        <EventCardSquare key={`upcoming-${event.id}`} event={event} index={index} />
                      ))}
                    </View>
                  ) : (
                    <GlassCard intensity={46}>
                      <Text className="text-white/60 text-sm">Sem eventos próximos.</Text>
                    </GlassCard>
                  )}

                  {(eventsQuery.data?.past ?? []).length > 0 ? (
                    <View className="pt-2">
                      <Text className="text-white/70 text-xs mb-2">Anteriores</Text>
                      {(eventsQuery.data?.past ?? []).map((event, index) => (
                        <EventCardSquare key={`past-${event.id}`} event={event} index={index} />
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
