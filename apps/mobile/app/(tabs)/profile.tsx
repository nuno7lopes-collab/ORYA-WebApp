import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { safePush } from "../../lib/navigation";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { tokens, useTranslation } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
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
import { checkUsernameAvailability, savePadelOnboarding } from "../../features/onboarding/api";
import {
  INTEREST_OPTIONS,
  InterestId,
  PADEL_GENDERS,
  PADEL_LEVELS,
  PADEL_SIDES,
  PadelGender,
  PadelLevel,
  PadelPreferredSide,
} from "../../features/onboarding/types";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useUserFollowers, useUserFollowing } from "../../features/network/followLists";
import { FollowListModal } from "../../components/profile/FollowListModal";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { ProfileTicketsSheet } from "../../components/profile/ProfileTicketsSheet";
import type { AgendaItem } from "../../features/profile/types";
import { splitAgendaTimeline } from "../../features/profile/timeline";
import { getMobileEnv } from "../../lib/env";
import { resolveMobileLink } from "../../lib/links";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";

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

const normalizePadelGenderValue = (value: unknown): PadelGender | null => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "MALE" || normalized === "MASCULINO") return "MALE";
  if (normalized === "FEMALE" || normalized === "FEMININO") return "FEMALE";
  return null;
};

const normalizePadelSideValue = (value: unknown): PadelPreferredSide | null => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "ESQUERDA" || normalized === "LEFT") return "ESQUERDA";
  if (normalized === "DIREITA" || normalized === "RIGHT") return "DIREITA";
  if (normalized === "QUALQUER" || normalized === "ANY") return "QUALQUER";
  return null;
};

