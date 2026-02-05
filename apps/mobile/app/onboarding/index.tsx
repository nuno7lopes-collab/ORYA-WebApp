import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@orya/shared";
import { AuthBackground } from "../../components/liquid/AuthBackground";
import { GlassCard } from "../../components/auth/GlassCard";
import { PrimaryButton } from "../../components/onboarding/PrimaryButton";
import { SecondaryButton } from "../../components/onboarding/SecondaryButton";
import { StepProgress } from "../../components/onboarding/StepProgress";
import { Ionicons } from "../../components/icons/Ionicons";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { resetOnboardingDone, setOnboardingDone } from "../../lib/onboardingState";
import {
  clearOnboardingDraft,
  getOnboardingDraft,
  setOnboardingDraft,
  type OnboardingDraft,
} from "../../lib/onboardingDraft";
import { getActiveSession } from "../../lib/session";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "../../lib/username";
import {
  INTEREST_OPTIONS,
  InterestId,
  OnboardingStep,
  PADEL_GENDERS,
  PADEL_LEVELS,
  PADEL_SIDES,
  PadelGender,
  PadelLevel,
  PadelPreferredSide,
} from "../../features/onboarding/types";
import {
  checkUsernameAvailability,
  fetchIpLocation,
  saveBasicProfile,
  saveLocationConsent,
  saveLocationCoarse,
  savePadelOnboarding,
} from "../../features/onboarding/api";
import type { ProfileSummary } from "../../features/profile/types";

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

const MAX_INTERESTS = 6;

