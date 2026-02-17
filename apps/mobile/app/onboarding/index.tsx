import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, useTranslation } from "@orya/shared";
import { AuthBackground } from "../../components/liquid/AuthBackground";
import { GlassCard } from "../../components/auth/GlassCard";
import { PrimaryButton } from "../../components/onboarding/PrimaryButton";
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
import { sanitizeUsername, validateUsername } from "../../lib/username";
import { getUserFacingError } from "../../lib/errors";
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
  type UsernameAvailabilityResult,
  saveBasicProfile,
  savePadelOnboarding,
} from "../../features/onboarding/api";
import type { ProfileSummary } from "../../features/profile/types";
import { setProfileCache } from "../../lib/profileCache";

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
const STEP_ICONS: Record<OnboardingStep, string> = {
  basic: "person-circle",
  interests: "sparkles",
  padel: "tennisball",
};

const resolveStartStep = (draft: OnboardingDraft | null): OnboardingStep => {
  if (!draft) return "basic";
  const interests = draft.interests ?? [];
  const hasPadel = interests.includes("padel");
  switch (draft.step) {
    case 1:
      return "interests";
    case 2:
      return hasPadel ? "padel" : "interests";
    case 3:
    case 4:
      return hasPadel ? "padel" : "interests";
    default:
      return "basic";
  }
};