const normalizePadelLevelValue = (value: unknown): PadelLevel | null => {
  const candidate = typeof value === "number" && Number.isFinite(value) ? String(value) : String(value ?? "").trim();
  if (!candidate) return null;
  return PADEL_LEVELS.includes(candidate as PadelLevel) ? (candidate as PadelLevel) : null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
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
  const [padelEditorOpen, setPadelEditorOpen] = useState(false);
  const [padelSaving, setPadelSaving] = useState(false);
  const [padelGender, setPadelGender] = useState<PadelGender | null>(null);
  const [padelSide, setPadelSide] = useState<PadelPreferredSide | null>(null);
  const [padelLevel, setPadelLevel] = useState<PadelLevel | null>(null);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [ticketsSheetOpen, setTicketsSheetOpen] = useState(false);
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
  const padelProfile = publicProfile.data?.profile ?? null;
  const normalizedPadelGender = normalizePadelGenderValue(padelProfile?.padelGender ?? null);
  const normalizedPadelSide = normalizePadelSideValue(padelProfile?.padelPreferredSide ?? null);
  const normalizedPadelLevel = normalizePadelLevelValue(padelProfile?.padelLevel ?? profile?.padelLevel ?? null);
  const hasPadelProfile = Boolean(normalizedPadelGender && normalizedPadelSide && normalizedPadelLevel);
  const padelGenderLabels = useMemo(
    () => ({
      MALE: t("onboarding:padel.genders.male"),
      FEMALE: t("onboarding:padel.genders.female"),
    }),
    [t],
  );
  const padelSideLabels = useMemo(
    () => ({
      ESQUERDA: t("onboarding:padel.sides.left"),
      DIREITA: t("onboarding:padel.sides.right"),
      QUALQUER: t("onboarding:padel.sides.any"),
    }),
    [t],
  );

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
    setPadelGender(normalizedPadelGender);
    setPadelSide(normalizedPadelSide);
    setPadelLevel(normalizedPadelLevel);
  }, [normalizedPadelGender, normalizedPadelLevel, normalizedPadelSide]);

  useEffect(() => {
    if (!showPadel) return;
    if (!hasPadelProfile) {
      setPadelEditorOpen(true);
    }
  }, [hasPadelProfile, showPadel]);

  useEffect(() => {
    if (!showPadel) {
      setPadelEditorOpen(false);
    }
  }, [showPadel]);

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
      onPress={() => safePush(router, "/settings")}
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
  const usernameError = useMemo(() => {
    if (!editMode || username.length === 0) return null;
    if (usernameValidation.valid) return null;
    return "error" in usernameValidation ? usernameValidation.error : null;
  }, [editMode, username.length, usernameValidation]);
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
    const cleanup = () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      if (usernameAbortRef.current) usernameAbortRef.current.abort();
    };

    if (!editMode) {
      setUsernameStatus("idle");
      cleanup();
      return cleanup;
    }
    if (!username || !usernameValidation.valid) {
      setUsernameStatus("idle");
      cleanup();
      return cleanup;
    }
    if (normalizedUsername === (profile?.username ?? "")) {
      setUsernameStatus("unchanged");
      cleanup();
      return cleanup;
    }
    const cached = usernameCacheRef.current.get(normalizedUsername);
    if (cached) {
      setUsernameStatus(cached);
      cleanup();
      return cleanup;
    }

    cleanup();
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

    return cleanup;
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
    } catch {
      Alert.alert("Erro", "Não foi possível guardar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePadelProfile = async () => {
    if (!accessToken) {
      Alert.alert("Inicia sessão", "Precisas de sessão ativa para atualizar o perfil de padel.");
      return;
    }
    if (!padelGender || !padelSide) {
      Alert.alert("Perfil de padel", "Seleciona género competitivo e lado preferido.");
      return;
    }
    setPadelSaving(true);
    try {
      await savePadelOnboarding({
        gender: padelGender,
        preferredSide: padelSide,
        level: padelLevel,
        accessToken,
      });
      await Promise.all([summary.refetch(), publicProfile.refetch()]);
      setPadelEditorOpen(false);
      Alert.alert("Perfil de padel", "Perfil atualizado com sucesso.");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível guardar agora.";
      Alert.alert("Perfil de padel", errorMessage);
    } finally {
      setPadelSaving(false);
    }
  };

  const agendaStats = agenda.data?.stats ?? { upcoming: 0, past: 0, thisMonth: 0 };
  const totalTimelineItems = agendaStats.upcoming + agendaStats.past;
  const counts = publicProfile.data?.counts ?? { followers: 0, following: 0, events: totalTimelineItems };
  const agendaItems = useMemo(() => agenda.data?.items ?? [], [agenda.data?.items]);
  const timeline = useMemo(() => splitAgendaTimeline(agendaItems), [agendaItems]);
  const activeTimelineItems = useMemo(() => timeline.active.slice(0, 6), [timeline.active]);
  const historyTimelineItems = useMemo(() => timeline.history.slice(0, 8), [timeline.history]);
  const selectedInterests = useMemo(
    () => INTEREST_OPTIONS.filter((interest) => interests.includes(interest.id)),
    [interests],
  );
  const featuredUpcomingItem = activeTimelineItems[0] ?? null;
  const remainingUpcomingItems = featuredUpcomingItem ? activeTimelineItems.slice(1) : [];
  const historyGroups = useMemo(() => {
    const groups: Array<{ label: string; items: AgendaItem[] }> = [];
    historyTimelineItems.forEach((item) => {
      const date = new Date(item.startAt);
      const label = Number.isNaN(date.getTime())
        ? "Outros"
        : date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
      const previous = groups[groups.length - 1];
      if (previous && previous.label === label) {
        previous.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    });
    return groups;
  }, [historyTimelineItems]);

  const formatAgendaDate = (value: string, long = false) =>
    new Date(value).toLocaleDateString("pt-PT", long ? { weekday: "short", day: "2-digit", month: "long" } : { day: "2-digit", month: "short" });
  const agendaTypeLabel = (item: AgendaItem) => {
    switch (item.type) {
      case "EVENTO":
        return "Evento";
      case "JOGO":
        return "Jogo";
      case "INSCRICAO":
        return "Inscrição";
      case "RESERVA":
        return "Reserva";
      default:
        return "Agenda";
    }
  };
  const agendaTypeColor = (item: AgendaItem) => {
    switch (item.type) {
      case "EVENTO":
        return "rgba(111, 244, 255, 0.95)";
      case "JOGO":
        return "rgba(161, 255, 168, 0.95)";
      case "INSCRICAO":
        return "rgba(255, 213, 122, 0.95)";
      case "RESERVA":
        return "rgba(182, 192, 255, 0.95)";
      default:
        return "rgba(255,255,255,0.85)";
    }
  };

  const normalizeCoverUrl = (url?: string | null) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
    const base = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const renderAgendaItem = (item: AgendaItem, options?: { featured?: boolean; showDivider?: boolean }) => {
    const resolved = resolveMobileLink(item.ctaHref, { allowWeb: false });
    const target = resolved.kind === "native" ? resolved.path : null;
    const disabled = !target;
    const cover = normalizeCoverUrl(item.coverImageUrl);
    const featured = options?.featured === true;
    const showDivider = options?.showDivider ?? true;
    const typeLabel = agendaTypeLabel(item);
    const accentColor = agendaTypeColor(item);
    return (
      <Pressable
        key={item.id}
        onPress={() => (target ? safePush(router, target) : undefined)}
        disabled={disabled}
        className={
          featured
            ? "flex-row items-center gap-3 rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-3 py-3"
            : showDivider
              ? "flex-row items-center gap-3 border-b border-white/10 px-1 py-3"
              : "flex-row items-center gap-3 px-1 py-3"
        }
        style={disabled ? { opacity: 0.6 } : featured ? { shadowColor: "#6FF4FF", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } } : undefined}
        accessibilityRole={disabled ? "text" : "button"}
        accessibilityLabel={item.title}
      >
        <View
          className="overflow-hidden rounded-xl border border-white/15 bg-white/8"
          style={{ width: featured ? 84 : 64, height: featured ? 62 : 46 }}
        >
          {cover ? (
            <Image source={{ uri: cover }} contentFit="cover" style={{ width: "100%", height: "100%" }} />
          ) : (
            <View className="flex-1 bg-white/5" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text className={featured ? "text-white text-base font-semibold" : "text-white text-sm font-semibold"} numberOfLines={1}>
            {item.title}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
              <Text style={{ color: accentColor, fontSize: 10, fontWeight: "700" }}>{typeLabel}</Text>
            </View>
            <Text className={featured ? "text-white/75 text-xs" : "text-white/60 text-xs"}>
              {formatAgendaDate(item.startAt, featured)}
            </Text>
          </View>
          {item.label ? (
            <Text className={featured ? "text-white/62 text-xs mt-0.5" : "text-white/55 text-xs mt-0.5"} numberOfLines={1}>
              {item.label}
            </Text>
          ) : null}
        </View>
        {!disabled ? <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" /> : null}
      </Pressable>
    );
  };

  const renderHistoryItem = (item: AgendaItem, index: number, total: number) => {
    const resolved = resolveMobileLink(item.ctaHref, { allowWeb: false });
    const target = resolved.kind === "native" ? resolved.path : null;
    const disabled = !target;
    const showDivider = index < total - 1;
    const accentColor = agendaTypeColor(item);
    return (
      <Pressable
        key={item.id}
        onPress={() => (target ? safePush(router, target) : undefined)}
        disabled={disabled}
        className={showDivider ? "flex-row items-start gap-3 border-b border-white/10 py-3" : "flex-row items-start gap-3 py-3"}
        style={disabled ? { opacity: 0.6 } : undefined}
        accessibilityRole={disabled ? "text" : "button"}
        accessibilityLabel={item.title}
      >
        <View className="items-center" style={{ width: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: accentColor, marginTop: 5 }} />
          {showDivider ? <View style={{ width: 1, flex: 1, minHeight: 44, backgroundColor: "rgba(255,255,255,0.16)", marginTop: 6 }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-white/60 text-xs mt-1">
            {agendaTypeLabel(item)} · {formatAgendaDate(item.startAt)}
            {item.label ? ` · ${item.label}` : ""}
          </Text>
        </View>
        {!disabled ? <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" /> : null}
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
        leftSlot={<TopTicketsButton onPress={() => setTicketsSheetOpen(true)} />}
        rightSlot={topBarRight}
        rightSlotMode="replace"
        showNotifications={false}
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
          <View className="gap-3 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-4">
            <Text className="text-white text-sm font-semibold">Não foi possível carregar o perfil.</Text>
            <Text className="text-white/75 text-xs">Tenta novamente para atualizar os teus dados.</Text>
            <Pressable
              onPress={() => summary.refetch()}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
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
                events: counts.events ?? totalTimelineItems,
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

            <View className="self-center flex-row items-center rounded-full border border-white/14 bg-white/[0.04] p-1">
              <Pressable
                onPress={() => setShowPadel(false)}
                className={
                  !showPadel
                    ? "min-w-[126px] rounded-full border border-white/24 bg-white/20 px-4 py-2.5"
                    : "min-w-[126px] rounded-full border border-transparent bg-transparent px-4 py-2.5"
                }
                accessibilityRole="button"
                accessibilityLabel={t("events:padel.profile.baseLabel")}
                accessibilityState={{ selected: !showPadel }}
              >
                <Text className={!showPadel ? "text-white text-xs font-semibold text-center" : "text-white/75 text-xs font-semibold text-center"}>
                  {t("events:padel.profile.baseLabel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowPadel(true)}
                className={
                  showPadel
                    ? "min-w-[126px] rounded-full border border-cyan-200/38 bg-cyan-300/20 px-4 py-2.5"
                    : "min-w-[126px] rounded-full border border-transparent bg-transparent px-4 py-2.5"
                }
                accessibilityRole="button"
                accessibilityLabel={t("events:padel.profile.padelLabel")}
                accessibilityState={{ selected: showPadel }}
              >
                <View className="flex-row items-center justify-center gap-2">
                  <Ionicons name="tennisball" size={14} color="rgba(255,255,255,0.9)" />
                  <Text className={showPadel ? "text-white text-xs font-semibold text-center" : "text-white/75 text-xs font-semibold text-center"}>
                    {t("events:padel.profile.padelLabel")}
                  </Text>
                </View>
              </Pressable>
            </View>

            {showPadel ? (
              <View className="gap-3 pb-3">
                <Text className="text-white text-sm font-semibold mb-2">{t("events:padel.profile.title")}</Text>
                {normalizedPadelLevel ? (
                  <Text className="text-white/70 text-sm">
                    {t("events:padel.profile.levelLabel", { level: normalizedPadelLevel })}
                  </Text>
                ) : (
                  <Text className="text-white/60 text-sm">{t("events:padel.profile.levelMissing")}</Text>
                )}
                <Text className="text-white/65 text-xs mt-1">
                  {normalizedPadelGender
                    ? `Género competitivo: ${padelGenderLabels[normalizedPadelGender]}`
                    : "Género competitivo por definir"}
                </Text>
                <Text className="text-white/65 text-xs">
                  {normalizedPadelSide
                    ? `Lado preferido: ${padelSideLabels[normalizedPadelSide]}`
                    : "Lado preferido por definir"}
                </Text>
                <Pressable
                  onPress={() => setPadelEditorOpen((prev) => !prev)}
                  className="mt-2 rounded-xl border border-white/15 bg-white/7 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel={
                    padelEditorOpen
                      ? "Fechar editor de perfil de padel"
                      : hasPadelProfile
                        ? "Editar perfil de padel"
                        : t("events:padel.profile.completeProfile")
                  }
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {padelEditorOpen
                      ? "Fechar edição"
                      : hasPadelProfile
                        ? "Editar perfil Padel"
                        : t("events:padel.profile.completeProfile")}
                  </Text>
                </Pressable>
                {!padelEditorOpen && hasPadelProfile ? (
                  <Text className="text-white/60 text-xs">
                    Perfil completo. Podes editar sempre que quiseres.
                  </Text>
                ) : null}
                {padelEditorOpen ? (
                  <View className="mt-3 gap-3">
                    <Text className="text-white/70 text-xs uppercase tracking-[0.08em]">Género</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {PADEL_GENDERS.map((gender) => {
                        const active = padelGender === gender.id;
                        return (
                          <Pressable
                            key={gender.id}
                            onPress={() => setPadelGender(gender.id)}
                            className={
                              active
                                ? "rounded-full border border-white/25 bg-white/20 px-3 py-2"
                                : "rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            }
                            accessibilityRole="button"
                            accessibilityLabel={padelGenderLabels[gender.id]}
                            accessibilityState={{ selected: active }}
                          >
                            <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                              {padelGenderLabels[gender.id]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text className="text-white/70 text-xs uppercase tracking-[0.08em]">Lado</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {PADEL_SIDES.map((side) => {
                        const active = padelSide === side.id;
                        return (
                          <Pressable
                            key={side.id}
                            onPress={() => setPadelSide(side.id)}
                            className={
                              active
                                ? "rounded-full border border-white/25 bg-white/20 px-3 py-2"
                                : "rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            }
                            accessibilityRole="button"
                            accessibilityLabel={padelSideLabels[side.id]}
                            accessibilityState={{ selected: active }}
                          >
                            <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                              {padelSideLabels[side.id]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text className="text-white/70 text-xs uppercase tracking-[0.08em]">Nível</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {PADEL_LEVELS.map((level) => {
                        const active = padelLevel === level;
                        return (
                          <Pressable
                            key={level}
                            onPress={() =>
                              setPadelLevel((prev) => (prev === level ? null : level))
                            }
                            className={
                              active
                                ? "rounded-full border border-white/25 bg-white/20 px-3 py-2"
                                : "rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Nível ${level}`}
                            accessibilityState={{ selected: active }}
                          >
                            <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                              {level}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      onPress={handleSavePadelProfile}
                      disabled={padelSaving}
                      className="rounded-xl bg-white/90 px-4 py-3"
                      style={padelSaving ? { opacity: 0.7 } : undefined}
                      accessibilityRole="button"
                      accessibilityLabel="Guardar perfil de padel"
                      accessibilityState={{ disabled: padelSaving }}
                    >
                      <Text className="text-[#0b1014] text-sm font-semibold text-center">
                        {padelSaving ? "A guardar..." : "Guardar perfil de padel"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => safePush(router, TAB_PATHNAMES.padel)}
                  className="mt-1 rounded-xl border border-white/15 bg-white/10 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.explore")}
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {t("common:actions.explore")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-3">
                {editMode ? (
                  <View className="gap-2">
                    <View className="flex-row flex-wrap gap-3">
                      {INTEREST_OPTIONS.map((interest) => {
                        const active = interests.includes(interest.id);
                        return (
                          <Pressable
                            key={interest.id}
                            onPress={() => toggleInterest(interest.id)}
                            className={
                              active
                                ? "rounded-full border border-white/30 bg-white/16 px-3 py-2"
                                : "rounded-full border border-white/12 bg-white/5 px-3 py-2"
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
                    <Text className="text-white/60 text-xs">{interests.length}/6 interesses selecionados</Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {selectedInterests.length === 0 ? (
                      <View className="gap-2">
                        <Text className="text-white/65 text-sm">Sem interesses definidos.</Text>
                        <Pressable
                          onPress={() => setEditMode(true)}
                          className="self-start rounded-full border border-white/15 bg-white/8 px-3 py-2"
                          accessibilityRole="button"
                          accessibilityLabel="Definir interesses"
                        >
                          <Text className="text-white/90 text-xs font-semibold">Definir interesses</Text>
                        </Pressable>
                      </View>
                    ) : (
                      selectedInterests.map((interest) => (
                        <View
                          key={interest.id}
                          className="flex-row items-center gap-2 rounded-full border border-white/15 bg-white/6 px-3 py-2"
                        >
                          <Ionicons
                            name={INTEREST_ICONS[interest.id] ?? "sparkles"}
                            size={12}
                            color="rgba(255,255,255,0.9)"
                          />
                          <Text className="text-white/90 text-xs font-semibold">{interest.label}</Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
                {editMode && interestsError ? (
                  <Text className="text-rose-200 text-[11px]">{interestsError}</Text>
                ) : null}
              </View>
            )}

            {!showPadel ? (
              <>
                <SectionHeader title="Timeline pessoal" subtitle="Reservas, bilhetes, inscrições e jogos." />
                {agenda.isLoading ? (
                  <View className="gap-3">
                    <GlassSkeleton height={90} />
                  </View>
                ) : (
                  <View className="gap-5">
                    <View className="flex-row flex-wrap gap-2">
                      <View className="rounded-full border border-cyan-200/35 bg-cyan-300/12 px-3 py-1.5">
                        <Text className="text-cyan-50 text-xs font-semibold">
                          Próximos {timeline.active.length}
                        </Text>
                      </View>
                      <View className="rounded-full border border-white/16 bg-white/6 px-3 py-1.5">
                        <Text className="text-white/80 text-xs font-semibold">
                          Histórico {timeline.history.length}
                        </Text>
                      </View>
                      <View className="rounded-full border border-emerald-200/26 bg-emerald-300/10 px-3 py-1.5">
                        <Text className="text-emerald-100 text-xs font-semibold">
                          Este mês {agendaStats.thisMonth}
                        </Text>
                      </View>
                    </View>
                    {activeTimelineItems.length === 0 && historyTimelineItems.length === 0 ? (
                      <View className="gap-2">
                        <Text className="text-white/65 text-sm">Ainda não tens itens na tua timeline pessoal.</Text>
                        <Pressable
                          onPress={() => safePush(router, TAB_PATHNAMES.agora)}
                          className="self-start rounded-full border border-cyan-200/40 bg-cyan-300/15 px-3 py-2"
                          accessibilityRole="button"
                          accessibilityLabel="Explorar eventos"
                        >
                          <Text className="text-cyan-50 text-xs font-semibold">Explorar eventos</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        {activeTimelineItems.length > 0 ? (
                          <View className="gap-2">
                            <Text className="text-white text-base font-semibold">
                              Próximos eventos ({activeTimelineItems.length})
                            </Text>
                            {featuredUpcomingItem ? renderAgendaItem(featuredUpcomingItem, { featured: true }) : null}
                            {remainingUpcomingItems.length > 0 ? (
                              <View className="border-b border-cyan-200/20 pb-1">
                                {remainingUpcomingItems.map((item, index) =>
                                  renderAgendaItem(item, { showDivider: index < remainingUpcomingItems.length - 1 }),
                                )}
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                        {historyTimelineItems.length > 0 ? (
                          <View className="gap-2">
                            <Text className="text-white/90 text-base font-semibold">
                              Histórico ({historyTimelineItems.length})
                            </Text>
                            <View className="border-b border-white/10 pb-1">
                              {historyGroups.map((group) => (
                                <View key={group.label} className="gap-1">
                                  <Text className="text-white/55 text-[11px] uppercase tracking-[0.08em] py-1">
                                    {group.label}
                                  </Text>
                                  {group.items.map((item, index) =>
                                    renderHistoryItem(item, index, group.items.length),
                                  )}
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                )}
              </>
            ) : null}

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
      <ProfileTicketsSheet visible={ticketsSheetOpen} onClose={() => setTicketsSheetOpen(false)} />
    </LiquidBackground>
  );
}
