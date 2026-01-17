"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

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

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [gender, setGender] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [preferredSide, setPreferredSide] = useState<string>("");
  const [clubName, setClubName] = useState("");
  const [context, setContext] = useState<PadelOnboardingResponse | null>(null);

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

  const validForm = Boolean(
    fullName.trim() &&
      username.trim() &&
      contactPhone.trim() &&
      gender &&
      level &&
      preferredSide &&
      !genderMismatch,
  );

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
          throw new Error(data?.error || "Nao foi possivel carregar.");
        }
        setContext(data);
        setFullName(data.profile.fullName ?? "");
        setUsername(data.profile.username ?? "");
        setEmail(data.profile.email ?? null);
        setContactPhone(data.profile.contactPhone ?? "");
        setGender(data.profile.gender ?? "");
        setLevel(data.padelProfile.level ?? "");
        setPreferredSide(data.padelProfile.preferredSide ?? "");
        setClubName(data.padelProfile.clubName ?? "");
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

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validForm) {
      setSubmitError("Preenche os campos obrigatorios antes de continuar.");
      return;
    }

    try {
      const res = await fetch("/api/padel/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          contactPhone: contactPhone.trim(),
          gender,
          level,
          preferredSide,
          clubName: clubName.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string } | null;
      if (!res.ok || !data?.ok) {
        const message =
          data?.code === "USERNAME_TAKEN"
            ? "Este @ ja esta a ser usado."
            : data?.error === "INVALID_PHONE"
              ? "Telemovel invalido."
              : data?.error || "Nao foi possivel guardar.";
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
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="space-y-6">
                <div>
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
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                        placeholder="@teu.username"
                      />
                      <p className="text-[11px] text-white/45">
                        3-30 caracteres, letras ou numeros, _ ou ., sem espacos.
                      </p>
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
                      <label className="text-xs uppercase tracking-[0.2em] text-white/60">Telemovel *</label>
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                        placeholder="+351 9xx xxx xxx"
                      />
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

                <div className="border-t border-white/10 pt-6">
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
                  <p className="text-xs text-white/55">
                    Obrigatorio: nome, username, telemovel, genero, nivel e lado.
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!validForm}
                    className="rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_25px_rgba(52,211,153,0.35)] disabled:opacity-50"
                  >
                    {ctaLabel}
                  </button>
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
