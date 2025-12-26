"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import {
  DEFAULT_ORGANIZATION_MODULES,
  ORGANIZATION_CATEGORIES,
  ORGANIZATION_MODULES,
  type OrganizationCategory,
  type OrganizationModule,
} from "@/lib/organizationCategories";
import {
  BecomeOrganizerFormValues,
  becomeOrganizerSchema,
} from "@/lib/validation/organization";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

const USERNAME_HELPER = "O teu @ é único na ORYA e vai aparecer no teu perfil, eventos e links.";

const gradientByEntity: Record<string, string> = {
  PROMOTOR_ORGANIZADOR: "from-[#7C3AED]/20 via-[#0B1A38]/70 to-[#0EA5E9]/20",
  EMPRESA_MARCA: "from-[#0EA5E9]/18 via-[#0B122B]/75 to-[#10B981]/15",
  OUTRO: "from-[#FF6BCA]/15 via-[#0B132D]/75 to-[#6BFFFF]/18",
};

const badgeColors = [
  "bg-[#6BFFFF]",
  "bg-[#FF6BCA]",
  "bg-[#7C3AED]",
  "bg-[#10B981]",
  "bg-[#F59E0B]",
  "bg-[#38BDF8]",
];

const suggestionSuffixes = ["events", "official", "pt", "live", "club", "hq"];

const CATEGORY_META: Record<
  OrganizationCategory,
  { label: string; headline: string; description: string }
> = {
  EVENTOS: {
    label: "Eventos",
    headline: "Bilhetes, check-in e público num só lugar.",
    description: "Ideal para lançamentos, workshops, encontros e eventos com bilhetes.",
  },
  PADEL: {
    label: "PADEL",
    headline: "Torneios com ranking, pares e categorias.",
    description: "Perfeito para clubes e ligas que precisam de estruturas competitivas e gestão de equipas.",
  },
  VOLUNTARIADO: {
    label: "Voluntariado",
    headline: "Missões, turnos e impacto com clareza.",
    description: "Para organizações com ações sociais, equipas de apoio e logística em campo.",
  },
};

const ORGANIZATION_CATEGORY_OPTIONS = ORGANIZATION_CATEGORIES.map((key) => ({
  key,
  ...CATEGORY_META[key],
}));

const MODULE_META: Record<OrganizationModule, { label: string; description: string }> = {
  INSCRICOES: {
    label: "Inscrições",
    description: "Ativa formulários públicos, lugares e pagamentos num só fluxo.",
  },
};

const MODULE_OPTIONS = ORGANIZATION_MODULES.map((key) => ({
  key,
  ...MODULE_META[key],
}));

const InfoTooltip = ({ text }: { text: string }) => (
  <span className="group relative inline-flex items-center">
    <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[10px] leading-none text-white/80">
      i
    </span>
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 rounded-md border border-white/10 bg-black/80 px-3 py-2 text-[11px] leading-snug text-white/80 opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
      {text}
    </span>
  </span>
);

function hashToIndex(value: string, length: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

function initialsFromName(name: string) {
  if (!name.trim()) return "OR";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase()).join("");
  return initials || "OR";
}

function buildUsernameSuggestions(base: string) {
  if (!base) return [];
  const cleaned = sanitizeUsername(base);
  const suggestions = suggestionSuffixes
    .map((suffix) => sanitizeUsername(`${cleaned}${suffix.length ? `-${suffix}` : ""}`))
    .filter(Boolean);

  const unique: string[] = [];
  suggestions.forEach((s) => {
    if (s && !unique.includes(s) && s !== cleaned && s.length <= 30) unique.push(s);
  });
  return unique.slice(0, 3);
}

