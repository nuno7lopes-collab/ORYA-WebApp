"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { isValidPhone, sanitizePhone } from "@/lib/phone";
import { PORTUGAL_CITIES } from "@/config/cities";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { CTA_DANGER, CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizador/dashboardUi";

type OrganizerMeResponse = {
  ok: boolean;
  organizer: {
    id: number;
    publicName: string | null;
    username?: string | null;
    businessName: string | null;
    entityType: string | null;
    city: string | null;
    address?: string | null;
    showAddressPublicly?: boolean | null;
    payoutIban: string | null;
    language?: string | null;
    publicListingEnabled?: boolean | null;
    alertsEmail?: string | null;
    alertsSalesEnabled?: boolean | null;
    alertsPayoutEnabled?: boolean | null;
    brandingAvatarUrl?: string | null;
    brandingPrimaryColor?: string | null;
    brandingSecondaryColor?: string | null;
    organizationKind?: string | null;
    officialEmail?: string | null;
    officialEmailVerifiedAt?: string | null;
    publicWebsite?: string | null;
    publicDescription?: string | null;
    publicHours?: string | null;
    infoRules?: string | null;
    infoFaq?: string | null;
    infoRequirements?: string | null;
    infoPolicies?: string | null;
    infoLocationNotes?: string | null;
  } | null;
  profile: {
    fullName: string | null;
    city: string | null;
    contactPhone?: string | null;
  } | null;
  contactEmail?: string | null;
  membershipRole?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type OrganizerSettingsPageProps = {
  embedded?: boolean;
};

export default function OrganizerSettingsPage({ embedded }: OrganizerSettingsPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, isLoading, mutate } = useSWR<OrganizerMeResponse>(
    user ? "/api/organizador/me" : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const organizer = data?.organizer ?? null;
  const profile = data?.profile ?? null;
  const contactEmailFromAccount = data?.contactEmail ?? null;
  const redirectTo = embedded ? "/organizador?tab=manage&section=settings" : "/organizador/settings";

  const [organizationKind, setOrganizationKind] = useState("PESSOA_SINGULAR");
  const [entityName, setEntityName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [showAddressPublicly, setShowAddressPublicly] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [officialEmail, setOfficialEmail] = useState("");
  const [officialEmailMessage, setOfficialEmailMessage] = useState<string | null>(null);
  const [officialEmailSaving, setOfficialEmailSaving] = useState(false);

  const [brandingAvatarUrl, setBrandingAvatarUrl] = useState("");
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState("");
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState("");
  const [brandingUploading, setBrandingUploading] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  const [publicWebsite, setPublicWebsite] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [publicHours, setPublicHours] = useState("");
  const [infoRules, setInfoRules] = useState("");
  const [infoFaq, setInfoFaq] = useState("");
  const [infoRequirements, setInfoRequirements] = useState("");
  const [infoPolicies, setInfoPolicies] = useState("");
  const [infoLocationNotes, setInfoLocationNotes] = useState("");
  const [publicProfileMessage, setPublicProfileMessage] = useState<string | null>(null);
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);

  const [dangerConfirm, setDangerConfirm] = useState("");
  const [dangerFeedback, setDangerFeedback] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);

  useEffect(() => {
    if (!organizer) return;
    setOrganizationKind((organizer.organizationKind as string | null) ?? "PESSOA_SINGULAR");
    const name =
      organizer.publicName ||
      organizer.businessName ||
      profile?.fullName ||
      "";
    setEntityName(name);
    setPublicName(organizer.publicName || organizer.businessName || name);
    setCity(organizer.city ?? profile?.city ?? "");
    setAddress((organizer as { address?: string | null }).address ?? "");
    setShowAddressPublicly((organizer as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false);
    setContactEmail(contactEmailFromAccount ?? "");
    setOfficialEmail((organizer as { officialEmail?: string | null })?.officialEmail ?? contactEmailFromAccount ?? "");
    if (profile?.contactPhone) setContactPhone(profile.contactPhone);
    setBrandingAvatarUrl((organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? "");
    setBrandingPrimaryColor((organizer as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? "");
    setBrandingSecondaryColor((organizer as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? "");
    setUsername((organizer as { username?: string | null }).username ?? "");
    setPublicWebsite((organizer as { publicWebsite?: string | null }).publicWebsite ?? "");
    setPublicDescription((organizer as { publicDescription?: string | null }).publicDescription ?? "");
    setPublicHours((organizer as { publicHours?: string | null }).publicHours ?? "");
    setInfoRules((organizer as { infoRules?: string | null }).infoRules ?? "");
    setInfoFaq((organizer as { infoFaq?: string | null }).infoFaq ?? "");
    setInfoRequirements((organizer as { infoRequirements?: string | null }).infoRequirements ?? "");
    setInfoPolicies((organizer as { infoPolicies?: string | null }).infoPolicies ?? "");
    setInfoLocationNotes((organizer as { infoLocationNotes?: string | null }).infoLocationNotes ?? "");
  }, [organizer, profile, contactEmailFromAccount]);

  const hasOrganizer = useMemo(() => organizer && data?.ok, [organizer, data]);
  const membershipRole = data?.membershipRole ?? null;
  const isOwner = membershipRole === "OWNER";
  const dangerReady = dangerConfirm.trim().toUpperCase() === "APAGAR";
  const officialEmailVerifiedAt = organizer?.officialEmailVerifiedAt ? new Date(organizer.officialEmailVerifiedAt) : null;
  const officialEmailStatusLabel = officialEmailVerifiedAt
    ? `Verificado ${officialEmailVerifiedAt.toLocaleDateString()}`
    : organizer?.officialEmail
      ? "A aguardar verificação"
      : "Por definir";
  const officialEmailBadgeClass = officialEmailVerifiedAt
    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
    : organizer?.officialEmail
      ? "border-amber-300/50 bg-amber-500/10 text-amber-50"
      : "border-white/20 bg-white/5 text-white/70";

  async function handleSaveOrg() {
    if (!user) {
      openModal({ mode: "login", redirectTo, showGoogle: true });
      return;
    }
    if (!entityName.trim()) {
      setOrgMessage("Preenche o nome da organização.");
      return;
    }
    if (!city.trim()) {
      setOrgMessage("Indica a cidade base.");
      return;
    }
    if (contactPhone && !isValidPhone(contactPhone)) {
      setPhoneError("Telefone inválido. Introduz um número válido (podes incluir indicativo, ex.: +351...).");
      return;
    }
    setSavingOrg(true);
    setOrgMessage(null);
    try {
      const res = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: entityName,
          publicName,
          city,
          address,
          showAddressPublicly,
          contactPhone,
          fullName: profile?.fullName ?? entityName,
          organizationKind,
          entityType: organizationKind,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setOrgMessage(json?.error || "Não foi possível guardar as definições.");
      } else {
        setOrgMessage("Dados da organização guardados.");
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] save", err);
      setOrgMessage("Erro inesperado ao guardar.");
    } finally {
      setSavingOrg(false);
    }
  }

  const normalizePublicWebsite = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  async function handleSavePublicProfile() {
    if (!user) {
      openModal({ mode: "login", redirectTo, showGoogle: true });
      return;
    }
    setSavingPublicProfile(true);
    setPublicProfileMessage(null);
    try {
      const res = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicWebsite: publicWebsite ? normalizePublicWebsite(publicWebsite) : "",
          publicDescription,
          publicHours,
          infoRules,
          infoFaq,
          infoRequirements,
          infoPolicies,
          infoLocationNotes,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setPublicProfileMessage(json?.error || "Não foi possível guardar o perfil público.");
      } else {
        setPublicProfileMessage("Perfil público atualizado.");
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] save public profile", err);
      setPublicProfileMessage("Erro inesperado ao guardar.");
    } finally {
      setSavingPublicProfile(false);
    }
  }

  async function handleOfficialEmailUpdate() {
    if (!organizer?.id) {
      setOfficialEmailMessage("Seleciona uma organização primeiro.");
      return;
    }
    if (!isOwner) {
      setOfficialEmailMessage("Apenas o Owner pode alterar este email.");
      return;
    }
    if (!officialEmail.trim()) {
      setOfficialEmailMessage("Indica um email oficial válido.");
      return;
    }

    setOfficialEmailSaving(true);
    setOfficialEmailMessage(null);
    try {
      const res = await fetch("/api/organizador/organizations/settings/official-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: organizer.id, email: officialEmail.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setOfficialEmailMessage(json?.error || "Não foi possível iniciar a verificação.");
      } else {
        setOfficialEmailMessage("Pedido enviado. Verifica a caixa de email para confirmar.");
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] official-email", err);
      setOfficialEmailMessage("Erro inesperado ao enviar pedido.");
    } finally {
      setOfficialEmailSaving(false);
    }
  }

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setBrandingUploading(true);
    setBrandingMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadJson?.url) {
        setBrandingMessage(uploadJson?.error || "Falha no upload do logo.");
        return;
      }
      setBrandingAvatarUrl(uploadJson.url);
      const saveRes = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandingAvatarUrl: uploadJson.url }),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok || saveJson?.ok === false) {
        setBrandingMessage(saveJson?.error || "Não foi possível guardar o logo.");
      } else {
        setBrandingMessage("Logo atualizado.");
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] upload logo", err);
      setBrandingMessage("Erro inesperado ao fazer upload.");
    } finally {
      setBrandingUploading(false);
    }
  };

  const handleSaveBranding = async () => {
    setBrandingMessage(null);
    try {
      const res = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandingPrimaryColor,
          brandingSecondaryColor,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setBrandingMessage(json?.error || "Não foi possível guardar as cores.");
      } else {
        setBrandingMessage("Branding atualizado.");
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] branding", err);
      setBrandingMessage("Erro inesperado ao guardar branding.");
    }
  };

  const handleSaveUsername = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo, showGoogle: true });
      return;
    }
    setUsernameMessage(null);
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,}$/.test(normalized)) {
      setUsernameError("Usa apenas letras minúsculas, números e - ou _. Mínimo 3 caracteres.");
      return;
    }
    setUsernameError(null);
    setSavingUsername(true);
    try {
      const res = await fetch("/api/organizador/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setUsernameMessage(json?.error || "Não foi possível atualizar o username.");
      } else {
        setUsernameMessage("Username atualizado.");
        setUsername(normalized);
        mutate();
      }
    } catch (err) {
      console.error("[organizador/settings] username", err);
      setUsernameMessage("Erro inesperado ao atualizar username.");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organizer?.id) return;
    if (dangerConfirm.trim().toUpperCase() !== "APAGAR") {
      setDangerFeedback("Escreve APAGAR para confirmares.");
      return;
    }
    setDangerLoading(true);
    setDangerFeedback(null);
    try {
      const res = await fetch(`/api/organizador/organizations/${organizer.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setDangerFeedback(json?.error || "Não foi possível apagar a organização.");
      } else {
        setDangerFeedback("Organização apagada. Redirecionámos-te para gerir outras.");
        setDangerConfirm("");
        setDangerDialogOpen(false);
        router.push("/organizador/organizations");
      }
    } catch (err) {
      console.error("[organizador/settings] delete", err);
      setDangerFeedback("Erro inesperado ao apagar.");
    } finally {
      setDangerLoading(false);
    }
  };

  if (!user) {
    return (
      <div
        className={
          embedded
            ? "space-y-4 text-white"
            : "w-full px-4 py-8 space-y-4 text-white md:px-6 lg:px-10"
        }
      >
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
          <h1 className="text-2xl font-semibold">Definições do organizador</h1>
          <p className="text-white/70">Precisas de iniciar sessão para aceder a estas definições.</p>
          <button
            type="button"
            onClick={() => openModal({ mode: "login", redirectTo, showGoogle: true })}
            className={CTA_PRIMARY}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !hasOrganizer) {
    return (
      <div
        className={
          embedded ? "text-white" : "w-full px-4 py-8 text-white md:px-6 lg:px-10"
        }
      >
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {isLoading ? "A carregar definições…" : "Ativa a conta de organizador para gerir estas definições."}
        </div>
      </div>
    );
  }

  const wrapperClass = embedded
    ? "space-y-6 text-white"
    : "w-full px-4 py-8 space-y-6 text-white md:px-8 lg:px-10";

  return (
    <div className={wrapperClass}>
      <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-5 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_35%),linear-gradient(225deg,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
              Definições
            </div>
            <h1 className="text-3xl font-semibold drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">Perfil do organizador</h1>
            <p className="text-sm text-white/70">Identidade, branding e contactos públicos.</p>
          </div>
          {organizer?.username && (
            <a
              href={`/${organizer.username}`}
              target="_blank"
              rel="noreferrer"
              className={CTA_SECONDARY}
            >
              Ver página pública ↗
            </a>
          )}
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dados da organização</h2>
            <p className="text-[12px] text-white/65">Identidade pública, localização base e contactos.</p>
          </div>
          <button
            type="button"
            onClick={handleSaveOrg}
            disabled={savingOrg}
            className={`${CTA_PRIMARY} disabled:opacity-60`}
          >
            {savingOrg ? "A guardar…" : "Guardar"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Nome da organização / entidade *</label>
            <input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Ex.: Clube XPTO Padel"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Nome público (como os clientes te vêem) *</label>
            <input
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Ex.: XPTO Events"
            />
            <p className="text-[11px] text-white/55">Se deixares vazio, usamos o nome da organização.</p>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Cidade base *</label>
            <input
              list="pt-cities"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Porto, Lisboa..."
            />
            <datalist id="pt-cities">
              {PORTUGAL_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Morada (opcional)</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Rua e número"
            />
            <label className="mt-1 flex items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={showAddressPublicly}
                onChange={(e) => setShowAddressPublicly(e.target.checked)}
                className="h-4 w-4"
              />
              Mostrar morada na página pública
            </label>
          </div>
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
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Telefone de contacto (opcional)</label>
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
      {orgMessage && <p className="text-[12px] text-white/70">{orgMessage}</p>}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Perfil público</h2>
            <p className="text-[12px] text-white/65">Blocos de informação visíveis na página pública da organização.</p>
          </div>
          <button
            type="button"
            onClick={handleSavePublicProfile}
            disabled={savingPublicProfile}
            className={`${CTA_PRIMARY} disabled:opacity-60`}
          >
            {savingPublicProfile ? "A guardar…" : "Guardar perfil público"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Website (opcional)</label>
            <input
              value={publicWebsite}
              onChange={(e) => setPublicWebsite(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="ex: https://orya.pt"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Horários (opcional)</label>
            <input
              value={publicHours}
              onChange={(e) => setPublicHours(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Seg-Sex 09:00-18:00"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Descrição principal</label>
            <textarea
              value={publicDescription}
              onChange={(e) => setPublicDescription(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Explica o que é a tua organização e o que as pessoas podem esperar."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Como chegar / notas de localização</label>
            <textarea
              value={infoLocationNotes}
              onChange={(e) => setInfoLocationNotes(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Indicações úteis, acessos, estacionamento, ponto de encontro."
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Regras</label>
            <textarea
              value={infoRules}
              onChange={(e) => setInfoRules(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Regras essenciais, o que é permitido ou não."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">FAQ</label>
            <textarea
              value={infoFaq}
              onChange={(e) => setInfoFaq(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Perguntas frequentes e respostas curtas."
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Requisitos</label>
            <textarea
              value={infoRequirements}
              onChange={(e) => setInfoRequirements(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Requisitos de participação, idade, equipamento, etc."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Políticas</label>
            <textarea
              value={infoPolicies}
              onChange={(e) => setInfoPolicies(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="Cancelamentos, no-show, reembolsos, outros."
            />
          </div>
        </div>
        {publicProfileMessage && <p className="text-[12px] text-white/70">{publicProfileMessage}</p>}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Email oficial da organização</h2>
            <p className="text-[12px] text-white/65">Apenas o Owner pode definir. Usamos para invoices, alertas críticos e transferências.</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] ${officialEmailBadgeClass}`}>
            {officialEmailStatusLabel}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <label className="text-[12px] text-white/70">Email oficial (Owner)</label>
            <input
              value={officialEmail}
              onChange={(e) => setOfficialEmail(e.target.value)}
              disabled={!isOwner}
              className={`w-full rounded-xl border bg-black/40 px-3 py-2 text-sm outline-none ${
                isOwner ? "border-white/15 focus:border-[#6BFFFF]" : "border-white/15 text-white/60"
              }`}
              placeholder="equipa@organizacao.pt"
            />
            {!officialEmailVerifiedAt && organizer?.officialEmail && (
              <p className="text-[11px] text-amber-200">
                Aguardamos confirmação. Reenvia se precisares de novo token.
              </p>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
            <p>Define o email institucional real da organização. Serve de contacto oficial para faturação, alertas e trocas de Owner.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOfficialEmailUpdate}
                disabled={!isOwner || officialEmailSaving}
                className={`${CTA_PRIMARY} disabled:opacity-60`}
              >
                {officialEmailSaving ? "A enviar…" : officialEmailVerifiedAt ? "Revalidar email" : "Enviar verificação"}
              </button>
            </div>
            {officialEmailMessage && <p className="text-[11px] text-white">{officialEmailMessage}</p>}
            {(!organizer?.officialEmail || !officialEmailVerifiedAt) && (
              <p className="text-[11px] text-amber-200">Sem email oficial verificado — mostraremos aviso no dashboard.</p>
            )}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Branding</h2>
            <p className="text-[12px] text-white/65">Logo e cores aplicados na página pública da organização.</p>
          </div>
          <label className={`${CTA_SECONDARY} cursor-pointer`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
              disabled={brandingUploading}
            />
            {brandingUploading ? "A enviar…" : "Upload logo"}
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {brandingAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandingAvatarUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/70">Logo</div>
              )}
            </div>
            <div className="space-y-1 text-sm text-white/70">
              <p>PNG/JPG/SVG até 2MB. Guardamos logo otimizado.</p>
              <p className="text-[11px] text-white/50">Fica visível no dashboard, listagens e página pública.</p>
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Cor primária</label>
                <input
                  type="color"
                  value={brandingPrimaryColor || "#6bffff"}
                  onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                  className="h-10 w-full rounded border border-white/20 bg-black/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Cor secundária</label>
                <input
                  type="color"
                  value={brandingSecondaryColor || "#0f172a"}
                  onChange={(e) => setBrandingSecondaryColor(e.target.value)}
                  className="h-10 w-full rounded border border-white/20 bg-black/30"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-white/55">Clica Guardar para aplicar as cores.</p>
              <button
                type="button"
                onClick={handleSaveBranding}
                className={CTA_PRIMARY}
              >
                Guardar cores
              </button>
            </div>
            {brandingMessage && <p className="text-[12px] text-white/70">{brandingMessage}</p>}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Username ORYA</h2>
            <p className="text-[12px] text-white/65">Handle público global do organizador.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-48 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              placeholder="ex.: clube-xpto"
            />
            <button
              type="button"
              onClick={handleSaveUsername}
              disabled={savingUsername}
              className={`${CTA_PRIMARY} disabled:opacity-60`}
            >
              {savingUsername ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-white/60">Letras minúsculas, números e - ou _. Mínimo 3 caracteres.</p>
        {(usernameMessage || usernameError) && (
          <p className="text-[12px] text-white/70">{usernameError || usernameMessage}</p>
        )}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b0f1f]/75 to-[#04070f]/90 p-4 space-y-2 shadow-[0_22px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <h2 className="text-lg font-semibold">Preferências (em breve)</h2>
        <p className="text-[12px] text-white/65">
          Aqui vais conseguir gerir idioma, notificações e visibilidade pública. Ainda não está disponível nesta versão.
        </p>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-red-400/40 bg-gradient-to-br from-red-500/15 via-[#2a0c0f]/85 to-black/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-red-100">Zona de perigo</h2>
            <p className="text-[12px] text-red-100/80">
              Apagar a organização marca-a como suspensa e remove memberships. Apenas Owners podem fazê-lo.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div className="space-y-1">
            <label className="text-[12px] text-white/80">Escreve APAGAR para confirmar</label>
            <input
              value={dangerConfirm}
              onChange={(e) => setDangerConfirm(e.target.value)}
              className="w-full rounded-lg border border-red-400/40 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-200"
              placeholder="APAGAR"
            />
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <button
              type="button"
              onClick={() => setDangerDialogOpen(true)}
              disabled={!isOwner || !dangerReady || dangerLoading}
              className={`${CTA_DANGER} w-full justify-center disabled:opacity-60 md:w-auto`}
            >
              {dangerLoading ? "A apagar…" : "Apagar organização"}
            </button>
            {!isOwner && (
              <p className="text-[11px] text-white/60">Só Owners podem apagar esta organização.</p>
            )}
            {dangerFeedback && (
              <p className="text-[12px] text-white/70">{dangerFeedback}</p>
            )}
          </div>
        </div>
      </section>

      <ConfirmDestructiveActionDialog
        open={dangerDialogOpen}
        title="Apagar organização?"
        description="Esta ação marca a organização como suspensa/arquivada. Não apaga vendas já feitas."
        consequences={[
          "Perdes acesso ao dashboard desta organização.",
          "As equipas deixam de ter acesso.",
          "Eventos e dados ficam ocultos do público.",
        ]}
        confirmLabel="Apagar organização"
        cancelLabel="Cancelar"
        dangerLevel="high"
        onClose={() => setDangerDialogOpen(false)}
        onConfirm={() => {
          if (dangerConfirm.trim().toUpperCase() !== "APAGAR") {
            setDangerFeedback("Escreve APAGAR para confirmares.");
            return;
          }
          handleDeleteOrganization();
        }}
      />
    </div>
  );
}
