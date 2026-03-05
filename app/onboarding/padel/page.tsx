"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "@/lib/username";
import { isValidPhone } from "@/lib/phone";

type PadelOnboardingResponse = {
  ok: boolean;
  organizationId?: number;
  event?: { id: number; title: string; slug: string } | null;
  category?: { id: number; label: string; genderRestriction: string | null } | null;
  profile: {
    fullName: string | null;
    username: string | null;
    contactPhone: string | null;
    gender: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  padelProfile: {
    level: string | null;
    preferredSide: string | null;
    clubName: string | null;
    displayName: string | null;
  };
  missing: Record<string, boolean>;
  completed: boolean;
  error?: string;
};

const LEVELS = ["1", "2", "3", "4", "5", "6"];
const PREFERRED_SIDES = [
  { value: "ESQUERDA", label: "Esquerda" },
  { value: "DIREITA", label: "Direita" },
  { value: "QUALQUER", label: "Qualquer" },
];

const GENDER_OPTIONS = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Feminino" },
];

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "error";

function PadelOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useUser();
  const { openModal, isOpen } = useAuthModal();

  const eventId = Number(searchParams.get("eventId"));
  const organizationId = Number(searchParams.get("organizationId"));
  const categoryId = Number(searchParams.get("categoryId"));
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirectTo"), "/");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [gender, setGender] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [preferredSide, setPreferredSide] = useState<string>("");
  const [clubName, setClubName] = useState("");
  const [context, setContext] = useState<PadelOnboardingResponse | null>(null);

  const existingUsernameNormalized = useMemo(
    () => sanitizeUsername(context?.profile?.username ?? ""),
    [context?.profile?.username],
  );

  const onboardingPath = useMemo(() => {
    const qs = searchParams?.toString();
    return `/onboarding/padel${qs ? `?${qs}` : ""}`;
  }, [searchParams]);

  const categoryRestriction = useMemo(() => {
    return (context?.category?.genderRestriction ?? "").trim().toUpperCase();
  }, [context?.category?.genderRestriction]);

  const genderLocked =
    categoryRestriction === "MALE" || categoryRestriction === "FEMALE";
  const genderOptions = useMemo(() => {
    if (categoryRestriction === "MALE") return [GENDER_OPTIONS[0]];
    if (categoryRestriction === "FEMALE") return [GENDER_OPTIONS[1]];
    return GENDER_OPTIONS;
  }, [categoryRestriction]);
  const genderMismatch =
    genderLocked && gender && gender !== categoryRestriction;
  const genderRestrictionLabel =
    categoryRestriction === "MALE"
      ? "Masculino"
      : categoryRestriction === "FEMALE"
        ? "Feminino"
        : null;

  const usernameValidation = validateUsername(sanitizeUsername(username), {
    allowReservedForEmail: email ?? null,
  });
  const usernameIsValid = usernameValidation.valid;
  const validPhone = isValidPhone(contactPhone.trim());
  const validPhoneOrEmpty = !contactPhone.trim() || validPhone;
  const validIdentityStep = Boolean(
    fullName.trim() && usernameIsValid && validPhoneOrEmpty && gender && !genderMismatch,
  );
  const validCompetitiveStep = Boolean(level && preferredSide);
  const validForm = validIdentityStep && validCompetitiveStep;

  const ctaLabel =
    redirectTo && redirectTo !== "/" ? "Guardar e continuar" : "Guardar perfil";

  useEffect(() => {
    if (!isLoading && !user && !isOpen) {
      openModal({ mode: "login", redirectTo: onboardingPath, showGoogle: true });
    }
  }, [isLoading, user, router, onboardingPath, openModal, isOpen]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (!Number.isNaN(eventId) && eventId) params.set("eventId", String(eventId));
        if (!Number.isNaN(organizationId) && organizationId) params.set("organizationId", String(organizationId));
        if (!Number.isNaN(categoryId) && categoryId) params.set("categoryId", String(categoryId));
        const res = await fetch(`/api/padel/onboarding?${params.toString()}`);
        const data = (await res.json().catch(() => null)) as PadelOnboardingResponse | null;
        if (!res.ok || !data?.ok) {
          throw new Error(sanitizeUiErrorMessage(data?.error, "Nao foi possivel carregar."));
        }
        setContext(data);
        setFullName(data.profile.fullName ?? "");
        setUsername(sanitizeUsername(data.profile.username ?? ""));
        setEmail(data.profile.email ?? null);
        setContactPhone(data.profile.contactPhone ?? "");
        setGender(data.profile.gender ?? "");
        setLevel(data.padelProfile.level ?? "");
        setPreferredSide(data.padelProfile.preferredSide ?? "");
        setClubName(data.padelProfile.clubName ?? "");
        setUsernameHint(null);
        setUsernameStatus("idle");
        setStep(
          data.missing?.fullName ||
            data.missing?.username ||
            data.missing?.gender
            ? 1
            : 2,
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, eventId, organizationId, categoryId]);

  useEffect(() => {
    if (!genderLocked || !categoryRestriction) return;
    if (!gender) {
      setGender(categoryRestriction);
    }
  }, [genderLocked, categoryRestriction, gender]);

  async function checkUsernameAvailability(currentUsername: string) {
    const normalized = sanitizeUsername(currentUsername);
    if (!normalized) {
      setUsernameHint(USERNAME_RULES_HINT);
      setUsernameStatus("idle");
      return "invalid" as const;
    }

    const validation = validateUsername(normalized, { allowReservedForEmail: email ?? null });
    if (!validation.valid) {
      setUsernameHint(validation.error);
      setUsernameStatus("error");
      return "invalid" as const;
    }

    if (existingUsernameNormalized && normalized === existingUsernameNormalized) {
      setUsernameStatus("available");
      setUsernameHint(null);
      return "available" as const;
    }

    setUsernameHint(null);
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        setUsernameStatus("error");
        setUsernameHint("Nao foi possivel validar o username.");
        return "error" as const;
      }
      const data = (await res.json().catch(() => null)) as { available?: boolean; reason?: string } | null;
      if (data?.available) {
        setUsernameStatus("available");
        setUsernameHint(null);
        return "available" as const;
      }
      if (data?.reason === "reserved") {
        setUsernameStatus("reserved");
        setUsernameHint("Este username esta reservado.");
        return "reserved" as const;
      }
      setUsernameStatus("taken");
      setUsernameHint("Este @ ja esta a ser usado.");
      return "taken" as const;
    } catch {
      setUsernameStatus("error");
      setUsernameHint("Nao foi possivel validar o username.");
      return "error" as const;
    }
  }

  const handleContinueIdentity = async () => {
    setSubmitError(null);
    if (!fullName.trim()) {
      setSubmitError("Preenche o nome completo.");
      return;
    }
    if (!usernameIsValid) {
      setSubmitError(usernameValidation.error || "Username invalido.");
      return;
    }
    if (contactPhone.trim() && !validPhone) {
      setSubmitError("Telemovel invalido.");
      return;
    }
    if (!gender) {
      setSubmitError("Seleciona o genero.");
      return;
    }
    if (genderMismatch) {
      setSubmitError("Genero incompatível com a categoria.");
      return;
    }
    const availability = await checkUsernameAvailability(username);
    if (availability === "taken" || availability === "reserved") {
      setSubmitError("Escolhe outro username para continuar.");
      return;
    }
    if (availability === "error" || availability === "invalid") {
      setSubmitError("Nao foi possivel validar o username.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validForm || (contactPhone.trim() && !validPhone)) {
      setSubmitError("Preenche os campos obrigatorios antes de continuar.");
      return;
    }

    const availability = await checkUsernameAvailability(username);
    if (availability === "taken" || availability === "reserved") {
      setSubmitError("Este @ ja esta a ser usado.");
      return;
    }
    if (availability === "error" || availability === "invalid") {
      setSubmitError("Nao foi possivel validar o username.");
      return;
    }

    try {
      const res = await fetch("/api/padel/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: sanitizeUsername(username),
          contactPhone: contactPhone.trim() || undefined,
          gender,
          level,
          preferredSide,
          clubName: clubName.trim() || null,
          eventId: !Number.isNaN(eventId) && eventId ? eventId : undefined,
          organizationId: !Number.isNaN(organizationId) && organizationId ? organizationId : undefined,
          categoryId: !Number.isNaN(categoryId) && categoryId ? categoryId : undefined,
        }),
      });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          errorCode?: string;
          code?: string;
        } | null;
        if (!res.ok || !data?.ok) {
          const errorCode = data?.errorCode ?? data?.code;
          const message =
            errorCode === "USERNAME_TAKEN"
              ? "Este @ ja esta a ser usado."
              : data?.error === "INVALID_PHONE"
                ? "Telemovel invalido."
                : data?.error === "GENDER_REQUIRED"
                  ? "Seleciona o género."
                : sanitizeUiErrorMessage(data?.error, "Nao foi possivel guardar.");
          throw new Error(message);
        }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("orya:profile-updated"));
      }
      router.push(redirectTo || "/");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao guardar.");
    }
  };

  if (loading) {
    return (
      <div className="orya-page-width min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-white/70">A preparar o teu perfil Padel...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="orya-page-width min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-red-200">{loadError}</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="orya-page-width min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-white/70">Nao foi possivel carregar o onboarding.</p>
      </div>
    );
  }

  const missingLabels: Record<string, string> = {
    fullName: "Nome completo",
    username: "Username",
    email: "Email",
    phone: "Telemovel",
    gender: "Genero",
    level: "Nivel",
    preferredSide: "Lado preferido",
  };
  const missingList = Object.keys(context.missing || {})
    .filter((key) => context.missing?.[key])
    .map((key) => missingLabels[key] || key);

  return (
    <main className="relative min-h-screen text-white">
      <div className="orya-page-width px-4 pb-20 pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(2,6,16,0.78))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
              <div className="absolute inset-y-0 right-0 hidden w-[220px] sm:block" aria-hidden="true">
                <div className="absolute inset-0 bg-gradient-to-l from-white/10 via-transparent to-transparent" />
                <div className="absolute inset-6 rounded-2xl border border-white/20">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
                  <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-white/5" />
                </div>
                <div className="absolute bottom-6 right-6 h-10 w-10 rounded-full border border-white/20 bg-emerald-400/15 shadow-[0_0_18px_rgba(52,211,153,0.25)]" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/60">
                <span>Perfil Padel</span>
                {username ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] tracking-[0.2em] text-white/70">
                    @{username.toLowerCase()}/padel
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-3xl font-semibold">Completa o teu perfil competitivo</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Perfil exclusivo para padel: ajuda a criar duplas equilibradas e acelera a tua inscrição em torneios.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`rounded-full border px-3 py-1 ${
                    step === 1
                      ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                      : "border-white/20 text-white/70 hover:bg-white/10"
                  }`}
                >
                  1 · Identidade
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!validIdentityStep}
                  className={`rounded-full border px-3 py-1 ${
                    step === 2
                      ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                      : "border-white/20 text-white/70 hover:bg-white/10"
                  } disabled:opacity-50`}
                >
                  2 · Perfil competitivo
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="space-y-6">
                <div className={step === 1 ? "" : "hidden"}>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Identidade & contacto</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Nome completo *</label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                        placeholder="Nome e apelido"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Username *</label>
                      <input
                        value={username}
                        onChange={(e) => {
                          const cleaned = sanitizeUsername(e.target.value);
                          setUsername(cleaned);
                          const validation = validateUsername(cleaned, {
                            allowReservedForEmail: email ?? null,
                          });
                          setUsernameStatus("idle");
                          setUsernameHint(validation.valid ? null : validation.error);
                        }}
                        onBlur={() => {
                          if (!username.trim()) return;
                          void checkUsernameAvailability(username);
                        }}
                        className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                        placeholder="@teu.username"
                      />
                      <p className="text-[11px] text-white/45">
                        3-30 caracteres, letras ou numeros, _ ou ., sem espacos.
                      </p>
                      {usernameHint ? <p className="text-[11px] text-amber-200">{usernameHint}</p> : null}
                      {usernameStatus === "checking" ? (
                        <p className="text-[11px] text-white/55">A validar username...</p>
                      ) : null}
                      {usernameStatus === "available" && username ? (
                        <p className="text-[11px] text-emerald-200">Username disponivel.</p>
                      ) : null}
                      {usernameStatus === "taken" ? (
                        <p className="text-[11px] text-red-200">Este @ ja esta a ser usado.</p>
                      ) : null}
                      {usernameStatus === "reserved" ? (
                        <p className="text-[11px] text-amber-200">Este username esta reservado.</p>
                      ) : null}
                    </div>

                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Email</label>
                      <input
                        value={email ?? ""}
                        readOnly
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60"
                      />
                    </div>

                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Telemovel (opcional)</label>
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className={`w-full rounded-2xl border bg-black/50 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none ${
                          contactPhone.trim() && !validPhone ? "border-amber-400/50" : "border-white/15"
                        }`}
                        placeholder="+351 9xx xxx xxx"
                      />
                      {contactPhone.trim() && !validPhone ? (
                        <p className="text-[11px] text-amber-200">Formato de telemovel invalido.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Genero *</label>
                      {genderRestrictionLabel ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-100">
                          Fixo pela categoria: {genderRestrictionLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {genderOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(opt.value)}
                          className={`rounded-full px-4 py-2 text-sm border ${
                            gender === opt.value
                              ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                              : "border-white/20 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {genderMismatch && (
                      <p className="text-xs text-amber-200">
                        Esta categoria exige {genderRestrictionLabel?.toLowerCase()}. Atualiza o genero para continuar.
                      </p>
                    )}
                  </div>
                </div>

                <div className={`border-t border-white/10 pt-6 ${step === 2 ? "" : "hidden"}`}>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Perfil competitivo</p>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Nivel *</label>
                      <div className="grid grid-cols-6 gap-2">
                        {LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setLevel(lvl)}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                              level === lvl
                                ? "bg-white text-black"
                                : "border border-white/15 text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Lado preferido *</label>
                      <div className="flex flex-wrap gap-2">
                        {PREFERRED_SIDES.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPreferredSide(opt.value)}
                            className={`rounded-full px-4 py-2 text-sm border ${
                              preferredSide === opt.value
                                ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-50"
                                : "border-white/20 text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Clube habitual (opcional)</label>
                      <input
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                        placeholder="Nome do teu clube"
                      />
                    </div>
                  </div>
                </div>

                {submitError && <p className="text-sm text-red-200">{submitError}</p>}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {step === 1 ? (
                    <>
                      <p className="text-xs text-white/55">
                        Passo 1 de 2: valida identidade para desbloquear o perfil competitivo.
                      </p>
                      <button
                        type="button"
                        onClick={handleContinueIdentity}
                        disabled={!validIdentityStep}
                        className="rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_25px_rgba(52,211,153,0.35)] disabled:opacity-50"
                      >
                        Continuar
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="rounded-full border border-white/25 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
                        >
                          Voltar
                        </button>
                        <p className="text-xs text-white/55">
                          Passo 2 de 2: nivel, lado preferido e clube.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!validForm}
                        className="rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_25px_rgba(52,211,153,0.35)] disabled:opacity-50"
                      >
                        {ctaLabel}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            {(context.event || context.category) && (
              <div className="rounded-3xl border border-white/15 bg-white/5 p-5 text-sm text-white/75 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Contexto</p>
                <div className="mt-3 space-y-2">
                  {context.event && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Evento</p>
                      <p className="text-sm text-white/85">{context.event.title}</p>
                    </div>
                  )}
                  {context.category && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Categoria</p>
                      <p className="text-sm text-white/85">{context.category.label}</p>
                    </div>
                  )}
                  {genderRestrictionLabel && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Genero exigido</p>
                      <p className="text-sm text-amber-100">{genderRestrictionLabel}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 text-sm text-white/75 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Checklist</p>
              {missingList.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-100">Perfil Padel completo. Pronto para competir.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-xs text-white/70">
                  {missingList.map((label) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-100">
                        Em falta
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-5 text-xs text-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Privacidade</p>
              <p className="mt-3 leading-relaxed">
                Dados usados apenas para padel. Podes editar ou ocultar mais tarde no teu perfil.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function PadelOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <PadelOnboardingContent />
    </Suspense>
  );
}
