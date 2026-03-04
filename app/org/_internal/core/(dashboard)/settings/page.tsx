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
import { AvatarCropModal } from "@/app/components/forms/AvatarCropModal";
import {
  CTA_DANGER_CLEAN,
  CTA_PRIMARY_CLEAN,
  CTA_SECONDARY_CLEAN,
} from "@/app/org/_internal/core/dashboardUi";
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
const ORG_CLEAN_INPUT_BASE = "org-clean-input";
const ORG_CLEAN_LABEL = "org-clean-label";
const ORG_CLEAN_HELP = "org-clean-help";

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
  const policiesHref = organizationId ? buildOrgHref(organizationId, "/policies") : "/org/policies";

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
  const [isPublicIdentityEditing, setIsPublicIdentityEditing] = useState(false);
  const [publicNameDraft, setPublicNameDraft] = useState("");
  const [publicUsernameDraft, setPublicUsernameDraft] = useState("");
  const [publicDescriptionDraft, setPublicDescriptionDraft] = useState("");
  const [brandingAvatarUrlInput, setBrandingAvatarUrlInput] = useState("");
  const [brandingCoverUrlInput, setBrandingCoverUrlInput] = useState("");
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);
  const [publicProfileMessage, setPublicProfileMessage] = useState<string | null>(null);
  const [orgFormDirty, setOrgFormDirty] = useState(false);
  const [officialEmailDirty, setOfficialEmailDirty] = useState(false);
  const [publicProfileDirty, setPublicProfileDirty] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const avatarActionsRef = useRef<HTMLDivElement | null>(null);
  const coverActionsRef = useRef<HTMLDivElement | null>(null);
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false);
  const [coverActionsOpen, setCoverActionsOpen] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [showAvatarCropModal, setShowAvatarCropModal] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const hydratedOrganizationIdRef = useRef<number | null>(null);

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
    const organizationChanged = hydratedOrganizationIdRef.current !== organization.id;
    if (organizationChanged) {
      hydratedOrganizationIdRef.current = organization.id;
      setOrgFormDirty(false);
      setOfficialEmailDirty(false);
      setPublicProfileDirty(false);
    }

    const shouldHydrateOrgForm = organizationChanged || !orgFormDirty;
    const shouldHydrateOfficialEmail = organizationChanged || !officialEmailDirty;
    const shouldHydratePublicProfile = organizationChanged || !publicProfileDirty;

    const formatted = organization.addressRef?.formattedAddress ?? "";
    if (shouldHydrateOrgForm) {
      setAddressQuery(formatted);
      setAddressId(organization.addressId ?? null);
      setShowAddressPublicly((organization as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false);
      setContactPhone(profile?.contactPhone ?? "");
      setSupportEmail(organization.supportEmail ?? "");
      setSupportPhone(organization.supportPhone ?? "");
    }

    if (shouldHydrateOfficialEmail) {
      const pendingEmail = normalizeOfficialEmail(
        (organization as { officialEmailPending?: { newEmail?: string | null } | null })?.officialEmailPending?.newEmail ?? null,
      );
      setOfficialEmail(pendingEmail ?? "");
    }

    if (shouldHydratePublicProfile) {
      setPublicNameInput(organization.publicName ?? "");
      setPublicUsernameInput(organization.username ?? "");
      setPublicDescriptionInput(organization.publicDescription ?? "");
      setPublicNameDraft(organization.publicName ?? "");
      setPublicUsernameDraft(organization.username ?? "");
      setPublicDescriptionDraft(organization.publicDescription ?? "");
      setPublicWebsiteInput(organization.publicWebsite ?? "");
      setPublicInstagramHandle(extractPublicSocialHandle(organization.publicInstagram ?? null, "instagram"));
      setPublicYoutubeHandle(extractPublicSocialHandle(organization.publicYoutube ?? null, "youtube"));
      setPublicTiktokHandle(extractPublicSocialHandle(organization.publicTiktok ?? null, "tiktok"));
      setBrandingAvatarUrlInput(organization.brandingAvatarUrl ?? "");
      setBrandingCoverUrlInput(organization.brandingCoverUrl ?? "");
    }

    if (organizationChanged) {
      setAvatarActionsOpen(false);
      setCoverActionsOpen(false);
      setIsPublicIdentityEditing(false);
      setAvatarCropFile(null);
      setShowAvatarCropModal(false);
      setCoverCropFile(null);
      setShowCoverCropModal(false);
    }
  }, [organization, profile, orgFormDirty, officialEmailDirty, publicProfileDirty]);

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

  const startPublicIdentityEdit = () => {
    if (!canEditPublicProfile) return;
    setPublicNameDraft(publicNameInput);
    setPublicUsernameDraft(publicUsernameInput);
    setPublicDescriptionDraft(publicDescriptionInput);
    setIsPublicIdentityEditing(true);
  };

  const cancelPublicIdentityEdit = () => {
    setPublicNameDraft(publicNameInput);
    setPublicUsernameDraft(publicUsernameInput);
    setPublicDescriptionDraft(publicDescriptionInput);
    setIsPublicIdentityEditing(false);
  };

  const applyPublicIdentityEdit = () => {
    const nextName = publicNameDraft;
    const nextUsername = publicUsernameDraft.replace(/^@+/, "");
    const nextDescription = publicDescriptionDraft;
    const changed =
      nextName !== publicNameInput ||
      nextUsername !== publicUsernameInput ||
      nextDescription !== publicDescriptionInput;
    setPublicNameInput(nextName);
    setPublicUsernameInput(nextUsername);
    setPublicDescriptionInput(nextDescription);
    if (changed) setPublicProfileDirty(true);
    setIsPublicIdentityEditing(false);
  };

  useEffect(() => {
    if (!avatarActionsOpen && !coverActionsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (avatarActionsRef.current?.contains(target) || coverActionsRef.current?.contains(target)) return;
      setAvatarActionsOpen(false);
      setCoverActionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAvatarActionsOpen(false);
      setCoverActionsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [avatarActionsOpen, coverActionsOpen]);

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
        await mutate();
        setOrgFormDirty(false);
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
    if (isPublicIdentityEditing) {
      setPublicProfileMessage("Guarda ou cancela a edição de nome, username e bio antes de publicar.");
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
      setPublicProfileDirty(false);
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
      setPublicProfileDirty(true);
      setPublicProfileMessage(`${kind === "avatar" ? "Logo" : "Capa"} carregada. Guarda para publicar.`);
    } catch (err) {
      console.error("[organização/settings] branding-upload", err);
      setPublicProfileMessage(`Erro no upload da ${kind === "avatar" ? "logo" : "capa"}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleAvatarCropCancel() {
    setShowAvatarCropModal(false);
    setAvatarCropFile(null);
  }

  async function handleAvatarCropConfirm(file: File) {
    setShowAvatarCropModal(false);
    setAvatarCropFile(null);
    await handleBrandingUpload("avatar", file);
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
          setOfficialEmailDirty(false);
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
      setOfficialEmailDirty(false);
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
      setOfficialEmailDirty(false);
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
          embedded ? "org-clean-page" : "w-full py-8 org-clean-page",
        )}
        data-org-ui="clean-v1"
      >
        <div className="org-clean-section">
          A validar sessão…
        </div>
      </div>
    );
  }

  if (!user && !hasOrganization) {
    return (
      <div
        className={cn(
          embedded ? "space-y-4 org-clean-page" : "w-full space-y-4 py-8 org-clean-page",
        )}
        data-org-ui="clean-v1"
      >
        <div className="org-clean-section space-y-3">
          <p className={ORG_CLEAN_HELP}>Inicia sessão para definições.</p>
          <button
            type="button"
            onClick={() => openModal({ mode: "login", redirectTo, showGoogle: true })}
            className={CTA_PRIMARY_CLEAN}
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
          embedded ? "org-clean-page" : "w-full py-8 org-clean-page",
        )}
        data-org-ui="clean-v1"
      >
        <div className="org-clean-section">
          Ativa a conta de organização para gerir estas definições.
        </div>
      </div>
    );
  }

  const wrapperClass = cn(
    embedded ? "space-y-6 org-clean-page" : "w-full space-y-6 py-8 org-clean-page",
  );

  return (
    <div className={wrapperClass} data-org-ui="clean-v1">
      {isOrganizationSuspended && (
        <section className="org-clean-section border-amber-400/45 bg-amber-500/14 text-amber-50">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/88">Organização suspensa</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Acesso em modo de leitura</h2>
          <p className="mt-1 text-[14px] text-amber-100/88">
            {suspension?.reactivationWindowOpen
              ? suspensionRemainingDays === 0
                ? "Último dia para reativar antes da eliminação definitiva."
                : `Janela de reativação aberta (${suspensionRemainingDays ?? "?"} dias restantes).`
              : "A janela de reativação terminou."}
          </p>
          {suspensionDeadlineDate && (
            <p className="mt-1 text-[13px] text-amber-100/82">
              Prazo de reativação: {suspensionDeadlineDate.toLocaleString()}.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReactivateOrganization}
              disabled={!canReactivateOrganization || reactivateLoading}
              className={`${CTA_PRIMARY_CLEAN} disabled:opacity-60`}
            >
              {reactivateLoading ? "A reativar…" : "Reativar organização"}
            </button>
            {reactivateFeedback && <p className="text-[13px] text-amber-100">{reactivateFeedback}</p>}
          </div>
        </section>
      )}

      <section className="org-clean-section space-y-4">
        <div className="org-clean-section-header">
          <div>
            <h2 className="org-clean-title">Operacional</h2>
            <p className="org-clean-subtitle">Contactos e informação pública.</p>
          </div>
          <div className="org-clean-actions">
            {canViewSensitive && (
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] ${officialEmailBadgeClass}`}>
                {officialEmailStatusLabel}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveOrg}
              disabled={savingOrg || !canEditOperational}
              className={`${CTA_PRIMARY_CLEAN} disabled:opacity-60`}
            >
              {savingOrg ? "A guardar…" : "Guardar contactos"}
            </button>
          </div>
        </div>
        <div className="org-clean-divider" />
        {canViewSensitive ? (
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              <label className={`${ORG_CLEAN_LABEL} flex items-center gap-2`}>
                Email oficial ativo
                <span className="org-clean-chip text-[10px] uppercase tracking-[0.12em]">
                  {isOwnerOrCoOwner ? "Dono / Co-dono" : "Apenas Dono / Co-dono"}
                </span>
              </label>
              <input
                value={officialEmailNormalized ?? ""}
                disabled
                className={`${ORG_CLEAN_INPUT_BASE} cursor-not-allowed border-white/16 text-white/90`}
                placeholder="Sem email oficial ativo"
              />
              <label className={`${ORG_CLEAN_LABEL} pt-1`}>Novo email oficial</label>
              <input
                value={officialEmail}
                onChange={(e) => {
                  setOfficialEmail(e.target.value);
                  setOfficialEmailDirty(true);
                }}
                disabled={!isOwnerOrCoOwner || officialEmailSaving || isOrganizationSuspended}
                className={`${ORG_CLEAN_INPUT_BASE} ${
                  isOwnerOrCoOwner && !isOrganizationSuspended
                    ? ""
                    : "cursor-not-allowed border-white/12 text-white/70"
                }`}
                placeholder="equipa@organização.pt"
              />
              {!hasPendingOfficialEmail && !hasOfficialEmailInput && (
                <p className={ORG_CLEAN_HELP}>
                  Sem alterações pendentes. Introduz um novo email para iniciar a alteração.
                </p>
              )}
              {!hasPendingOfficialEmail && hasOfficialEmailInput && isOfficialEmailInputSameAsActive && (
                <p className={ORG_CLEAN_HELP}>
                  O email introduzido já é o email oficial ativo.
                </p>
              )}
              {hasPendingOfficialEmail && (
                <div className="rounded-xl border border-amber-300/40 bg-amber-500/12 px-3 py-2 text-[13px] text-amber-100">
                  Alteração pendente para: <span className="font-semibold">{pendingOfficialEmailNormalized}</span>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-xl border border-white/20 bg-white/[0.02] p-4 text-[13px] text-white/84">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/70">Estado</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${officialEmailBadgeClass}`}>
                  {officialEmailStatusLabel}
                </span>
              </div>
              <p>Email oficial para faturação, payouts e alertas operacionais.</p>
              {hasPendingOfficialEmail && pendingOfficialEmailExpiresAtDate && (
                <p className="text-[13px] text-amber-200">
                  Validade do pedido pendente até {pendingOfficialEmailExpiresAtDate.toLocaleString()}.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {showOfficialEmailPrimaryAction && (
                  <button
                    type="button"
                    onClick={handleOfficialEmailUpdate}
                    disabled={officialEmailActionDisabled}
                    className={`${CTA_PRIMARY_CLEAN} disabled:opacity-60`}
                  >
                    {officialEmailSaving ? "A enviar…" : officialEmailActionLabel}
                  </button>
                )}
                {hasPendingOfficialEmail && (
                  <button
                    type="button"
                    onClick={handleCancelOfficialEmailPending}
                    disabled={!isOwnerOrCoOwner || officialEmailSaving || isOrganizationSuspended}
                    className={`${CTA_SECONDARY_CLEAN} disabled:opacity-60`}
                  >
                    Cancelar pendente
                  </button>
                )}
              </div>
              {officialEmailMessage && <p className={ORG_CLEAN_HELP}>{officialEmailMessage}</p>}
              {!isOfficialEmailVerified && !officialEmailNormalized && (
                <p className="text-[13px] text-amber-200">Sem email oficial verificado.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/18 bg-white/[0.02] px-4 py-3 text-[13px] text-white/82">
            Email oficial e faturação apenas disponível para Dono e Co-dono.
          </div>
        )}
        <div className="org-clean-divider" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={ORG_CLEAN_LABEL}>Email de suporte da loja (opcional)</label>
            <input
              value={supportEmail}
              onChange={(e) => {
                setSupportEmail(e.target.value);
                setOrgFormDirty(true);
              }}
              type="email"
              className={ORG_CLEAN_INPUT_BASE}
              placeholder="suporte@organizacao.pt"
              disabled={!canEditOperational}
            />
          </div>
          <div className="space-y-1">
            <label className={ORG_CLEAN_LABEL}>Telefone de suporte da loja (opcional)</label>
            <input
              value={supportPhone}
              onChange={(e) => {
                const sanitized = sanitizePhone(e.target.value);
                setSupportPhone(sanitized);
                setOrgFormDirty(true);
                if (sanitized && !isValidPhone(sanitized)) {
                  setSupportPhoneError("Telefone de suporte inválido.");
                } else {
                  setSupportPhoneError(null);
                }
              }}
              inputMode="tel"
              pattern="\\+?\\d{6,15}"
              maxLength={18}
              className={`${ORG_CLEAN_INPUT_BASE} ${
                supportPhoneError
                  ? "border-red-300/70 focus-visible:border-red-300"
                  : ""
              }`}
              placeholder="+351912345678"
              disabled={!canEditOperational}
            />
            {supportPhoneError && <p className="text-[13px] text-red-300">{supportPhoneError}</p>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={ORG_CLEAN_LABEL}>Telefone (opcional)</label>
            <input
              value={contactPhone}
              onChange={(e) => {
                const sanitized = sanitizePhone(e.target.value);
                setContactPhone(sanitized);
                setOrgFormDirty(true);
                if (sanitized && !isValidPhone(sanitized)) {
                  setPhoneError("Telefone inválido. Introduz um número válido (podes incluir indicativo, ex.: +351...).");
                } else {
                  setPhoneError(null);
                }
              }}
              inputMode="tel"
              pattern="\\+?\\d{6,15}"
              maxLength={18}
              className={`${ORG_CLEAN_INPUT_BASE} ${
                phoneError
                  ? "border-red-300/70 focus-visible:border-red-300"
                  : ""
              }`}
              placeholder="+351912345678"
              disabled={!canEditOperational}
            />
            {phoneError && <p className="text-[13px] text-red-300">{phoneError}</p>}
          </div>
          <div className="space-y-1">
            <AddressCombobox
              label="Morada (Apple Maps)"
              value={addressQuery}
              onValueChange={(next) => {
                setAddressQuery(next);
                setOrgFormDirty(true);
              }}
              addressId={addressId}
              onAddressIdChange={(next) => {
                setAddressId(next);
                setOrgFormDirty(true);
              }}
              disabled={!canEditOperational}
              minChars={2}
              maxItems={10}
              enableRecents
              enableGeolocationCta
            />
            <label className={`${ORG_CLEAN_LABEL} mt-1 flex items-center gap-2`}>
              <input
                type="checkbox"
                checked={showAddressPublicly}
                onChange={(e) => {
                  setShowAddressPublicly(e.target.checked);
                  setOrgFormDirty(true);
                }}
                className="h-4 w-4 accent-[#22D3EE]"
                disabled={!canEditOperational}
              />
              Mostrar na página pública
            </label>
          </div>
        </div>
        {orgMessage && <p className={ORG_CLEAN_HELP}>{orgMessage}</p>}
      </section>

      <section className="org-clean-section">
        <div className="org-clean-section-header">
          <div>
            <h2 className="org-clean-title">Políticas operacionais</h2>
            <p className="org-clean-subtitle">
              A política de reservas de campos foi movida para a área de Políticas.
            </p>
          </div>
          <a href={policiesHref} className={CTA_PRIMARY_CLEAN}>
            Abrir políticas
          </a>
        </div>
      </section>

      <section className="org-clean-section space-y-4">
        <div className="org-clean-section-header">
          <div>
            <h2 className="org-clean-title">Perfil público</h2>
            <p className="org-clean-subtitle">Edita diretamente no preview e publica quando estiver pronto.</p>
          </div>
          <button
            type="button"
            onClick={handleSavePublicProfile}
            disabled={savingPublicProfile || !canEditPublicProfile}
            className={`${CTA_PRIMARY_CLEAN} disabled:opacity-60`}
          >
            {savingPublicProfile ? "A guardar…" : "Guardar perfil público"}
          </button>
        </div>

        <div className="org-clean-divider" />

        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/[0.02]">
          <ProfileHeaderLayout
            coverUrl={publicPreviewCoverDisplay}
            onCoverClick={
              canEditPublicBranding
                ? () => {
                    setCoverActionsOpen((prev) => !prev);
                    setAvatarActionsOpen(false);
                  }
                : null
            }
            coverActionsSlot={
              canEditPublicBranding ? (
                <div
                  ref={coverActionsRef}
                  className="relative"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCoverActionsOpen((prev) => !prev);
                      setAvatarActionsOpen(false);
                    }}
                    disabled={!canEditPublicBranding}
                    className={`${CTA_SECONDARY_CLEAN} px-3 py-1 text-[12px] font-semibold disabled:opacity-60`}
                  >
                    {hasCoverImage ? "Editar capa" : "Adicionar capa"}
                  </button>
                  {coverActionsOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-44 rounded-2xl border border-white/20 bg-[rgba(11,15,23,0.98)] p-1.5 text-sm text-white">
                      <button
                        type="button"
                        onClick={() => {
                          setCoverActionsOpen(false);
                          coverFileRef.current?.click();
                        }}
                        disabled={uploadingCover}
                        className="block w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {uploadingCover ? "A carregar..." : "Alterar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBrandingCoverUrlInput("");
                          setPublicProfileDirty(true);
                          setCoverActionsOpen(false);
                          setPublicProfileMessage("Capa removida. Guarda para publicar.");
                        }}
                        disabled={!hasCoverImage}
                        className="block w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/70 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              ) : null
            }
            coverHeightClassName="aspect-[3/1] h-auto"
            contentWidthClassName="mx-auto w-full max-w-[640px]"
            avatarSlot={
              <div ref={avatarActionsRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!canEditPublicBranding) return;
                    setAvatarActionsOpen((prev) => !prev);
                    setCoverActionsOpen(false);
                  }}
                  disabled={!canEditPublicBranding}
                  className={cn(
                    "relative inline-flex rounded-full",
                    canEditPublicBranding
                      ? "cursor-pointer transition-colors"
                      : "cursor-default",
                  )}
                >
                  <Avatar
                    src={publicPreviewAvatar}
                    name={publicPreviewName}
                    className="h-28 w-28"
                    textClassName="text-[10px] tracking-[0.14em]"
                  />
                  {canEditPublicBranding && (
                    <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/60 text-[12px] text-white/90">
                      ✎
                    </span>
                  )}
                </button>
                {avatarActionsOpen && canEditPublicBranding && (
                  <div className="absolute left-1/2 top-[calc(100%+10px)] z-30 w-44 -translate-x-1/2 rounded-2xl border border-white/20 bg-[rgba(11,15,23,0.98)] p-1.5 text-sm text-white">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarActionsOpen(false);
                        avatarFileRef.current?.click();
                      }}
                      disabled={uploadingAvatar}
                      className="block w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {uploadingAvatar ? "A carregar..." : "Alterar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBrandingAvatarUrlInput("");
                        setPublicProfileDirty(true);
                        setAvatarActionsOpen(false);
                        setPublicProfileMessage("Logo removida. Guarda para publicar.");
                      }}
                      disabled={!hasAvatarImage}
                      className="block w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/70 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            }
            titleSlot={
              isPublicIdentityEditing && canEditPublicBranding ? (
                <input
                  value={publicNameDraft}
                  onChange={(event) => setPublicNameDraft(event.target.value)}
                  className={`${ORG_CLEAN_INPUT_BASE} text-[20px] font-semibold tracking-tight`}
                  placeholder="Nome público"
                  maxLength={80}
                />
              ) : (
                <h3 className="truncate text-[20px] font-semibold tracking-tight text-white">{publicPreviewName}</h3>
              )
            }
            metaSlot={
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-white/88">
                {isPublicIdentityEditing && canEditPublicUsername ? (
                  <div className="flex items-center rounded-full border border-white/20 bg-white/[0.02] px-3 py-1">
                    <span className="pr-1 text-white/78">@</span>
                    <input
                      value={publicUsernameDraft}
                      onChange={(event) => setPublicUsernameDraft(event.target.value.replace(/^@+/, ""))}
                      className="w-[200px] bg-transparent text-sm text-white outline-none placeholder:text-white/70"
                      placeholder="username"
                      maxLength={24}
                    />
                  </div>
                ) : (
                  <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 font-semibold text-white">
                    @{publicPreviewUsername}
                  </span>
                )}
                {canEditPublicProfile && !isPublicIdentityEditing && (
                  <button
                    type="button"
                    onClick={startPublicIdentityEdit}
                    className={`${CTA_SECONDARY_CLEAN} px-3 py-1 text-[12px]`}
                  >
                    Editar
                  </button>
                )}
              </div>
            }
            bioSlot={
              isPublicIdentityEditing ? (
                <div className="flex max-w-xl flex-col gap-2">
                  <textarea
                    value={publicDescriptionDraft}
                    onChange={(event) => setPublicDescriptionDraft(event.target.value.slice(0, 280))}
                    disabled={!canEditPublicProfile}
                    className={cn(
                      `min-h-[90px] w-full ${ORG_CLEAN_INPUT_BASE}`,
                      canEditPublicProfile
                        ? ""
                        : "cursor-not-allowed border-white/12 text-white/72",
                    )}
                    placeholder="Descrição pública da organização."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={applyPublicIdentityEdit}
                      className={`${CTA_PRIMARY_CLEAN} px-3 py-1 text-[12px]`}
                    >
                      Guardar edição
                    </button>
                    <button
                      type="button"
                      onClick={cancelPublicIdentityEdit}
                      className={`${CTA_SECONDARY_CLEAN} px-3 py-1 text-[12px]`}
                    >
                      Cancelar
                    </button>
                    <span className={ORG_CLEAN_HELP}>{publicDescriptionDraft.length}/280</span>
                  </div>
                </div>
              ) : (
                <p className="max-w-xl whitespace-pre-line text-sm leading-relaxed text-white/90">{publicPreviewBio}</p>
              )
            }
          />
        </div>

        <input
          ref={avatarFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.currentTarget.value = "";
            if (!file) return;
            setAvatarCropFile(file);
            setShowAvatarCropModal(true);
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

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className={ORG_CLEAN_LABEL}>Website</span>
            <input
              value={publicWebsiteInput}
              onChange={(e) => {
                setPublicWebsiteInput(e.target.value);
                setPublicProfileDirty(true);
              }}
              disabled={!canEditPublicProfile}
              className={`${ORG_CLEAN_INPUT_BASE} ${
                canEditPublicProfile
                  ? ""
                  : "cursor-not-allowed border-white/12 text-white/72"
              }`}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1">
            <span className={ORG_CLEAN_LABEL}>Instagram</span>
            <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.02] px-3 py-2">
              <span className="pr-2 text-[13px] text-white/80">https://www.instagram.com/</span>
              <input
                value={publicInstagramHandle}
                onChange={(e) => {
                  setPublicInstagramHandle(e.target.value);
                  setPublicProfileDirty(true);
                }}
                disabled={!canEditPublicProfile}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/70 ${
                  canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/72"
                }`}
                placeholder="username"
              />
            </div>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className={ORG_CLEAN_LABEL}>YouTube</span>
            <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.02] px-3 py-2">
              <span className="pr-2 text-[13px] text-white/80">https://www.youtube.com/</span>
              <input
                value={publicYoutubeHandle}
                onChange={(e) => {
                  setPublicYoutubeHandle(e.target.value);
                  setPublicProfileDirty(true);
                }}
                disabled={!canEditPublicProfile}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/70 ${
                  canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/72"
                }`}
                placeholder="@canal"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className={ORG_CLEAN_LABEL}>TikTok</span>
            <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.02] px-3 py-2">
              <span className="pr-2 text-[13px] text-white/80">https://www.tiktok.com/@</span>
              <input
                value={publicTiktokHandle}
                onChange={(e) => {
                  setPublicTiktokHandle(e.target.value.replace(/^@+/, ""));
                  setPublicProfileDirty(true);
                }}
                disabled={!canEditPublicProfile}
                className={`w-full bg-transparent text-sm outline-none placeholder:text-white/70 ${
                  canEditPublicProfile ? "text-white" : "cursor-not-allowed text-white/72"
                }`}
                placeholder="username"
              />
            </div>
          </label>
        </div>

        <p className={ORG_CLEAN_HELP}>
          Dono/Co-dono: edição completa. Admin: bio e links sociais/website. Equipa: leitura.
        </p>
        {publicProfileMessage && <p className={ORG_CLEAN_HELP}>{publicProfileMessage}</p>}
      </section>

      <AvatarCropModal
        open={showAvatarCropModal}
        file={avatarCropFile}
        onCancel={handleAvatarCropCancel}
        onConfirm={handleAvatarCropConfirm}
      />

      <ProfileCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />

      {isOwner && (
        <section className="org-clean-section space-y-3 border-red-400/45 bg-red-500/12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-100">Zona de perigo</h2>
              <p className="text-[13px] text-red-100/88">
                Suspender, reativar e apagar são ações exclusivas do Dono.
              </p>
            </div>
          </div>
          {!isOrganizationSuspended ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-300/45 bg-amber-500/14 p-3 text-[13px] text-amber-100">
                Suspender bloqueia a operação diária e abre uma janela de 30 dias para reativação.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setSuspendDialogOpen(true)}
                  disabled={suspendLoading || !canSuspendOrganization}
                  className={`${CTA_DANGER_CLEAN} w-full justify-center disabled:opacity-60 sm:w-auto`}
                >
                  {suspendLoading ? "A suspender…" : "Suspender organização"}
                </button>
                {suspendFeedback && <p className={ORG_CLEAN_HELP}>{suspendFeedback}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-300/45 bg-emerald-500/14 p-3 text-[13px] text-emerald-100">
                Organização suspensa. A reativação repõe acesso operacional imediato.
                {suspensionDeadlineDate ? ` Prazo limite: ${suspensionDeadlineDate.toLocaleString()}.` : ""}
              </div>
              <button
                type="button"
                onClick={handleReactivateOrganization}
                disabled={reactivateLoading || !canReactivateOrganization}
                className={`${CTA_PRIMARY_CLEAN} w-full justify-center disabled:opacity-60 sm:w-auto`}
              >
                {reactivateLoading ? "A reativar…" : "Reativar organização"}
              </button>
              {reactivateFeedback && (
                <p className={ORG_CLEAN_HELP}>
                  {reactivateFeedback}
                </p>
              )}
              {!canReactivateOrganization && (
                <p className={ORG_CLEAN_HELP}>
                  A janela de reativação terminou.
                </p>
              )}
            </div>
          )}

          {isOrganizationSuspended && (
            <div className="rounded-xl border border-red-400/35 bg-red-500/[0.08] p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-100/90">
                Eliminação definitiva
              </p>
              {!canDeleteOrganization ? (
                <p className={ORG_CLEAN_HELP}>
                  Disponível apenas após o fecho da janela de reativação.
                </p>
              ) : (
                <p className={ORG_CLEAN_HELP}>
                  Esta ação remove permanentemente a organização.
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr] md:items-end">
                <div className="space-y-1">
                  <label className={ORG_CLEAN_LABEL}>Escreve APAGAR para confirmar</label>
                  <input
                    value={dangerConfirm}
                    onChange={(e) => setDangerConfirm(e.target.value)}
                    className={`${ORG_CLEAN_INPUT_BASE} border-red-300/70 focus-visible:border-red-300`}
                    placeholder="APAGAR"
                  />
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <button
                    type="button"
                    onClick={() => setDangerDialogOpen(true)}
                    disabled={!dangerReady || dangerLoading || !canDeleteOrganization}
                    className={`${CTA_DANGER_CLEAN} w-full justify-center disabled:opacity-60 md:w-auto`}
                  >
                    {dangerLoading ? "A apagar…" : "Apagar organização"}
                  </button>
                </div>
              </div>
              {dangerFeedback && (
                <p className={ORG_CLEAN_HELP}>{dangerFeedback}</p>
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
