"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import { ModuleIcon } from "@/app/organizacao/moduleIcons";
import {
  DEFAULT_PRIMARY_MODULE,
  getDefaultOrganizationModules,
  type OperationModule,
  type OrganizationModule,
} from "@/lib/organizationCategories";
import {
  BecomeOrganizationFormValues,
  becomeOrganizationSchema,
} from "@/lib/validation/organization";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

const USERNAME_HELPER =
  "O teu @ é único na ORYA e vai aparecer no teu perfil, eventos e links. 3-15 caracteres.";

const suggestionSuffixes = ["events", "official", "pt", "live", "club", "hq"];

const OPERATION_META: Record<
  OperationModule,
  { label: string; headline: string; description: string }
> = {
  EVENTOS: {
    label: "Eventos",
    headline: "Bilhetes, check-in e público num só lugar.",
    description: "Ideal para lançamentos, workshops, encontros e eventos com bilhetes.",
  },
  TORNEIOS: {
    label: "Padel",
    headline: "Jogos, pares e categorias num só lugar.",
    description: "Ideal para clubes e ligas com organização competitiva simples.",
  },
  RESERVAS: {
    label: "Reservas",
    headline: "Agenda, disponibilidade e confirmações num só fluxo.",
    description: "Ideal para espaços e serviços que precisam de marcações e slots.",
  },
};

const OPERATION_OPTIONS = [
  {
    key: "EVENTOS",
    label: OPERATION_META.EVENTOS.label,
    headline: OPERATION_META.EVENTOS.headline,
    description: OPERATION_META.EVENTOS.description,
  },
  {
    key: "TORNEIOS",
    label: OPERATION_META.TORNEIOS.label,
    headline: OPERATION_META.TORNEIOS.headline,
    description: OPERATION_META.TORNEIOS.description,
  },
  {
    key: "RESERVAS",
    label: OPERATION_META.RESERVAS.label,
    headline: OPERATION_META.RESERVAS.headline,
    description: OPERATION_META.RESERVAS.description,
  },
] as const;

const OPTIONAL_MODULES = ["INSCRICOES", "MENSAGENS", "LOJA"] as const;
type OptionalModule = (typeof OPTIONAL_MODULES)[number];

const MODULE_META: Record<OptionalModule, { label: string; description: string }> = {
  INSCRICOES: {
    label: "Formulários públicos",
    description: "Inscrições, lugares e pagamentos num só fluxo.",
  },
  MENSAGENS: {
    label: "Mensagens",
    description: "Mensagens e automações para participantes.",
  },
  LOJA: {
    label: "Loja",
    description: "Produtos físicos e digitais com carrinho e checkout.",
  },
};

const MODULE_OPTIONS = OPTIONAL_MODULES.map((key) => ({
  key,
  ...MODULE_META[key],
}));

const STORAGE_KEY = "orya_org_onboarding_state_v1";

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

const TypingText = ({
  text,
  speed = 24,
  className,
  showCaret = true,
}: {
  text: string;
  speed?: number;
  className?: string;
  showCaret?: boolean;
}) => {
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    let index = 0;
    setDisplayed("");
    setTyping(true);
    const interval = setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setTyping(false);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <div className={className}>
      <span>{displayed}</span>
      {showCaret && (
        <span
          className={`ml-1 inline-block h-5 w-0.5 align-middle typing-caret ${
            typing ? "typing-caret-active" : ""
          }`}
        />
      )}
    </div>
  );
};

function buildUsernameSuggestions(base: string) {
  if (!base) return [];
  const cleaned = sanitizeUsername(base);
  const suggestions = suggestionSuffixes
    .map((suffix) => sanitizeUsername(`${cleaned}${suffix.length ? `-${suffix}` : ""}`))
    .filter(Boolean);

  const unique: string[] = [];
  suggestions.forEach((s) => {
    if (s && !unique.includes(s) && s !== cleaned && s.length <= 15) unique.push(s);
  });
  return unique.slice(0, 3);
}

