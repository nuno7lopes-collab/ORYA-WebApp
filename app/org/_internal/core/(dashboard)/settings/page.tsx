"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { isValidPhone, sanitizePhone } from "@/lib/phone";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import ProfileHeaderLayout from "@/app/components/profile/ProfileHeaderLayout";
import { ProfileCoverCropModal } from "@/app/components/forms/ProfileCoverCropModal";
import { CTA_DANGER, CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import { Avatar } from "@/components/ui/avatar";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { extractPublicSocialHandle } from "@/lib/publicSocialLinks";
import { getProfileCoverUrl } from "@/lib/profileCover";
import { cn } from "@/lib/utils";
import { AddressCombobox } from "@/components/ui/address-combobox";
import { buildOrgHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";

type OrganizationMeResponse = {
  ok: boolean;
  organization: {
    id: number;
    status?: string | null;
    publicName: string | null;
    username?: string | null;
    businessName: string | null;
    entityType: string | null;
    addressId?: string | null;
    addressRef?: { formattedAddress: string | null; canonical: Record<string, unknown> | null } | null;
    showAddressPublicly?: boolean | null;
    payoutIban: string | null;
    language?: string | null;
    alertsEmail?: string | null;
    alertsSalesEnabled?: boolean | null;
    alertsPayoutEnabled?: boolean | null;
    brandingAvatarUrl?: string | null;
    brandingCoverUrl?: string | null;
    brandingPrimaryColor?: string | null;
    brandingSecondaryColor?: string | null;
    organizationKind?: string | null;
    officialEmail?: string | null;
    officialEmailVerifiedAt?: string | null;
    officialEmailPending?: {
      requestId: number;
      newEmail: string;
      createdAt: string;
      expiresAt?: string | null;
    } | null;
    suspension?: {
      isSuspended: boolean;
      suspendedAt?: string | null;
      reactivationDeadlineAt?: string | null;
      reactivationWindowOpen?: boolean;
      remainingWindowDays?: number | null;
      suspensionTimestampUnknown?: boolean;
    } | null;
    publicWebsite?: string | null;
    publicInstagram?: string | null;
    publicYoutube?: string | null;
    publicTiktok?: string | null;
    publicLinkedin?: string | null;
    publicDescription?: string | null;
    publicHours?: string | null;
    infoRules?: string | null;
    infoRequirements?: string | null;
    infoPolicies?: string | null;
    infoLocationNotes?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
  } | null;
  profile: {
    fullName: string | null;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const organizationIdFromQuery = organizationIdParam ? Number(organizationIdParam) : null;
  const organizationId = parseOrgIdFromPathnameStrict(pathname) ?? organizationIdFromQuery;
  const orgMeUrl =
    organizationId && Number.isFinite(organizationId)
      ? `/api/org/${organizationId}/me`
      : null;
  const { data, isLoading, mutate } = useSWR<OrganizationMeResponse>(
    orgMeUrl,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const organization = data?.organization ?? null;
  const profile = data?.profile ?? null;
  const redirectTo = organizationId ? buildOrgHref(organizationId, "/settings") : "/org-hub/organizations";

  const [addressQuery, setAddressQuery] = useState("");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddressPublicly, setShowAddressPublicly] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [supportPhoneError, setSupportPhoneError] = useState<string | null>(null);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [officialEmail, setOfficialEmail] = useState("");
  const [officialEmailMessage, setOfficialEmailMessage] = useState<string | null>(null);
  const [officialEmailSaving, setOfficialEmailSaving] = useState(false);
  const [publicNameInput, setPublicNameInput] = useState("");
  const [publicUsernameInput, setPublicUsernameInput] = useState("");
  const [publicDescriptionInput, setPublicDescriptionInput] = useState("");
  const [publicWebsiteInput, setPublicWebsiteInput] = useState("");
  const [publicInstagramHandle, setPublicInstagramHandle] = useState("");
  const [publicYoutubeHandle, setPublicYoutubeHandle] = useState("");
  const [publicTiktokHandle, setPublicTiktokHandle] = useState("");
  const [publicLinkedinHandle, setPublicLinkedinHandle] = useState("");
  const [brandingAvatarUrlInput, setBrandingAvatarUrlInput] = useState("");
  const [brandingCoverUrlInput, setBrandingCoverUrlInput] = useState("");
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);
  const [publicProfileMessage, setPublicProfileMessage] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false);
  const [coverActionsOpen, setCoverActionsOpen] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);

  const [dangerConfirm, setDangerConfirm] = useState("");
  const [dangerFeedback, setDangerFeedback] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);
  const [suspendFeedback, setSuspendFeedback] = useState<string | null>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [reactivateFeedback, setReactivateFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    const formatted = organization.addressRef?.formattedAddress ?? "";
    setAddressQuery(formatted);
    setAddressId(organization.addressId ?? null);
    setShowAddressPublicly((organization as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false);
    const pendingEmail = normalizeOfficialEmail(
      (organization as { officialEmailPending?: { newEmail?: string | null } | null })?.officialEmailPending?.newEmail ?? null,
    );
    setOfficialEmail(pendingEmail ?? "");
    setContactPhone(profile?.contactPhone ?? "");
    setSupportEmail(organization.supportEmail ?? "");
    setSupportPhone(organization.supportPhone ?? "");
    setPublicNameInput(organization.publicName ?? "");
    setPublicUsernameInput(organization.username ?? "");
    setPublicDescriptionInput(organization.publicDescription ?? "");
    setPublicWebsiteInput(organization.publicWebsite ?? "");
    setPublicInstagramHandle(extractPublicSocialHandle(organization.publicInstagram ?? null, "instagram"));
    setPublicYoutubeHandle(extractPublicSocialHandle(organization.publicYoutube ?? null, "youtube"));
    setPublicTiktokHandle(extractPublicSocialHandle(organization.publicTiktok ?? null, "tiktok"));
    setPublicLinkedinHandle(extractPublicSocialHandle(organization.publicLinkedin ?? null, "linkedin"));
    setBrandingAvatarUrlInput(organization.brandingAvatarUrl ?? "");
    setBrandingCoverUrlInput(organization.brandingCoverUrl ?? "");
    setAvatarActionsOpen(false);
    setCoverActionsOpen(false);
    setCoverCropFile(null);
    setShowCoverCropModal(false);
  }, [organization, profile]);

  const hasOrganization = useMemo(() => organization && data?.ok, [organization, data]);
  const bootstrappingSession = isUserLoading || (isLoading && !hasOrganization);
  const membershipRole = data?.membershipRole ?? null;
  const isOwner = membershipRole === "OWNER";
  const isCoOwner = membershipRole === "CO_OWNER";
  const isAdmin = membershipRole === "ADMIN";
  const isOwnerOrCoOwner = isOwner || isCoOwner;
  const isOrganizationSuspended = organization?.status === "SUSPENDED";
  const suspension = organization?.suspension ?? null;
  const suspensionDeadlineDate = suspension?.reactivationDeadlineAt ? new Date(suspension.reactivationDeadlineAt) : null;
  const suspensionRemainingDays =
    typeof suspension?.remainingWindowDays === "number" ? suspension.remainingWindowDays : null;
  const canEditOperational = (isOwner || isCoOwner || isAdmin) && !isOrganizationSuspended;
  const canEditPublicProfile = canEditOperational;
  const canEditPublicBranding = isOwnerOrCoOwner && !isOrganizationSuspended;
  const canEditPublicUsername = isOwnerOrCoOwner && !isOrganizationSuspended;
  const canViewSensitive = isOwnerOrCoOwner;
  const canSuspendOrganization = isOwner && !isOrganizationSuspended;
  const canReactivateOrganization =
    isOwner &&
    isOrganizationSuspended &&
    (suspension?.reactivationWindowOpen === true || suspension?.suspensionTimestampUnknown === true);
  const canDeleteOrganization =
    isOwner &&
    isOrganizationSuspended &&
    suspension?.reactivationWindowOpen === false &&
    suspension?.suspensionTimestampUnknown === false;
  const dangerReady = dangerConfirm.trim().toUpperCase() === "APAGAR";
  const officialEmailNormalized = normalizeOfficialEmail(organization?.officialEmail ?? null);
  const pendingOfficialEmailNormalized = normalizeOfficialEmail(organization?.officialEmailPending?.newEmail ?? null);
  const hasPendingOfficialEmail = Boolean(pendingOfficialEmailNormalized);
  const normalizedOfficialEmailInput = normalizeOfficialEmail(officialEmail);
  const hasOfficialEmailInput = Boolean(normalizedOfficialEmailInput);
  const isOfficialEmailInputSameAsActive =
    hasOfficialEmailInput && normalizedOfficialEmailInput === officialEmailNormalized;
  const isEditingPendingSameEmail =
    hasPendingOfficialEmail && normalizedOfficialEmailInput === pendingOfficialEmailNormalized;
  const pendingOfficialEmailExpiresAtDate = organization?.officialEmailPending?.expiresAt
    ? new Date(organization.officialEmailPending.expiresAt)
    : null;
  const isOfficialEmailVerified = Boolean(officialEmailNormalized && organization?.officialEmailVerifiedAt);
  const officialEmailVerifiedAtDate = organization?.officialEmailVerifiedAt ? new Date(organization.officialEmailVerifiedAt) : null;
  const officialEmailStatusLabel =
    isOfficialEmailVerified && officialEmailVerifiedAtDate
      ? hasPendingOfficialEmail
        ? `Verificado ${officialEmailVerifiedAtDate.toLocaleDateString()} · alteração pendente`
        : `Verificado ${officialEmailVerifiedAtDate.toLocaleDateString()}`
      : officialEmailNormalized
        ? "A aguardar verificação"
        : "Por definir";
  const officialEmailBadgeClass =
    isOfficialEmailVerified && hasPendingOfficialEmail
      ? "border-amber-300/50 bg-amber-500/10 text-amber-50"
      : isOfficialEmailVerified
        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-50"
        : officialEmailNormalized
          ? "border-amber-300/50 bg-amber-500/10 text-amber-50"
          : "border-white/20 bg-white/5 text-white/70";
  const officialEmailActionLabel = isEditingPendingSameEmail
    ? "Reenviar verificação"
    : hasPendingOfficialEmail
      ? "Atualizar pedido"
      : hasOfficialEmailInput && isOfficialEmailInputSameAsActive && isOfficialEmailVerified
        ? "Email já verificado"
      : "Enviar verificação";
  const officialEmailActionDisabled =
    !isOwnerOrCoOwner ||
    officialEmailSaving ||
    isOrganizationSuspended ||
    !hasOfficialEmailInput ||
    (!hasPendingOfficialEmail && isOfficialEmailInputSameAsActive);
  const showOfficialEmailPrimaryAction = hasPendingOfficialEmail || hasOfficialEmailInput;
  const publicPreviewName = publicNameInput.trim() || organization?.publicName?.trim() || "Organização";
  const publicPreviewUsername =
    publicUsernameInput.trim().replace(/^@+/, "") || organization?.username?.trim() || "username";
  const publicPreviewBio = publicDescriptionInput.trim() || "Sem bio pública definida.";
  const publicPreviewAvatar = brandingAvatarUrlInput.trim() || null;
  const publicPreviewCover = brandingCoverUrlInput.trim() || null;
  const publicPreviewCoverDisplay = publicPreviewCover
    ? getProfileCoverUrl(publicPreviewCover, { width: 1500, height: 500, quality: 72, format: "webp" })
    : null;
  const hasAvatarImage = Boolean(publicPreviewAvatar);
  const hasCoverImage = Boolean(publicPreviewCover);

  async function handleSaveOrg() {
    if (!user) {
      openModal({ mode: "login", redirectTo, showGoogle: true });
      return;
    }
    if (contactPhone && !isValidPhone(contactPhone)) {
      setPhoneError("Telefone inválido. Introduz um número válido (podes incluir indicativo, ex.: +351...).");
      return;
    }
    if (addressQuery.trim() && !addressId) {
      setOrgMessage("Seleciona uma morada Apple válida antes de guardar.");
      return;
    }
    if (supportEmail.trim()) {
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(supportEmail.trim())) {
        setOrgMessage("Email de suporte inválido.");
        return;
      }
    }
    if (supportPhone && !isValidPhone(supportPhone)) {
      setSupportPhoneError("Telefone de suporte inválido.");
      return;
    }
    setSupportPhoneError(null);
    setSavingOrg(true);
    setOrgMessage(null);
    try {
      if (!organizationId || Number.isNaN(organizationId)) {
        setOrgMessage("Seleciona uma organização primeiro.");
        return;
      }
      const res = await fetch(`/api/org/${organizationId}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: addressId ?? "",
          showAddressPublicly,
          contactPhone,
          supportEmail: supportEmail.trim() || null,
          supportPhone: supportPhone.trim() || null,
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

  async function handleSavePublicProfile() {
    if (!user) {
      openModal({ mode: "login", redirectTo, showGoogle: true });
      return;
    }
    if (!organizationId || Number.isNaN(organizationId)) {
      setPublicProfileMessage("Seleciona uma organização primeiro.");
      return;
    }
    if (!canEditPublicProfile) {
      setPublicProfileMessage("Sem permissões para editar perfil público.");
      return;
    }

    const normalizedUsername = publicUsernameInput.trim().replace(/^@+/, "");
    if (canEditPublicUsername && !normalizedUsername) {
      setPublicProfileMessage("Username inválido.");
      return;
    }

    setSavingPublicProfile(true);
    setPublicProfileMessage(null);
    try {
      const payload: Record<string, unknown> = {
        publicDescription: publicDescriptionInput,
        publicWebsite: publicWebsiteInput,
        publicInstagram: publicInstagramHandle,
        publicYoutube: publicYoutubeHandle,
        publicTiktok: publicTiktokHandle,
        publicLinkedin: publicLinkedinHandle,
      };
      if (canEditPublicBranding) {
        payload.publicName = publicNameInput;
        payload.brandingAvatarUrl = brandingAvatarUrlInput.trim() || null;
        payload.brandingCoverUrl = brandingCoverUrlInput.trim() || null;
      }

      const profileRes = await fetch(`/api/org/${organizationId}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const profileJson = await profileRes.json().catch(() => null);
      if (!profileRes.ok || profileJson?.ok === false) {
        setPublicProfileMessage(profileJson?.message || profileJson?.error || "Não foi possível guardar o perfil público.");
        return;
      }

      if (canEditPublicUsername) {
        const currentUsername = (organization?.username ?? "").trim();
        if (normalizedUsername !== currentUsername) {
          const usernameRes = await fetch(`/api/org/${organizationId}/username`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: normalizedUsername }),
          });
          const usernameJson = await usernameRes.json().catch(() => null);
          if (!usernameRes.ok || usernameJson?.ok === false) {
            setPublicProfileMessage(
              usernameJson?.message ||
                usernameJson?.error ||
                "Perfil guardado, mas o username não foi atualizado.",
            );
            await mutate();
            return;
          }
        }
      }

      setPublicProfileMessage("Perfil público guardado.");
      await mutate();
    } catch (err) {
      console.error("[organização/settings] public-profile", err);
      setPublicProfileMessage("Erro inesperado ao guardar perfil público.");
    } finally {
      setSavingPublicProfile(false);
    }
  }

  async function handleBrandingUpload(kind: "avatar" | "cover", file: File | null) {
    if (!file || !organizationId || Number.isNaN(organizationId)) return;
    const setLoading = kind === "avatar" ? setUploadingAvatar : setUploadingCover;
    const setTarget = kind === "avatar" ? setBrandingAvatarUrlInput : setBrandingCoverUrlInput;
    const scope = kind === "avatar" ? "avatar" : "profile-cover";
    setLoading(true);
    setPublicProfileMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/upload?scope=${scope}&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setPublicProfileMessage(json?.error || `Falha no upload da ${kind === "avatar" ? "logo" : "capa"}.`);
        return;
      }
      setTarget(json.url);
      setPublicProfileMessage(`${kind === "avatar" ? "Logo" : "Capa"} carregada. Guarda para publicar.`);
    } catch (err) {
      console.error("[organização/settings] branding-upload", err);
      setPublicProfileMessage(`Erro no upload da ${kind === "avatar" ? "logo" : "capa"}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleCoverCropCancel() {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
  }

  async function handleCoverCropConfirm(file: File) {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
    await handleBrandingUpload("cover", file);
  }

  async function handleOfficialEmailUpdate() {
    if (!organization?.id) {
      setOfficialEmailMessage("Seleciona uma organização primeiro.");
      return;
    }
    if (!isOwnerOrCoOwner) {
      setOfficialEmailMessage("Apenas Dono e Co-dono podem alterar este email.");
      return;
    }
    const normalizedEmail = normalizeOfficialEmail(officialEmail);
    if (!normalizedEmail) {
      setOfficialEmailMessage("Indica um email oficial válido.");
      return;
    }
    if (normalizedEmail === officialEmailNormalized && isOfficialEmailVerified && !hasPendingOfficialEmail) {
      setOfficialEmailMessage("Este email já está verificado.");
      return;
    }

    setOfficialEmailSaving(true);
    setOfficialEmailMessage(null);
    try {
      const res = await fetch("/api/org-hub/organizations/settings/official-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id, email: normalizedEmail }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        if (json?.error === "EMAIL_ALREADY_VERIFIED" || json?.errorCode === "EMAIL_ALREADY_VERIFIED") {
          setOfficialEmailMessage("Este email já está verificado.");
          await mutate();
        } else {
          setOfficialEmailMessage(
            json?.message || json?.error || json?.errorCode || "Não foi possível iniciar a verificação.",
          );
        }
        return;
      }
      const status = json?.data?.status ?? json?.status;
      setOfficialEmailMessage(
        status === "VERIFIED"
          ? "Este email já está verificado."
          : hasPendingOfficialEmail && normalizedEmail === pendingOfficialEmailNormalized
            ? "Email de confirmação reenviado."
            : "Pedido enviado. Verifica a caixa de email para confirmar.",
      );
      await mutate();
    } catch (err) {
      console.error("[organização/settings] official-email", err);
      setOfficialEmailMessage("Erro inesperado ao enviar pedido.");
    } finally {
      setOfficialEmailSaving(false);
    }
  }

  async function handleCancelOfficialEmailPending() {
    if (!organization?.id) {
      setOfficialEmailMessage("Seleciona uma organização primeiro.");
      return;
    }
    if (!isOwnerOrCoOwner) {
      setOfficialEmailMessage("Apenas Dono e Co-dono podem cancelar este pedido.");
      return;
    }
    setOfficialEmailSaving(true);
    setOfficialEmailMessage(null);
    try {
      const res = await fetch("/api/org-hub/organizations/settings/official-email", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setOfficialEmailMessage(
          json?.message || json?.error || json?.errorCode || "Não foi possível cancelar a alteração de email.",
        );
        return;
      }
      setOfficialEmailMessage("Pedido pendente cancelado. Email ativo mantido.");
      setOfficialEmail("");
      await mutate();
    } catch (err) {
      console.error("[organização/settings] official-email-cancel", err);
      setOfficialEmailMessage("Erro inesperado ao cancelar o pedido.");
    } finally {
      setOfficialEmailSaving(false);
    }
  }

  async function runDangerActionWithStepUp(params: {
    url: string;
    method: "POST" | "DELETE";
    reasonCode: string;
    actionLabel: string;
    onSuccess: () => Promise<void> | void;
  }) {
    const invoke = async (stepUp?: { stepUpChallengeId?: string; stepUpCode?: string }) => {
      const res = await fetch(params.url, {
        method: params.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode: params.reasonCode,
          ...(stepUp?.stepUpChallengeId ? { stepUpChallengeId: stepUp.stepUpChallengeId } : {}),
          ...(stepUp?.stepUpCode ? { stepUpCode: stepUp.stepUpCode } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      return { res, json };
    };

    const first = await invoke();
    if (first.res.ok && first.json?.ok !== false) {
      await params.onSuccess();
      return { ok: true as const, json: first.json };
    }

    const firstCode = String(first.json?.errorCode ?? first.json?.error ?? "").toUpperCase();
    if (firstCode !== "STEP_UP_REQUIRED") {
      return { ok: false as const, json: first.json };
    }

    const challengeId =
      typeof first.json?.details?.challengeId === "string" ? first.json.details.challengeId : undefined;
    const input = typeof window !== "undefined"
      ? window.prompt(`Código de confirmação para ${params.actionLabel} (6 dígitos):`)
      : null;
    const code = typeof input === "string" ? input.trim() : "";
    if (!code) {
      return {
        ok: false as const,
        json: { message: "Operação cancelada. Código não introduzido." },
      };
    }

    const second = await invoke({ stepUpChallengeId: challengeId, stepUpCode: code });
    if (second.res.ok && second.json?.ok !== false) {
      await params.onSuccess();
      return { ok: true as const, json: second.json };
    }

    return { ok: false as const, json: second.json };
  }

  const handleSuspendOrganization = async () => {
    if (!organization?.id) return;
    setSuspendLoading(true);
    setSuspendFeedback(null);
    try {
      const result = await runDangerActionWithStepUp({
        url: `/api/org-hub/organizations/${organization.id}/suspend`,
        method: "POST",
        reasonCode: "OWNER_REQUEST",
        actionLabel: "suspender organização",
        onSuccess: async () => {
          setSuspendFeedback("Organização suspensa. Acesso operacional bloqueado.");
          setSuspendDialogOpen(false);
          await mutate();
          router.refresh();
        },
      });
      if (!result.ok) {
        setSuspendFeedback(result.json?.message || result.json?.error || "Não foi possível suspender a organização.");
      }
    } catch (err) {
      console.error("[organização/settings] suspend", err);
      setSuspendFeedback("Erro inesperado ao suspender.");
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleReactivateOrganization = async () => {
    if (!organization?.id) return;
    setReactivateLoading(true);
    setReactivateFeedback(null);
    try {
      const result = await runDangerActionWithStepUp({
        url: `/api/org-hub/organizations/${organization.id}/suspend`,
        method: "DELETE",
        reasonCode: "OWNER_RESTORE",
        actionLabel: "reativar organização",
        onSuccess: async () => {
          setReactivateFeedback("Organização reativada.");
          await mutate();
          router.refresh();
        },
      });
      if (!result.ok) {
        setReactivateFeedback(result.json?.message || result.json?.error || "Não foi possível reativar a organização.");
      }
    } catch (err) {
      console.error("[organização/settings] reactivate", err);
      setReactivateFeedback("Erro inesperado ao reativar.");
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization?.id) return;
    if (dangerConfirm.trim().toUpperCase() !== "APAGAR") {
      setDangerFeedback("Escreve APAGAR para confirmares.");
      return;
    }
    if (!canDeleteOrganization) {
      setDangerFeedback("A eliminação definitiva só fica disponível depois da janela de reativação.");
      return;
    }
    setDangerLoading(true);
    setDangerFeedback(null);
    try {
      const result = await runDangerActionWithStepUp({
        url: `/api/org-hub/organizations/${organization.id}`,
        method: "DELETE",
        reasonCode: "OWNER_DELETE",
        actionLabel: "apagar organização",
        onSuccess: async () => {
          setDangerFeedback("Organização apagada. Redirecionámos-te para gerir outras.");
          setDangerConfirm("");
          setDangerDialogOpen(false);
          router.push("/org-hub/organizations");
        },
      });
      if (!result.ok) {
        setDangerFeedback(result.json?.message || result.json?.error || "Não foi possível apagar a organização.");
      }
    } catch (err) {
      console.error("[organização/settings] delete", err);
      setDangerFeedback("Erro inesperado ao apagar.");
    } finally {
      setDangerLoading(false);
    }
  };

  if (bootstrappingSession) {
    return (
      <div
        className={cn(
          embedded ? "text-white" : "w-full py-8 text-white",
        )}
      >
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          A validar sessão…
        </div>
      </div>
    );
  }

  if (!user && !hasOrganization) {
    return (
      <div
        className={cn(
          embedded ? "space-y-4 text-white" : "w-full space-y-4 py-8 text-white",
        )}
      >
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3">
          <p className="text-white/70">Inicia sessão para definições.</p>
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

  if (!hasOrganization) {
    return (
      <div
        className={cn(
          embedded ? "text-white" : "w-full py-8 text-white",
        )}
      >
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          Ativa a conta de organização para gerir estas definições.
        </div>
      </div>
    );
  }

  const wrapperClass = cn(
    embedded ? "space-y-6 text-white" : "w-full space-y-6 py-8 text-white",
  );

  return (
    <div className={wrapperClass}>
      {isOrganizationSuspended && (
        <section className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-50 shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Organização suspensa</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Acesso em modo de leitura</h2>
          <p className="mt-1 text-[13px] text-amber-100/85">
            {suspension?.reactivationWindowOpen
              ? suspensionRemainingDays === 0
                ? "Último dia para reativar antes da eliminação definitiva."
                : `Janela de reativação aberta (${suspensionRemainingDays ?? "?"} dias restantes).`
              : "A janela de reativação terminou."}
          </p>
          {suspensionDeadlineDate && (
            <p className="mt-1 text-[12px] text-amber-100/75">
              Prazo de reativação: {suspensionDeadlineDate.toLocaleString()}.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReactivateOrganization}
              disabled={!canReactivateOrganization || reactivateLoading}
              className={`${CTA_PRIMARY} disabled:opacity-60`}
            >
              {reactivateLoading ? "A reativar…" : "Reativar organização"}
            </button>
            {reactivateFeedback && <p className="text-[12px] text-amber-100">{reactivateFeedback}</p>}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 via-[#0b1226]/80 to-[#050912]/92 p-6 space-y-4 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Operacional</h2>
            <p className="text-[12px] text-white/65">Contactos e informação pública.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewSensitive && (
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] ${officialEmailBadgeClass}`}>
                {officialEmailStatusLabel}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveOrg}
              disabled={savingOrg || !canEditOperational}
              className={`${CTA_PRIMARY} disabled:opacity-60 shadow-[0_10px_30px_rgba(0,0,0,0.45)]`}
            >
              {savingOrg ? "A guardar…" : "Guardar contactos"}
            </button>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-white/20 via-white/5 to-transparent" />
        {canViewSensitive ? (
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[12px] text-white/70">
                Email oficial ativo
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/55">
                  {isOwnerOrCoOwner ? "Dono / Co-dono" : "Apenas Dono / Co-dono"}
                </span>
              </label>
              <input
                value={officialEmailNormalized ?? ""}
                disabled
                className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
                  "cursor-not-allowed border-white/10 text-white/75"
                }`}
                placeholder="Sem email oficial ativo"
              />
              <label className="pt-1 text-[12px] text-white/70">Novo email oficial</label>
              <input
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                disabled={!isOwnerOrCoOwner || officialEmailSaving || isOrganizationSuspended}
                className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
                  isOwnerOrCoOwner && !isOrganizationSuspended
                    ? "border-white/20 hover:border-white/35 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
                    : "cursor-not-allowed border-white/10 text-white/60"
                }`}
                placeholder="equipa@organização.pt"
              />
              {!hasPendingOfficialEmail && !hasOfficialEmailInput && (
                <p className="text-[11px] text-white/55">
                  Sem alterações pendentes. Introduz um novo email para iniciar a alteração.
                </p>
              )}
              {!hasPendingOfficialEmail && hasOfficialEmailInput && isOfficialEmailInputSameAsActive && (
                <p className="text-[11px] text-white/55">
                  O email introduzido já é o email oficial ativo.
                </p>
              )}
              {hasPendingOfficialEmail && (
                <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                  Alteração pendente para: <span className="font-semibold">{pendingOfficialEmailNormalized}</span>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-white/3 to-transparent p-4 text-[12px] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Estado</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${officialEmailBadgeClass}`}>
                  {officialEmailStatusLabel}
                </span>
              </div>
              <p>Email oficial para faturação, payouts e alertas operacionais.</p>
              {hasPendingOfficialEmail && pendingOfficialEmailExpiresAtDate && (
                <p className="text-[11px] text-amber-200">
                  Validade do pedido pendente até {pendingOfficialEmailExpiresAtDate.toLocaleString()}.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {showOfficialEmailPrimaryAction && (
                  <button
                    type="button"
                    onClick={handleOfficialEmailUpdate}
                    disabled={officialEmailActionDisabled}
                    className={`${CTA_PRIMARY} disabled:opacity-60 shadow-[0_10px_30px_rgba(0,0,0,0.45)]`}
                  >
                    {officialEmailSaving ? "A enviar…" : officialEmailActionLabel}
                  </button>
                )}
                {hasPendingOfficialEmail && (
                  <button
                    type="button"
                    onClick={handleCancelOfficialEmailPending}
                    disabled={!isOwnerOrCoOwner || officialEmailSaving || isOrganizationSuspended}
                    className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white hover:border-white/35 disabled:opacity-60"
                  >
                    Cancelar pendente
                  </button>
                )}
              </div>
              {officialEmailMessage && <p className="text-[11px] text-white">{officialEmailMessage}</p>}
              {!isOfficialEmailVerified && !officialEmailNormalized && (
                <p className="text-[11px] text-amber-200">Sem email oficial verificado.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-white/70">
            Email oficial e faturação apenas disponível para Dono e Co-dono.
          </div>
        )}
        <div className="h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Email de suporte da loja (opcional)</label>
            <input
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              type="email"
              className="w-full rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
              placeholder="suporte@organizacao.pt"
              disabled={!canEditOperational}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-white/70">Telefone de suporte da loja (opcional)</label>
            <input
              value={supportPhone}
              onChange={(e) => {
                const sanitized = sanitizePhone(e.target.value);
                setSupportPhone(sanitized);
                if (sanitized && !isValidPhone(sanitized)) {
                  setSupportPhoneError("Telefone de suporte inválido.");
                } else {
                  setSupportPhoneError(null);
                }
              }}
              inputMode="tel"
              pattern="\\+?\\d{6,15}"
              maxLength={18}
              className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
                supportPhoneError
                  ? "border-red-400/60 focus:border-red-300/80 focus:ring-1 focus:ring-red-300/40"
                  : "border-white/15 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
              }`}
              placeholder="+351912345678"
              disabled={!canEditOperational}
            />
            {supportPhoneError && <p className="text-[11px] text-red-300">{supportPhoneError}</p>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
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
              className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
                phoneError
                  ? "border-red-400/60 focus:border-red-300/80 focus:ring-1 focus:ring-red-300/40"
                  : "border-white/15 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
              }`}
              placeholder="+351912345678"
              disabled={!canEditOperational}
            />
            {phoneError && <p className="text-[11px] text-red-300">{phoneError}</p>}
          </div>
          <div className="space-y-1">
            <AddressCombobox
              label="Morada (Apple Maps)"
              value={addressQuery}
              onValueChange={(next) => {
                setAddressQuery(next);
              }}
              addressId={addressId}
              onAddressIdChange={(next) => {
                setAddressId(next);
              }}
              disabled={!canEditOperational}
              minChars={2}
              maxItems={10}
              enableRecents
              enableGeolocationCta
            />
            <label className="mt-1 flex items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={showAddressPublicly}
                onChange={(e) => setShowAddressPublicly(e.target.checked)}
                className="h-4 w-4 accent-[#6BFFFF]"
                disabled={!canEditOperational}
              />
              Mostrar na página pública
            </label>
          </div>
        </div>
        {orgMessage && <p className="text-[12px] text-white/70">{orgMessage}</p>}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 via-[#0b1226]/80 to-[#050912]/92 p-6 space-y-4 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Perfil público</h2>
            <p className="text-[12px] text-white/65">
              Configuração fixa do perfil público. Hero/Sobre/Galeria/FAQ/Contacto foram removidos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePublicProfile}
            disabled={savingPublicProfile || !canEditPublicProfile}
            className={`${CTA_PRIMARY} disabled:opacity-60 shadow-[0_10px_30px_rgba(0,0,0,0.45)]`}
          >
            {savingPublicProfile ? "A guardar…" : "Guardar perfil público"}
          </button>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-white/20 via-white/5 to-transparent" />

        <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <ProfileHeaderLayout
            coverUrl={publicPreviewCoverDisplay}
            coverHeightClassName="aspect-[3/1] h-auto"
            contentWidthClassName="mx-auto w-full max-w-[640px]"
            avatarSlot={
              <div className="rounded-full bg-gradient-to-br from-white/65 via-[#6BFFFF]/45 to-[#FF7AD1]/45 p-[2px] shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
                <Avatar
                  src={publicPreviewAvatar}
                  name={publicPreviewName}
                  className="h-28 w-28 rounded-full border-2 border-white/35 bg-white/10"
                  textClassName="text-[10px] tracking-[0.14em]"
                />
              </div>
            }
            titleSlot={<h3 className="truncate text-[20px] font-semibold tracking-tight text-white">{publicPreviewName}</h3>}
            metaSlot={
              <div className="flex items-center gap-2 text-[12px] text-white/80">
                <span className="rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white">
                  @{publicPreviewUsername}
                </span>
              </div>
            }
            bioSlot={<p className="max-w-xl whitespace-pre-line text-sm leading-relaxed text-white/85">{publicPreviewBio}</p>}
          />
          <div className="-mt-4 px-4 pb-4 text-center">
            <p className="text-[11px] text-white/55">Para mudar avatar e capa, clica nas fotos abaixo.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[12px] text-white/70">Nome público</span>
            <input
              value={publicNameInput}
              onChange={(e) => setPublicNameInput(e.target.value)}
              disabled={!canEditPublicBranding}
              className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
                canEditPublicBranding
                  ? "border-white/15 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
                  : "cursor-not-allowed border-white/10 text-white/60"
              }`}
              placeholder="Top Padel"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] text-white/70">Username público</span>
            <div className="flex items-center rounded-xl border border-white/15 bg-black/45 px-3 py-2">
              <span className="pr-1 text-sm text-white/55">@</span>
              <input
                value={publicUsernameInput}
                onChange={(e) => setPublicUsernameInput(e.target.value.replace(/^@+/, ""))}
                disabled={!canEditPublicUsername}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/35 ${
                  canEditPublicUsername ? "text-white" : "cursor-not-allowed text-white/60"
                }`}
                placeholder="username"
              />
            </div>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[12px] text-white/70">Avatar</p>
            <button
              type="button"
              onClick={() => {
                if (!canEditPublicBranding) return;
                setAvatarActionsOpen((prev) => !prev);
                setCoverActionsOpen(false);
              }}
              disabled={!canEditPublicBranding}
              className={`group w-full rounded-2xl border bg-black/35 p-3 text-left transition ${
                canEditPublicBranding
                  ? "border-white/15 hover:border-white/35 hover:bg-black/45"
                  : "cursor-not-allowed border-white/10 text-white/60"
              }`}
            >
              <div className="relative flex h-28 items-center justify-center rounded-xl border border-white/12 bg-gradient-to-br from-[#101930] via-[#10172b] to-[#070b15]">
                <Avatar
                  src={publicPreviewAvatar}
                  name={publicPreviewName}
                  className="h-20 w-20 rounded-full border-2 border-white/35 bg-white/10 shadow-[0_18px_46px_rgba(0,0,0,0.45)]"
                  textClassName="text-[10px] tracking-[0.14em]"
                />
                {canEditPublicBranding && (
                  <span className="absolute bottom-2 rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                    Clicar para gerir
                  </span>
                )}
              </div>
            </button>
            {avatarActionsOpen && canEditPublicBranding && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAvatarActionsOpen(false);
                    avatarFileRef.current?.click();
                  }}
                  disabled={!canEditPublicBranding || uploadingAvatar}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85 hover:bg-white/15 disabled:opacity-60"
                >
                  {uploadingAvatar ? "A carregar..." : "Alterar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrandingAvatarUrlInput("");
                    setAvatarActionsOpen(false);
                    setPublicProfileMessage("Logo removida. Guarda para publicar.");
                  }}
                  disabled={!canEditPublicBranding || !hasAvatarImage}
                  className="rounded-full border border-white/20 bg-transparent px-3 py-1 text-[12px] font-semibold text-white/70 hover:bg-white/10 disabled:opacity-60"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[12px] text-white/70">Capa</p>
            <button
              type="button"
              onClick={() => {
                if (!canEditPublicBranding) return;
                setCoverActionsOpen((prev) => !prev);
                setAvatarActionsOpen(false);
              }}
              disabled={!canEditPublicBranding}
              className={`group w-full rounded-2xl border bg-black/35 p-3 text-left transition ${
                canEditPublicBranding
                  ? "border-white/15 hover:border-white/35 hover:bg-black/45"
                  : "cursor-not-allowed border-white/10 text-white/60"
              }`}
            >
              <div className="relative h-28 overflow-hidden rounded-xl border border-white/12 bg-gradient-to-br from-[#0f1f3b] via-[#121a33] to-[#060b14]">
                {publicPreviewCover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={publicPreviewCover}
                    alt="Pré-visualização da capa"
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                {canEditPublicBranding && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                    Clicar para gerir
                  </span>
                )}
              </div>
            </button>
            {coverActionsOpen && canEditPublicBranding && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCoverActionsOpen(false);
                    coverFileRef.current?.click();
                  }}
                  disabled={!canEditPublicBranding || uploadingCover}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85 hover:bg-white/15 disabled:opacity-60"
                >
                  {uploadingCover ? "A carregar..." : "Alterar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrandingCoverUrlInput("");
                    setCoverActionsOpen(false);
                    setPublicProfileMessage("Capa removida. Guarda para publicar.");
                  }}
                  disabled={!canEditPublicBranding || !hasCoverImage}
                  className="rounded-full border border-white/20 bg-transparent px-3 py-1 text-[12px] font-semibold text-white/70 hover:bg-white/10 disabled:opacity-60"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        </div>
        <input
          ref={avatarFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.currentTarget.value = "";
            void handleBrandingUpload("avatar", file);
          }}
        />
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.currentTarget.value = "";
            if (!file) return;
            setCoverCropFile(file);
            setShowCoverCropModal(true);
          }}
        />

        <label className="space-y-1">
          <span className="text-[12px] text-white/70">Bio pública</span>
          <textarea
            value={publicDescriptionInput}
            onChange={(e) => setPublicDescriptionInput(e.target.value)}
            disabled={!canEditPublicProfile}
            className={`min-h-[90px] w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
              canEditPublicProfile
                ? "border-white/15 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
                : "cursor-not-allowed border-white/10 text-white/60"
            }`}
            placeholder="Descrição pública da organização."
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[12px] text-white/70">Website</span>
            <input
              value={publicWebsiteInput}
              onChange={(e) => setPublicWebsiteInput(e.target.value)}
              disabled={!canEditPublicProfile}
              className={`w-full rounded-xl border bg-black/45 px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/35 ${
                canEditPublicProfile
                  ? "border-white/15 hover:border-white/30 focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/40"
                  : "cursor-not-allowed border-white/10 text-white/60"
              }`}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] text-white/70">Instagram</span>
            <div className="flex items-center rounded-xl border border-white/15 bg-black/45 px-3 py-2">
              <span className="pr-2 text-[11px] text-white/50">https://www.instagram.com/</span>
              <input
                value={publicInstagramHandle}
                onChange={(e) => setPublicInstagramHandle(e.target.value)}
                disabled={!canEditPublicProfile}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/35 ${
                  canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/60"
                }`}
                placeholder="username"
              />
            </div>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[12px] text-white/70">YouTube</span>
            <div className="flex items-center rounded-xl border border-white/15 bg-black/45 px-3 py-2">
              <span className="pr-2 text-[11px] text-white/50">https://www.youtube.com/</span>
              <input
                value={publicYoutubeHandle}
                onChange={(e) => setPublicYoutubeHandle(e.target.value)}
                disabled={!canEditPublicProfile}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/35 ${
                  canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/60"
                }`}
                placeholder="@canal"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[12px] text-white/70">TikTok</span>
            <div className="flex items-center rounded-xl border border-white/15 bg-black/45 px-3 py-2">
              <span className="pr-2 text-[11px] text-white/50">https://www.tiktok.com/@</span>
              <input
                value={publicTiktokHandle}
                onChange={(e) => setPublicTiktokHandle(e.target.value.replace(/^@+/, ""))}
                disabled={!canEditPublicProfile}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/35 ${
                  canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/60"
                }`}
                placeholder="username"
              />
            </div>
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-[12px] text-white/70">LinkedIn</span>
          <div className="flex items-center rounded-xl border border-white/15 bg-black/45 px-3 py-2">
            <span className="pr-2 text-[11px] text-white/50">https://www.linkedin.com/company/</span>
            <input
              value={publicLinkedinHandle}
              onChange={(e) => setPublicLinkedinHandle(e.target.value)}
              disabled={!canEditPublicProfile}
              className={`w-full bg-transparent text-sm outline-none placeholder:text-white/35 ${
                canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/60"
              }`}
              placeholder="handle"
            />
          </div>
        </label>

        <p className="text-[11px] text-white/55">
          Dono/Co-dono: edição completa. Admin: bio e links sociais/website. Equipa: leitura.
        </p>
        {publicProfileMessage && <p className="text-[12px] text-white/70">{publicProfileMessage}</p>}
      </section>

      <ProfileCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />

      {isOwner && (
        <section className="relative overflow-hidden rounded-3xl border border-red-400/40 bg-gradient-to-br from-red-500/15 via-[#2a0c0f]/85 to-black/90 p-5 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-100">Zona de perigo</h2>
              <p className="text-[12px] text-red-100/80">
                Suspender, reativar e apagar são ações exclusivas do Dono.
              </p>
            </div>
          </div>
          {!isOrganizationSuspended ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-300/35 bg-amber-500/10 p-3 text-[12px] text-amber-100">
                Suspender bloqueia a operação diária e abre uma janela de 30 dias para reativação.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setSuspendDialogOpen(true)}
                  disabled={suspendLoading || !canSuspendOrganization}
                  className={`${CTA_DANGER} w-full justify-center disabled:opacity-60 sm:w-auto`}
                >
                  {suspendLoading ? "A suspender…" : "Suspender organização"}
                </button>
                {suspendFeedback && <p className="text-[12px] text-white/70">{suspendFeedback}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-[12px] text-emerald-100">
                Organização suspensa. A reativação repõe acesso operacional imediato.
                {suspensionDeadlineDate ? ` Prazo limite: ${suspensionDeadlineDate.toLocaleString()}.` : ""}
              </div>
              <button
                type="button"
                onClick={handleReactivateOrganization}
                disabled={reactivateLoading || !canReactivateOrganization}
                className={`${CTA_PRIMARY} w-full justify-center disabled:opacity-60 sm:w-auto`}
              >
                {reactivateLoading ? "A reativar…" : "Reativar organização"}
              </button>
              {reactivateFeedback && (
                <p className="text-[12px] text-white/70">
                  {reactivateFeedback}
                </p>
              )}
              {!canReactivateOrganization && (
                <p className="text-[12px] text-white/70">
                  A janela de reativação terminou.
                </p>
              )}
            </div>
          )}

          {isOrganizationSuspended && (
            <div className="rounded-2xl border border-red-400/30 bg-black/25 p-4 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-red-100/90">
                Eliminação definitiva
              </p>
              {!canDeleteOrganization ? (
                <p className="text-[12px] text-white/70">
                  Disponível apenas após o fecho da janela de reativação.
                </p>
              ) : (
                <p className="text-[12px] text-white/70">
                  Esta ação remove permanentemente a organização.
                </p>
              )}
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
                    disabled={!dangerReady || dangerLoading || !canDeleteOrganization}
                    className={`${CTA_DANGER} w-full justify-center disabled:opacity-60 md:w-auto`}
                  >
                    {dangerLoading ? "A apagar…" : "Apagar organização"}
                  </button>
                </div>
              </div>
              {dangerFeedback && (
                <p className="text-[12px] text-white/70">{dangerFeedback}</p>
              )}
            </div>
          )}
        </section>
      )}

      <ConfirmDestructiveActionDialog
        open={suspendDialogOpen}
        title="Suspender organização?"
        description="A organização fica em pausa operacional durante 30 dias."
        consequences={[
          "Operações de vendas e gestão ficam bloqueadas.",
          "A equipa perde acesso operacional até reativação.",
          "Podes avançar para eliminação definitiva depois da janela de suspensão.",
        ]}
        confirmLabel="Suspender organização"
        cancelLabel="Cancelar"
        dangerLevel="medium"
        onClose={() => setSuspendDialogOpen(false)}
        onConfirm={() => {
          handleSuspendOrganization();
        }}
      />

      <ConfirmDestructiveActionDialog
        open={dangerDialogOpen}
        title="Apagar organização?"
        description="Este passo inicia o fluxo de remoção da organização."
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
