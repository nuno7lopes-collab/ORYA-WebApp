import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { safeBack } from "../lib/navigation";
import { tokens } from "@orya/shared";
import { SectionHeader } from "../components/liquid/SectionHeader";
import { EventCardSquare, EventCardSquareSkeleton } from "../components/events/EventCardSquare";
import { useOrganizationFollowers, useUserFollowers, useUserFollowing } from "../features/network/followLists";
import { FollowListModal } from "../components/profile/FollowListModal";
import { ProfileHeader } from "../components/profile/ProfileHeader";

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
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);

  const data = profileQuery.data ?? null;
  const profile = data?.profile ?? null;
  const isUser = data?.type === "user";
  const isSelf = Boolean(data?.isSelf);
  const profileId = profile?.id ?? null;
  const userProfileId = isUser && profileId ? String(profileId) : null;
  const organizationIdRaw = !isUser && profileId ? Number(profileId) : null;
  const organizationId = Number.isFinite(organizationIdRaw ?? NaN) ? (organizationIdRaw as number) : null;
  const coverUrl = profile?.coverUrl ?? null;
  const avatarUrl = profile?.avatarUrl ?? null;
  const canOpenFollowers = Boolean(profileId);
  const canOpenFollowing = Boolean(isUser);

  const userFollowers = useUserFollowers(
    userProfileId,
    accessToken,
    Boolean(followersOpen && isUser && userProfileId),
  );
  const orgFollowers = useOrganizationFollowers(
    organizationId,
    accessToken,
    Boolean(followersOpen && !isUser && organizationId),
  );
  const followersList = isUser ? userFollowers : orgFollowers;
  const followingList = useUserFollowing(
    userProfileId,
    accessToken,
    Boolean(followingOpen && isUser && userProfileId),
  );

  const followLabel = useMemo(() => {
    if (!data?.viewer) return "Seguir";
    if (data.viewer.isRequested) return "Pedido enviado";
    if (data.viewer.isFollowing) return "A seguir";
    return "Seguir";
  }, [data?.viewer]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setFollowersOpen(false);
        setFollowingOpen(false);
      };
    }, []),
  );

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
            <ProfileHeader
              isUser={isUser}
              coverUrl={coverUrl}
              avatarUrl={avatarUrl}
              displayName={profile.fullName ?? "Perfil"}
              username={profile.username ?? null}
              bio={profile.bio ?? null}
              counts={{
                followers: data?.counts.followers ?? 0,
                following: data?.counts.following ?? 0,
                events: data?.counts.events ?? 0,
              }}
              onFollowersPress={canOpenFollowers ? () => setFollowersOpen(true) : undefined}
              onFollowingPress={canOpenFollowing ? () => setFollowingOpen(true) : undefined}
            />

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

      <FollowListModal
        open={followersOpen}
        title="Seguidores"
        items={followersList.data}
        isLoading={followersList.isLoading}
        isError={followersList.isError}
        emptyLabel="Sem seguidores ainda."
        onClose={() => setFollowersOpen(false)}
        onRetry={() => followersList.refetch()}
      />
      <FollowListModal
        open={followingOpen && isUser}
        title="A seguir"
        items={followingList.data}
        isLoading={followingList.isLoading}
        isError={followingList.isError}
        emptyLabel="Ainda não segue ninguém."
        onClose={() => setFollowingOpen(false)}
        onRetry={() => followingList.refetch()}
      />
    </LiquidBackground>
  );
}