const NETWORK_TIMEOUT_MS = 10_000;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label = "timeout") => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(label)), ms);
      promise
        .then((value) => resolve(value))
        .catch((err) => reject(err));
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const queryClient = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [step, setStep] = useState<OnboardingStep>("basic");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "invalid" | "checking" | "available" | "taken" | "reserved" | "error"
  >("idle");
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [padelGender, setPadelGender] = useState<PadelGender | null>(null);
  const [padelSide, setPadelSide] = useState<PadelPreferredSide | null>(null);
  const [padelLevel, setPadelLevel] = useState<PadelLevel | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [savingStep, setSavingStep] = useState<OnboardingStep | null>(null);

  const draftRef = useRef<OnboardingDraft | null>(null);
  const didInitDraftRef = useRef(false);
  const usernameCacheRef = useRef<Map<string, UsernameAvailabilityResult>>(new Map());
  const usernameAbortRef = useRef<AbortController | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameRequestIdRef = useRef(0);
  const usernameInflightRef = useRef<{
    normalized: string;
    promise: Promise<UsernameAvailabilityResult>;
    requestId: number;
  } | null>(null);
  const didApplyStartRef = useRef(false);
  const stepTransition = useRef(new Animated.Value(1)).current;

  const USERNAME_MIN_LEN = 3;

  const startAtPadel = useMemo(() => {
    const raw = params?.step;
    if (!raw) return false;
    if (Array.isArray(raw)) return raw[0] === "padel";
    return raw === "padel";
  }, [params?.step]);
  const USERNAME_DEBOUNCE_MS = 300;
  const USERNAME_TIMEOUT_MS = 6500;
  const genderLabels = useMemo(
    () => ({
      MALE: t("onboarding:padel.genders.male"),
      FEMALE: t("onboarding:padel.genders.female"),
    }),
    [t],
  );
  const sideLabels = useMemo(
    () => ({
      ESQUERDA: t("onboarding:padel.sides.left"),
      DIREITA: t("onboarding:padel.sides.right"),
      QUALQUER: t("onboarding:padel.sides.any"),
    }),
    [t],
  );

  const cancelUsernameCheck = (invalidate = true) => {
    if (invalidate) usernameRequestIdRef.current += 1;
    if (usernameTimerRef.current) {
      clearTimeout(usernameTimerRef.current);
      usernameTimerRef.current = null;
    }
    if (usernameAbortRef.current) {
      usernameAbortRef.current.abort();
      usernameAbortRef.current = null;
    }
    usernameInflightRef.current = null;
  };

  const runUsernameCheck = async (
    normalized: string,
    accessToken: string | null,
    controller: AbortController,
  ): Promise<UsernameAvailabilityResult> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await new Promise<UsernameAvailabilityResult>((resolve, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("username_timeout"));
        }, USERNAME_TIMEOUT_MS);
        checkUsernameAvailability(normalized, accessToken, controller.signal)
          .then(resolve)
          .catch(reject);
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const padelSelected = interests.includes("padel");
  const steps = useMemo<OnboardingStep[]>(
    () => (padelSelected ? ["basic", "interests", "padel"] : ["basic", "interests"]),
    [padelSelected],
  );
  const stepIndex = Math.max(0, steps.indexOf(step));
  const stepHint = t(`onboarding:stepHints.${step}`);
  const compactLayout = screenWidth < 370;
  const wideLayout = screenWidth >= 430;

  const allowReservedForEmail = session?.user?.email ?? null;
  const usernameValidation = useMemo(
    () => validateUsername(username, { allowReservedForEmail }),
    [username, allowReservedForEmail],
  );
  const normalizedUsername = usernameValidation.valid
    ? usernameValidation.normalized
    : sanitizeUsername(username);

  const saveBasicMutation = useMutation({ mutationFn: saveBasicProfile, retry: 1 });
  const savePadelMutation = useMutation({ mutationFn: savePadelOnboarding, retry: 1 });

  useEffect(() => {
    if (padelSelected) return;
    if (step === "padel") setStep("interests");
    setPadelGender(null);
    setPadelSide(null);
    setPadelLevel(null);
  }, [padelSelected, step]);

  useEffect(() => {
    if (step !== "basic") {
      cancelUsernameCheck();
    }
  }, [step]);

  useEffect(() => {
    stepTransition.setValue(0);
    Animated.timing(stepTransition, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [step, stepTransition]);

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
          setStep(resolveStartStep(draft));
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
    if (!startAtPadel || loadingDraft || didApplyStartRef.current) return;
    didApplyStartRef.current = true;
    setInterests((prev) => {
      if (prev.includes("padel")) {
        setStep("padel");
        return prev;
      }
      if (prev.length >= MAX_INTERESTS) {
        setStep("interests");
        return prev;
      }
      setStep("padel");
      return [...prev, "padel"];
    });
  }, [loadingDraft, startAtPadel]);

  useEffect(() => {
    if (loadingDraft || didInitDraftRef.current) return;
    if (!session?.user?.id) return;
    didInitDraftRef.current = true;
    if (!draftRef.current) {
      persistDraft({ step: 0 }).catch(() => undefined);
    }
  }, [loadingDraft, session?.user?.id]);

  useEffect(() => {
    cancelUsernameCheck();
    if (!username) {
      setUsernameStatus("idle");
      return;
    }
    if (normalizedUsername.length < USERNAME_MIN_LEN) {
      setUsernameStatus("idle");
      return;
    }
    if (!usernameValidation.valid) {
      setUsernameStatus("invalid");
      return;
    }

    const normalized = usernameValidation.normalized;
    if (usernameCacheRef.current.has(normalized)) {
      const cached = usernameCacheRef.current.get(normalized);
      const nextStatus = cached?.available
        ? "available"
        : cached?.reason === "reserved"
          ? "reserved"
          : "taken";
      setUsernameStatus(nextStatus);
      return;
    }

    setUsernameStatus("idle");
    const requestId = usernameRequestIdRef.current;
    const controller = new AbortController();
    usernameAbortRef.current = controller;

    usernameTimerRef.current = setTimeout(async () => {
      setUsernameStatus("checking");
      const accessToken = session?.access_token ?? (await getActiveSession())?.access_token ?? null;
      const promise = runUsernameCheck(normalized, accessToken, controller);
      usernameInflightRef.current = { normalized, promise, requestId };
      try {
        const result = await promise;
        if (requestId !== usernameRequestIdRef.current || controller.signal.aborted) return;
        usernameCacheRef.current.set(normalized, result);
        const nextStatus = result.available
          ? "available"
          : result.reason === "reserved"
            ? "reserved"
            : "taken";
        setUsernameStatus(nextStatus);
      } catch {
        if (requestId !== usernameRequestIdRef.current) return;
        setUsernameStatus("error");
      } finally {
        if (usernameInflightRef.current?.normalized === normalized) {
          usernameInflightRef.current = null;
        }
      }
    }, USERNAME_DEBOUNCE_MS);

    return () => {
      cancelUsernameCheck();
    };
  }, [username, usernameValidation, session?.access_token]);

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
    router.replace({ pathname: "/auth", params: { next: "/onboarding" } });
  };

  const handleExitOnboarding = async () => {
    await resetOnboardingDone();
    await clearOnboardingDraft();
    await supabase.auth.signOut();
    router.replace({ pathname: "/auth", params: { next: "/onboarding" } });
  };

  const ensureUsernameAvailable = async () => {
    if (!usernameValidation.valid) {
      setUsernameStatus("invalid");
      Alert.alert(t("onboarding:errors.usernameInvalidTitle"), t("onboarding:basic.usernameHint"));
      return false;
    }
    if (usernameStatus === "available") return true;
    cancelUsernameCheck();
    const requestId = usernameRequestIdRef.current;
    setUsernameStatus("checking");
    try {
      const accessToken = await resolveAccessToken();
      const controller = new AbortController();
      usernameAbortRef.current = controller;
      const promise = runUsernameCheck(usernameValidation.normalized, accessToken, controller);
      usernameInflightRef.current = { normalized: usernameValidation.normalized, promise, requestId };
      const result = await promise;
      if (requestId !== usernameRequestIdRef.current || controller.signal.aborted) {
        return false;
      }
      usernameCacheRef.current.set(usernameValidation.normalized, result);
      const nextStatus = result.available
        ? "available"
        : result.reason === "reserved"
          ? "reserved"
          : "taken";
      setUsernameStatus(nextStatus);
      if (!result.available) {
        const message =
          result.reason === "reserved"
            ? t("onboarding:errors.usernameReserved")
            : t("onboarding:errors.usernameTaken");
        Alert.alert(t("onboarding:errors.usernameUnavailableTitle"), message);
      }
      return result.available;
    } catch (err: any) {
      if (requestId !== usernameRequestIdRef.current) return false;
      setUsernameStatus("error");
      const message =
        String(err?.message ?? "").includes("timeout") || String(err?.message ?? "").includes("abort")
          ? t("onboarding:errors.usernameCheckTimeout")
          : t("onboarding:errors.usernameCheckFailed");
      Alert.alert(t("common:labels.error"), message);
      return false;
    } finally {
      if (usernameInflightRef.current?.requestId === requestId) {
        usernameInflightRef.current = null;
      }
    }
  };

  const updateProfileCache = (payload: {
    fullName: string;
    username: string;
    interests: InterestId[];
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
      padelLevel: payload.padelLevel ?? prev?.padelLevel ?? null,
      favouriteCategories: payload.interests,
      onboardingDone: true,
    }));
    queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
    if (session?.user?.id) {
      setProfileCache({
        userId: session.user.id,
        fullName: payload.fullName,
        username: payload.username,
        onboardingDone: true,
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
  };

  const finalizeOnboarding = async () => {
    try {
      const usernameOk = await ensureUsernameAvailable();
      if (!usernameOk) {
        Alert.alert(
          t("onboarding:errors.usernameUnavailableTitle"),
          t("onboarding:errors.usernameUnavailableBody"),
        );
        return;
      }
      const accessToken = await resolveAccessToken();
      await withTimeout(
        saveBasicMutation.mutateAsync({
          fullName: fullName.trim(),
          username: normalizedUsername,
          favouriteCategories: interests,
          accessToken,
        }),
        NETWORK_TIMEOUT_MS,
        "save_basic_timeout",
      );
      if (padelSelected && padelGender && padelSide) {
        await withTimeout(
          savePadelMutation.mutateAsync({
            gender: padelGender,
            preferredSide: padelSide,
            level: padelLevel,
            accessToken,
          }),
          NETWORK_TIMEOUT_MS,
          "save_padel_timeout",
        );
      }
      updateProfileCache({
        fullName: fullName.trim(),
        username: normalizedUsername,
        interests,
        padelLevel: padelLevel ?? null,
      });
      await setOnboardingDone(true);
      await clearOnboardingDraft();
      router.replace("/agora");
    } catch (err: any) {
      const raw = String(err?.message ?? "");
      const message = t("onboarding:errors.finalizeFailed");
      if (
        raw.includes("USERNAME_TAKEN") ||
        raw.toLowerCase().includes("username") ||
        raw.toLowerCase().includes("utilizado")
      ) {
        setUsernameStatus("taken");
        Alert.alert(
          t("onboarding:errors.usernameUnavailableTitle"),
          t("onboarding:errors.usernameUnavailableBody"),
        );
        setStep("basic");
        return;
      }
      if (raw.includes("API 401") || raw.includes("UNAUTHENTICATED")) {
        await handleAuthError();
        return;
      }
      Alert.alert(t("common:labels.error"), message);
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
      await persistDraft({
        step: 1,
        fullName: fullName.trim(),
        username: normalizedUsername,
        interests,
      });
      setStep("interests");
    } catch (err: any) {
      const rawMessage = String(err?.message ?? "");
      if (
        rawMessage.includes("USERNAME_TAKEN") ||
        rawMessage.toLowerCase().includes("username") ||
        rawMessage.includes("já está")
      ) {
        setUsernameStatus("taken");
        Alert.alert(
          t("onboarding:errors.usernameUnavailableTitle"),
          t("onboarding:errors.usernameTaken"),
        );
        return;
      }
      if (rawMessage.includes("API 401") || rawMessage.includes("UNAUTHENTICATED")) {
        await handleAuthError();
        return;
      }
      Alert.alert(
        t("common:labels.error"),
        getUserFacingError(err, t("onboarding:errors.profileSaveFailed")),
      );
    } finally {
      setSavingStep(null);
    }
  };

  const handleInterestsContinue = async () => {
    if (!canContinueInterests) return;
    setSavingStep("interests");
    try {
      await persistDraft({ step: 2, interests });
      if (padelSelected) {
        setStep("padel");
      } else {
        await finalizeOnboarding();
      }
    } catch (err: any) {
      const rawMessage = String(err?.message ?? "");
      if (rawMessage.includes("API 401") || rawMessage.includes("UNAUTHENTICATED")) {
        await handleAuthError();
        return;
      }
      Alert.alert(
        t("common:labels.error"),
        getUserFacingError(err, t("onboarding:errors.interestsSaveFailed")),
      );
    } finally {
      setSavingStep(null);
    }
  };

  const handlePadelContinue = async () => {
    if (!canContinuePadel) {
      Alert.alert(t("onboarding:errors.missingDataTitle"), t("onboarding:errors.padelMissing"));
      return;
    }
    setSavingStep("padel");
    try {
      await persistDraft({
        step: 3,
        padel: {
          gender: padelGender,
          preferredSide: padelSide,
          level: padelLevel,
          skipped: false,
        },
      });
      await finalizeOnboarding();
    } catch (err: any) {
      const rawMessage = String(err?.message ?? "");
      if (rawMessage.includes("API 401") || rawMessage.includes("UNAUTHENTICATED")) {
        await handleAuthError();
        return;
      }
      Alert.alert(
        t("common:labels.error"),
        getUserFacingError(err, t("onboarding:errors.padelSaveFailed")),
      );
    } finally {
      setSavingStep(null);
    }
  };

  const handlePadelSkip = async () => {
    if (savingStep) return;
    setSavingStep("padel");
    try {
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
      await finalizeOnboarding();
    } catch (err: any) {
      const rawMessage = String(err?.message ?? "");
      if (rawMessage.includes("API 401") || rawMessage.includes("UNAUTHENTICATED")) {
        await handleAuthError();
        return;
      }
      Alert.alert(
        t("common:labels.error"),
        getUserFacingError(err, t("onboarding:errors.padelSaveFailed")),
      );
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
    if (savingStep) return;
    const prev = steps[stepIndex - 1];
    if (prev) {
      setStep(prev);
      return;
    }
    Alert.alert(
      t("onboarding:exit.title"),
      t("onboarding:exit.body"),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        {
          text: t("onboarding:exit.confirm"),
          style: Platform.OS === "ios" ? "destructive" : "default",
          onPress: () => {
            handleExitOnboarding().catch(() => undefined);
          },
        },
      ],
      { cancelable: true },
    );
  };

  const renderUsernameStatus = () => {
    const hasUsername = username.length > 0;
    const showHint = hasUsername && usernameStatus === "invalid";
    const statusMessage =
      usernameStatus === "checking"
        ? t("onboarding:status.checking")
        : usernameStatus === "available"
          ? t("onboarding:status.available")
        : usernameStatus === "reserved"
            ? t("onboarding:status.reserved")
            : usernameStatus === "taken"
              ? t("onboarding:status.taken")
              : usernameStatus === "invalid"
                ? t("onboarding:status.invalid")
                : usernameStatus === "error"
                  ? t("onboarding:status.error")
                  : "";
    const tone =
      usernameStatus === "available"
        ? styles.helperSuccess
        : usernameStatus === "checking"
          ? styles.helperNeutral
          : usernameStatus === "taken" || usernameStatus === "reserved" || usernameStatus === "invalid" || usernameStatus === "error"
            ? styles.helperError
            : styles.helperText;

    if (!hasUsername && !statusMessage) return null;
    if (!statusMessage && !showHint) return null;

    return (
      <View style={styles.helperStack}>
        {showHint ? (
          <Text style={styles.helperHint}>{t("onboarding:basic.usernameHint")}</Text>
        ) : null}
        {statusMessage ? (
          <View style={styles.helperRow}>
            {usernameStatus === "checking" ? (
              <ActivityIndicator size="small" color="rgba(200,210,230,0.9)" />
            ) : usernameStatus === "available" ? (
              <Ionicons name="checkmark-circle" size={14} color="rgba(110, 231, 183, 0.9)" />
            ) : usernameStatus === "taken" || usernameStatus === "reserved" || usernameStatus === "invalid" || usernameStatus === "error" ? (
              <Ionicons name="alert-circle" size={14} color="rgba(252, 165, 165, 0.9)" />
            ) : null}
            <Text style={[styles.helperText, tone]}>{statusMessage}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderBasicStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={styles.cardTitle}>{t("onboarding:basic.title")}</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t("onboarding:basic.nameLabel")}</Text>
        <View style={styles.inputShell}>
          <TextInput
            ref={nameInputRef}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t("onboarding:basic.namePlaceholder")}
            placeholderTextColor={tokens.colors.textMuted}
            autoCapitalize="words"
            textContentType="name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => usernameInputRef.current?.focus()}
            style={styles.input}
            accessibilityLabel={t("onboarding:basic.nameLabel")}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t("onboarding:basic.usernameLabel")}</Text>
        <View
          style={[
            styles.inputShell,
            usernameStatus === "available"
              ? styles.inputShellSuccess
              : usernameStatus === "taken" ||
                  usernameStatus === "reserved" ||
                  usernameStatus === "invalid" ||
                  usernameStatus === "error"
                ? styles.inputShellError
                : null,
          ]}
        >
          <Text style={styles.usernamePrefix}>@</Text>
          <TextInput
            ref={usernameInputRef}
            value={username}
            onChangeText={(value) => {
              const next = sanitizeUsername(value);
              setUsername(next);
            }}
            placeholder={t("onboarding:basic.usernamePlaceholder").replace(/^@+/, "")}
            placeholderTextColor={tokens.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="username"
            returnKeyType="done"
            style={styles.usernameInput}
            accessibilityLabel={t("onboarding:basic.usernameLabel")}
          />
        </View>
        {renderUsernameStatus()}
      </View>
    </GlassCard>
  );

  const renderInterestsStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={[styles.cardTitle, styles.interestsTitle]}>
        {t("onboarding:interests.title")}
      </Text>
      <Text style={[styles.cardSubtitle, styles.interestsSubtitle]}>
        {t("onboarding:interests.subtitle")}
      </Text>

      <View style={styles.interestGrid}>
        {INTEREST_OPTIONS.map((interest, idx) => {
          const active = interests.includes(interest.id);
          const disabled = !active && interests.length >= MAX_INTERESTS;
          const isPadel = interest.id === "padel";
          const interestLabel = t(`common:interests.${interest.id}`);
          return (
            <Pressable
              key={interest.id}
              onPress={() => {
                if (disabled) return;
                toggleInterest(interest.id);
              }}
              style={({ pressed }) => [
                styles.interestChip,
                compactLayout
                  ? styles.interestChipCompact
                  : wideLayout
                    ? styles.interestChipWide
                    : styles.interestChipRegular,
                active ? styles.interestChipActive : styles.interestChipIdle,
                isPadel ? styles.interestChipPadel : null,
                disabled ? styles.interestChipDisabled : null,
                pressed ? styles.interestChipPressed : null,
                idx === 0 ? styles.interestChipFirst : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={interestLabel}
              accessibilityState={{ selected: active, disabled }}
            >
              <View style={[styles.interestIcon, active ? styles.interestIconActive : null]}>
                <Ionicons
                  name={INTEREST_ICONS[interest.id]}
                  size={18}
                  color={active ? "#ffffff" : "rgba(255,255,255,0.75)"}
                />
              </View>
              <Text style={[styles.interestLabel, active ? styles.interestLabelActive : null]}>
                {interestLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helperMeta}>
        {t("onboarding:interests.selectedCount", { count: interests.length, total: MAX_INTERESTS })}
      </Text>
      {interests.length >= MAX_INTERESTS ? (
        <Text style={styles.helperHint}>{t("onboarding:interests.limitReached")}</Text>
      ) : null}
    </GlassCard>
  );

  const renderPadelStep = () => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{t("onboarding:padel.title")}</Text>
        <Pressable
          onPress={handlePadelSkip}
          style={styles.skipLink}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding:padel.skip")}
        >
          <Text style={styles.skipText}>{t("onboarding:padel.skip")}</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t("onboarding:padel.gender")}</Text>
        <View style={styles.optionRow}>
          {PADEL_GENDERS.map((gender) => {
            const active = padelGender === gender.id;
            const label = genderLabels[gender.id];
            return (
              <Pressable
                key={gender.id}
                onPress={() => setPadelGender(gender.id)}
                style={({ pressed }) => [
                  styles.optionChip,
                  styles.optionChipHalf,
                  active ? styles.optionChipActive : styles.optionChipIdle,
                  pressed ? styles.optionChipPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.optionContent}>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={16} color="#0b0f17" />
                  ) : null}
                  <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t("onboarding:padel.side")}</Text>
        <View style={styles.optionRow}>
          {PADEL_SIDES.map((side) => {
            const active = padelSide === side.id;
            const label = sideLabels[side.id];
            return (
              <Pressable
                key={side.id}
                onPress={() => setPadelSide(side.id)}
                style={({ pressed }) => [
                  styles.optionChip,
                  compactLayout ? styles.optionChipHalf : styles.optionChipThird,
                  active ? styles.optionChipActive : styles.optionChipIdle,
                  pressed ? styles.optionChipPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.optionContent}>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={16} color="#0b0f17" />
                  ) : null}
                  <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t("onboarding:padel.levelOptional")}</Text>
        <View style={styles.levelGrid}>
          {PADEL_LEVELS.map((level) => {
            const active = padelLevel === level;
            return (
              <Pressable
                key={level}
                onPress={() => setPadelLevel(active ? null : level)}
                style={({ pressed }) => [
                  styles.optionChip,
                  compactLayout ? styles.levelChipCompact : styles.levelChip,
                  active ? styles.optionChipActive : styles.optionChipIdle,
                  pressed ? styles.optionChipPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("onboarding:padel.levelOption", { level })}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.optionContent}>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={14} color="#0b0f17" />
                  ) : null}
                  <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>{level}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={[
              styles.container,
              compactLayout ? styles.containerCompact : null,
              {
                paddingTop: insets.top + 16,
                paddingBottom: Math.max(insets.bottom + 20, 40),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topBar}>
              <Pressable
                onPress={handleBack}
                style={[styles.backButton, savingStep ? styles.backButtonDisabled : null]}
                disabled={Boolean(savingStep)}
                accessibilityRole="button"
                accessibilityLabel={t("common:actions.back")}
                accessibilityState={{ disabled: Boolean(savingStep) }}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>

            <View style={styles.header}>
              <View style={styles.stepMetaRow}>
                <View style={styles.stepMetaBadge}>
                  <Ionicons name={STEP_ICONS[step]} size={14} color="rgba(210,226,255,0.95)" />
                </View>
                <Text style={styles.stepMetaText}>
                  {t("onboarding:stepCounter", { current: stepIndex + 1, total: steps.length })}
                </Text>
              </View>
              <Text style={styles.title}>{t("onboarding:welcomeTitle")}</Text>
              <Text style={styles.subtitle}>{stepHint}</Text>
            </View>

            <StepProgress
              total={steps.length}
              current={stepIndex}
              accessibilityLabel={t("onboarding:stepCounter", { current: stepIndex + 1, total: steps.length })}
            />

            <Animated.View
              style={[
                styles.stepContentWrap,
                {
                  opacity: stepTransition,
                  transform: [
                    {
                      translateY: stepTransition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {step === "basic"
                ? renderBasicStep()
                : step === "interests"
                  ? renderInterestsStep()
                  : renderPadelStep()}

              <View style={styles.actions}>
                {step === "basic" ? (
                  <PrimaryButton
                    label={savingStep === "basic" ? t("common:actions.saving") : t("common:actions.continue")}
                    onPress={handleBasicContinue}
                    disabled={!canContinueBasic || savingStep === "basic"}
                    loading={savingStep === "basic"}
                  />
                ) : null}
                {step === "interests" ? (
                  <PrimaryButton
                    label={
                      savingStep === "interests" ? t("common:actions.saving") : t("common:actions.continue")
                    }
                    onPress={handleInterestsContinue}
                    disabled={!canContinueInterests || savingStep === "interests"}
                    loading={savingStep === "interests"}
                  />
                ) : null}
                {step === "padel" ? (
                  <View style={styles.padelActions}>
                    <PrimaryButton
                      label={savingStep === "padel" ? t("common:actions.saving") : t("common:actions.continue")}
                      onPress={handlePadelContinue}
                      disabled={!canContinuePadel || savingStep === "padel"}
                      loading={savingStep === "padel"}
                    />
                  </View>
                ) : null}
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 22,
    paddingBottom: 40,
    gap: 18,
    alignItems: "center",
  },
  containerCompact: {
    paddingHorizontal: 16,
    gap: 14,
  },
  topBar: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.layout.touchTarget,
    minWidth: tokens.layout.touchTarget,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  backButtonDisabled: {
    opacity: 0.45,
  },
  backLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    gap: 10,
    alignItems: "center",
    maxWidth: 440,
    width: "100%",
  },
  stepMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(164, 200, 255, 0.1)",
    borderColor: "rgba(170, 210, 255, 0.3)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepMetaBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepMetaText: {
    color: "rgba(220,232,255,0.92)",
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 36,
    fontFamily: tokens.typography.fontFamily?.headingBold ?? "System",
    letterSpacing: tokens.typography.letterSpacing?.tight ?? -0.2,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(220, 228, 244, 0.78)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
    maxWidth: 360,
  },
  stepContentWrap: {
    width: "100%",
    alignItems: "center",
    gap: 14,
  },
  card: {
    width: "100%",
    maxWidth: 440,
  },
  cardContent: {
    gap: 18,
    padding: 22,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: tokens.typography.fontFamily?.heading ?? "System",
  },
  interestsTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: tokens.typography.fontFamily?.headingBold ?? "System",
    letterSpacing: tokens.typography.letterSpacing?.tight ?? -0.2,
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  interestsSubtitle: {
    color: "rgba(225,236,255,0.88)",
    fontSize: 15,
    lineHeight: 22,
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
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  inputShell: {
    minHeight: tokens.layout.touchTarget + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inputShellSuccess: {
    borderColor: "rgba(110, 231, 183, 0.55)",
    backgroundColor: "rgba(80, 200, 140, 0.08)",
  },
  inputShellError: {
    borderColor: "rgba(252, 165, 165, 0.56)",
    backgroundColor: "rgba(250, 120, 120, 0.08)",
  },
  input: {
    minHeight: tokens.layout.touchTarget,
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  usernamePrefix: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
    marginTop: Platform.OS === "ios" ? 1 : 0,
  },
  usernameInput: {
    minHeight: tokens.layout.touchTarget,
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  helperText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  helperHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  helperStack: {
    gap: 2,
    marginTop: 6,
  },
  helperNeutral: {
    color: "rgba(200,210,230,0.9)",
  },
  helperSuccess: {
    color: "rgba(110, 231, 183, 0.9)",
  },
  helperError: {
    color: "rgba(252, 165, 165, 0.95)",
  },
  helperMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 10,
    alignSelf: "center",
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  interestChip: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: tokens.layout.touchTarget + 6,
    aspectRatio: 1,
    position: "relative",
  },
  interestChipRegular: {
    width: "31%",
    minWidth: 86,
  },
  interestChipWide: {
    width: "23%",
    minWidth: 86,
  },
  interestChipCompact: {
    width: "47%",
    minWidth: 118,
    aspectRatio: 1.18,
  },
  interestChipIdle: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  interestChipActive: {
    borderColor: "rgba(170, 220, 255, 0.78)",
    backgroundColor: "rgba(147, 197, 253, 0.26)",
    shadowColor: "rgba(130, 190, 255, 0.44)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
  },
  interestChipDisabled: {
    opacity: 0.42,
  },
  interestChipPadel: {
    borderColor: "rgba(200, 225, 255, 0.7)",
    backgroundColor: "rgba(255,255,255,0.14)",
    shadowColor: "rgba(180, 220, 255, 0.35)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  interestIconActive: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  interestLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
    flexShrink: 1,
    textAlign: "center",
    width: "100%",
  },
  interestLabelActive: {
    color: "#ffffff",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipLink: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: tokens.layout.touchTarget,
    justifyContent: "center",
  },
  skipText: {
    color: "rgba(200, 220, 255, 0.9)",
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: tokens.layout.touchTarget + 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  optionChipHalf: {
    width: "48%",
  },
  optionChipThird: {
    width: "31%",
  },
  optionChipIdle: {
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  optionChipActive: {
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "rgba(255,255,255,0.35)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  optionChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  optionLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
  },
  optionLabelActive: {
    color: "#0b0f17",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  levelChip: {
    width: "30%",
  },
  levelChipCompact: {
    width: "47%",
  },
  actions: {
    gap: 12,
    width: "100%",
    maxWidth: 440,
    marginTop: 2,
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
