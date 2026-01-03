"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { isValidPhone, sanitizePhone } from "@/lib/phone";
import { PORTUGAL_CITIES } from "@/config/cities";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { CTA_DANGER, CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

type OrganizationMeResponse = {
  ok: boolean;
  organization: {
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
    publicInstagram?: string | null;
    publicYoutube?: string | null;
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

type OrganizationSettingsPageProps = {
  embedded?: boolean;
};

export default function OrganizationSettingsPage({ embedded }: OrganizationSettingsPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, isLoading, mutate } = useSWR<OrganizationMeResponse>(
    user ? "/api/organizacao/me" : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const organization = data?.organization ?? null;
  const profile = data?.profile ?? null;
  const contactEmailFromAccount = data?.contactEmail ?? null;
  const redirectTo = "/organizacao/settings";

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

  const [dangerConfirm, setDangerConfirm] = useState("");
  const [dangerFeedback, setDangerFeedback] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setOrganizationKind((organization.organizationKind as string | null) ?? "PESSOA_SINGULAR");
    const name =
      organization.publicName ||
      organization.businessName ||
      profile?.fullName ||
      "";
    setEntityName(name);
    setPublicName(organization.publicName || organization.businessName || name);
    setCity(organization.city ?? profile?.city ?? "");
    setAddress((organization as { address?: string | null }).address ?? "");
    setShowAddressPublicly((organization as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false);
    setContactEmail(contactEmailFromAccount ?? "");
    setOfficialEmail((organization as { officialEmail?: string | null })?.officialEmail ?? contactEmailFromAccount ?? "");
    if (profile?.contactPhone) setContactPhone(profile.contactPhone);
  }, [organization, profile, contactEmailFromAccount]);

  const hasOrganization = useMemo(() => organization && data?.ok, [organization, data]);
  const membershipRole = data?.membershipRole ?? null;
  const isOwner = membershipRole === "OWNER";
  const dangerReady = dangerConfirm.trim().toUpperCase() === "APAGAR";
  const officialEmailVerifiedAt = organization?.officialEmailVerifiedAt ? new Date(organization.officialEmailVerifiedAt) : null;
  const officialEmailStatusLabel = officialEmailVerifiedAt
    ? `Verificado ${officialEmailVerifiedAt.toLocaleDateString()}`
    : organization?.officialEmail
      ? "A aguardar verificação"
      : "Por definir";
  const officialEmailBadgeClass = officialEmailVerifiedAt
    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
    : organization?.officialEmail
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
      const res = await fetch("/api/organizacao/me", {
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
      console.error("[organização/settings] save", err);
      setOrgMessage("Erro inesperado ao guardar.");
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleOfficialEmailUpdate() {
    if (!organization?.id) {
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
      const res = await fetch("/api/organizacao/organizations/settings/official-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id, email: officialEmail.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setOfficialEmailMessage(json?.error || "Não foi possível iniciar a verificação.");
      } else {
        setOfficialEmailMessage("Pedido enviado. Verifica a caixa de email para confirmar.");
        mutate();
      }
    } catch (err) {
      console.error("[organização/settings] official-email", err);
      setOfficialEmailMessage("Erro inesperado ao enviar pedido.");
    } finally {
      setOfficialEmailSaving(false);
    }
  }

  const handleDeleteOrganization = async () => {
    if (!organization?.id) return;
    if (dangerConfirm.trim().toUpperCase() !== "APAGAR") {
      setDangerFeedback("Escreve APAGAR para confirmares.");
      return;
    }
    setDangerLoading(true);
    setDangerFeedback(null);
    try {
      const res = await fetch(`/api/organizacao/organizations/${organization.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setDangerFeedback(json?.error || "Não foi possível apagar a organização.");
      } else {
        setDangerFeedback("Organização apagada. Redirecionámos-te para gerir outras.");
        setDangerConfirm("");
        setDangerDialogOpen(false);
        router.push("/organizacao/organizations");
      }
    } catch (err) {
      console.error("[organização/settings] delete", err);
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
          <h1 className="text-2xl font-semibold">Definições do organização</h1>
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

  if (isLoading || !hasOrganization) {
    return (
      <div
        className={
          embedded ? "text-white" : "w-full px-4 py-8 text-white md:px-6 lg:px-10"
        }
      >
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {isLoading ? "A carregar definições…" : "Ativa a conta de organização para gerir estas definições."}
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
            <h1 className="text-3xl font-semibold drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">Perfil do organização</h1>
            <p className="text-sm text-white/70">Identidade e contactos da organização.</p>
          </div>
          {organization?.username && (
            <a
              href={`/${organization.username}`}
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
              placeholder="equipa@organização.pt"
            />
            {!officialEmailVerifiedAt && organization?.officialEmail && (
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
            {(!organization?.officialEmail || !officialEmailVerifiedAt) && (
              <p className="text-[11px] text-amber-200">Sem email oficial verificado — mostraremos aviso no dashboard.</p>
            )}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0b0f1f]/75 to-[#04070f]/90 p-4 space-y-2 shadow-[0_22px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <h2 className="text-lg font-semibold">Preferências (em breve)</h2>
        <p className="text-[12px] text-white/65">
          Aqui vais conseguir gerir idioma e notificações. Ainda não está disponível nesta versão; a visibilidade pública é sempre ativa para organizações.
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