export default function BecomeOrganizationForm() {
  const router = useRouter();
  const [usernameHelper, setUsernameHelper] = useState(USERNAME_HELPER);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastChecked = useRef<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [navDirection, setNavDirection] = useState<"forward" | "back">("forward");
  const [showBuildScreen, setShowBuildScreen] = useState(false);
  const [selectedOperations, setSelectedOperations] = useState<OperationModule[]>([]);
  const [optionalSelection, setOptionalSelection] = useState<OptionalModule[]>([]);
  const buildTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef(true);

  const form = useForm<BecomeOrganizationFormValues>({
    resolver: zodResolver(becomeOrganizationSchema),
    mode: "onChange",
    defaultValues: {
      primaryModule: DEFAULT_PRIMARY_MODULE,
      modules: getDefaultOrganizationModules(DEFAULT_PRIMARY_MODULE),
      businessName: "",
      username: "",
    },
  });

  const watchBusinessName = form.watch("businessName");
  const watchUsername = form.watch("username");

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      isRestoringRef.current = false;
      return;
    }
    try {
      const parsed = JSON.parse(stored) as {
        step?: number;
        selectedOperations?: string[];
        optionalSelection?: string[];
        businessName?: string;
        username?: string;
        usernameTouched?: boolean;
      };
      const step =
        typeof parsed.step === "number" && Number.isFinite(parsed.step)
          ? Math.min(3, Math.max(0, parsed.step))
          : null;
      const allowedOperations = new Set(OPERATION_OPTIONS.map((option) => option.key));
      const allowedOptional = new Set(OPTIONAL_MODULES);
      const storedOperations = Array.isArray(parsed.selectedOperations)
        ? parsed.selectedOperations.filter((item) => allowedOperations.has(item as OperationModule))
        : [];
      const storedOptional = Array.isArray(parsed.optionalSelection)
        ? parsed.optionalSelection.filter((item) => allowedOptional.has(item as OptionalModule))
        : [];

      if (step !== null) setActiveStep(step);
      if (storedOperations.length > 0) {
        setSelectedOperations([storedOperations[0] as OperationModule]);
      }
      if (storedOptional.length > 0) {
        setOptionalSelection(storedOptional as OptionalModule[]);
      }
      if (typeof parsed.businessName === "string" && parsed.businessName.length > 0) {
        form.setValue("businessName", parsed.businessName, { shouldValidate: false });
      }
      if (typeof parsed.username === "string" && parsed.username.length > 0) {
        form.setValue("username", parsed.username, { shouldValidate: false });
        if (parsed.usernameTouched || parsed.username.length > 0) {
          setUsernameTouched(true);
        }
      }
    } catch {
      // Ignorar estado inválido
    } finally {
      isRestoringRef.current = false;
    }
  }, [form]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isRestoringRef.current) return;
    const payload = {
      step: activeStep,
      selectedOperations,
      optionalSelection,
      businessName: watchBusinessName,
      username: watchUsername,
      usernameTouched,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [activeStep, selectedOperations, optionalSelection, watchBusinessName, watchUsername, usernameTouched]);

  useEffect(() => {
    if (isRestoringRef.current) return;
    if (usernameTouched) return;
    const suggestion = sanitizeUsername(watchBusinessName);
    if (suggestion !== watchUsername) {
      form.setValue("username", suggestion, { shouldValidate: true, shouldDirty: true });
      setUsernameHelper(USERNAME_HELPER);
      setUsernameStatus("idle");
    }
  }, [watchBusinessName, watchUsername, usernameTouched, form]);

  useEffect(() => {
    return () => {
      if (buildTimerRef.current) clearTimeout(buildTimerRef.current);
    };
  }, []);

  const startBuildTransition = () => {
    setShowBuildScreen(true);
    if (buildTimerRef.current) clearTimeout(buildTimerRef.current);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    buildTimerRef.current = setTimeout(() => {
      router.replace("/organizacao?tab=overview&section=modulos");
    }, 7000);
  };

  const derivedPrimaryModule = useMemo<OperationModule>(
    () => selectedOperations[0] ?? DEFAULT_PRIMARY_MODULE,
    [selectedOperations],
  );

  useEffect(() => {
    form.setValue("primaryModule", derivedPrimaryModule, { shouldValidate: true });
  }, [form, derivedPrimaryModule]);

  useEffect(() => {
    const baseModules = getDefaultOrganizationModules(derivedPrimaryModule);
    const nextModules = Array.from(
      new Set<OrganizationModule>([...baseModules, ...selectedOperations, ...optionalSelection]),
    );
    form.setValue("modules", nextModules, { shouldValidate: true, shouldDirty: true });
  }, [form, derivedPrimaryModule, selectedOperations, optionalSelection]);

  const usernameClean = sanitizeUsername(watchUsername);
  const nextStepLabel = activeStep === 0 ? "Começar" : "Continuar";
  const stepAnimationClass =
    navDirection === "back" ? "wizard-step-in-left" : "wizard-step-in-right";

  const isFormValid =
    !saving &&
    form.formState.isValid &&
    validateUsername(usernameClean).valid &&
    selectedOperations.length > 0;

  const gradientOverlay = "from-white/6 via-transparent to-[#6BFFFF]/8";
  const stepGlowClass =
    [
      "bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.12),transparent_48%)]",
      "bg-[radial-gradient(circle_at_10%_20%,rgba(107,255,255,0.18),transparent_52%)]",
      "bg-[radial-gradient(circle_at_90%_18%,rgba(255,0,200,0.18),transparent_52%)]",
      "bg-[radial-gradient(circle_at_70%_20%,rgba(107,255,255,0.16),transparent_52%)]",
    ][activeStep] ?? "bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.12),transparent_48%)]";

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
      console.error("[organização/become] erro check username", err);
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
    if (selectedOperations.length === 0) {
      setError("Escolhe pelo menos um foco para a tua organização.");
      return;
    }
    const modulesPayload = Array.from(
      new Set<OrganizationModule>([
        ...getDefaultOrganizationModules(derivedPrimaryModule),
        ...selectedOperations,
        ...optionalSelection,
      ]),
    );

    setSaving(true);
    try {
      const res = await fetch("/api/organizacao/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryModule: derivedPrimaryModule,
          modules: modulesPayload,
          businessName: values.businessName.trim(),
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

      if (data?.organization?.id) {
        await fetch("/api/organizacao/organizations/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: data.organization.id }),
        });
      }
      setSaving(false);
      startBuildTransition();
    } catch (err) {
      console.error("[organização/become] erro:", err);
      setError("Erro inesperado ao criar organização.");
      setSaving(false);
    }
  });

  const showBusinessNameError = Boolean(
    form.formState.errors.businessName &&
      (form.formState.touchedFields.businessName ||
        form.formState.dirtyFields.businessName ||
        form.formState.isSubmitted),
  );
  const showUsernameError = Boolean(
    form.formState.errors.username &&
      (form.formState.touchedFields.username || usernameTouched || form.formState.isSubmitted),
  );

  const usernameMessageClass = (() => {
    if (usernameStatus === "available") return "text-emerald-300";
    if (usernameStatus === "taken" || usernameStatus === "error") return "text-red-300";
    if (usernameStatus === "checking") return "text-white/65";
    return "text-white/55";
  })();

  const usernameBorderClass =
    usernameStatus === "available"
      ? "border-emerald-300/60 focus:border-emerald-300/80 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
      : usernameStatus === "taken" || showUsernameError
      ? "border-red-400/70 focus:border-red-300 shadow-[0_0_0_1px_rgba(248,113,113,0.4)]"
      : "border-white/15 focus:border-[#6BFFFF]";

  const usernameSuggestions =
    usernameStatus === "taken" ? buildUsernameSuggestions(usernameClean || watchBusinessName) : [];

  const handleNextStep = async () => {
    setNavDirection("forward");
    if (activeStep === 0) {
      setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      if (selectedOperations.length === 0) {
        form.setError("primaryModule", { message: "Escolhe pelo menos uma operação." });
        return;
      }
      setActiveStep(2);
      return;
    }
    if (activeStep === 2) {
      setActiveStep(3);
    }
  };

  const handleBackStep = () => {
    setNavDirection("back");
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  if (!isLoaded) {
    return (
      <div className="relative mx-auto max-w-[880px] overflow-hidden rounded-3xl border border-white/8 bg-white/[0.04] p-8 md:p-9 lg:p-10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/6 via-transparent to-[#6BFFFF]/8" />
        <div className="relative space-y-4 animate-pulse">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-8 w-3/4 rounded bg-white/10" />
          <div className="space-y-3 pt-2">
            <div className="h-16 rounded-2xl bg-white/5" />
            <div className="h-16 rounded-2xl bg-white/5" />
          </div>
          <div className="h-20 rounded-2xl bg-white/5" />
          <div className="h-11 w-40 rounded-full bg-white/5" />
        </div>
        <p className="mt-4 text-center text-[12px] text-white/55">A preparar o teu espaço na ORYA…</p>
      </div>
    );
  }

  if (showBuildScreen) {
    return (
      <div className="relative mx-auto max-w-[880px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-10 text-center shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradientOverlay}`} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(107,255,255,0.08),transparent_40%)]" />
        <div className="relative flex min-h-[320px] flex-col items-center justify-center gap-4">
          <TypingText
            key="build-typing"
            text="Está tudo pronto."
            className="text-2xl font-semibold text-white md:text-3xl"
          />
          <p className="max-w-md text-sm text-white/70">
            Bem-vindo à ORYA. Entramos no teu painel dentro de alguns segundos.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#6BFFFF] animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-[#FF7AD1] animate-pulse [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-[#6A7BFF] animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-[12px] text-white/55">A preparar o painel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[880px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 md:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradientOverlay}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(107,255,255,0.05),transparent_45%)]" />
      <div key={`glow-${activeStep}`} className={`pointer-events-none absolute inset-0 onboarding-glow ${stepGlowClass}`} />

      <form onSubmit={handleSubmit} className="relative space-y-8">
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackStep}
            disabled={activeStep === 0}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition ${
              activeStep === 0
                ? "border-white/10 text-white/30"
                : "border-white/20 text-white/80 hover:bg-white/10"
            }`}
            aria-label="Voltar"
          >
            ←
          </button>
          <span className="text-[11px] uppercase tracking-[0.26em] text-white/50">Onboarding</span>
        </div>

        <div key={`step-${activeStep}`} className={stepAnimationClass}>
          {activeStep === 0 && (
            <div className="space-y-5">
              <TypingText
                key={`welcome-${activeStep}`}
                text="Bem-vindo à ORYA"
                className="text-2xl font-semibold text-white md:text-3xl"
              />
              <p className="text-sm text-white/70">Aqui montas o teu painel em minutos.</p>
              <div className="space-y-3 text-sm text-white/80">
                {[
                  "Gestão inteligente de bilhetes, inscrições e comunicação num só lugar.",
                  "Equipa alinhada: atribui acessos e mantém a equipa alinhada.",
                  "Vendas em tempo real num painel claro.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#6BFFFF]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="space-y-6">
              <TypingText
                key={`focus-${activeStep}`}
                text="Qual é o foco da tua organização?"
                className="text-2xl font-semibold text-white md:text-3xl"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {OPERATION_OPTIONS.map((option, index) => {
                  const isSelected = selectedOperations.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setSelectedOperations([option.key]);
                        form.clearErrors("primaryModule");
                      }}
                      aria-pressed={isSelected}
                      style={{ animationDelay: `${index * 70}ms` }}
                      className={`onboarding-card-in rounded-2xl border p-4 text-left transition-transform duration-150 active:scale-[0.98] hover:-translate-y-[1px] ${
                        isSelected
                          ? "border-[#6BFFFF]/70 bg-[#6BFFFF]/10 shadow-[0_18px_40px_rgba(107,255,255,0.14)] ring-1 ring-[#6BFFFF]/30"
                          : "border-white/12 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                            isSelected ? "border-[#6BFFFF]/50 bg-[#6BFFFF]/15" : "border-white/15 bg-white/5"
                          }`}
                        >
                          <ModuleIcon moduleKey={option.key} className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">{option.label}</p>
                          <p className="text-[12px] text-white/65">{option.headline}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {form.formState.errors.primaryModule && (
                <p className="text-[12px] text-red-300">
                  {form.formState.errors.primaryModule.message}
                </p>
              )}
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              <TypingText
                key={`modules-${activeStep}`}
                text="Queres ativar formulários públicos e mensagens?"
                className="text-2xl font-semibold text-white md:text-3xl"
              />
              <p className="text-sm text-white/65">Podes alterar isto mais tarde.</p>
            <div className="space-y-3">
              {MODULE_OPTIONS.map((module, index) => {
                const isEnabled = optionalSelection.includes(module.key);
                return (
                  <div
                    key={module.key}
                    style={{ animationDelay: `${index * 70}ms` }}
                    className={`onboarding-card-in flex flex-col gap-4 rounded-2xl border p-4 transition-transform duration-150 hover:-translate-y-[1px] sm:flex-row sm:items-center sm:justify-between ${
                      isEnabled
                        ? "border-[#6BFFFF]/50 bg-[#6BFFFF]/10 shadow-[0_16px_36px_rgba(107,255,255,0.12)] ring-1 ring-[#6BFFFF]/20"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">{module.label}</p>
                      <p className="text-[12px] text-white/65">{module.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOptionalSelection((prev) =>
                            prev.includes(module.key) ? prev : [...prev, module.key],
                          )
                        }
                        className={`btn-orya px-3 py-1 text-[11px] font-semibold ${
                          isEnabled ? "" : "opacity-75"
                        }`}
                      >
                        Ativar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOptionalSelection((prev) => prev.filter((item) => item !== module.key))
                        }
                        className="btn-ghost px-3 py-1 text-[11px] font-semibold"
                      >
                        Agora não
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-6">
              <TypingText
                key={`identity-${activeStep}`}
                text="Qual é o nome da tua organização?"
                className="text-2xl font-semibold text-white md:text-3xl"
              />
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">Nome da organização *</label>
                  <Controller
                    name="businessName"
                    control={form.control}
                  render={({ field }) => (
                    <input
                      {...field}
                      className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF] ${
                        showBusinessNameError ? "border-red-400/60" : "border-white/15"
                      }`}
                      placeholder="Nome da organização"
                    />
                  )}
                />
                {showBusinessNameError && (
                  <p className="text-[12px] text-red-300">{form.formState.errors.businessName?.message}</p>
                )}
              </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-[12px] text-white/75">
                    <span>Username ORYA *</span>
                    <InfoTooltip text="Este é o teu @ público e aparece nos links." />
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
                            setUsernameTouched(true);
                            const cleaned = sanitizeUsername(e.target.value);
                            field.onChange(cleaned);
                            const validation = validateUsername(cleaned);
                            setUsernameHelper(validation.valid ? USERNAME_HELPER : validation.error);
                            setUsernameStatus("idle");
                          }}
                          onBlur={(e) => checkUsername(e.target.value)}
                          className={`w-full rounded-xl border bg-black/40 px-3 py-2 pl-7 text-sm outline-none transition ${usernameBorderClass}`}
                          maxLength={15}
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
                          onClick={() => {
                            setUsernameTouched(true);
                            form.setValue("username", sanitizeUsername(sug), { shouldValidate: true });
                          }}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition hover:border-white/25 hover:bg-white/10"
                        >
                          @{sug}
                          {idx < usernameSuggestions.length - 1 ? " " : ""}
                        </button>
                      ))}
                    </div>
                  )}
                {showUsernameError && (
                  <p className="text-[12px] text-red-300">{form.formState.errors.username?.message}</p>
                )}
              </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end pt-2">
          {activeStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="btn-orya px-6 py-2.5 text-sm font-semibold"
            >
              {nextStepLabel}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!isFormValid}
              className="btn-orya px-6 py-2.5 text-sm font-semibold"
            >
              {saving ? "A criar organização…" : "Criar organização"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
