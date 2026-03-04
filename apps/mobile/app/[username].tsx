import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "../components/icons/Ionicons";
import { LiquidBackground } from "../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../components/glass/GlassSkeleton";
import { useAuth } from "../lib/auth";
import { usePublicOrganizationAgenda, usePublicProfile, usePublicProfileEvents } from "../features/profile/hooks";
import { useNetworkActions, useOrganizationFollowActions } from "../features/network/hooks";
import { useTabBarPadding } from "../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../components/navigation/useTopBarScroll";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { safeBack, safePush } from "../lib/navigation";
import { tokens } from "@orya/shared";
import { SectionHeader } from "../components/liquid/SectionHeader";
import { EventCardSquare, EventCardSquareSkeleton } from "../components/events/EventCardSquare";
import { useOrganizationFollowers, useUserFollowers, useUserFollowing } from "../features/network/followLists";
import { FollowListModal } from "../components/profile/FollowListModal";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { buildUsernameCandidates } from "../features/profile/usernameCandidates";
import { trackCrmEngagement } from "../lib/crm";

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ username?: string }>();
  const rawUsername = typeof params.username === "string" ? params.username : "";
  const usernameCandidates = useMemo(() => buildUsernameCandidates(rawUsername), [rawUsername]);
  const [usernameCandidateIndex, setUsernameCandidateIndex] = useState(0);
  const username = usernameCandidates[usernameCandidateIndex] ?? "";
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const profileQuery = usePublicProfile(username, accessToken);
  const privacy = profileQuery.data?.privacy ?? null;
  const canView = privacy?.canView ?? true;
  const eventsEnabled = Boolean(username) && profileQuery.isSuccess && canView;
  const eventsQuery = usePublicProfileEvents(username, accessToken, eventsEnabled);
  const data = profileQuery.data ?? null;
  const profile = data?.profile ?? null;
  const isUser = data?.type === "user";
  const profileId = profile?.id ?? null;
  const organizationIdRaw = !isUser && profileId ? Number(profileId) : null;
  const organizationId = Number.isFinite(organizationIdRaw ?? NaN) ? (organizationIdRaw as number) : null;
  const publicAgendaQuery = usePublicOrganizationAgenda(
    !isUser && organizationId ? organizationId : null,
    Boolean(!isUser && organizationId && canView),
  );
  const userActions = useNetworkActions();
  const orgActions = useOrganizationFollowActions();
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const viewSentRef = useRef(false);

  useEffect(() => {
    setUsernameCandidateIndex(0);
  }, [rawUsername]);

  useEffect(() => {
    if (!profileQuery.isError) return;
    if (usernameCandidateIndex >= usernameCandidates.length - 1) return;
    setUsernameCandidateIndex((prev) => prev + 1);
  }, [profileQuery.isError, usernameCandidateIndex, usernameCandidates.length]);

  const isSelf = Boolean(data?.isSelf);
  const isLocked = Boolean(privacy?.isPrivate && !canView);
  const userProfileId = isUser && profileId ? String(profileId) : null;
  const coverUrl = profile?.coverUrl ?? null;
  const avatarUrl = profile?.avatarUrl ?? null;
  const canOpenFollowers = Boolean(profileId);
  const canOpenFollowing = Boolean(isUser);
  const topBarTitle = profile?.username ? `@${profile.username}` : profile?.fullName ?? "Perfil";
  const canOpenStore = !isUser && data?.store?.canOpenPublicStore === true;
  const organizationStoreHref = canOpenStore && profile?.username ? `/store/${profile.username}` : null;
  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, "/comunidade")}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );

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
  const pendingUserFollow = Boolean(isUser && userProfileId && userActions.pendingUserId === userProfileId);
  const pendingOrgFollow = Boolean(!isUser && organizationId && orgActions.pendingOrgId === organizationId);
  const followPending = pendingUserFollow || pendingOrgFollow;
  const isViewerFriend = Boolean(data?.viewer?.isFriend ?? data?.viewer?.isFollowing);
  const isViewerFollowingOrg = Boolean(data?.viewer?.isFollowing);
  const userActionActive = isViewerFriend || Boolean(data?.viewer?.isRequested);
  const orgActionActive = isViewerFollowingOrg;
  const followActionActive = isUser ? userActionActive : orgActionActive;

  const followLabel = useMemo(() => {
    if (followPending) return "A atualizar...";
    if (!data?.viewer) return isUser ? "Adicionar amigo" : "Seguir";
    if (isUser) {
      if (data.viewer.isRequested) return "Pedido enviado";
      if (isViewerFriend) return "Amigo";
      return "Adicionar amigo";
    }
    return isViewerFollowingOrg ? "A seguir" : "Seguir";
  }, [data?.viewer, followPending, isUser, isViewerFriend, isViewerFollowingOrg]);

  useEffect(() => {
    if (!accessToken || viewSentRef.current) return;
    if (!organizationId || isUser) return;
    viewSentRef.current = true;
    trackCrmEngagement({ type: "PROFILE_VIEWED", organizationId });
  }, [accessToken, isUser, organizationId]);

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
    if (followPending) return;
    if (isUser) {
      const userId = String(profile.id);
      if (isViewerFriend || data.viewer?.isRequested) {
        userActions.unfollow(userId);
      } else {
        userActions.follow(userId);
      }
    } else {
      const orgId = Number(profile.id);
      if (Number.isNaN(orgId)) return;
      if (isViewerFollowingOrg) {
        orgActions.unfollow(orgId);
      } else {
        orgActions.follow(orgId);
      }
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader scrollState={topBar} variant="title" title={topBarTitle} leftSlot={backButton} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: tabBarPadding }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {profileQuery.isLoading ? (
          <View className="gap-3">
            <GlassSkeleton height={180} />
            <GlassSkeleton height={120} />
            <GlassSkeleton height={140} />
          </View>
        ) : !profile || profileQuery.isError ? (
          <View className="gap-3 border-b border-rose-200/30 pb-4">
            <Text className="text-rose-200 text-sm font-semibold">Não foi possível carregar o perfil.</Text>
            <Text className="text-white/70 text-xs">Tenta novamente para atualizar os dados deste utilizador.</Text>
            <Pressable
              onPress={() => profileQuery.refetch()}
              className="self-start rounded-full border border-white/20 bg-white/10 px-4 py-2.5"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-xs font-semibold">Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-5">
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
                disabled={followPending}
                className={
                  followActionActive
                    ? "rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                    : "rounded-2xl border border-sky-300/45 bg-sky-400/20 px-4 py-3"
                }
                accessibilityRole="button"
                accessibilityLabel={followLabel}
                accessibilityState={{
                  disabled: followPending,
                  selected: followActionActive,
                }}
                style={{ opacity: followPending ? 0.7 : 1 }}
              >
                <Text
                  className={
                    followActionActive
                      ? "text-white text-sm font-semibold text-center"
                      : "text-sky-200 text-sm font-semibold text-center"
                  }
                >
                  {followLabel}
                </Text>
              </Pressable>
            ) : null}

            {organizationStoreHref ? (
              <Pressable
                onPress={() => safePush(router, organizationStoreHref)}
                className="rounded-2xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel="Ver loja"
              >
                <Text className="text-emerald-100 text-sm font-semibold text-center">Ver loja</Text>
              </Pressable>
            ) : null}

            {!isUser && canView ? (
              <View className="gap-2 border-b border-white/12 pb-4">
                <Text className="text-white text-sm font-semibold">Agenda pública</Text>
                {publicAgendaQuery.isLoading ? (
                  <Text className="text-white/60 text-xs">A carregar agenda…</Text>
                ) : publicAgendaQuery.isError ? (
                  <Text className="text-white/55 text-xs">Agenda indisponível neste momento.</Text>
                ) : (publicAgendaQuery.data?.length ?? 0) > 0 ? (
                  <View className="gap-1.5">
                    {publicAgendaQuery.data!.slice(0, 4).map((item, index, list) => (
                      <View
                        key={`agenda-${item.id}`}
                        className={index < list.length - 1 ? "gap-1 border-b border-white/10 pb-2.5" : "gap-1 pb-0.5"}
                      >
                        <View className="flex-row items-center gap-2">
                          <View className="h-1.5 w-1.5 rounded-full bg-cyan-200/90" />
                          <Text className="flex-1 text-white text-sm font-semibold" numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>
                        <Text className="pl-3.5 text-white/62 text-xs">
                          {new Date(item.startsAt).toLocaleString("pt-PT")} · {item.sourceType}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-white/55 text-xs">Sem itens de agenda para os próximos dias.</Text>
                )}
              </View>
            ) : null}

            {isLocked ? (
              <View className="mt-1 flex-row items-start gap-3 rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-4">
                <View className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.9)" />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-white text-sm font-semibold">Esta conta é privada</Text>
                  <Text className="text-white/60 text-xs">
                    {isUser
                      ? "Adiciona como amigo para veres publicações, eventos e detalhes de padel."
                      : "Segue o clube para veres publicações, eventos e detalhes de padel."}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="pt-2">
                <SectionHeader title="Eventos" subtitle="Próximos e anteriores" />
                {eventsQuery.isLoading ? (
                  <View className="pt-3 gap-3">
                    <EventCardSquareSkeleton />
                    <EventCardSquareSkeleton />
                  </View>
                ) : eventsQuery.isError ? (
                  <View className="mt-3 border-b border-white/12 pb-3">
                    <Text className="text-white/70 text-sm">Não foi possível carregar os eventos deste perfil.</Text>
                  </View>
                ) : (
                  <View className="pt-3 gap-3">
                    <View className="flex-row flex-wrap gap-2">
                      <View className="rounded-full border border-cyan-200/35 bg-cyan-300/12 px-3 py-1.5">
                        <Text className="text-cyan-50 text-xs font-semibold">
                          Próximos {(eventsQuery.data?.upcoming ?? []).length}
                        </Text>
                      </View>
                      <View className="rounded-full border border-white/16 bg-white/6 px-3 py-1.5">
                        <Text className="text-white/80 text-xs font-semibold">
                          Passados {(eventsQuery.data?.past ?? []).length}
                        </Text>
                      </View>
                    </View>
                    {(eventsQuery.data?.upcoming ?? []).length > 0 ? (
                      <View>
                        <Text className="text-white/70 text-xs mb-2">Próximos</Text>
                        {(eventsQuery.data?.upcoming ?? []).map((event, index) => (
                          <EventCardSquare key={`upcoming-${event.id}`} event={event} index={index} source="profile" />
                        ))}
                      </View>
                    ) : (
                      <View className="border-b border-white/12 pb-3">
                        <Text className="text-white/60 text-sm">Sem eventos próximos.</Text>
                      </View>
                    )}

                    {(eventsQuery.data?.past ?? []).length > 0 ? (
                      <View className="pt-2">
                        <Text className="text-white/70 text-xs mb-2">Anteriores</Text>
                        {(eventsQuery.data?.past ?? []).map((event, index) => (
                          <EventCardSquare key={`past-${event.id}`} event={event} index={index} source="profile" />
                        ))}
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <FollowListModal
        open={followersOpen}
        title={isUser ? "Amigos" : "Seguidores"}
        items={followersList.data}
        isLoading={followersList.isLoading}
        isError={followersList.isError}
        emptyLabel={isUser ? "Sem amigos ainda." : "Sem seguidores ainda."}
        onClose={() => setFollowersOpen(false)}
        onRetry={() => followersList.refetch()}
      />
      <FollowListModal
        open={followingOpen && isUser}
        title="Clubes seguidos"
        items={followingList.data}
        isLoading={followingList.isLoading}
        isError={followingList.isError}
        emptyLabel="Ainda não segue clubes."
        onClose={() => setFollowingOpen(false)}
        onRetry={() => followingList.refetch()}
      />
    </LiquidBackground>
  );
}
