"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { trackEvent } from "@/lib/analytics";
import { RoleBadge } from "../../RoleBadge";
import { CTA_DANGER, CTA_GHOST, CTA_NEUTRAL, CTA_PRIMARY, CTA_SECONDARY, CTA_SUCCESS } from "@/app/organizacao/dashboardUi";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type MemberRole = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | "TRAINER" | "PROMOTER";

type Member = {
  userId: string;
  role: MemberRole;
  invitedByUserId: string | null;
  createdAt: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type MembersResponse = {
  ok: boolean;
  items: Member[];
  viewerRole?: MemberRole | null;
  organizationId?: number | null;
  error?: string;
};
type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
type Invite = {
  id: string;
  organizationId: number;
  role: MemberRole;
  targetIdentifier: string;
  targetUserId: string | null;
  status: InviteStatus;
  expiresAt: string | null;
  createdAt: string;
  invitedBy: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null } | null;
  targetUser: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null; email: string | null } | null;
  canRespond?: boolean;
};

type InvitesResponse = {
  ok: boolean;
  items: Invite[];
  viewerRole?: MemberRole | null;
  organizationId?: number | null;
  error?: string;
};
type TrainerItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isPublished: boolean;
  reviewStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewRequestedAt: string | null;
};
type TrainersResponse = {
  ok: boolean;
  items: TrainerItem[];
  organizationId?: number | null;
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const roleLabels: Record<MemberRole, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  ADMIN: "Admin",
  STAFF: "Staff",
  TRAINER: "Treinador",
  PROMOTER: "Promoter",
};

const roleOrder: Record<MemberRole, number> = {
  OWNER: 0,
  CO_OWNER: 1,
  ADMIN: 2,
  STAFF: 3,
  TRAINER: 4,
  PROMOTER: 5,
};

const statusTone: Record<InviteStatus, string> = {
  PENDING:
    "border-amber-200/60 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-amber-600/25 text-amber-50 shadow-[0_10px_32px_rgba(251,191,36,0.25)]",
  EXPIRED: "border-white/15 bg-gradient-to-r from-white/8 via-white/4 to-white/6 text-white/60",
  ACCEPTED:
    "border-emerald-300/60 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-600/25 text-emerald-50 shadow-[0_10px_32px_rgba(52,211,153,0.25)]",
  DECLINED:
    "border-red-300/60 bg-gradient-to-r from-red-500/30 via-red-500/15 to-red-700/25 text-red-100 shadow-[0_10px_32px_rgba(239,68,68,0.25)]",
  CANCELLED: "border-white/15 bg-gradient-to-r from-white/8 via-white/4 to-white/6 text-white/65",
};

const trainerStatusLabel: Record<TrainerItem["reviewStatus"], string> = {
  DRAFT: "Rascunho",
  PENDING: "Em revisão",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
};

const trainerStatusTone: Record<TrainerItem["reviewStatus"], string> = {
  DRAFT: "border-white/15 bg-white/5 text-white/60",
  PENDING: "border-amber-300/50 bg-amber-400/10 text-amber-100",
  APPROVED: "border-emerald-300/50 bg-emerald-400/10 text-emerald-100",
  REJECTED: "border-rose-300/50 bg-rose-400/10 text-rose-100",
};

function canManageMember(actorRole: MemberRole | null, targetRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") return targetRole !== "OWNER" && targetRole !== "CO_OWNER";
  if (actorRole === "ADMIN") {
    return targetRole === "STAFF" || targetRole === "TRAINER" || targetRole === "PROMOTER";
  }
  return false;
}

function canAssignRole(actorRole: MemberRole | null, targetRole: MemberRole, desiredRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") {
    if (desiredRole === "OWNER" || desiredRole === "CO_OWNER") return false;
    return targetRole !== "OWNER" && targetRole !== "CO_OWNER";
  }
  if (actorRole === "ADMIN") {
    const allowed = desiredRole === "STAFF" || desiredRole === "TRAINER" || desiredRole === "PROMOTER";
    return allowed && targetRole !== "OWNER" && targetRole !== "CO_OWNER" && targetRole !== "ADMIN";
  }
  return false;
}

