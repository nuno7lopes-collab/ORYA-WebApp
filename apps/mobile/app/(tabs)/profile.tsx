import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  InteractionManager,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { Ionicons } from "../../components/icons/Ionicons";
import { useAuth } from "../../lib/auth";
import { useProfileAgenda, useProfileSummary, usePublicProfile } from "../../features/profile/hooks";
import { updateProfile } from "../../features/profile/api";
import { uploadImage } from "../../lib/upload";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { sanitizeUsername, validateUsername } from "../../lib/username";
import { checkUsernameAvailability } from "../../features/onboarding/api";
import { INTEREST_OPTIONS, InterestId } from "../../features/onboarding/types";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useUserFollowers, useUserFollowing } from "../../features/network/followLists";
import { FollowListModal } from "../../components/profile/FollowListModal";
import { ProfileHeader } from "../../components/profile/ProfileHeader";

export default function ProfileScreen() {
  const router = useRouter();
  const [dataReady, setDataReady] = useState(false);
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const summary = useProfileSummary(dataReady, accessToken, userId);
  const agenda = useProfileAgenda(accessToken, userId, dataReady);
  const profile = summary.data ?? null;
  const publicProfile = usePublicProfile(profile?.username ?? null, accessToken, dataReady);
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(16);
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [coverLocalUri, setCoverLocalUri] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [showPadel, setShowPadel] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const followersList = useUserFollowers(userId, accessToken, Boolean(followersOpen && userId));
  const followingList = useUserFollowing(userId, accessToken, Boolean(followingOpen && userId));

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setInterests((profile.favouriteCategories ?? []) as InterestId[]);
    setAvatarLocalUri(null);
    setCoverLocalUri(null);
    setAvatarRemoved(false);
    setCoverRemoved(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const task = InteractionManager.runAfterInteractions(() => {
        if (active) setDataReady(true);
      });
      return () => {
        active = false;
        task.cancel();
        setFollowersOpen(false);
        setFollowingOpen(false);
        setDataReady(false);
      };
    }, []),
  );

  const avatarPreview = avatarRemoved ? null : avatarLocalUri ?? profile?.avatarUrl ?? null;
  const coverPreview = coverRemoved ? null : coverLocalUri ?? profile?.coverUrl ?? null;

  const allowReservedForEmail = session?.user?.email ?? null;
  const usernameValidation = useMemo(
    () => validateUsername(username, { allowReservedForEmail }),
    [username, allowReservedForEmail],
  );
  const normalizedUsername = usernameValidation.valid ? usernameValidation.normalized : sanitizeUsername(username);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    if (fullName.trim() !== (profile.fullName ?? "").trim()) return true;
    if (normalizedUsername !== (profile.username ?? "")) return true;
    if (bio.trim() !== (profile.bio ?? "").trim()) return true;
    const profileInterests = (profile.favouriteCategories ?? []) as InterestId[];
    if (interests.slice().sort().join("|") !== profileInterests.slice().sort().join("|")) return true;
    if (avatarRemoved || coverRemoved || avatarLocalUri || coverLocalUri) return true;
    return false;
  }, [avatarLocalUri, avatarRemoved, bio, coverLocalUri, coverRemoved, fullName, interests, normalizedUsername, profile]);

  const canSave = Boolean(
    fullName.trim().length >= 2 && usernameValidation.valid && isDirty && !saving,
  );

  const requestImagePermission = async () => {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.status === ImagePicker.PermissionStatus.GRANTED) return true;

    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requested.status === ImagePicker.PermissionStatus.GRANTED) return true;
    Alert.alert("Permissão necessária", "Autoriza o acesso à galeria para atualizar fotos.");
    return false;
  };

  const pickImage = async (kind: "avatar" | "cover") => {
    if (!editMode) return;
    const ok = await requestImagePermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [16, 9],
      quality: 0.9,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    if (kind === "avatar") {
      setAvatarLocalUri(uri);
      setAvatarRemoved(false);
    } else {
      setCoverLocalUri(uri);
      setCoverRemoved(false);
    }
  };

  const toggleInterest = (interest: InterestId) => {
    if (!editMode) return;
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((item) => item !== interest);
      if (prev.length >= 6) return prev;
      return [...prev, interest];
    });
  };

  const handleToggleEdit = () => {
    if (!editMode) {
      setEditMode(true);
      return;
    }
    if (!isDirty) {
      setEditMode(false);
      return;
    }
    Alert.alert("Descartar alterações?", "Queres sair sem guardar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Descartar",
        style: "destructive",
        onPress: () => {
          setEditMode(false);
          if (profile) {
            setFullName(profile.fullName ?? "");
            setUsername(profile.username ?? "");
            setBio(profile.bio ?? "");
            setInterests((profile.favouriteCategories ?? []) as InterestId[]);
            setAvatarLocalUri(null);
            setCoverLocalUri(null);
            setAvatarRemoved(false);
            setCoverRemoved(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!profile || !canSave) return;
    setSaving(true);
    try {
      if (profile.username !== normalizedUsername) {
        const availability = await checkUsernameAvailability(normalizedUsername, accessToken ?? null);
        if (!availability.available) {
          const message =
            availability.reason === "reserved"
              ? "Este username está reservado."
              : "Escolhe outro username.";
          Alert.alert("Username indisponível", message);
          setSaving(false);
          return;
        }
      }
      let avatarUrl = avatarRemoved ? null : profile.avatarUrl ?? null;
      let coverUrl = coverRemoved ? null : profile.coverUrl ?? null;

      if (avatarLocalUri && accessToken) {
        avatarUrl = await uploadImage({ uri: avatarLocalUri, scope: "avatar", accessToken });
      }
      if (coverLocalUri && accessToken) {
        coverUrl = await uploadImage({ uri: coverLocalUri, scope: "profile-cover", accessToken });
      }

      await updateProfile({
        accessToken,
        fullName: fullName.trim(),
        username: normalizedUsername,
        bio: bio.trim() || null,
        avatarUrl,
        coverUrl,
        favouriteCategories: interests,
        visibility: profile.visibility ?? "PUBLIC",
        allowEmailNotifications: profile.allowEmailNotifications ?? true,
        allowEventReminders: profile.allowEventReminders ?? true,
        allowFollowRequests: profile.allowFollowRequests ?? true,
      });

      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "public"] });
      setEditMode(false);
    } catch (err: any) {
      Alert.alert("Erro", "Não foi possível guardar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const agendaStats = agenda.data?.stats ?? { upcoming: 0, past: 0, thisMonth: 0 };
  const totalEvents = agendaStats.upcoming + agendaStats.past;
  const counts = publicProfile.data?.counts ?? { followers: 0, following: 0, events: totalEvents };
  const upcomingItems = useMemo(() => {
    const items = agenda.data?.items ?? [];
    const now = Date.now();
    return items
      .filter((item) => new Date(item.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3);
  }, [agenda.data?.items]);

  return (
    <LiquidBackground>
      <TopAppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: tabBarPadding }}
        showsVerticalScrollIndicator={false}
      >
        {summary.isLoading ? (
          <View className="gap-3 mb-6">
            <GlassSkeleton height={160} />
            <GlassSkeleton height={120} />
          </View>
        ) : (
          <View className="gap-5">
            <ProfileHeader
              isUser
              coverUrl={coverPreview}
              avatarUrl={avatarPreview}
              displayName={profile?.fullName ?? "Utilizador ORYA"}
              username={profile?.username ?? null}
              bio={profile?.bio ?? null}
              counts={{
                followers: counts.followers,
                following: counts.following,
                events: counts.events ?? totalEvents,
              }}
              onCoverPress={editMode ? () => pickImage("cover") : undefined}
              onAvatarPress={editMode ? () => pickImage("avatar") : undefined}
              onFollowersPress={() => setFollowersOpen(true)}
              onFollowingPress={() => setFollowingOpen(true)}
              rightActions={
                <>
                  <Pressable
                    onPress={() => router.push("/settings")}
                    className="rounded-full border border-white/15 bg-white/10 p-2"
                  >
                    <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.9)" />
                  </Pressable>
                  <Pressable
                    onPress={editMode ? handleSave : handleToggleEdit}
                    disabled={editMode && !canSave}
                    className={
                      editMode
                        ? "rounded-full bg-white/90 px-3 py-2"
                        : "rounded-full border border-white/15 bg-white/10 px-3 py-2"
                    }
                    style={editMode && !canSave ? { opacity: 0.5 } : undefined}
                  >
                    <Text className={editMode ? "text-black text-xs font-semibold" : "text-white text-xs font-semibold"}>
                      {editMode ? (saving ? "A guardar..." : "Guardar") : "Editar"}
                    </Text>
                  </Pressable>
                </>
              }
              nameNode={
                editMode ? (
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Nome completo"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={{
                      color: "#ffffff",
                      fontSize: 20,
                      fontWeight: "700",
                      textAlign: "center",
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(255,255,255,0.12)",
                      paddingBottom: 4,
                      minWidth: 220,
                    }}
                  />
                ) : undefined
              }
              usernameNode={
                editMode ? (
                  <TextInput
                    value={username}
                    onChangeText={(value) => setUsername(sanitizeUsername(value))}
                    placeholder="username"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 13,
                      textAlign: "center",
                      paddingBottom: 2,
                    }}
                  />
                ) : undefined
              }
              bioNode={
                editMode ? (
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Escreve uma bio curta"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  />
                ) : undefined
              }
            />

            <View className="flex-row justify-center gap-8">
              <Pressable
                onPress={() => setShowPadel((prev) => !prev)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="tennisball" size={14} color="rgba(255,255,255,0.85)" />
                  <Text className="text-white text-xs font-semibold">
                    {showPadel ? "Perfil base" : "Perfil Padel"}
                  </Text>
                </View>
              </Pressable>
            </View>

            {showPadel ? (
              <GlassCard intensity={54}>
                <Text className="text-white text-sm font-semibold mb-2">Perfil Padel</Text>
                {profile?.padelLevel ? (
                  <Text className="text-white/70 text-sm">Nível: {profile.padelLevel}</Text>
                ) : (
                  <Text className="text-white/60 text-sm">Completa o teu perfil Padel para apareceres nos rankings.</Text>
                )}
                {!profile?.padelLevel ? (
                  <Pressable
                    onPress={() => setShowPadel(true)}
                    className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  >
                    <Text className="text-white text-sm font-semibold text-center">Completar perfil Padel</Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            ) : (
              <GlassCard intensity={52}>
                <View className="gap-3">
                  {editMode ? (
                    <View className="flex-row flex-wrap gap-3">
                      {INTEREST_OPTIONS.map((interest) => {
                        const active = interests.includes(interest.id);
                        return (
                          <Pressable
                            key={interest.id}
                            onPress={() => toggleInterest(interest.id)}
                            className={
                              active
                                ? "rounded-full border border-white/25 bg-white/15 px-3 py-2"
                                : "rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            }
                          >
                            <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                              {interest.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {INTEREST_OPTIONS.filter((interest) => interests.includes(interest.id)).length === 0 ? (
                        <Text className="text-white/55 text-xs">Sem interesses definidos.</Text>
                      ) : (
                        INTEREST_OPTIONS.filter((interest) => interests.includes(interest.id)).map((interest) => (
                          <View
                            key={interest.id}
                            className="rounded-full border border-white/15 bg-white/8 px-3 py-2"
                          >
                            <Text className="text-white/80 text-xs font-semibold">{interest.label}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              </GlassCard>
            )}

            <SectionHeader title="Calendário" subtitle="Próximos eventos e torneios." />
            {agenda.isLoading ? (
              <View className="gap-3">
                <GlassSkeleton height={90} />
              </View>
            ) : (
              <View className="gap-3">
                <GlassSurface intensity={48}>
                  <Text className="text-white/70 text-sm">
                    Próximos eventos: {agendaStats.upcoming} · Este mês: {agendaStats.thisMonth}
                  </Text>
                </GlassSurface>
                {upcomingItems.length > 0 ? (
                  <GlassCard intensity={52}>
                    <View className="gap-2">
                      <Text className="text-white text-sm font-semibold">Próximos</Text>
                      {upcomingItems.map((item) => (
                        <View key={item.id} className="flex-row justify-between">
                          <Text className="text-white/70 text-xs" numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text className="text-white/50 text-xs">{new Date(item.startAt).toLocaleDateString("pt-PT")}</Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                ) : null}
              </View>
            )}
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
        open={followingOpen}
        title="A seguir"
        items={followingList.data}
        isLoading={followingList.isLoading}
        isError={followingList.isError}
        emptyLabel="Ainda não segues ninguém."
        onClose={() => setFollowingOpen(false)}
        onRetry={() => followingList.refetch()}
      />
    </LiquidBackground>
  );
}
