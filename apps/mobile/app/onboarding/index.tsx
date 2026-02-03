import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import {
  INTEREST_OPTIONS,
  PADEL_LEVELS,
  InterestId,
  OnboardingStep,
} from "../../features/onboarding/types";
import {
  checkUsernameAvailability,
  saveBasicProfile,
  saveLocationConsent,
  saveLocationCoarse,
  savePadelOnboarding,
} from "../../features/onboarding/api";
import { useIpLocation } from "../../features/onboarding/hooks";

const steps: OnboardingStep[] = ["basic", "interests", "padel", "location", "finish"];

const sanitizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");

const PrimaryButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      {
        minHeight: tokens.layout.touchTarget,
        borderRadius: 16,
        backgroundColor: "rgba(52, 211, 153, 0.9)",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        alignItems: "center",
        justifyContent: "center",
      },
    ]}
  >
    <Text className="text-black font-semibold">{label}</Text>
  </Pressable>
);

const GhostButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      {
        minHeight: tokens.layout.touchTarget,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: pressed ? "rgba(255,255,255,0.06)" : "transparent",
        alignItems: "center",
        justifyContent: "center",
      },
    ]}
  >
    <Text className="text-white/80 font-semibold">{label}</Text>
  </Pressable>
);

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("basic");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [padelLevel, setPadelLevel] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState<"GRANTED" | "DENIED" | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: ipLocation } = useIpLocation();
  const stepIndex = steps.indexOf(step);

  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    fade.setValue(0);
    translate.setValue(18);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, fade, translate]);

  const canContinueBasic = useMemo(() => {
    const hasName = fullName.trim().length >= 2;
    const hasUsername = username.trim().length >= 3;
    return hasName && hasUsername && usernameStatus !== "taken" && usernameStatus !== "invalid";
  }, [fullName, username, usernameStatus]);

  const canContinueInterests = interests.length > 0;

  const handleCheckUsername = async () => {
    const normalized = sanitizeUsername(username);
    if (normalized.length < 3) {
      setUsernameStatus("invalid");
      return;
    }
    try {
      setUsernameStatus("checking");
      const available = await checkUsernameAvailability(normalized);
      setUsernameStatus(available ? "available" : "taken");
    } catch (err: any) {
      setUsernameStatus("invalid");
      Alert.alert("Erro", err?.message ?? "Não foi possível validar o username.");
    }
  };

  const toggleInterest = (interest: InterestId) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((item) => item !== interest);
      if (prev.length >= 6) return prev;
      return [...prev, interest];
    });
  };

  const handleFinish = async () => {
    try {
      setSaving(true);
      const normalizedUsername = sanitizeUsername(username);
      await saveBasicProfile({
        fullName: fullName.trim(),
        username: normalizedUsername,
        favouriteCategories: interests,
      });

      if (padelLevel) {
        await savePadelOnboarding({ level: padelLevel });
      }

      if (locationConsent === "GRANTED") {
        await saveLocationConsent({ consent: "GRANTED", preferredGranularity: "COARSE" });
        await saveLocationCoarse({
          city: ipLocation?.city ?? null,
          region: ipLocation?.region ?? null,
          source: "IP",
        });
      } else if (locationConsent === "DENIED") {
        await saveLocationConsent({ consent: "DENIED" });
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Erro", err?.message ?? "Não foi possível concluir o onboarding.");
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "basic":
        return (
          <GlassSurface intensity={50}>
            <Text className="text-white text-lg font-semibold mb-2">Quem és?</Text>
            <Text className="text-white/60 text-sm mb-6">
              Cria um perfil público bonito. Podes editar tudo depois.
            </Text>
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-2">Nome completo</Text>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ex: Sofia Almeida"
              placeholderTextColor={tokens.colors.textMuted}
              style={{ minHeight: tokens.layout.touchTarget }}
            />
            <Text className="text-white/60 text-xs uppercase tracking-[0.2em] mb-2">Username</Text>
            <TextInput
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white mb-2"
              value={username}
              onChangeText={(value) => {
                setUsername(sanitizeUsername(value));
                setUsernameStatus("idle");
              }}
              autoCapitalize="none"
              placeholder="ex: orya.sofia"
              placeholderTextColor={tokens.colors.textMuted}
              style={{ minHeight: tokens.layout.touchTarget }}
            />
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xs text-white/50">
                {usernameStatus === "available"
                  ? "Username disponível"
                  : usernameStatus === "taken"
                    ? "Já está ocupado"
                    : usernameStatus === "invalid"
                      ? "Precisa de 3+ caracteres"
                      : ""}
              </Text>
              <Pressable onPress={handleCheckUsername}>
                <Text className="text-xs text-emerald-200">Verificar</Text>
              </Pressable>
            </View>
          </GlassSurface>
        );
      case "interests":
        return (
          <GlassSurface intensity={52}>
            <Text className="text-white text-lg font-semibold mb-2">Interesses</Text>
            <Text className="text-white/60 text-sm mb-6">
              Escolhe até 6 áreas para personalizar o feed.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const active = interests.includes(interest.id);
                return (
                  <Pressable key={interest.id} onPress={() => toggleInterest(interest.id)}>
                    <GlassPill
                      label={interest.label}
                      variant={active ? "accent" : "muted"}
                      className={active ? "border-emerald-200/50" : undefined}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs text-white/50 mt-4">{interests.length}/6 selecionados</Text>
          </GlassSurface>
        );
      case "padel":
        return (
          <GlassSurface intensity={52}>
            <Text className="text-white text-lg font-semibold mb-2">Padel (opcional)</Text>
            <Text className="text-white/60 text-sm mb-6">
              Diz-nos o teu nível para recomendações e matchmaking.
            </Text>
            <View className="gap-2">
              {PADEL_LEVELS.map((level) => {
                const active = padelLevel === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => setPadelLevel(active ? null : level)}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: active ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.12)",
                        backgroundColor: pressed || active ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)",
                      },
                    ]}
                  >
                    <Text className="text-white font-semibold">{level}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs text-white/50 mt-4">Podes saltar e preencher mais tarde.</Text>
          </GlassSurface>
        );
      case "location":
        return (
          <GlassSurface intensity={52}>
            <Text className="text-white text-lg font-semibold mb-2">Localização (opcional)</Text>
            <Text className="text-white/60 text-sm mb-6">
              Usamos localização aproximada para sugerir eventos perto de ti.
            </Text>
            <GlassCard intensity={40} padding={12}>
              <Text className="text-white/80 text-sm">Sugestão</Text>
              <Text className="text-white text-base font-semibold">
                {ipLocation?.city || "Cidade"} {ipLocation?.region ? `· ${ipLocation.region}` : ""}
              </Text>
              <Text className="text-xs text-white/50 mt-1">Baseado em IP (podes alterar depois).</Text>
            </GlassCard>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => setLocationConsent("GRANTED")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    minHeight: tokens.layout.touchTarget,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: locationConsent === "GRANTED" ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.15)",
                    backgroundColor:
                      locationConsent === "GRANTED"
                        ? "rgba(52,211,153,0.12)"
                        : pressed
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.02)",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text className="text-white font-semibold">Permitir</Text>
              </Pressable>
              <Pressable
                onPress={() => setLocationConsent("DENIED")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    minHeight: tokens.layout.touchTarget,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: locationConsent === "DENIED" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
                    backgroundColor:
                      locationConsent === "DENIED"
                        ? "rgba(255,255,255,0.08)"
                        : pressed
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.02)",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text className="text-white/80 font-semibold">Agora não</Text>
              </Pressable>
            </View>
          </GlassSurface>
        );
      case "finish":
        return (
          <GlassSurface intensity={52}>
            <Text className="text-white text-lg font-semibold mb-2">Está quase</Text>
            <Text className="text-white/60 text-sm mb-6">
              Revê os teus dados principais antes de começar.
            </Text>
            <View className="gap-3">
              <GlassCard intensity={35} padding={12}>
                <Text className="text-xs text-white/50">Nome</Text>
                <Text className="text-white font-semibold">{fullName || "—"}</Text>
              </GlassCard>
              <GlassCard intensity={35} padding={12}>
                <Text className="text-xs text-white/50">Username</Text>
                <Text className="text-white font-semibold">{sanitizeUsername(username) || "—"}</Text>
              </GlassCard>
              <GlassCard intensity={35} padding={12}>
                <Text className="text-xs text-white/50">Interesses</Text>
                <Text className="text-white font-semibold">
                  {interests.length ? interests.join(" · ") : "—"}
                </Text>
              </GlassCard>
              <GlassCard intensity={35} padding={12}>
                <Text className="text-xs text-white/50">Padel</Text>
                <Text className="text-white font-semibold">{padelLevel ?? "Ainda não definido"}</Text>
              </GlassCard>
              <GlassCard intensity={35} padding={12}>
                <Text className="text-xs text-white/50">Localização</Text>
                <Text className="text-white font-semibold">
                  {locationConsent === "GRANTED"
                    ? `${ipLocation?.city || "Cidade"}${ipLocation?.region ? ` · ${ipLocation.region}` : ""}`
                    : "Sem localização"}
                </Text>
              </GlassCard>
            </View>
          </GlassSurface>
        );
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (step === "basic" && !canContinueBasic) return;
    if (step === "interests" && !canContinueInterests) return;
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  };

  const handleBack = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  };

  return (
    <LiquidBackground variant="deep">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-white/60 text-xs uppercase tracking-[0.3em]">Onboarding</Text>
            <Text className="text-white text-3xl font-semibold">Bem-vindo à ORYA</Text>
            <Text className="text-white/60 text-sm">
              Personalizamos o teu feed e preparámos o checkout para ti.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {steps.map((item, idx) => (
              <GlassPill
                key={item}
                label={`${idx + 1}`}
                variant={idx === stepIndex ? "accent" : "muted"}
              />
            ))}
          </View>

          <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
            {renderStep()}
          </Animated.View>

          <View className="gap-3">
            {stepIndex > 0 ? <GhostButton label="Voltar" onPress={handleBack} /> : null}
            {step === "finish" ? (
              <PrimaryButton
                label={saving ? "A concluir..." : "Concluir"}
                onPress={handleFinish}
                disabled={saving}
              />
            ) : (
              <PrimaryButton
                label="Continuar"
                onPress={handleNext}
                disabled={
                  (step === "basic" && !canContinueBasic) ||
                  (step === "interests" && !canContinueInterests)
                }
              />
            )}
            {step !== "finish" && step !== "basic" ? (
              <GhostButton label="Saltar" onPress={handleNext} />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </LiquidBackground>
  );
}
