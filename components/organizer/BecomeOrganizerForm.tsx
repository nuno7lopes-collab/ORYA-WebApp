"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sanitizeUsername, validateUsername } from "@/lib/username";
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
  const formId = "become-organizer-form";
  const router = useRouter();
  const [usernameHelper, setUsernameHelper] = useState(USERNAME_HELPER);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastChecked = useRef<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  const form = useForm<BecomeOrganizerFormValues>({
    resolver: zodResolver(becomeOrganizerSchema),
    mode: "onChange",
    defaultValues: {
      entityType: "",
      businessName: "",
      city: "",
      website: "",
      iban: "",
      taxId: "",
      username: "",
    },
  });

  const watchEntityType = form.watch("entityType");
  const watchBusinessName = form.watch("businessName");
  const watchCity = form.watch("city");
  const watchUsername = form.watch("username");

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 200);
    return () => clearTimeout(t);
  }, []);

  const avatarSeed = watchUsername || watchBusinessName || "orya";
  const avatarColor = badgeColors[hashToIndex(avatarSeed, badgeColors.length)];
  const avatarInitials = initialsFromName(watchBusinessName || "Organização");
  const usernameClean = sanitizeUsername(watchUsername);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (values.website.startsWith("@")) return values.website;
      return /^https?:\/\//i.test(values.website) ? values.website : `https://${values.website}`;
    })();

    setSaving(true);
    try {
      const res = await fetch("/api/organizador/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: values.entityType.trim(),
          businessName: values.businessName.trim(),
          city: values.city.trim(),
          website: normalizedWebsite,
          payoutIban: values.iban ? values.iban.replace(/\s+/g, "") : null,
          nif: values.taxId || null,
          displayName: values.businessName.trim(),
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

      <div className="relative grid items-start gap-y-10 md:grid-cols-2 md:gap-x-28 lg:gap-x-32">
        <div className="pointer-events-none absolute inset-y-8 left-1/2 hidden w-14 -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-white/10 to-transparent md:block" />
        {/* Coluna ESQUERDA – formulário completo */}
        <div className="order-1 md:order-1 md:pr-10 lg:pr-12">
          <form
            id={formId}
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

            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/65">Dados da organização</p>
                <h3 className="text-lg font-semibold">Informação base</h3>
              </div>
              <p className="text-[11px] text-white/55 leading-relaxed text-right">
                Campos marcados com * são obrigatórios.
              </p>
            </div>

            <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[12px] text-white/70">
                <span>Tipo de entidade *</span>
                <InfoTooltip text="Escolhe se és promotor de eventos, empresa/marca ou outro tipo de organização que cria experiências." />
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
                  <input
                    {...field}
                    className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF] ${
                      form.formState.errors.city ? "border-red-400/60" : "border-white/15"
                    }`}
                    placeholder="Cidade base"
                  />
                )}
              />
              {form.formState.errors.city && (
                <p className="text-[12px] text-red-300">{form.formState.errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Website ou Instagram (opcional)</label>
              <Controller
                name="website"
                control={form.control}
                render={({ field }) => (
                  <input
                    {...field}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-[#6BFFFF]"
                    placeholder="ex: orya.pt ou @orya.app"
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

            <div className="space-y-4 border-t border-white/10 pt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Payouts (opcional)</p>
                  <InfoTooltip text="Usamos este IBAN para enviar os pagamentos dos teus eventos. Podes adicionar ou alterar mais tarde nas Definições." />
                </div>
                <h3 className="text-lg font-medium">Prepara os pagamentos</h3>
                <p className="text-[12px] text-white/65">
                  Liga os teus dados de pagamento para começares a receber o dinheiro dos teus eventos. Se preferires, podes completar esta parte mais tarde nas Definições.
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
          </form>
        </div>

        {/* Coluna DIREITA – benefícios, preview e CTA */}
        <div className="order-2 space-y-8 md:order-2 md:pl-10 lg:pl-12 md:pt-1">
          <div className="space-y-6 text-sm text-white/80">
            <div className="space-y-1.5">
              <p className="text-[12px] uppercase tracking-[0.22em] text-white/60">O que ganhas</p>
              <h3 className="text-xl font-semibold">O que ganhas ao criar a tua organização</h3>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Vendas & pagamentos",
                  desc: "Vende bilhetes online, vê as vendas em tempo real e liga facilmente os teus payouts.",
                  icon: "💳",
                },
                {
                  title: "Equipa & acessos",
                  desc: "Convida staff para gerir eventos, check-in e finanças com diferentes níveis de acesso.",
                  icon: "🧑‍🤝‍🧑",
                },
                {
                  title: "Controlo & transparência",
                  desc: "Acompanha receitas, reembolsos e estatísticas de cada evento num só painel.",
                  icon: "📊",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="group flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:shadow-[0_14px_45px_rgba(0,0,0,0.45)]"
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

            <div className="space-y-2 max-w-[65ch]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                Funciona para qualquer organização que cria eventos ou experiências — clubes, associações, marcas,
                equipas de desporto, projectos independentes e muito mais.
              </div>
              <p className="text-[12px] text-white/45">
                Podes alterar todos os dados da organização mais tarde nas Definições.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/8 bg-white/5 p-5 text-sm text-white/85 shadow-[0_14px_45px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3">
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
                <p className="text-[12px] text-white/60">
                  {watchCity || "Cidade"} ·{" "}
                  {watchEntityType
                    ? watchEntityType === "PROMOTOR_ORGANIZADOR"
                      ? "Promotor / Organizador"
                      : watchEntityType === "EMPRESA_MARCA"
                      ? "Empresa ou marca"
                      : "Outro tipo de organização"
                    : "Tipo de entidade"}
                </p>
                <p className="text-[12px] text-white/55">orya.pt/{usernameClean || "teuusername"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5/20 p-4 text-sm text-white/75 shadow-[0_10px_35px_rgba(0,0,0,0.35)] md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
            <p className="text-[12px] text-white/70">
              A seguir: criar o teu primeiro evento · convidar a tua equipa · ativar pagamentos
            </p>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:gap-4">
              <Link
                href="/organizador/(dashboard)/organizations"
                className="text-sm text-white/75 underline-offset-4 transition hover:text-white hover:underline"
              >
                Já tens uma organização? Ver lista
              </Link>
              <button
                form={formId}
                type="submit"
                disabled={!isFormValid}
                className={`w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-sm font-semibold text-black shadow transition focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/50 md:w-auto ${
                  isFormValid
                    ? "hover:brightness-110 shadow-[0_0_30px_rgba(107,255,255,0.22)] animate-[pulse_2.8s_ease-in-out_infinite]"
                    : "opacity-60"
                }`}
              >
                {saving ? "A criar organização…" : "Começar a organizar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
