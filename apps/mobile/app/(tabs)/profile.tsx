import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
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
import { TopTicketsButton } from "../../components/navigation/TopTicketsButton";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { sanitizeUsername, validateUsername } from "../../lib/username";
import { checkUsernameAvailability } from "../../features/onboarding/api";
import { INTEREST_OPTIONS, InterestId } from "../../features/onboarding/types";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useUserFollowers, useUserFollowing } from "../../features/network/followLists";
import { FollowListModal } from "../../components/profile/FollowListModal";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import type { AgendaItem } from "../../features/profile/types";
import { getMobileEnv } from "../../lib/env";
import { resolveMobileLink } from "../../lib/links";

const INTEREST_ICONS: Record<InterestId, string> = {
  padel: "tennisball",
  concertos: "musical-notes",
  festas: "sparkles",
  viagens: "airplane",
  bem_estar: "leaf",
  gastronomia: "restaurant",
  aulas: "book",
  workshops: "construct",
};

export default function ProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
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
  const topBar = useTopBarScroll();
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
  const [interestsError, setInterestsError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved" | "error" | "unchanged"
  >("idle");
  const interestErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameAbortRef = useRef<AbortController | null>(null);
  const usernameCacheRef = useRef<Map<string, "available" | "taken" | "reserved">>(new Map());
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

  useEffect(() => {
    if (isFocused) {
      setDataReady(true);
      return;
    }
    setFollowersOpen(false);
    setFollowingOpen(false);
  }, [isFocused]);

  useEffect(() => {
    return () => {
      if (interestErrorTimeoutRef.current) {
        clearTimeout(interestErrorTimeoutRef.current);
      }
      if (usernameTimerRef.current) {
        clearTimeout(usernameTimerRef.current);
      }
      if (usernameAbortRef.current) {
        usernameAbortRef.current.abort();
      }
    };
  }, []);

  const avatarPreview = avatarRemoved ? null : avatarLocalUri ?? profile?.avatarUrl ?? null;
  const coverPreview = coverRemoved ? null : coverLocalUri ?? profile?.coverUrl ?? null;
  const topBarTitle = profile?.username ? `@${profile.username}` : "Perfil";
  const topBarRight = (
    <Pressable
      onPress={() => router.push("/settings")}
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          borderRadius: tokens.layout.touchTarget / 2,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed ? { opacity: 0.85, backgroundColor: "rgba(255,255,255,0.08)" } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Abrir definições"
      hitSlop={10}
    >
      <Ionicons name="settings-outline" size={20} color="rgba(240,247,255,0.95)" />
    </Pressable>
  );

  const allowReservedForEmail = session?.user?.email ?? null;
  const usernameValidation = useMemo(
    () => validateUsername(username, { allowReservedForEmail }),
    [username, allowReservedForEmail],
  );
  const normalizedUsername = usernameValidation.valid ? usernameValidation.normalized : sanitizeUsername(username);
  const fullNameError =
    editMode && fullName.trim().length > 0 && fullName.trim().length < 2 ? "Nome demasiado curto." : null;
  const usernameError =
    editMode && username.length > 0 && !usernameValidation.valid ? usernameValidation.error : null;
  const usernameStatusLabel = useMemo(() => {
    if (!editMode || !username || !usernameValidation.valid) return null;
    if (normalizedUsername === (profile?.username ?? "")) return "Atual";
    switch (usernameStatus) {
      case "checking":
        return "A verificar disponibilidade...";
      case "available":
        return "Disponível";
      case "taken":
        return "Já existe";
      case "reserved":
        return "Reservado";
      case "error":
        return "Não foi possível verificar agora";
      default:
        return null;
    }
  }, [editMode, normalizedUsername, profile?.username, username, usernameStatus, usernameValidation.valid]);

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
    fullName.trim().length >= 2 &&
      usernameValidation.valid &&
      isDirty &&
      !saving &&
      (usernameStatus === "available" || usernameStatus === "unchanged" || usernameStatus === "idle"),
  );

  useEffect(() => {
    if (!editMode) {
      setUsernameStatus("idle");
      return;
    }
    if (!username || !usernameValidation.valid) {
      setUsernameStatus("idle");
      return;
    }
    if (normalizedUsername === (profile?.username ?? "")) {
      setUsernameStatus("unchanged");
      return;
    }
    const cached = usernameCacheRef.current.get(normalizedUsername);
    if (cached) {
      setUsernameStatus(cached);
      return;
    }
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (usernameAbortRef.current) usernameAbortRef.current.abort();
    const controller = new AbortController();
    usernameAbortRef.current = controller;
    setUsernameStatus("checking");
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const availability = await checkUsernameAvailability(
          normalizedUsername,
          accessToken ?? null,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const next =
          availability.available ? "available" : availability.reason === "reserved" ? "reserved" : "taken";
        usernameCacheRef.current.set(normalizedUsername, next);
        setUsernameStatus(next);
      } catch {
        if (!controller.signal.aborted) setUsernameStatus("error");
      }
    }, 650);
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      if (usernameAbortRef.current) usernameAbortRef.current.abort();
    };
  }, [accessToken, editMode, normalizedUsername, profile?.username, username, usernameValidation.valid]);

  const nameNode = editMode ? (
    <View className="items-center">
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Nome completo"
        placeholderTextColor="rgba(255,255,255,0.4)"
        accessibilityLabel="Nome completo"
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
      {fullNameError ? <Text className="text-rose-200 text-[11px] mt-1">{fullNameError}</Text> : null}
    </View>
  ) : undefined;

  const usernameNode = editMode ? (
    <View className="items-center">
      <TextInput
        value={username}
        onChangeText={(value) => setUsername(sanitizeUsername(value))}
        placeholder="username"
        placeholderTextColor="rgba(255,255,255,0.4)"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Username"
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          textAlign: "center",
          paddingBottom: 2,
        }}
      />
      {usernameError ? (
        <Text className="text-rose-200 text-[11px] mt-1 text-center">{usernameError}</Text>
      ) : usernameStatusLabel ? (
        <Text
          className={
            usernameStatus === "available" || usernameStatus === "unchanged"
              ? "text-emerald-200 text-[11px] mt-1 text-center"
              : usernameStatus === "checking"
                ? "text-white/60 text-[11px] mt-1 text-center"
                : "text-rose-200 text-[11px] mt-1 text-center"
          }
        >
          {usernameStatusLabel}
        </Text>
      ) : null}
    </View>
  ) : undefined;

  const bioNode = editMode ? (
    <TextInput
      value={bio}
      onChangeText={setBio}
      placeholder="Escreve uma bio curta"
      placeholderTextColor="rgba(255,255,255,0.35)"
      multiline
      accessibilityLabel="Bio"
      style={{
        color: "rgba(255,255,255,0.8)",
        fontSize: 13,
        textAlign: "center",
        marginTop: 6,
      }}
    />
  ) : undefined;

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

  const removeImage = (kind: "avatar" | "cover") => {
    if (!editMode) return;
    if (kind === "avatar") {
      setAvatarLocalUri(null);
      setAvatarRemoved(true);
    } else {
      setCoverLocalUri(null);
      setCoverRemoved(true);
    }
  };

  const openImageActions = (kind: "avatar" | "cover") => {
    if (!editMode) return;
    const hasImage = kind === "avatar" ? Boolean(avatarPreview) : Boolean(coverPreview);
    const title = kind === "avatar" ? "Foto de perfil" : "Capa do perfil";
    const message = "Escolhe uma ação";
    const actions: Array<{ text: string; onPress?: () => void; style?: "cancel" | "destructive" }> = [
      { text: kind === "avatar" ? "Mudar foto" : "Mudar capa", onPress: () => pickImage(kind) },
    ];
    if (hasImage) {
      actions.push({
        text: kind === "avatar" ? "Remover foto" : "Remover capa",
        style: "destructive",
        onPress: () => removeImage(kind),
      });
    }
    actions.push({ text: "Cancelar", style: "cancel" });
    Alert.alert(title, message, actions);
  };

  const toggleInterest = (interest: InterestId) => {
    if (!editMode) return;
    setInterests((prev) => {
      if (prev.includes(interest)) {
        setInterestsError(null);
        return prev.filter((item) => item !== interest);
      }
      if (prev.length >= 6) {
        setInterestsError("Máximo 6 interesses.");
        if (interestErrorTimeoutRef.current) clearTimeout(interestErrorTimeoutRef.current);
        interestErrorTimeoutRef.current = setTimeout(() => setInterestsError(null), 2200);
        return prev;
      }
      setInterestsError(null);
      return [...prev, interest];
    });
  };

  const handleToggleEdit = () => {
    if (!editMode) {
      setEditMode(true);
      setInterestsError(null);
      return;
    }
    if (!isDirty) {
      setEditMode(false);
      setInterestsError(null);
      return;
    }
    Alert.alert("Descartar alterações?", "Queres sair sem guardar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Descartar",
        style: "destructive",
        onPress: () => {
          setEditMode(false);
          setInterestsError(null);
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
  const agendaItems = useMemo(() => agenda.data?.items ?? [], [agenda.data?.items]);
  const eventItems = useMemo(
    () => agendaItems.filter((item) => item.type === "EVENTO" || item.type === "JOGO"),
    [agendaItems],
  );
  const upcomingItems = useMemo(() => {
    const items = eventItems;
    const now = Date.now();
    return items
      .filter((item) => new Date(item.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3);
  }, [eventItems]);
  const pastItems = useMemo(() => {
    const items = eventItems;
    const now = Date.now();
    return items
      .filter((item) => new Date(item.startAt).getTime() < now)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 3);
  }, [eventItems]);
  const eventStats = useMemo(() => {
    const now = Date.now();
    const currentYear = new Date(now).getFullYear();
    const currentMonth = new Date(now).getMonth();
    let upcoming = 0;
    let past = 0;
    let thisMonth = 0;
    eventItems.forEach((item) => {
      const start = new Date(item.startAt);
      if (Number.isNaN(start.getTime())) return;
      if (start.getTime() >= now) upcoming += 1;
      else past += 1;
      if (start.getFullYear() === currentYear && start.getMonth() === currentMonth) {
        thisMonth += 1;
      }
    });
    return { upcoming, past, thisMonth };
  }, [eventItems]);

  const formatAgendaDate = (value: string) =>
    new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });

  const normalizeCoverUrl = (url?: string | null) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
    const base = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const renderAgendaItem = (item: AgendaItem) => {
    const resolved = resolveMobileLink(item.ctaHref, { allowWeb: false });
    const target = resolved.kind === "native" ? resolved.path : null;
    const disabled = !target;
    const cover = normalizeCoverUrl(item.coverImageUrl);
    return (
      <Pressable
        key={item.id}
        onPress={() => (target ? router.push(target as any) : undefined)}
        disabled={disabled}
        className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
        style={disabled ? { opacity: 0.6 } : undefined}
        accessibilityRole={disabled ? "text" : "button"}
        accessibilityLabel={item.title}
      >
        <View
          className="overflow-hidden rounded-xl border border-white/15 bg-white/10"
          style={{ width: 64, height: 46 }}
        >
          {cover ? (
            <Image source={{ uri: cover }} contentFit="cover" style={{ width: "100%", height: "100%" }} />
          ) : (
            <View className="flex-1 bg-white/5" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-white/60 text-xs">
            {formatAgendaDate(item.startAt)}
            {item.label ? ` · ${item.label}` : ""}
          </Text>
        </View>
        {!disabled ? <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" /> : null}
      </Pressable>
    );
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={topBarTitle}
        titleAlign="center"
        leftSlot={<TopTicketsButton />}
        rightSlot={topBarRight}
        rightSlotMode="append"
        showNotifications
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: tabBarPadding }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {summary.isLoading ? (
          <View className="gap-3 mb-6">
            <GlassSkeleton height={160} />
            <GlassSkeleton height={120} />
          </View>
        ) : summary.isError || !profile ? (
          <GlassCard intensity={54}>
            <View className="gap-3">
              <Text className="text-white text-sm font-semibold">Não foi possível carregar o perfil.</Text>
              <Text className="text-white/70 text-xs">Tenta novamente para atualizar os teus dados.</Text>
              <Pressable
                onPress={() => summary.refetch()}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel="Tentar novamente"
              >
                <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
              </Pressable>
            </View>
          </GlassCard>
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
              onCoverPress={editMode ? () => openImageActions("cover") : undefined}
              onAvatarPress={editMode ? () => openImageActions("avatar") : undefined}
              onFollowersPress={() => setFollowersOpen(true)}
              onFollowingPress={() => setFollowingOpen(true)}
              rightActions={
                <>
                  <Pressable
                    onPress={
                      editMode
                        ? isDirty && canSave
                          ? handleSave
                          : handleToggleEdit
                        : handleToggleEdit
                    }
                    disabled={saving}
                    className={
                      editMode
                        ? "rounded-full bg-white/90 px-3 py-2"
                        : "rounded-full border border-white/15 bg-white/10 px-3 py-2"
                    }
                    style={saving ? { opacity: 0.6 } : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={
                      editMode
                        ? isDirty && canSave
                          ? saving
                            ? "A guardar"
                            : "Guardar"
                          : "Fechar edição"
                        : "Editar"
                    }
                    accessibilityState={{ disabled: saving }}
                  >
                    <Text className={editMode ? "text-black text-xs font-semibold" : "text-white text-xs font-semibold"}>
                      {editMode ? (isDirty && canSave ? (saving ? "A guardar..." : "Guardar") : "Fechar") : "Editar"}
                    </Text>
                  </Pressable>
                </>
              }
              nameNode={nameNode}
              usernameNode={usernameNode}
              bioNode={bioNode}
            />

            {editMode ? (
              <Text className="text-white/55 text-xs text-center">
                Toca na foto ou na capa para mudar ou remover.
              </Text>
            ) : null}

            <View className="flex-row justify-center gap-8">
              <Pressable
                onPress={() => setShowPadel((prev) => !prev)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
                accessibilityRole="button"
                accessibilityLabel={showPadel ? "Ver perfil base" : "Ver perfil Padel"}
                accessibilityState={{ selected: showPadel }}
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
                    onPress={() => router.push({ pathname: "/onboarding", params: { step: "padel" } })}
                    className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                    accessibilityRole="button"
                    accessibilityLabel="Completar perfil Padel"
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
                            accessibilityRole="button"
                            accessibilityLabel={`Interesse ${interest.label}`}
                            accessibilityState={{ selected: active }}
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
                            className="flex-row items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-3 py-2"
                          >
                            <Ionicons
                              name={INTEREST_ICONS[interest.id] ?? "sparkles"}
                              size={12}
                              color="rgba(255,255,255,0.85)"
                            />
                            <Text className="text-white/85 text-xs font-semibold">{interest.label}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                  {editMode && interestsError ? (
                    <Text className="text-rose-200 text-[11px]">{interestsError}</Text>
                  ) : null}
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
                    Próximos eventos: {eventStats.upcoming} · Este mês: {eventStats.thisMonth}
                  </Text>
                </GlassSurface>
                {upcomingItems.length === 0 && pastItems.length === 0 ? (
                  <GlassCard intensity={52}>
                    <Text className="text-white/60 text-xs">Ainda não tens eventos no calendário.</Text>
                  </GlassCard>
                ) : (
                  <>
                    {upcomingItems.length > 0 ? (
                      <GlassCard intensity={52}>
                        <View className="gap-3">
                          <Text className="text-white text-sm font-semibold">Próximos</Text>
                          {upcomingItems.map(renderAgendaItem)}
                        </View>
                      </GlassCard>
                    ) : null}
                    {pastItems.length > 0 ? (
                      <GlassCard intensity={48}>
                        <View className="gap-3">
                          <Text className="text-white/80 text-sm font-semibold">Passados</Text>
                          {pastItems.map(renderAgendaItem)}
                        </View>
                      </GlassCard>
                    ) : null}
                  </>
                )}
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
