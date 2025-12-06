"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { isValidPhone, sanitizePhone } from "@/lib/phone";

type OrganizerMeResponse = {
  ok: boolean;
  organizer: {
    id: number;
    displayName: string | null;
    businessName: string | null;
    entityType: string | null;
    city: string | null;
    payoutIban: string | null;
  } | null;
  profile: {
    fullName: string | null;
    city: string | null;
    contactPhone?: string | null;
  } | null;
  contactEmail?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OrganizerSettingsPage() {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, isLoading, mutate } = useSWR<OrganizerMeResponse>(user ? "/api/organizador/me" : null, fetcher, {
    revalidateOnFocus: false,
  });

  const organizer = data?.organizer ?? null;
  const profile = data?.profile ?? null;
  const contactEmailFromAccount = data?.contactEmail ?? null;

  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [city, setCity] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [payoutIban, setPayoutIban] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [prefLanguage, setPrefLanguage] = useState("pt");
  const [prefNotifications, setPrefNotifications] = useState(true);
  const [prefPublicListing, setPrefPublicListing] = useState(true);

  useEffect(() => {
    if (!organizer) return;
    setDisplayName(organizer.displayName ?? "");
    setBusinessName(organizer.businessName ?? "");
    setEntityType(organizer.entityType ?? "");
    setCity(organizer.city ?? profile?.city ?? "");
    setPayoutIban(organizer.payoutIban ?? "");
    if (profile?.contactPhone) setContactPhone(profile.contactPhone);
    if (contactEmailFromAccount) setContactEmail(contactEmailFromAccount);
  }, [organizer, profile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("organizadorSettingsPref");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        prefLanguage?: string;
        prefNotifications?: boolean;
        prefPublicListing?: boolean;
        contactEmail?: string;
      };
      if (parsed.prefLanguage) setPrefLanguage(parsed.prefLanguage);
      if (typeof parsed.prefNotifications === "boolean") setPrefNotifications(parsed.prefNotifications);
      if (typeof parsed.prefPublicListing === "boolean") setPrefPublicListing(parsed.prefPublicListing);
      if (parsed.contactEmail) setContactEmail(parsed.contactEmail);
    } catch {
      // ignore
    }
  }, []);

  const hasOrganizer = useMemo(() => organizer && data?.ok, [organizer, data]);

  async function handleSave() {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizador/settings", showGoogle: true });
      return;
    }
    if (contactPhone && !isValidPhone(contactPhone)) {
      setPhoneError("Telefone inválido. Introduz um número válido (podes incluir indicativo, ex.: +351...).");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          businessName,
          entityType,
          city,
          payoutIban,
          fullName: profile?.fullName ?? displayName,
          contactPhone,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setMessage(json?.error || "Não foi possível guardar as definições.");
      } else {
        setMessage("Definições guardadas.");
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] save", err);
      setMessage("Erro inesperado ao guardar.");
    } finally {
      setSaving(false);
      if (typeof window !== "undefined") {
        const pref = { prefLanguage, prefNotifications, prefPublicListing, contactEmail };
        window.localStorage.setItem("organizadorSettingsPref", JSON.stringify(pref));
      }
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-4 text-white md:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Definições do organizador</h1>
        <p>Precisas de iniciar sessão para aceder a estas definições.</p>
        <button
          type="button"
          onClick={() => openModal({ mode: "login", redirectTo: "/organizador/settings", showGoogle: true })}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (isLoading || !hasOrganizer) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-white md:px-6 lg:px-8">
        {isLoading ? "A carregar definições…" : "Ativa a conta de organizador para gerir estas definições."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6 text-white md:px-6 lg:px-8">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Definições</p>
        <h1 className="text-3xl font-semibold">Perfil do organizador</h1>
        <p className="text-sm text-white/65">Dados públicos, faturação e preferências de comunicação.</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dados públicos</h2>
            <p className="text-[12px] text-white/65">Nome visível, localização e contactos públicos.</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
          >
            {saving ? "A guardar…" : "Guardar"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Tipo de entidade *</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            >
              <option value="">Seleciona</option>
              <option value="PESSOA_SINGULAR">Pessoa singular</option>
              <option value="EMPRESA">Empresa</option>
              <option value="ASSOCIACAO">Associação</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Nome do organizador *</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Ex.: Casa Guedes, ORYA TEAM"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Nome público (opcional)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Ex.: ORYA"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Cidade base *</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Lisboa, Porto..."
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Email de contacto *</label>
            <input
              value={contactEmail}
              readOnly
              className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white/80"
              placeholder="email@exemplo.pt"
            />
            <p className="text-[11px] text-white/50">Usamos o email da tua conta. Altera em /me/settings se precisares.</p>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Telefone (opcional)</label>
            <input
              value={contactPhone}
              onChange={(e) => {
                const sanitized = sanitizePhone(e.target.value);
                setContactPhone(sanitized);
                if (sanitized && !isValidPhone(sanitized)) {
                  setPhoneError("Telefone inválido. Introduz um número válido (podes incluir indicativo, ex.: +351...).");
                } else {
                  setPhoneError(null);
                }
              }}
              inputMode="tel"
              pattern="\\+?\\d{6,15}"
              maxLength={18}
              className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] ${
                phoneError ? "border-red-400/60" : "border-white/15"
              }`}
              placeholder="+351912345678"
            />
            {phoneError && <p className="text-[11px] text-red-300">{phoneError}</p>}
          </div>
        </div>
        {message && <p className="text-[12px] text-white/70">{message}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Branding (em breve)</h2>
            <p className="text-[12px] text-white/65">Logo e capa do organizador para todas as páginas públicas.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/70 cursor-not-allowed"
          >
            Upload em breve
          </button>
        </div>
        <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-white/60">
          Prepara o logo (PNG/SVG) e uma capa. Em breve poderás carregar aqui e propagar para os eventos.
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Preferências</h2>
            <p className="text-[12px] text-white/65">Idioma, notificações e visibilidade pública.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Idioma</label>
            <select
              value={prefLanguage}
              onChange={(e) => setPrefLanguage(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            >
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Notificações (email)</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefNotifications}
                onChange={(e) => setPrefNotifications(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-white/70">Receber alertas de vendas, payouts e promoções</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefPublicListing}
            onChange={(e) => setPrefPublicListing(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-white/70">Listar eventos publicamente na ORYA</span>
        </div>
        <p className="text-[11px] text-white/55">
          Estas preferências guardam localmente por agora. Próximo passo: ligar a API para refletir em emails e listagens públicas.
        </p>
      </section>
    </div>
  );
}