export default function BecomeOrganizerForm() {
  const router = useRouter();
  const [usernameHelper, setUsernameHelper] = useState(USERNAME_HELPER);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastChecked = useRef<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [rankingAnswer, setRankingAnswer] = useState<"yes" | "no" | null>(null);
  const [impactAnswer, setImpactAnswer] = useState<"yes" | "no" | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);

  const form = useForm<BecomeOrganizerFormValues>({
    resolver: zodResolver(becomeOrganizerSchema),
    mode: "onChange",
    defaultValues: {
      organizationCategory: "",
      modules: [...DEFAULT_ORGANIZATION_MODULES],
      entityType: "",
      businessName: "",
      city: "",
      website: "",
      iban: "",
      taxId: "",
      username: "",
    },
  });

  const watchOrganizationCategory = form.watch("organizationCategory");
  const watchModules = form.watch("modules");
  const watchEntityType = form.watch("entityType");
  const watchBusinessName = form.watch("businessName");
  const watchCity = form.watch("city");
  const watchUsername = form.watch("username");
  const cityOptions = useMemo(
    () => [
      "Lisboa",
      "Porto",
      "Braga",
      "Coimbra",
      "Faro",
      "Aveiro",
      "Setúbal",
      "Guimarães",
      "Viseu",
      "Funchal",
      "Ponta Delgada",
      "Évora",
      "Viana do Castelo",
      "Leiria",
      "Santarém",
    ],
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 200);
    return () => clearTimeout(t);
  }, []);

  const stepLabels = ["Categoria", "Módulos", "Dados"];
  const suggestedCategory = useMemo<OrganizationCategory | null>(() => {
    if (rankingAnswer === "yes") return "PADEL";
    if (rankingAnswer === "no" && impactAnswer === "yes") return "VOLUNTARIADO";
    if (rankingAnswer === "no" && impactAnswer === "no") return "EVENTOS";
    return null;
  }, [rankingAnswer, impactAnswer]);

  useEffect(() => {
    if (suggestedCategory && !categoryTouched) {
      form.setValue("organizationCategory", suggestedCategory, { shouldValidate: true, shouldDirty: true });
    }
  }, [suggestedCategory, categoryTouched, form]);

  const avatarSeed = watchUsername || watchBusinessName || "orya";
  const avatarColor = badgeColors[hashToIndex(avatarSeed, badgeColors.length)];
  const avatarInitials = initialsFromName(watchBusinessName || "Organização");
  const usernameClean = sanitizeUsername(watchUsername);
  const modulesEnabled = Array.isArray(watchModules) && watchModules.includes("INSCRICOES");
  const selectedCategoryMeta = ORGANIZATION_CATEGORY_OPTIONS.find(
    (category) => category.key === watchOrganizationCategory,
  );
  const selectedCategoryLabel = selectedCategoryMeta?.label ?? "Por escolher";
  const modulesLabel = modulesEnabled ? "Inscrições ativas" : "Inscrições desligadas";

  const isFormValid =
    !saving && form.formState.isValid && validateUsername(usernameClean).valid;

  const gradientOverlay = useMemo(() => {
    if (watchEntityType && gradientByEntity[watchEntityType]) return gradientByEntity[watchEntityType];
    return "from-white/6 via-transparent to-[#6BFFFF]/8";
  }, [watchEntityType]);

  const checkUsername = async (value: string) => {
    const cleaned = sanitizeUsername(value);
    if (!cleaned) {
      setUsernameStatus("idle");
      setUsernameHelper(USERNAME_HELPER);
      return false;
    }
    const validation = validateUsername(cleaned);
    if (!validation.valid) {
      setUsernameStatus("error");
      setUsernameHelper(validation.error);
      return false;
    }
    if (lastChecked.current === cleaned && usernameStatus === "available") {
      return true;
    }
    setUsernameHelper("A verificar disponibilidade…");
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(cleaned)}`);
      if (!res.ok) {
        setUsernameStatus("error");
        setUsernameHelper("Não foi possível verificar o @ agora.");
        return false;
      }
      const data = (await res.json().catch(() => null)) as { available?: boolean } | null;
      const available = Boolean(data?.available);
      lastChecked.current = cleaned;
      if (available) {
        setUsernameStatus("available");
        setUsernameHelper("Este @ está disponível.");
      } else {
        setUsernameStatus("taken");
        setUsernameHelper("Este @ já está a ser usado — escolhe outro.");
      }
      return available;
    } catch (err) {
      console.error("[organizador/become] erro check username", err);
      setUsernameStatus("error");
      setUsernameHelper("Erro ao verificar o @.");
      return false;
    }
  };

  useEffect(() => {
    if (usernameCheckTimeout.current) clearTimeout(usernameCheckTimeout.current);
    usernameCheckTimeout.current = setTimeout(() => {
      checkUsername(watchUsername);
    }, 450);
    return () => {
      if (usernameCheckTimeout.current) clearTimeout(usernameCheckTimeout.current);
    };
  }, [watchUsername]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setSuccess(null);

    const cleanedUsername = sanitizeUsername(values.username);
    const usernameValidation = validateUsername(cleanedUsername);
    if (!usernameValidation.valid) {
      setUsernameStatus("error");
      setUsernameHelper(usernameValidation.error);
      return;
    }

    const usernameAvailable = await checkUsername(cleanedUsername);
    if (!usernameAvailable) {
      setError("Este @ já está a ser usado — escolhe outro.");
      return;
    }

    const normalizedWebsite = (() => {
      if (!values.website) return null;
      const trimmed = values.website.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("@")) {
        return `https://instagram.com/${trimmed.slice(1)}`;
      }
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    })();

    setSaving(true);
    try {
      const res = await fetch("/api/organizador/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationCategory: values.organizationCategory,
          modules: values.modules ?? [],
          entityType: values.entityType.trim(),
          businessName: values.businessName.trim(),
          city: values.city.trim(),
          website: normalizedWebsite,
          payoutIban: values.iban ? values.iban.replace(/\s+/g, "") : null,
          nif: values.taxId || null,
          publicName: values.businessName.trim(),
          username: cleanedUsername,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        setError(data?.error || "Não foi possível criar a organização.");
        setSaving(false);
        return;
      }

      if (data?.organizer?.id) {
        await fetch("/api/organizador/organizations/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizerId: data.organizer.id }),
        });
      }

      setSuccess("Organização criada com sucesso. Bem-vindo ao painel da ORYA.");
      setTimeout(() => {
        router.replace("/organizador");
      }, 320);
    } catch (err) {
      console.error("[organizador/become] erro:", err);
      setError("Erro inesperado ao criar organização.");
      setSaving(false);
    }
  });

  const usernameMessageClass = (() => {
    if (usernameStatus === "available") return "text-emerald-300";
    if (usernameStatus === "taken" || usernameStatus === "error") return "text-red-300";
    if (usernameStatus === "checking") return "text-white/65";
    return "text-white/55";
  })();

  const usernameBorderClass =
    usernameStatus === "available"
      ? "border-emerald-300/60 focus:border-emerald-300/80 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
      : usernameStatus === "taken" || form.formState.errors.username
      ? "border-red-400/70 focus:border-red-300 shadow-[0_0_0_1px_rgba(248,113,113,0.4)]"
      : "border-white/15 focus:border-[#6BFFFF]";

  const usernameSuggestions =
    usernameStatus === "taken" ? buildUsernameSuggestions(usernameClean || watchBusinessName) : [];

  const handleRankingAnswer = (value: "yes" | "no") => {
    setRankingAnswer(value);
    if (value === "yes") setImpactAnswer(null);
  };

  const handleNextStep = async () => {
    if (activeStep === 0) {
      const valid = await form.trigger("organizationCategory");
      if (valid) setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      setActiveStep(2);
    }
  };

  const handleBackStep = () => {
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  if (!isLoaded) {
    return (
      <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-3xl border border-white/8 bg-white/[0.04] p-8 md:p-9 lg:p-10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/6 via-transparent to-[#6BFFFF]/8" />
        <div className="relative grid gap-8 md:grid-cols-2">
          <div className="space-y-4 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="h-6 w-3/4 rounded bg-white/10" />
            <div className="space-y-3 pt-2">
              <div className="h-20 rounded-2xl bg-white/5" />
              <div className="h-20 rounded-2xl bg-white/5" />
              <div className="h-20 rounded-2xl bg-white/5" />
            </div>
            <div className="h-16 rounded-2xl bg-white/5" />
            <div className="h-10 w-1/2 rounded-full bg-white/5" />
          </div>
          <div className="space-y-4 animate-pulse">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-white/5" />
              ))}
            </div>
            <div className="h-24 rounded-2xl bg-white/5" />
            <div className="h-12 rounded-full bg-white/10" />
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] text-white/55">A preparar o teu espaço na ORYA…</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-3xl border border-white/8 bg-white/[0.04] p-8 md:p-9 lg:p-10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradientOverlay}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(107,255,255,0.04),transparent_40%)]" />

      <div className="relative grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-white/10 bg-black/30 p-6 md:p-7 lg:p-8 backdrop-blur"
        >
          {error && (
            <div className="rounded-2xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100">
              {success}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/60">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] text-white/70">
                Onboarding
              </span>
              <span>
                Passo {activeStep + 1} de {stepLabels.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {stepLabels.map((label, idx) => (
                <span
                  key={label}
                  className={`h-1.5 w-8 rounded-full ${idx <= activeStep ? "bg-white" : "bg-white/20"}`}
                />
              ))}
            </div>
          </div>

          {activeStep === 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Categoria</p>
                <h3 className="text-xl font-semibold">Onde a tua organização brilha</h3>
                <p className="text-sm text-white/70">
                  Duas perguntas rápidas para sugerir a categoria certa para ti.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Organizas torneios com ranking?</p>
                  <p className="text-[12px] text-white/60">Ideal para ligas, clubes e circuitos oficiais.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRankingAnswer("yes")}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                        rankingAnswer === "yes"
                          ? "border-[#6BFFFF] bg-[#6BFFFF]/15 text-white"
                          : "border-white/15 bg-black/30 text-white/70 hover:border-white/30"
                      }`}
                    >
                      Sim, com ranking
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRankingAnswer("no")}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                        rankingAnswer === "no"
                          ? "border-[#6BFFFF] bg-[#6BFFFF]/15 text-white"
                          : "border-white/15 bg-black/30 text-white/70 hover:border-white/30"
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                {rankingAnswer === "no" && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">Fazes ações com missão/impacto?</p>
                    <p className="text-[12px] text-white/60">
                      Ex.: iniciativas sociais, ambientais ou comunitárias.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setImpactAnswer("yes")}
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                          impactAnswer === "yes"
                            ? "border-[#6BFFFF] bg-[#6BFFFF]/15 text-white"
                            : "border-white/15 bg-black/30 text-white/70 hover:border-white/30"
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setImpactAnswer("no")}
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                          impactAnswer === "no"
                            ? "border-[#6BFFFF] bg-[#6BFFFF]/15 text-white"
                            : "border-white/15 bg-black/30 text-white/70 hover:border-white/30"
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/60">
                  <span>Categoria principal</span>
                  {suggestedCategory && <span className="normal-case text-white/60">Sugestão pronta</span>}
                </div>
                <Controller
                  name="organizationCategory"
                  control={form.control}
                  render={({ field }) => (
                    <div className="grid gap-3 md:grid-cols-3">
                      {ORGANIZATION_CATEGORY_OPTIONS.map((category) => {
                        const isSelected = field.value === category.key;
                        const isSuggested = suggestedCategory === category.key;
                        return (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => {
                              setCategoryTouched(true);
                              field.onChange(category.key);
                            }}
                            aria-pressed={isSelected}
                            className={`group rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? "border-[#6BFFFF]/70 bg-[#6BFFFF]/10 shadow-[0_12px_35px_rgba(107,255,255,0.12)]"
                                : "border-white/12 bg-black/30 hover:border-white/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-white">{category.label}</p>
                                <p className="text-[12px] text-white/65">{category.headline}</p>
                              </div>
                              {isSuggested && (
                                <span className="rounded-full border border-[#6BFFFF]/40 bg-[#6BFFFF]/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/85">
                                  Sugerido
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-[12px] text-white/55">{category.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
                {form.formState.errors.organizationCategory && (
                  <p className="text-[12px] text-red-300">
                    {form.formState.errors.organizationCategory.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Módulos</p>
                <h3 className="text-xl font-semibold">Ativa o que precisas agora</h3>
                <p className="text-sm text-white/70">
                  Começa com inscrições e ajusta quando a tua equipa estiver pronta.
                </p>
              </div>

              <Controller
                name="modules"
                control={form.control}
                render={({ field }) => {
                  const currentModules = Array.isArray(field.value) ? field.value : [];
                  return (
                    <div className="space-y-4">
                      {MODULE_OPTIONS.map((module) => {
                        const isEnabled = currentModules.includes(module.key);
                        const nextModules = isEnabled
                          ? currentModules.filter((item) => item !== module.key)
                          : [...currentModules, module.key];
                        return (
                          <div key={module.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-white">{module.label}</p>
                                <p className="text-[12px] text-white/65">{module.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => field.onChange(nextModules)}
                                aria-pressed={isEnabled}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                                  isEnabled
                                    ? "border-emerald-300/60 bg-emerald-400/20"
                                    : "border-white/15 bg-white/5"
                                }`}
                              >
                                <span
                                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                                    isEnabled ? "translate-x-6" : ""
                                  }`}
                                />
                                <span className="sr-only">
                                  {isEnabled ? "Desativar inscrições" : "Ativar inscrições"}
                                </span>
                              </button>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-[11px] text-white/60">
                              <span className={`h-2 w-2 rounded-full ${isEnabled ? "bg-emerald-300" : "bg-white/30"}`} />
                              <span>
                                {isEnabled
                                  ? "Inscrições ativas no teu painel."
                                  : "Inscrições desligadas, podes ativar depois."}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/70">
                O módulo de inscrições controla páginas públicas, formulários e pagamentos. Podes mudar isto mais
                tarde, sem impacto nos teus dados.
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Dados</p>
                <h3 className="text-xl font-semibold">Detalhes da tua organização</h3>
                <p className="text-sm text-white/70">
                  Estes dados alimentam o teu perfil público e o painel de organização.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-[12px] text-white/70">
                    <span>Tipo de entidade *</span>
                    <InfoTooltip text="Escolhe se és promotor de eventos, empresa/marca ou outro tipo de organização que cria eventos." />
                  </div>
                  <Controller
                    name="entityType"
                    control={form.control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF] ${
                          form.formState.errors.entityType ? "border-red-400/60" : "border-white/15"
                        }`}
                      >
                        <option value="">Seleciona</option>
                        <option value="PROMOTOR_ORGANIZADOR">Promotor / Organizador</option>
                        <option value="EMPRESA_MARCA">Empresa ou marca</option>
                        <option value="OUTRO">Outro tipo de organização</option>
                      </select>
                    )}
                  />
                  {form.formState.errors.entityType && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.entityType.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">Nome da organização *</label>
                  <Controller
                    name="businessName"
                    control={form.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF] ${
                          form.formState.errors.businessName ? "border-red-400/60" : "border-white/15"
                        }`}
                        placeholder="Nome da organização"
                      />
                    )}
                  />
                  {form.formState.errors.businessName && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.businessName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-[12px] text-white/75">
                    <span>Username ORYA *</span>
                    <InfoTooltip text="Este será o @ da tua marca na ORYA. Vai aparecer no teu perfil, nos eventos e nos links públicos." />
                  </div>
                  <Controller
                    name="username"
                    control={form.control}
                    render={({ field }) => (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/50">
                          @
                        </span>
                        <input
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const cleaned = sanitizeUsername(e.target.value);
                            field.onChange(cleaned);
                            const validation = validateUsername(cleaned);
                            setUsernameHelper(validation.valid ? USERNAME_HELPER : validation.error);
                            setUsernameStatus("idle");
                          }}
                          onBlur={(e) => checkUsername(e.target.value)}
                          className={`w-full rounded-xl border bg-black/40 px-3 py-2 pl-7 text-sm outline-none transition ${usernameBorderClass}`}
                          maxLength={30}
                          placeholder="O teu username"
                        />
                      </div>
                    )}
                  />
                  <p className={`text-[11px] leading-relaxed ${usernameMessageClass}`}>{usernameHelper}</p>
                  {usernameSuggestions.length > 0 && (
                    <div className="text-[11px] text-white/65">
                      Sugestões:{" "}
                      {usernameSuggestions.map((sug, idx) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => form.setValue("username", sanitizeUsername(sug), { shouldValidate: true })}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition hover:border-white/25 hover:bg-white/10"
                        >
                          @{sug}
                          {idx < usernameSuggestions.length - 1 ? " " : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.formState.errors.username && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">Cidade base *</label>
                  <Controller
                    name="city"
                    control={form.control}
                    render={({ field }) => (
                      <div className="relative">
                        <select
                          {...field}
                          className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF] ${
                            form.formState.errors.city ? "border-red-400/60" : "border-white/15"
                          }`}
                        >
                          <option value="">Seleciona uma cidade</option>
                          {cityOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {!field.value && (
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] uppercase tracking-[0.18em] text-white/40">
                            PT
                          </span>
                        )}
                      </div>
                    )}
                  />
                  {form.formState.errors.city && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">Website (opcional)</label>
                  <Controller
                    name="website"
                    control={form.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        value={field.value ?? ""}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF]"
                        placeholder="ex: https://orya.pt"
                        autoCapitalize="none"
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                  {form.formState.errors.website && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.website.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Payouts (opcional)</p>
                    <InfoTooltip text="Usamos este IBAN para enviar os pagamentos dos teus eventos. Podes adicionar ou alterar mais tarde nas Definições." />
                  </div>
                  <h3 className="text-lg font-medium">Prepara os pagamentos</h3>
                  <p className="text-[12px] text-white/65">
                    Liga os teus dados de pagamento para receberes o dinheiro dos teus eventos. Se preferires, podes
                    completar esta parte mais tarde nas Definições.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">IBAN para pagamentos (opcional)</label>
                  <Controller
                    name="iban"
                    control={form.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\s+/g, "").toUpperCase();
                          const withSpaces = raw.replace(/(.{4})/g, "$1 ").trim();
                          field.onChange(withSpaces);
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF] uppercase"
                        placeholder="PT50 0000 0000 0000 0000 0000 0"
                      />
                    )}
                  />
                  {form.formState.errors.iban && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.iban.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">NIF para faturação (opcional)</label>
                  <Controller
                    name="taxId"
                    control={form.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        value={field.value || ""}
                        inputMode="numeric"
                        maxLength={9}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                          field.onChange(digits);
                        }}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF]"
                        placeholder="123456789"
                      />
                    )}
                  />
                  {form.formState.errors.taxId && (
                    <p className="text-[12px] text-red-300">{form.formState.errors.taxId.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {activeStep > 0 ? (
              <button
                type="button"
                onClick={handleBackStep}
                className="text-sm text-white/60 underline-offset-4 transition hover:text-white hover:underline"
              >
                Voltar
              </button>
            ) : (
              <span />
            )}
            {activeStep < stepLabels.length - 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-sm font-semibold text-black shadow transition focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/50 sm:w-auto"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-sm font-semibold text-black shadow transition focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/50 sm:w-auto ${
                  isFormValid
                    ? "hover:brightness-110 shadow-[0_0_30px_rgba(107,255,255,0.22)] animate-[pulse_2.8s_ease-in-out_infinite]"
                    : "opacity-60"
                }`}
              >
                {saving ? "A criar organização…" : "Criar organização"}
              </button>
            )}
          </div>
        </form>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-5 text-sm text-white/85 shadow-[0_14px_45px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Resumo</p>
            <div className="mt-4 flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${avatarColor} font-semibold text-black`}
              >
                {avatarInitials}
              </div>
              <div className="space-y-0.5">
                <p className="text-base font-semibold text-white">
                  {watchBusinessName || "Nome da tua organização"}
                </p>
                <p className="text-[12px] text-white/70">@{usernameClean || "teuusername"}</p>
                <p className="text-[12px] text-white/60">{watchCity || "Cidade"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-[12px] text-white/70">
              <div className="flex items-center justify-between">
                <span>Categoria</span>
                <span className="font-semibold text-white">{selectedCategoryLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Módulos</span>
                <span className="font-semibold text-white">{modulesLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tipo de entidade</span>
                <span className="font-semibold text-white">
                  {watchEntityType
                    ? watchEntityType === "PROMOTOR_ORGANIZADOR"
                      ? "Promotor / Organizador"
                      : watchEntityType === "EMPRESA_MARCA"
                      ? "Empresa ou marca"
                      : "Outro tipo de organização"
                    : "Por definir"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm text-white/80">
            <div className="space-y-1.5">
              <p className="text-[12px] uppercase tracking-[0.22em] text-white/60">O que desbloqueias</p>
              <h3 className="text-lg font-semibold text-white">Painel pronto para crescer contigo</h3>
            </div>

            <div className="space-y-3">
              {[
                {
                  title: "Gestão inteligente",
                  desc: "Bilhetes, inscrições e comunicação num só lugar, com menos fricção.",
                  icon: "✨",
                },
                {
                  title: "Equipa alinhada",
                  desc: "Atribui acessos, acompanha tarefas e mantém toda a equipa sincronizada.",
                  icon: "🧭",
                },
                {
                  title: "Visão em tempo real",
                  desc: "Vendas, inscrições e impacto com dashboards claros e acionáveis.",
                  icon: "📈",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="group flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:shadow-[0_14px_45px_rgba(0,0,0,0.45)]"
                >
                  <div className="mt-0.5 text-lg transition-transform duration-150 group-hover:scale-105">
                    {item.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="leading-relaxed text-white/70">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/70 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              Podes ajustar categoria e módulos sempre que precisares, sem perder histórico.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