const resolveStartStep = (draft: OnboardingDraft | null): OnboardingStep => {
  if (!draft) return "basic";
  const interests = draft.interests ?? [];
  const hasPadel = interests.includes("padel");
  switch (draft.step) {
    case 1:
      return "interests";
    case 2:
      return hasPadel ? "padel" : "location";
    case 3:
    case 4:
      return "location";
    default:
      return "basic";
  }
};

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>("basic");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "invalid" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [confirmedUsername, setConfirmedUsername] = useState<string | null>(null);
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [padelGender, setPadelGender] = useState<PadelGender | null>(null);
  const [padelSide, setPadelSide] = useState<PadelPreferredSide | null>(null);
  const [padelLevel, setPadelLevel] = useState<PadelLevel | null>(null);
  const [locationHint, setLocationHint] = useState<{ city?: string | null; region?: string | null } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [savingStep, setSavingStep] = useState<OnboardingStep | null>(null);

  const draftRef = useRef<OnboardingDraft | null>(null);
  const usernameCacheRef = useRef<Map<string, boolean>>(new Map());
  const usernameAbortRef = useRef<AbortController | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameInflightRef = useRef<{ normalized: string; promise: Promise<boolean> } | null>(null);

  const USERNAME_DEBOUNCE_MS = 300;
  const USERNAME_TIMEOUT_MS = 6500;

  const padelSelected = interests.includes("padel");
  const steps = useMemo<OnboardingStep[]>(
    () => (padelSelected ? ["basic", "interests", "padel", "location"] : ["basic", "interests", "location"]),
    [padelSelected],
  );
  const stepIndex = Math.max(0, steps.indexOf(step));

  const usernameValidation = useMemo(() => validateUsername(username), [username]);
  const normalizedUsername = usernameValidation.valid
    ? usernameValidation.normalized
    : sanitizeUsername(username);

  const saveBasicMutation = useMutation({ mutationFn: saveBasicProfile, retry: 1 });
  const savePadelMutation = useMutation({ mutationFn: savePadelOnboarding, retry: 1 });
  const saveConsentMutation = useMutation({ mutationFn: saveLocationConsent, retry: 1 });
  const saveCoarseMutation = useMutation({ mutationFn: saveLocationCoarse, retry: 1 });

  useEffect(() => {
    if (padelSelected) return;
    if (step === "padel") setStep("location");
    setPadelGender(null);
    setPadelSide(null);
    setPadelLevel(null);
  }, [padelSelected, step]);

  useEffect(() => {
    let mounted = true;
    if (!session?.user?.id) {
      setLoadingDraft(false);
      return () => {
        mounted = false;
      };
    }
    getOnboardingDraft(session.user.id)
      .then((draft) => {
        if (!mounted) return;
        draftRef.current = draft;
        if (draft) {
          setFullName(draft.fullName ?? "");
          setUsername(draft.username ?? "");
          setInterests((draft.interests ?? []) as InterestId[]);
          setPadelGender((draft.padel?.gender as PadelGender | null) ?? null);
          setPadelSide((draft.padel?.preferredSide as PadelPreferredSide | null) ?? null);
          setPadelLevel((draft.padel?.level as PadelLevel | null) ?? null);
          setLocationHint(draft.location ? { city: draft.location.city, region: draft.location.region } : null);
          setStep(resolveStartStep(draft));
          if (draft.step >= 1 && draft.username) {
            setConfirmedUsername(draft.username);
            usernameCacheRef.current.set(draft.username, true);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoadingDraft(false);
      });
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      return;
    }
    if (!usernameValidation.valid) {
      setUsernameStatus("invalid");
      return;
    }

    const normalized = usernameValidation.normalized;
    if (confirmedUsername && normalized === confirmedUsername) {
      if (usernameStatus !== "available") setUsernameStatus("available");
      usernameCacheRef.current.set(normalized, true);
      return;
    }

    if (usernameCacheRef.current.has(normalized)) {
      setUsernameStatus(usernameCacheRef.current.get(normalized) ? "available" : "taken");
      return;
    }

    setUsernameStatus("checking");
    if (usernameAbortRef.current) usernameAbortRef.current.abort();
    const controller = new AbortController();
    usernameAbortRef.current = controller;
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, USERNAME_TIMEOUT_MS);

    usernameTimerRef.current = setTimeout(async () => {
      const runCheck = async () => {
        const accessToken = session?.access_token ?? (await getActiveSession())?.access_token ?? null;
        const available = await checkUsernameAvailability(normalized, accessToken, controller.signal);
        return available;
      };
      const promise = runCheck();
      usernameInflightRef.current = { normalized, promise };
      try {
        const available = await promise;
        if (controller.signal.aborted) return;
        clearTimeout(timeoutId);
        usernameCacheRef.current.set(normalized, available);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        if (controller.signal.aborted) {
          if (didTimeout) setUsernameStatus("error");
          return;
        }
        setUsernameStatus("error");
      } finally {
        if (usernameInflightRef.current?.normalized === normalized) {
          usernameInflightRef.current = null;
        }
      }
    }, USERNAME_DEBOUNCE_MS);

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [username, usernameValidation, session?.access_token]);

  useEffect(() => {
    if (step !== "location" || locationHint) return;
    resolveIpLocation().catch(() => undefined);
  }, [step, locationHint]);

  const canContinueBasic =
    fullName.trim().length >= 2 && usernameValidation.valid && usernameStatus === "available";
  const canContinueInterests = interests.length > 0;
  const canContinuePadel = Boolean(padelGender && padelSide);

  const persistDraft = async (patch: Partial<OnboardingDraft>) => {
    const userId = session?.user?.id;
    if (!userId) return;
    const base: OnboardingDraft = draftRef.current ?? { userId, step: 0 };
    const next: OnboardingDraft = {
      ...base,
      ...patch,
      userId,
      step: patch.step ?? base.step,
      updatedAt: new Date().toISOString(),
    };
    draftRef.current = next;
    await setOnboardingDraft(next);
  };

  const resolveAccessToken = async () =>
    session?.access_token ?? (await getActiveSession())?.access_token ?? null;

  const handleAuthError = async () => {
    await resetOnboardingDone();
    await clearOnboardingDraft();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  const handleExitOnboarding = async () => {
    await resetOnboardingDone();
    await clearOnboardingDraft();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  const ensureUsernameAvailable = async () => {
    if (!usernameValidation.valid) {
      setUsernameStatus("invalid");
      Alert.alert("Username inválido", usernameValidation.error || USERNAME_RULES_HINT);
      return false;
    }
    if (confirmedUsername && usernameValidation.normalized === confirmedUsername) {
      setUsernameStatus("available");
      usernameCacheRef.current.set(usernameValidation.normalized, true);
      return true;
    }
    if (usernameStatus === "available") return true;
    if (usernameInflightRef.current?.normalized === usernameValidation.normalized) {
      try {
        const available = await usernameInflightRef.current.promise;
        setUsernameStatus(available ? "available" : "taken");
        if (!available) {
          Alert.alert("Username indisponível", "Este username já está a ser utilizado.");
        }
        return available;
      } catch {
        setUsernameStatus("error");
        Alert.alert("Erro", "Não foi possível verificar agora.");
        return false;
      }
    }
    setUsernameStatus("checking");
    try {
      const accessToken = await resolveAccessToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), USERNAME_TIMEOUT_MS);
      const available = await checkUsernameAvailability(usernameValidation.normalized, accessToken, controller.signal);
      clearTimeout(timeoutId);
      usernameCacheRef.current.set(usernameValidation.normalized, available);
      setUsernameStatus(available ? "available" : "taken");
      if (!available) {
        Alert.alert("Username indisponível", "Este username já está a ser utilizado.");
      }
      return available;
    } catch (err: any) {
      if (String(err?.name ?? "").toLowerCase().includes("abort")) {
        setUsernameStatus("error");
        Alert.alert("Erro", "Verificação demorou demasiado. Tenta novamente.");
        return false;
      }
      setUsernameStatus("error");
      Alert.alert("Erro", "Não foi possível verificar agora.");
      return false;
    }
  };

  const updateProfileCache = (payload: {
    fullName: string;
    username: string;
    interests: InterestId[];
    city?: string | null;
    padelLevel?: string | null;
  }) => {
    const summaryKey = ["profile", "summary", session?.user?.id ?? "anon"];
    queryClient.setQueryData<ProfileSummary | undefined>(summaryKey, (prev) => ({
      id: prev?.id ?? session?.user?.id ?? "",
      email: prev?.email ?? session?.user?.email ?? null,
      fullName: payload.fullName,
      username: payload.username,
      avatarUrl: prev?.avatarUrl ?? null,
      bio: prev?.bio ?? null,
      city: payload.city ?? prev?.city ?? null,
      padelLevel: payload.padelLevel ?? prev?.padelLevel ?? null,
      favouriteCategories: payload.interests,
      onboardingDone: true,
    }));
    queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
  };

  const finalizeOnboarding = async (location?: { city?: string | null; region?: string | null }) => {
    try {
      const accessToken = await resolveAccessToken();
      await saveBasicMutation.mutateAsync({
        fullName: fullName.trim(),
        username: normalizedUsername,
        favouriteCategories: interests,
        accessToken,
      });
      updateProfileCache({
        fullName: fullName.trim(),
        username: normalizedUsername,
        interests,
        city: location?.city ?? null,
        padelLevel: padelLevel ?? null,
      });
      await setOnboardingDone(true);
      await clearOnboardingDraft();
      router.replace("/(tabs)");
    } catch (err: any) {
      const message = err?.message ?? "Não foi possível concluir o onboarding.";
      if (typeof message === "string" && (message.includes("API 401") || message.includes("UNAUTHENTICATED"))) {
        await handleAuthError();
        return;
      }
      Alert.alert("Erro", message);
    }
  };

  const handleBasicContinue = async () => {
    if (!canContinueBasic) return;
    if (!(await ensureUsernameAvailable())) return;
    setSavingStep("basic");
    try {
      await persistDraft({
        step: 0,
        fullName: fullName.trim(),
        username: normalizedUsername,
        interests,
      });
      const accessToken = await resolveAccessToken();
      await saveBasicMutation.mutateAsync({
        fullName: fullName.trim(),
        username: normalizedUsername,
        favouriteCategories: interests,
        accessToken,
      });
      setConfirmedUsername(normalizedUsername);
      usernameCacheRef.current.set(normalizedUsername, true);
      await persistDraft({
        step: 1,
        fullName: fullName.trim(),
        username: normalizedUsername,
        interests,
      });
      setStep("interests");
    } catch (err: any) {
      const message = err?.message ?? "Não foi possível guardar o perfil.";
      if (
        typeof message === "string" &&
        (message.includes("USERNAME_TAKEN") || message.includes("username") || message.includes("já está"))
      ) {
        setUsernameStatus("taken");
        Alert.alert("Username indisponível", "Este username já está a ser utilizado.");
        return;
      }
      if (typeof message === "string" && (message.includes("API 401") || message.includes("UNAUTHENTICATED"))) {
        await handleAuthError();
        return;
      }
      Alert.alert("Erro", message);
    } finally {
      setSavingStep(null);
    }
  };

  const handleInterestsContinue = async () => {
    if (!canContinueInterests) return;
    setSavingStep("interests");
    try {
      const accessToken = await resolveAccessToken();
      await saveBasicMutation.mutateAsync({
        fullName: fullName.trim(),
        username: normalizedUsername,
        favouriteCategories: interests,
        accessToken,
      });
      await persistDraft({ step: 2, interests });
      setStep(padelSelected ? "padel" : "location");
    } catch (err: any) {
      const message = err?.message ?? "Não foi possível guardar os interesses.";
      if (typeof message === "string" && (message.includes("API 401") || message.includes("UNAUTHENTICATED"))) {
        await handleAuthError();
        return;
      }
      Alert.alert("Erro", message);
    } finally {
      setSavingStep(null);
    }
  };

  const handlePadelContinue = async () => {
    if (!canContinuePadel) {
      Alert.alert("Faltam dados", "Seleciona o género e o lado preferido.");
      return;
    }
    setSavingStep("padel");
    try {
      const accessToken = await resolveAccessToken();
      await savePadelMutation.mutateAsync({
        gender: padelGender,
        preferredSide: padelSide,
        level: padelLevel,
        accessToken,
      });
      await persistDraft({
        step: 3,
        padel: {
          gender: padelGender,
          preferredSide: padelSide,
          level: padelLevel,
          skipped: false,
        },
      });
      setStep("location");
    } catch (err: any) {
      const message = err?.message ?? "Não foi possível guardar o perfil de padel.";
      if (typeof message === "string" && (message.includes("API 401") || message.includes("UNAUTHENTICATED"))) {
        await handleAuthError();
        return;
      }
      Alert.alert("Erro", message);
    } finally {
      setSavingStep(null);
    }
  };

  const handlePadelSkip = async () => {
    setPadelGender(null);
    setPadelSide(null);
    setPadelLevel(null);
    await persistDraft({
      step: 3,
      padel: {
        gender: null,
        preferredSide: null,
        level: null,
        skipped: true,
      },
    });
    setStep("location");
  };

  async function resolveIpLocation() {
    const accessToken = await resolveAccessToken();
    try {
      const ipLocation = await fetchIpLocation(accessToken);
      const next = { city: ipLocation?.city ?? null, region: ipLocation?.region ?? null };
      setLocationHint(next);
      return next;
    } catch {
      return { city: null, region: null };
    }
  }

  const handleLocationFlow = async (intent: "allow" | "skip") => {
    setLocationError(null);
    setSavingStep("location");
    try {
      const accessToken = await resolveAccessToken();
      if (!accessToken) throw new Error("Sessão expirada.");

      if (intent === "allow") {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          const ip = await resolveIpLocation();
          await saveConsentMutation.mutateAsync({ consent: "DENIED", accessToken });
          await saveCoarseMutation.mutateAsync({ city: ip.city, region: ip.region, source: "IP", accessToken });
          await persistDraft({
            step: 4,
            location: { city: ip.city ?? null, region: ip.region ?? null, source: "IP", consent: "DENIED" },
          });
          await finalizeOnboarding(ip);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        let city: string | null = null;
        let region: string | null = null;
        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          city = (address?.city ?? address?.subregion ?? null) as string | null;
          region = (address?.region ?? null) as string | null;
        } catch {
          // ignore reverse geocode errors
        }

        await saveConsentMutation.mutateAsync({
          consent: "GRANTED",
          preferredGranularity: "COARSE",
          accessToken,
        });
        await saveCoarseMutation.mutateAsync({ city, region, source: "GPS", accessToken });
        await persistDraft({
          step: 4,
          location: { city, region, source: "GPS", consent: "GRANTED" },
        });
        await finalizeOnboarding({ city, region });
        return;
      }

      const ip = await resolveIpLocation();
      await saveConsentMutation.mutateAsync({ consent: "DENIED", accessToken });
      await saveCoarseMutation.mutateAsync({ city: ip.city, region: ip.region, source: "IP", accessToken });
      await persistDraft({
        step: 4,
        location: { city: ip.city ?? null, region: ip.region ?? null, source: "IP", consent: "DENIED" },
      });
      await finalizeOnboarding(ip);
    } catch (err: any) {
      const message = err?.message ?? "Não foi possível guardar a localização.";
      if (typeof message === "string" && (message.includes("API 401") || message.includes("UNAUTHENTICATED"))) {
        await handleAuthError();
        return;
      }
      setLocationError(message);
    } finally {
      setSavingStep(null);
    }
  };

  const toggleInterest = (interest: InterestId) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((item) => item !== interest);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, interest];
    });
  };

  const handleBack = () => {
    const prev = steps[stepIndex - 1];
    if (prev) {
      setStep(prev);
      return;
    }
    handleExitOnboarding();
  };

  const renderUsernameStatus = () => {
    if (!username) return null;
    let message = "";
    if (usernameStatus === "checking") message = "A verificar…";
    else if (usernameStatus === "available") message = "Disponível ✓";
    else if (usernameStatus === "taken") message = "Indisponível";
    else if (usernameStatus === "invalid") message = usernameValidation.error || USERNAME_RULES_HINT;
    else if (usernameStatus === "error") message = "Não foi possível verificar agora.";
    const tone =
      usernameStatus === "available"
        ? styles.helperSuccess
        : usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "error"
          ? styles.helperError
          : styles.helperText;
    return message ? <Text style={[styles.helperText, tone]}>{message}</Text> : null;
  };

  const renderBasicStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={styles.cardTitle}>Quem és?</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Nome completo</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ex: Sofia Almeida"
          placeholderTextColor={tokens.colors.textMuted}
          autoCapitalize="words"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput
          value={username}
          onChangeText={(value) => {
            const next = sanitizeUsername(value);
            setUsername(next);
            setUsernameStatus("idle");
            if (confirmedUsername && next !== confirmedUsername) {
              setConfirmedUsername(null);
            }
          }}
          placeholder="ex: orya.sofia"
          placeholderTextColor={tokens.colors.textMuted}
          autoCapitalize="none"
          style={styles.input}
        />
        {renderUsernameStatus()}
      </View>
    </GlassCard>
  );

  const renderInterestsStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={styles.cardTitle}>Interesses</Text>
      <Text style={styles.cardSubtitle}>Escolhe pelo menos 1.</Text>

      <View style={styles.interestGrid}>
        {INTEREST_OPTIONS.map((interest, idx) => {
          const active = interests.includes(interest.id);
          const isPadel = interest.id === "padel";
          return (
            <Pressable
              key={interest.id}
              onPress={() => toggleInterest(interest.id)}
              style={({ pressed }) => [
                styles.interestChip,
                active ? styles.interestChipActive : styles.interestChipIdle,
                isPadel ? styles.interestChipPadel : null,
                pressed ? styles.interestChipPressed : null,
                idx === 0 ? styles.interestChipFirst : null,
              ]}
            >
              <View style={[styles.interestIcon, active ? styles.interestIconActive : null]}>
                <Ionicons
                  name={INTEREST_ICONS[interest.id]}
                  size={16}
                  color={active ? "#ffffff" : "rgba(255,255,255,0.75)"}
                />
              </View>
              <Text style={[styles.interestLabel, active ? styles.interestLabelActive : null]}>
                {interest.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helperText}>
        {interests.length} selecionado{interests.length === 1 ? "" : "s"} · máximo {MAX_INTERESTS}
      </Text>
    </GlassCard>
  );

  const renderPadelStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={styles.cardTitle}>Padel</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Género</Text>
        <View style={styles.optionRow}>
          {PADEL_GENDERS.map((gender) => {
            const active = padelGender === gender.id;
            return (
              <Pressable
                key={gender.id}
                onPress={() => setPadelGender(gender.id)}
                style={({ pressed }) => [
                  styles.optionChip,
                  active ? styles.optionChipActive : styles.optionChipIdle,
                  pressed ? styles.optionChipPressed : null,
                ]}
              >
                <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                  {gender.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Lado preferido</Text>
        <View style={styles.optionRow}>
          {PADEL_SIDES.map((side) => {
            const active = padelSide === side.id;
            return (
              <Pressable
                key={side.id}
                onPress={() => setPadelSide(side.id)}
                style={({ pressed }) => [
                  styles.optionChip,
                  active ? styles.optionChipActive : styles.optionChipIdle,
                  pressed ? styles.optionChipPressed : null,
                ]}
              >
                <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                  {side.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Nível (opcional)</Text>
        <View style={styles.levelGrid}>
          {PADEL_LEVELS.map((level) => {
            const active = padelLevel === level;
            return (
              <Pressable
                key={level}
                onPress={() => setPadelLevel(active ? null : level)}
                style={({ pressed }) => [
                  styles.optionChip,
                  styles.levelChip,
                  active ? styles.optionChipActive : styles.optionChipIdle,
                  pressed ? styles.optionChipPressed : null,
                ]}
              >
                <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>{level}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </GlassCard>
  );

  const renderLocationStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={styles.cardTitle}>Localização</Text>

      {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

      <View style={styles.locationActions}>
        <PrimaryButton
          label={savingStep === "location" ? "A guardar..." : "Permitir"}
          onPress={() => handleLocationFlow("allow")}
          disabled={savingStep === "location"}
          loading={savingStep === "location"}
          accessibilityLabel="Permitir localização"
        />
        <SecondaryButton
          label="Agora não"
          onPress={() => handleLocationFlow("skip")}
          disabled={savingStep === "location"}
          accessibilityLabel="Agora não"
        />
      </View>
    </GlassCard>
  );

  if (authLoading || loadingDraft) {
    return (
      <AuthBackground>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" />
        </View>
      </AuthBackground>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backButton} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.backLabel}>Voltar</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Bem-vindo à ORYA</Text>
        </View>

        <StepProgress total={steps.length} current={stepIndex} />

        {step === "basic"
          ? renderBasicStep()
          : step === "interests"
            ? renderInterestsStep()
            : step === "padel"
              ? renderPadelStep()
              : renderLocationStep()}

        <View style={styles.actions}>
          {step === "basic" ? (
            <PrimaryButton
              label={savingStep === "basic" ? "A guardar..." : "Continuar"}
              onPress={handleBasicContinue}
              disabled={!canContinueBasic || savingStep === "basic"}
              loading={savingStep === "basic"}
            />
          ) : null}
          {step === "interests" ? (
            <PrimaryButton
              label={savingStep === "interests" ? "A guardar..." : "Continuar"}
              onPress={handleInterestsContinue}
              disabled={!canContinueInterests || savingStep === "interests"}
              loading={savingStep === "interests"}
            />
          ) : null}
          {step === "padel" ? (
            <View style={styles.padelActions}>
              <PrimaryButton
                label={savingStep === "padel" ? "A guardar..." : "Continuar"}
                onPress={handlePadelContinue}
                disabled={!canContinuePadel || savingStep === "padel"}
                loading={savingStep === "padel"}
              />
              <SecondaryButton label="Saltar" onPress={handlePadelSkip} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
    gap: 18,
    alignItems: "center",
  },
  topBar: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: tokens.layout.touchTarget,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    gap: 8,
    alignItems: "center",
    maxWidth: 440,
    width: "100%",
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 440,
  },
  cardContent: {
    gap: 16,
    padding: 22,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: 8,
    width: "100%",
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  input: {
    minHeight: tokens.layout.touchTarget,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    color: "#ffffff",
    fontSize: 15,
  },
  helperText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
  },
  helperSuccess: {
    color: "rgba(110, 231, 183, 0.95)",
  },
  helperError: {
    color: "rgba(252, 165, 165, 0.95)",
  },
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: tokens.layout.touchTarget,
    width: "48%",
  },
  interestChipIdle: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  interestChipActive: {
    borderColor: "rgba(140, 200, 255, 0.6)",
    backgroundColor: "rgba(92, 175, 255, 0.18)",
    shadowColor: "rgba(120, 190, 255, 0.4)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  interestChipPadel: {
    borderColor: "rgba(255,255,255,0.25)",
  },
  interestChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  interestChipFirst: {
    shadowColor: "rgba(255,255,255,0.2)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  interestIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  interestIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  interestLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  interestLabelActive: {
    color: "#ffffff",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: tokens.layout.touchTarget + 4,
    alignItems: "center",
    justifyContent: "center",
    width: "48%",
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  optionChipIdle: {
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  optionChipActive: {
    borderColor: "rgba(140, 200, 255, 0.75)",
    backgroundColor: "rgba(92, 175, 255, 0.24)",
    shadowColor: "rgba(120, 190, 255, 0.55)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  optionChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  optionLabel: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    fontSize: 13,
  },
  optionLabelActive: {
    color: "#ffffff",
  },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  levelChip: {
    width: "30%",
  },
  locationActions: {
    gap: 12,
  },
  errorText: {
    color: "rgba(255,180,180,0.9)",
    fontSize: 12,
  },
  actions: {
    gap: 12,
    width: "100%",
    maxWidth: 440,
  },
  padelActions: {
    gap: 10,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