function InviteBadge({ status }: { status: InviteStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] uppercase tracking-[0.16em] ${statusTone[status]}`}>
      {status === "PENDING" ? "Pendente" : status === "EXPIRED" ? "Expirado" : status === "ACCEPTED" ? "Aceite" : status === "DECLINED" ? "Recusado" : "Cancelado"}
    </span>
  );
}

const primaryCta = CTA_PRIMARY;
const glassButton = CTA_SECONDARY;
const ghostButton = CTA_GHOST;
const dangerPill = CTA_DANGER;
const neutralPill = CTA_NEUTRAL;
const acceptPill = CTA_SUCCESS;

type Toast = { id: number; message: string; type: "error" | "success" };

type OrganizationStaffPageProps = {
  embedded?: boolean;
};

export default function OrganizationStaffPage({ embedded }: OrganizationStaffPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("STAFF");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; newRole: MemberRole; currentRole: MemberRole; label: string }>({
    userId: "",
    newRole: "STAFF",
    currentRole: "STAFF",
    label: "",
  });
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [trainerActionLoading, setTrainerActionLoading] = useState<string | null>(null);
  const [newTrainerUsername, setNewTrainerUsername] = useState("");
  const [creatingTrainer, setCreatingTrainer] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<TrainerItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const [toasts, setToasts] = useState<Toast[]>([]);

  const { data: meData } = useSWR<{ ok: boolean; organization?: { id: number; publicName?: string | null } | null; orgTransferEnabled?: boolean | null }>(
    user ? "/api/organizacao/me" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const eventIdParam = searchParams?.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const staffTabParam = searchParams?.get("staff");
  const activeStaffTab = staffTabParam === "convidados" ? "convidados" : "membros";
  const organizationIdParam =
    searchParams?.get("organizationId") ?? (meData?.organization?.id ? String(meData.organization.id) : null);
  const organizationId = organizationIdParam ? Number(organizationIdParam) : null;
  const orgTransferEnabled = meData?.orgTransferEnabled ?? false;

  const membersKey = useMemo(() => {
    if (!user) return null;
    if (organizationId) return `/api/organizacao/organizations/members?organizationId=${organizationId}`;
    if (eventId && !Number.isNaN(eventId)) return `/api/organizacao/organizations/members?eventId=${eventId}`;
    return null;
  }, [user, organizationId, eventId]);

  const invitesKey = useMemo(() => {
    if (!user) return null;
    if (organizationId) return `/api/organizacao/organizations/members/invites?organizationId=${organizationId}`;
    if (eventId && !Number.isNaN(eventId)) return `/api/organizacao/organizations/members/invites?eventId=${eventId}`;
    return null;
  }, [user, organizationId, eventId]);

  const { data: invitesData, isLoading: isInvitesLoading, mutate: mutateInvites } = useSWR<InvitesResponse>(
    invitesKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: membersData, isLoading: isMembersLoading, mutate: mutateMembers } = useSWR<MembersResponse>(
    membersKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const members = membersData?.items ?? [];
  const invites = useMemo(() => invitesData?.items ?? [], [invitesData?.items]);
  const pendingInvites = useMemo(
    () => invites.filter((i) => i.status === "PENDING" || i.status === "EXPIRED" || i.status === "DECLINED"),
    [invites],
  );
  const viewerRole: MemberRole | null = membersData?.viewerRole ?? invitesData?.viewerRole ?? null;
  const resolvedOrganizationId = organizationId ?? membersData?.organizationId ?? invitesData?.organizationId ?? null;
  const canInvite = viewerRole === "OWNER" || viewerRole === "CO_OWNER" || viewerRole === "ADMIN";
  const trainersKey = useMemo(() => {
    if (!user) return null;
    if (!resolvedOrganizationId) return null;
    if (!canInvite) return null;
    return `/api/organizacao/trainers?organizationId=${resolvedOrganizationId}`;
  }, [user, resolvedOrganizationId, canInvite]);
  const { data: trainersData, mutate: mutateTrainers } = useSWR<TrainersResponse>(
    trainersKey,
    fetcher,
    { revalidateOnFocus: false },
  );
  const canManageTrainers = canInvite;
  const trainers = trainersData?.items ?? [];
  const ownerCount = useMemo(() => members.filter((m) => m.role === "OWNER").length, [members]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
    });
  }, [members]);

  const isOrganizationProfile = profile?.roles?.includes("organization") ?? false;
  const hasMembership = !!viewerRole;

  const pushToast = (message: string, type: "error" | "success" = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const handleTrainerAction = async (trainer: TrainerItem, action: "APPROVE" | "REJECT" | "PUBLISH" | "HIDE", note?: string) => {
    if (!resolvedOrganizationId) return;
    setTrainerActionLoading(trainer.userId);
    try {
      const res = await fetch("/api/organizacao/trainers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: resolvedOrganizationId,
          userId: trainer.userId,
          action,
          reviewNote: note ?? null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível atualizar o treinador.");
      }
      if (mutateTrainers) await mutateTrainers();
      if (action === "APPROVE") pushToast("Treinador aprovado e publicado.", "success");
      if (action === "REJECT") pushToast("Treinador recusado.", "success");
      if (action === "PUBLISH") pushToast("Treinador publicado.", "success");
      if (action === "HIDE") pushToast("Treinador ocultado.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Erro ao atualizar treinador.");
    } finally {
      setTrainerActionLoading(null);
    }
  };

  const openRejectDialog = (trainer: TrainerItem) => {
    setReviewTarget(trainer);
    setReviewNote("");
    setReviewDialogOpen(true);
  };

  const handleCreateTrainerProfile = async () => {
    if (!resolvedOrganizationId) return;
    const value = newTrainerUsername.trim();
    if (!value) {
      pushToast("Indica o username do treinador.");
      return;
    }
    setCreatingTrainer(true);
    try {
      const res = await fetch("/api/organizacao/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId, username: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        pushToast(json?.error || "Não foi possível criar o perfil.");
        return;
      }
      setNewTrainerUsername("");
      pushToast("Perfil de treinador criado.", "success");
      if (mutateTrainers) await mutateTrainers();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Erro ao criar perfil.");
    } finally {
      setCreatingTrainer(false);
    }
  };

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: embedded ? "/organizacao?tab=manage&section=staff" : "/organizacao/staff",
      showGoogle: true,
    });
  };

  const handleInviteSubmit = async () => {
    if (!inviteIdentifier.trim() || !resolvedOrganizationId) {
      pushToast("Indica o email ou username a convidar.");
      return;
    }
    if (!canInvite || !canAssignRole(viewerRole, inviteRole, inviteRole)) {
      pushToast("Não tens permissão para enviar este convite.");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/organizacao/organizations/members/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: resolvedOrganizationId,
          identifier: inviteIdentifier.trim(),
          role: inviteRole,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível enviar o convite.");
      } else {
        pushToast("Convite enviado.", "success");
        trackEvent("organization_staff_invited", { organizationId: resolvedOrganizationId, role: inviteRole });
        setInviteIdentifier("");
        setInviteModalOpen(false);
        mutateInvites();
      }
    } catch (err) {
      console.error("[staff] invite submit error", err);
      pushToast("Erro inesperado ao enviar convite.");
    } finally {
      setInviteLoading(false);
    }
  };

  const applyRoleChange = async (userId: string, newRole: MemberRole) => {
    if (!resolvedOrganizationId) return;
    setMemberActionLoading(userId);
    try {
      const res = await fetch("/api/organizacao/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId, userId, role: newRole }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível alterar o papel.");
      } else {
        pushToast("Role atualizado.", "success");
        trackEvent("organization_staff_role_changed", { organizationId: resolvedOrganizationId, userId, newRole });
        mutateMembers();
      }
    } catch (err) {
      console.error("[staff] role change error", err);
      pushToast("Erro inesperado ao alterar role.");
    } finally {
      setMemberActionLoading(null);
      setRoleConfirmOpen(false);
    }
  };

  const handleRoleChange = (member: Member, newRole: MemberRole) => {
    if (!canAssignRole(viewerRole, member.role, newRole)) {
      pushToast("Não tens permissão para definir este papel.");
      return;
    }

    if (member.role === "OWNER" && newRole !== "OWNER") {
      setRoleConfirm({
        userId: member.userId,
        newRole,
        currentRole: member.role,
        label: member.fullName || member.username || member.email || "Owner",
      });
      setRoleConfirmOpen(true);
      return;
    }
    applyRoleChange(member.userId, newRole);
  };

  const confirmRemove = async (member: Member) => {
    if (!resolvedOrganizationId) return;
    setMemberActionLoading(member.userId);
    try {
      const res = await fetch(
        `/api/organizacao/organizations/members?organizationId=${resolvedOrganizationId}&userId=${member.userId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível remover o membro.");
      } else {
        pushToast("Membro removido.", "success");
        mutateMembers();
        trackEvent("organization_staff_removed", {
          organizationId: resolvedOrganizationId,
          userId: member.userId,
          role: member.role,
        });
      }
    } catch (err) {
      console.error("[staff] remove error", err);
      pushToast("Erro inesperado ao remover membro.");
    } finally {
      setMemberActionLoading(null);
      setRemoveTarget(null);
    }
  };

  const handleInviteAction = async (inviteId: string, action: "RESEND" | "CANCEL" | "ACCEPT" | "DECLINE") => {
    if (!resolvedOrganizationId) return;
    setInviteActionLoading(inviteId);
    try {
      const res = await fetch("/api/organizacao/organizations/members/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId, inviteId, action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível atualizar o convite.");
      } else {
        pushToast(
          action === "RESEND"
            ? "Convite reenviado."
            : action === "CANCEL"
              ? "Convite cancelado."
              : action === "ACCEPT"
                ? "Convite aceite."
                : "Convite recusado.",
          "success",
        );
        mutateInvites();
        if (action === "ACCEPT") {
          mutateMembers();
        }
        trackEvent("organization_staff_invite_action", { organizationId: resolvedOrganizationId, inviteId, action });
      }
    } catch (err) {
      console.error("[staff] invite action error", err);
      pushToast("Erro inesperado ao gerir convite.");
    } finally {
      setInviteActionLoading(null);
    }
  };

  const handleTransfer = async () => {
    if (!orgTransferEnabled) {
      pushToast("Transferências desativadas neste momento.");
      return;
    }
    if (!resolvedOrganizationId || !transferTarget.trim()) {
      pushToast("Indica o username/email de destino.");
      return;
    }
    if (transferTarget.trim() !== transferConfirm.trim()) {
      pushToast("Confirma o destino digitando o mesmo valor.");
      return;
    }
    setTransferLoading(true);
    try {
      const res = await fetch("/api/organizacao/organizations/owner/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId, targetUserId: transferTarget.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível transferir a organização.");
      } else {
        pushToast("Pedido criado. Enviámos o pedido de confirmação ao novo Owner.", "success");
        setTransferTarget("");
        setTransferConfirm("");
        setTransferModalOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("[staff] transfer error", err);
      pushToast("Erro inesperado ao transferir organização.");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!resolvedOrganizationId) return;
    setLeaveLoading(true);
    try {
      const res = await fetch("/api/organizacao/organizations/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível sair desta organização.");
      } else {
        pushToast("Saíste da organização.", "success");
        router.push("/organizacao/organizations");
      }
    } catch (err) {
      console.error("[staff] leave error", err);
      pushToast("Erro inesperado ao sair.");
    } finally {
      setLeaveLoading(false);
      setLeaveConfirmOpen(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className={cn("w-full py-8")}>
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 text-sm text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          A carregar a tua conta…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("w-full py-8")}>
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-3 text-white">
          <h1 className="text-2xl font-semibold">Equipa</h1>
          <p className="text-white/70">Inicia sessão para gerir o staff.</p>
          <button
            type="button"
            onClick={handleRequireLogin}
            className={primaryCta}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const emptyClass = cn(
    embedded ? "space-y-4 text-white" : "w-full space-y-4 py-8 text-white",
  );
  const wrapperClass = cn(
    embedded ? "space-y-6 text-white" : "w-full space-y-6 py-8 text-white",
  );
  const staffTabs = [
    { key: "membros", label: "Equipa" },
    { key: "convidados", label: "Convidados" },
  ];
  const setStaffTab = (next: "membros" | "convidados") => {
    const params = new URLSearchParams(searchParams?.toString());
    if (next === "membros") params.delete("staff");
    else params.set("staff", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!isOrganizationProfile && !hasMembership) {
    return (
      <div className={emptyClass}>
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-2">
          <h1 className="text-2xl font-semibold">Equipa</h1>
          <p className="text-sm text-white/70">Ativa o perfil ou aceita convite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-5 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_35%),linear-gradient(225deg,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
              Equipa &amp; segurança
            </div>
            <h1 className="text-3xl font-semibold drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
              Controla quem tem acesso {meData?.organization?.publicName ? ` · ${meData.organization.publicName}` : ""}
            </h1>
            <p className="text-sm text-white/70">Papéis, convites e transferências.</p>
            {viewerRole === "OWNER" && !orgTransferEnabled && (
              <p className="text-[11px] text-white/55">Transferência de Owner desativada.</p>
            )}
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
            {activeStaffTab === "membros" && (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className={primaryCta}
              >
                Convidar membro
              </button>
            )}
            {viewerRole === "OWNER" && orgTransferEnabled && (
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                className={glassButton}
              >
                Transferir organização
              </button>
            )}
            {viewerRole && (
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(true)}
                disabled={leaveLoading}
                className={ghostButton}
              >
                {leaveLoading ? "A sair…" : "Sair da organização"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/12 bg-white/5 px-2 py-2 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.4)]">
        {staffTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStaffTab(tab.key as "membros" | "convidados")}
            className={`rounded-xl px-3 py-2 font-semibold transition ${
              activeStaffTab === tab.key
                ? "bg-gradient-to-r from-[#FF7AD1]/60 via-[#7FE0FF]/35 to-[#6A7BFF]/55 text-white shadow-[0_14px_36px_rgba(107,255,255,0.45)]"
                : "text-white/80 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewerRole === "TRAINER" && (
        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>O teu perfil de treinador está pronto para editar.</p>
            <Link href="/organizacao/treinadores" className={CTA_SECONDARY}>
              Editar perfil
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {activeStaffTab === "convidados" && canManageTrainers && (
          <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Treinadores</h2>
                <p className="text-[12px] text-white/60">Publica perfis para aparecerem no clube.</p>
              </div>
              <div className="text-[11px] text-white/60">
                {trainers.length} treinador{trainers.length === 1 ? "" : "es"}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[12px] text-white/70">Criar perfil por username</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={newTrainerUsername}
                  onChange={(e) => setNewTrainerUsername(e.target.value)}
                  placeholder="@username"
                  className="flex-1 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                />
                <button
                  type="button"
                  onClick={handleCreateTrainerProfile}
                  disabled={creatingTrainer}
                  className={`rounded-full border border-emerald-300/50 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition ${
                    creatingTrainer ? "opacity-60" : "hover:border-emerald-300/80"
                  }`}
                >
                  {creatingTrainer ? "A criar…" : "Criar perfil"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                O treinador pode editar o perfil assim que tiver role Treinador.
              </p>
            </div>
            {trainers.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Sem treinadores com role atribuído.
              </div>
            ) : (
              <div className="space-y-2">
                {trainers.map((trainer) => {
                  const displayName = trainer.fullName || trainer.username || "Treinador";
                  const isLoading = trainerActionLoading === trainer.userId;
                  const statusLabel = trainerStatusLabel[trainer.reviewStatus];
                  return (
                    <div
                      key={trainer.userId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={trainer.avatarUrl}
                          name={displayName}
                          className="h-9 w-9 border border-white/10"
                          textClassName="text-xs font-semibold uppercase tracking-[0.16em] text-white/80"
                          fallbackText="TR"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{displayName}</p>
                          {trainer.username && (
                            <p className="text-[11px] text-white/60">@{trainer.username}</p>
                          )}
                          {trainer.reviewStatus === "REJECTED" && trainer.reviewNote && (
                            <p className="text-[11px] text-rose-200">Motivo: {trainer.reviewNote}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${trainerStatusTone[trainer.reviewStatus]}`}
                        >
                          {statusLabel}
                        </span>
                        {trainer.reviewStatus === "PENDING" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTrainerAction(trainer, "APPROVE")}
                              disabled={isLoading}
                              className={`rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition ${isLoading ? "opacity-60" : ""}`}
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectDialog(trainer)}
                              disabled={isLoading}
                              className={`rounded-full border border-rose-300/50 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold text-rose-100 transition ${isLoading ? "opacity-60" : ""}`}
                            >
                              Recusar
                            </button>
                          </>
                        )}
                        {trainer.reviewStatus === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => handleTrainerAction(trainer, trainer.isPublished ? "HIDE" : "PUBLISH")}
                            disabled={isLoading}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                              trainer.isPublished
                                ? "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white"
                                : "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                            } ${isLoading ? "opacity-60" : ""}`}
                          >
                            {trainer.isPublished ? "Ocultar" : "Publicar"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeStaffTab === "membros" && (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Membros</h2>
              <p className="text-[12px] text-white/60">
                Papéis: Owner, Co-owner, Admin, Staff, Treinador e Promoter.
              </p>
            </div>
            <div className="text-[11px] text-white/60">
              {isMembersLoading ? "A carregar…" : `${sortedMembers.length} membro${sortedMembers.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {isMembersLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex animate-pulse items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/10" />
                    <div className="space-y-2">
                      <div className="h-3 w-32 rounded bg-white/10" />
                      <div className="h-3 w-24 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="h-8 w-28 rounded-full bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {!isMembersLoading && sortedMembers.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
              <p>Sem membros. Convida um admin.</p>
            </div>
          )}

          {sortedMembers.length > 0 && (
            <div className="space-y-2">
              {sortedMembers.map((m) => {
                const isOwnerRow = m.role === "OWNER";
                const isOnlyOwner = isOwnerRow && ownerCount <= 1;
                const canManageMemberRow = canManageMember(viewerRole, m.role);
                const roleDisabled = !canManageMemberRow || memberActionLoading === m.userId;
                const removeDisabled = memberActionLoading === m.userId || !canManageMemberRow || isOnlyOwner;
                const displayName = m.fullName || m.username || "Utilizador";
                return (
                  <div
                    key={m.userId}
                    className="flex flex-col gap-2 rounded-xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)] md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={m.avatarUrl}
                        name={displayName}
                        className="h-10 w-10 border border-white/10"
                        textClassName="text-sm font-semibold uppercase tracking-[0.16em] text-white/80"
                        fallbackText="OR"
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{displayName}</span>
                          <RoleBadge role={m.role} />
                          <span className="text-[11px] text-white/50">
                            {new Date(m.createdAt).toLocaleDateString("pt-PT")}
                          </span>
                        </div>
                        <div className="text-[12px] text-white/60 space-x-2">
                          {m.username && <span>@{m.username}</span>}
                          {m.email && <span className="text-white/50">· {m.email}</span>}
                          {isOnlyOwner && <span className="text-red-300">· Último Owner</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={m.role}
                        disabled={roleDisabled || memberActionLoading === m.userId}
                        onChange={(e) => handleRoleChange(m, e.target.value as MemberRole)}
                        className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.35)] disabled:opacity-60"
                      >
                        <option value="OWNER" disabled={!canAssignRole(viewerRole, m.role, "OWNER")}>
                          Owner
                        </option>
                        <option value="CO_OWNER" disabled={!canAssignRole(viewerRole, m.role, "CO_OWNER")}>
                          Co-owner
                        </option>
                        <option value="ADMIN" disabled={!canAssignRole(viewerRole, m.role, "ADMIN")}>
                          Admin
                        </option>
                        <option value="STAFF" disabled={!canAssignRole(viewerRole, m.role, "STAFF")}>
                          Staff
                        </option>
                        <option value="TRAINER" disabled={!canAssignRole(viewerRole, m.role, "TRAINER")}>
                          Treinador
                        </option>
                        <option value="PROMOTER" disabled={!canAssignRole(viewerRole, m.role, "PROMOTER")}>
                          Promoter
                        </option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(m)}
                        disabled={removeDisabled}
                        className={`${dangerPill} ${removeDisabled ? "opacity-60" : ""}`}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Convites</h2>
              <p className="text-[12px] text-white/60">Pendentes e reenvios.</p>
            </div>
            <div className="text-[11px] text-white/60">
              {isInvitesLoading ? "A carregar…" : `${pendingInvites.length} convite${pendingInvites.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {isInvitesLoading && (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="flex animate-pulse justify-between rounded-xl border border-white/12 bg-white/5 p-3">
                  <div className="space-y-2">
                    <div className="h-3 w-40 rounded bg-white/10" />
                    <div className="h-3 w-24 rounded bg-white/5" />
                  </div>
                  <div className="h-8 w-24 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {!isInvitesLoading && pendingInvites.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
              Sem convites pendentes.
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              {pendingInvites.map((inv) => {
                const isPending = inv.status === "PENDING";
                const isExpired = inv.status === "EXPIRED";
                const canRespond = inv.canRespond && isPending;
                const targetLabel =
                  inv.targetUser?.fullName ||
                  inv.targetUser?.username ||
                  inv.targetIdentifier ||
                  "Convite";
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{targetLabel}</span>
                          <RoleBadge role={inv.role} />
                          <InviteBadge status={inv.status} />
                        </div>
                        <div className="text-[12px] text-white/60 space-x-2">
                          <span>{inv.targetIdentifier}</span>
                          {inv.targetUser?.email && <span className="text-white/50">· {inv.targetUser.email}</span>}
                          {inv.expiresAt && (
                            <span className="text-white/50">
                              · {isExpired ? "Expirou" : "Expira"} {new Date(inv.expiresAt).toLocaleDateString("pt-PT")}
                            </span>
                          )}
                        </div>
                        {inv.invitedBy && (
                          <p className="text-[11px] text-white/45">
                            Enviado por {inv.invitedBy.fullName || inv.invitedBy.username || "owner"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canRespond && (
                          <>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "DECLINE")}
                              className={`${neutralPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "ACCEPT")}
                              className={`${acceptPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                            >
                              Aceitar
                            </button>
                          </>
                        )}
                        {canInvite && (
                          <>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "RESEND")}
                              className={`${neutralPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                            >
                              Re-enviar
                            </button>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "CANCEL")}
                              className={`${dangerPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {!canRespond && !canInvite && (
                          <span className="text-[11px] text-white/50">A aguardar resposta.</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
          </>
        )}

        {activeStaffTab === "convidados" && !canManageTrainers && (
          <section className="rounded-3xl border border-white/12 bg-white/5 p-4 text-sm text-white/70">
            Sem permissões para gerir convidados.
          </section>
        )}
      </div>

      <ConfirmDestructiveActionDialog
        open={removeTarget !== null}
        title="Remover membro do staff?"
        description={`Isto remove ${removeTarget?.fullName || removeTarget?.username || "este membro"} desta organização.`}
        consequences={["Perde o acesso ao dashboard e check-ins desta organização."]}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        dangerLevel="high"
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) confirmRemove(removeTarget);
        }}
      />
      <ConfirmDestructiveActionDialog
        open={leaveConfirmOpen}
        title="Sair desta organização?"
        description="Perdes acesso ao dashboard e às equipas desta organização."
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        dangerLevel="medium"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeave}
      />

      {/* Role confirm modal */}
      {roleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Confirmar</p>
              <h3 className="text-xl font-semibold text-white">Despromover Owner?</h3>
              <p className="text-sm text-white/70">
                Vais descer o papel de <span className="font-semibold text-white">{roleConfirm.label}</span> de Owner para {roleLabels[roleConfirm.newRole]}. Garante que fica pelo menos um Owner ativo.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleConfirmOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => applyRoleChange(roleConfirm.userId, roleConfirm.newRole)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trainer review modal */}
      {reviewDialogOpen && reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Revisão</p>
              <h3 className="text-xl font-semibold text-white">Recusar perfil</h3>
              <p className="text-sm text-white/70">
                Motivo opcional para o treinador rever e submeter novamente.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Motivo</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Ex: Ajustar bio e preços."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewDialogOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleTrainerAction(reviewTarget, "REJECT", reviewNote.trim() || undefined);
                  setReviewDialogOpen(false);
                }}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow"
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Convite</p>
              <h3 className="text-xl font-semibold text-white">Convidar membro</h3>
              <p className="text-sm text-white/70">Email ou username. Expira em 14 dias.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Email / username</label>
                <input
                  type="text"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="email@dominio.com ou @username"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Role proposto</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                >
                  <option value="OWNER" disabled={!canAssignRole(viewerRole, inviteRole, "OWNER")}>
                    Owner
                  </option>
                  <option value="CO_OWNER" disabled={!canAssignRole(viewerRole, inviteRole, "CO_OWNER")}>
                    Co-owner
                  </option>
                  <option value="ADMIN" disabled={!canAssignRole(viewerRole, inviteRole, "ADMIN")}>
                    Admin
                  </option>
                  <option value="STAFF" disabled={!canAssignRole(viewerRole, inviteRole, "STAFF")}>
                    Staff
                  </option>
                  <option value="TRAINER" disabled={!canAssignRole(viewerRole, inviteRole, "TRAINER")}>
                    Treinador
                  </option>
                  <option value="PROMOTER" disabled={!canAssignRole(viewerRole, inviteRole, "PROMOTER")}>
                    Promoter
                  </option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleInviteSubmit}
                disabled={inviteLoading}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
              >
                {inviteLoading ? "A enviar…" : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModalOpen && orgTransferEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Transferir organização</p>
              <h3 className="text-xl font-semibold text-white">Passar a propriedade</h3>
              <p className="text-sm text-white/70">
                A organização será atribuída ao destino como Owner. O teu papel passa para Admin automaticamente.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Username / email do novo Owner</label>
                <input
                  type="text"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="@destino ou email@dominio.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Confirma o destino</label>
                <input
                  type="text"
                  value={transferConfirm}
                  onChange={(e) => setTransferConfirm(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Escreve novamente para confirmar"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferLoading}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
              >
                {transferLoading ? "A transferir…" : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow ${
              toast.type === "success"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
                : "border-red-400/40 bg-red-500/15 text-red-50"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
