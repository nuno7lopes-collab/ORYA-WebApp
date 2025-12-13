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

type OrganizerMeResponse = {
  ok: boolean;
  organizer: {
    id: number;
    displayName: string | null;
    publicName?: string | null;
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

export default function OrganizerSettingsPage() {
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

  const [dangerConfirm, setDangerConfirm] = useState("");
  const [dangerFeedback, setDangerFeedback] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);

  useEffect(() => {
    if (!organizer) return;
    setOrganizationKind((organizer.organizationKind as string | null) ?? "PESSOA_SINGULAR");
    const name =
      organizer.displayName ||
      organizer.businessName ||
      profile?.fullName ||
      "";
    setEntityName(name);
    setPublicName(organizer.publicName || organizer.displayName || organizer.businessName || name);
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
      openModal({ mode: "login", redirectTo: "/organizador/settings", showGoogle: true });
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
          displayName: entityName,
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
      openModal({ mode: "login", redirectTo: "/organizador/settings", showGoogle: true });
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
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4 text-white md:px-6 lg:px-10">
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
      <div className="mx-auto max-w-5xl px-4 py-10 text-white md:px-6 lg:px-10">
        {isLoading ? "A carregar definições…" : "Ativa a conta de organizador para gerir estas definições."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6 text-white md:px-8 lg:px-10">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Definições</p>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Perfil do organizador</h1>
            <p className="text-sm text-white/65">Identidade, branding e contactos públicos.</p>
          </div>
          {organizer?.username && (
            <a
              href={`/org/${organizer.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] text-white hover:bg-white/10"
            >
              Ver página pública ↗
            </a>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dados da organização</h2>
            <p className="text-[12px] text-white/65">Identidade pública, localização base e contactos.</p>
          </div>
          <button
            type="button"
            onClick={handleSaveOrg}
            disabled={savingOrg}
            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
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

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
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
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
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

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Branding</h2>
            <p className="text-[12px] text-white/65">Logo e cores aplicados na página pública da organização.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] text-white hover:bg-white/10">
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
                className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10"
              >
                Guardar cores
              </button>
            </div>
            {brandingMessage && <p className="text-[12px] text-white/70">{brandingMessage}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
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
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
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

      <section className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-2 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <h2 className="text-lg font-semibold">Preferências (em breve)</h2>
        <p className="text-[12px] text-white/65">
          Aqui vais conseguir gerir idioma, notificações e visibilidade pública. Ainda não está disponível nesta versão.
        </p>
      </section>

      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
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
            <p className="text-[11px] text-white/60">
              Ação irreversível (soft delete). Bloqueada se existirem bilhetes vendidos.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <button
              type="button"
              onClick={() => setDangerDialogOpen(true)}
              disabled={!isOwner || !dangerReady || dangerLoading}
              className="w-full rounded-full border border-red-400/60 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 shadow hover:bg-red-500/25 disabled:opacity-60 md:w-auto"
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
