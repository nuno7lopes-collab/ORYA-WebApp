import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { updateProfile } from "../../features/profile/api";
import { uploadImage } from "../../lib/upload";
import { checkUsernameAvailability } from "../../features/onboarding/api";
import { PADEL_LEVELS, InterestId, INTEREST_OPTIONS } from "../../features/onboarding/types";
import { safeBack } from "../../lib/navigation";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "../../lib/username";

export default function ProfileEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const summary = useProfileSummary(Boolean(accessToken), accessToken, userId);
  const profile = summary.data;

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [padelLevel, setPadelLevel] = useState<string | null>(null);
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE" | "FOLLOWERS">("PUBLIC");
  const [allowEmailNotifications, setAllowEmailNotifications] = useState(true);
  const [allowEventReminders, setAllowEventReminders] = useState(true);
  const [allowFollowRequests, setAllowFollowRequests] = useState(true);

  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [coverLocalUri, setCoverLocalUri] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setCity(profile.city ?? "");
    setPadelLevel(profile.padelLevel ?? null);
    setInterests((profile.favouriteCategories ?? []).slice(0, 6) as InterestId[]);
    setVisibility(profile.visibility ?? "PUBLIC");
    setAllowEmailNotifications(profile.allowEmailNotifications ?? true);
    setAllowEventReminders(profile.allowEventReminders ?? true);
    setAllowFollowRequests(profile.allowFollowRequests ?? true);
    setAvatarLocalUri(null);
    setCoverLocalUri(null);
    setAvatarRemoved(false);
    setCoverRemoved(false);
    setAvatarProgress(null);
    setCoverProgress(null);
    setAvatarError(null);
    setCoverError(null);
  }, [profile]);

  const avatarPreview = avatarRemoved ? null : avatarLocalUri ?? profile?.avatarUrl ?? null;
  const coverPreview = coverRemoved ? null : coverLocalUri ?? profile?.coverUrl ?? null;
  const avatarInitial = useMemo(() => {
    const source = (fullName || profile?.fullName || session?.user?.email || "").trim();
    return source ? source[0].toUpperCase() : "";
  }, [fullName, profile?.fullName, session?.user?.email]);

  const requestImagePermission = async () => {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.status === ImagePicker.PermissionStatus.GRANTED) return true;

    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requested.status === ImagePicker.PermissionStatus.GRANTED) return true;

    if (requested.canAskAgain === false) {
      Alert.alert(
        "Permissão necessária",
        "Autoriza o acesso à galeria nas definições para atualizar fotos.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Abrir definições",
            onPress: () => {
              Linking.openSettings().catch(() => undefined);
            },
          },
        ],
      );
    } else {
      Alert.alert("Permissão necessária", "Autoriza o acesso à galeria para atualizar fotos.");
    }
    return false;
  };

  const pickImage = async (kind: "avatar" | "cover") => {
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
      setAvatarError(null);
      setAvatarProgress(null);
    } else {
      setCoverLocalUri(uri);
      setCoverRemoved(false);
      setCoverError(null);
      setCoverProgress(null);
    }
  };

  const toggleInterest = (interest: InterestId) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((item) => item !== interest);
      if (prev.length >= 6) return prev;
      return [...prev, interest];
    });
  };

  const usernameValidation = useMemo(() => validateUsername(username), [username]);
  const normalizedUsername = usernameValidation.valid
    ? usernameValidation.normalized
    : sanitizeUsername(username);
  const isDirty = useMemo(() => {
    if (!profile) return false;
    if (fullName.trim() !== (profile.fullName ?? "").trim()) return true;
    if (normalizedUsername !== (profile.username ?? "")) return true;
    if (bio.trim() !== (profile.bio ?? "").trim()) return true;
    if (city.trim() !== (profile.city ?? "").trim()) return true;
    if ((profile.padelLevel ?? null) !== padelLevel) return true;
    if (visibility !== (profile.visibility ?? "PUBLIC")) return true;
    if (allowEmailNotifications !== (profile.allowEmailNotifications ?? true)) return true;
    if (allowEventReminders !== (profile.allowEventReminders ?? true)) return true;
    if (allowFollowRequests !== (profile.allowFollowRequests ?? true)) return true;
    if (avatarRemoved || coverRemoved || avatarLocalUri || coverLocalUri) return true;
    const profileInterests = (profile.favouriteCategories ?? []).slice(0, 6) as InterestId[];
    const currentKey = interests.slice().sort().join("|");
    const profileKey = profileInterests.slice().sort().join("|");
    if (currentKey !== profileKey) return true;
    return false;
  }, [
    allowEmailNotifications,
    allowEventReminders,
    allowFollowRequests,
    avatarLocalUri,
    avatarRemoved,
    bio,
    city,
    coverLocalUri,
    coverRemoved,
    fullName,
    interests,
    normalizedUsername,
    padelLevel,
    profile,
    visibility,
  ]);

  const canSave = fullName.trim().length >= 2 && usernameValidation.valid && isDirty && !saving;

  const handleUsernameCheck = async () => {
    if (!accessToken) return false;
    if (!usernameValidation.valid) {
      setUsernameStatus("invalid");
      Alert.alert("Username inválido", usernameValidation.error || USERNAME_RULES_HINT);
      return false;
    }
    setUsernameStatus("checking");
    try {
      const available = await checkUsernameAvailability(normalizedUsername, accessToken);
      setUsernameStatus(available ? "available" : "taken");
      return available;
    } catch (err: any) {
      setUsernameStatus("invalid");
      Alert.alert("Erro", err?.message ?? "Não foi possível validar o username.");
      return false;
    }
  };

  const resolveUploadErrorMessage = (err: any) => {
    const message = String(err?.message ?? err ?? "");
    const lower = message.toLowerCase();
    if (lower.includes("internet") || lower.includes("network") || lower.includes("offline") || lower.includes("ligação")) {
      return "Sem ligação à internet. Tenta novamente quando estiveres online.";
    }
    if (lower.includes("payload") || lower.includes("413") || lower.includes("tamanho")) {
      return "A imagem é demasiado pesada. Escolhe outra.";
    }
    return message || "Não foi possível enviar a imagem.";
  };

  const handleSave = async () => {
    if (!accessToken) {
      Alert.alert("Sessão expirada", "Entra novamente para continuar.");
      router.replace("/auth");
      return;
    }
    if (!canSave) {
      Alert.alert("Faltam dados", "Confirma o nome completo e username.");
      return;
    }
    if (!usernameValidation.valid) {
      Alert.alert("Username inválido", usernameValidation.error || USERNAME_RULES_HINT);
      return;
    }
    if (normalizedUsername !== (profile?.username ?? "")) {
      const available = await handleUsernameCheck();
      if (!available) return;
    }

    try {
      setSaving(true);
      setAvatarError(null);
      setCoverError(null);
      setAvatarProgress(null);
      setCoverProgress(null);
      let avatarUrl: string | null | undefined = undefined;
      let coverUrl: string | null | undefined = undefined;

      if (avatarRemoved) avatarUrl = null;
      if (coverRemoved) coverUrl = null;

      if (avatarLocalUri) {
        setAvatarProgress(0);
        try {
          avatarUrl = await uploadImage({
            uri: avatarLocalUri,
            scope: "avatar",
            accessToken,
            onProgress: setAvatarProgress,
            maxRetries: 2,
          });
        } catch (err) {
          setAvatarError(resolveUploadErrorMessage(err));
          return;
        }
      }
      if (coverLocalUri) {
        setCoverProgress(0);
        try {
          coverUrl = await uploadImage({
            uri: coverLocalUri,
            scope: "profile-cover",
            accessToken,
            onProgress: setCoverProgress,
            maxRetries: 2,
          });
        } catch (err) {
          setCoverError(resolveUploadErrorMessage(err));
          return;
        }
      }

      const updated = await updateProfile({
        accessToken,
        fullName: fullName.trim(),
        username: normalizedUsername,
        bio: bio.trim() || null,
        avatarUrl,
        coverUrl,
        city: city.trim() || null,
        padelLevel,
        favouriteCategories: interests,
        visibility,
        allowEmailNotifications,
        allowEventReminders,
        allowFollowRequests,
      });

      queryClient.setQueryData(["profile", "summary", userId ?? "anon"], updated);
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
      safeBack(router);
    } catch (err: any) {
      Alert.alert("Erro", err?.message ?? "Não foi possível guardar o perfil.");
    } finally {
      setSaving(false);
      setAvatarProgress(null);
      setCoverProgress(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiquidBackground variant="solid">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 54, paddingBottom: 40 }}>
          <View className="flex-row items-center justify-between mb-6">
            <Pressable
              onPress={() => safeBack(router)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Text className="text-white text-sm font-semibold">Voltar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className="rounded-full bg-sky-200/90 px-5 py-2"
              style={{ minHeight: tokens.layout.touchTarget, opacity: canSave ? 1 : 0.6 }}
            >
              <Text className="text-slate-900 text-sm font-semibold">{saving ? "A guardar…" : "Guardar"}</Text>
            </Pressable>
          </View>

          <Text className="text-white text-[28px] font-semibold mb-2">Editar perfil</Text>
          <Text className="text-white/60 text-sm mb-6">
            Atualiza o teu perfil público, interesses e preferências.
          </Text>

          <GlassSurface intensity={58} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-3">Capa</Text>
            <View className="rounded-2xl overflow-hidden border border-white/10 mb-3" style={{ height: 140 }}>
              {coverPreview ? (
                <Image
                  source={{ uri: coverPreview }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={160}
                />
              ) : (
                <View className="flex-1 bg-white/5" />
              )}
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => pickImage("cover")}
                className="flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-2"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-white text-sm font-semibold text-center">Alterar capa</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCoverLocalUri(null);
                  setCoverRemoved(true);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-white/70 text-sm font-semibold text-center">Remover</Text>
              </Pressable>
            </View>
            {typeof coverProgress === "number" ? (
              <View className="mt-3">
                <View className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <View
                    className="h-full bg-white/60"
                    style={{ width: `${Math.round(coverProgress * 100)}%` }}
                  />
                </View>
                <Text className="text-white/50 text-xs mt-2">
                  A enviar… {Math.round(coverProgress * 100)}%
                </Text>
              </View>
            ) : null}
            {coverError ? (
              <View className="mt-3">
                <Text className="text-rose-200 text-xs">{coverError}</Text>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="mt-2 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2"
                >
                  <Text className="text-white text-xs font-semibold">Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
          </GlassSurface>

          <GlassSurface intensity={58} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-3">Avatar</Text>
            <View className="flex-row items-center gap-4">
              <View
                className="h-20 w-20 rounded-full border border-white/10 overflow-hidden items-center justify-center bg-white/5"
              >
                {avatarPreview ? (
                  <Image
                    source={{ uri: avatarPreview }}
                    style={{ width: 80, height: 80 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={160}
                  />
                ) : (
                  <Text className="text-white/70 text-lg font-semibold">{avatarInitial}</Text>
                )}
              </View>
              <View className="flex-1 gap-2">
                <Pressable
                  onPress={() => pickImage("avatar")}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Alterar avatar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAvatarLocalUri(null);
                    setAvatarRemoved(true);
                    setAvatarError(null);
                    setAvatarProgress(null);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white/70 text-sm font-semibold text-center">Remover</Text>
                </Pressable>
              </View>
            </View>
            {typeof avatarProgress === "number" ? (
              <View className="mt-3">
                <View className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <View
                    className="h-full bg-white/60"
                    style={{ width: `${Math.round(avatarProgress * 100)}%` }}
                  />
                </View>
                <Text className="text-white/50 text-xs mt-2">
                  A enviar… {Math.round(avatarProgress * 100)}%
                </Text>
              </View>
            ) : null}
            {avatarError ? (
              <View className="mt-3">
                <Text className="text-rose-200 text-xs">{avatarError}</Text>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="mt-2 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2"
                >
                  <Text className="text-white text-xs font-semibold">Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
          </GlassSurface>

          <GlassSurface intensity={56} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-2">Nome completo</Text>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nome completo"
              placeholderTextColor={tokens.colors.textMuted}
              style={{ minHeight: tokens.layout.touchTarget }}
            />
            <View className="flex-row items-center justify-between">
              <Text className="text-white/60 text-xs uppercase tracking-[0.2em]">Username</Text>
              <Pressable onPress={handleUsernameCheck}>
                <Text className="text-sky-200 text-xs font-semibold">Verificar</Text>
              </Pressable>
            </View>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mt-2"
              value={username}
              onChangeText={(value) => {
                setUsername(sanitizeUsername(value));
                setUsernameStatus("idle");
              }}
              autoCapitalize="none"
              placeholder="username"
              placeholderTextColor={tokens.colors.textMuted}
              style={{ minHeight: tokens.layout.touchTarget }}
            />
            {usernameStatus !== "idle" ? (
              <Text className="text-xs text-white/60 mt-2">
                {usernameStatus === "checking"
                  ? "A verificar…"
                  : usernameStatus === "available"
                    ? "Disponível"
                    : usernameStatus === "invalid"
                      ? USERNAME_RULES_HINT
                      : "Indisponível"}
              </Text>
            ) : null}
          </GlassSurface>

          <GlassSurface intensity={54} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-2">Bio</Text>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white"
              value={bio}
              onChangeText={setBio}
              placeholder="Conta algo sobre ti"
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              style={{ minHeight: 110, textAlignVertical: "top" }}
            />
          </GlassSurface>

          <GlassSurface intensity={52} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-2">Cidade</Text>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white"
              value={city}
              onChangeText={setCity}
              placeholder="Ex: Lisboa"
              placeholderTextColor={tokens.colors.textMuted}
              style={{ minHeight: tokens.layout.touchTarget }}
            />
          </GlassSurface>

          <GlassSurface intensity={52} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-3">Padel</Text>
            <View className="flex-row flex-wrap gap-2">
              {PADEL_LEVELS.map((level) => {
                const active = padelLevel === level;
                return (
                  <Pressable key={level} onPress={() => setPadelLevel(active ? null : level)}>
                    <GlassPill label={level} variant={active ? "accent" : "muted"} />
                  </Pressable>
                );
              })}
            </View>
          </GlassSurface>

          <GlassSurface intensity={52} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-3">Interesses</Text>
            <View className="flex-row flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const active = interests.includes(interest.id);
                return (
                  <Pressable key={interest.id} onPress={() => toggleInterest(interest.id)}>
                    <GlassPill
                      label={interest.label}
                      variant={active ? "accent" : "muted"}
                      className={active ? "border-sky-200/50" : undefined}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs text-white/50 mt-3">{interests.length}/6 selecionados</Text>
          </GlassSurface>

          <GlassSurface intensity={50} padding={16} style={{ marginBottom: 16 }}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-3">Privacidade</Text>
            <View className="flex-row gap-2">
              {(["PUBLIC", "FOLLOWERS", "PRIVATE"] as const).map((option) => {
                const active = visibility === option;
                return (
                  <Pressable key={option} onPress={() => setVisibility(option)} style={{ flex: 1 }}>
                    <GlassPill
                      label={option === "PUBLIC" ? "Público" : option === "FOLLOWERS" ? "Seguidores" : "Privado"}
                      variant={active ? "accent" : "muted"}
                    />
                  </Pressable>
                );
              })}
            </View>
          </GlassSurface>

          <GlassSurface intensity={48} padding={16}>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-3">Notificações</Text>
            <View className="gap-3">
              {[
                {
                  id: "email",
                  label: "Email essencial",
                  value: allowEmailNotifications,
                  onToggle: () => setAllowEmailNotifications((prev) => !prev),
                },
                {
                  id: "reminders",
                  label: "Lembretes de eventos",
                  value: allowEventReminders,
                  onToggle: () => setAllowEventReminders((prev) => !prev),
                },
                {
                  id: "follows",
                  label: "Pedidos de follow",
                  value: allowFollowRequests,
                  onToggle: () => setAllowFollowRequests((prev) => !prev),
                },
              ].map((item) => (
                <Pressable
                  key={item.id}
                  onPress={item.onToggle}
                  className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <Text className="text-white text-sm">{item.label}</Text>
                  <Text className="text-white/70 text-sm">{item.value ? "On" : "Off"}</Text>
                </Pressable>
              ))}
            </View>
          </GlassSurface>

          <GlassCard intensity={42} className="mt-6">
            <Text className="text-white/60 text-xs">
              As alterações podem demorar alguns segundos a aparecer no feed.
            </Text>
          </GlassCard>
        </ScrollView>
      </LiquidBackground>
    </>
  );
}
