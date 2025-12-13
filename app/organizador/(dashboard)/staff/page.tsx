"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { trackEvent } from "@/lib/analytics";

type MemberRole = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | "VIEWER";

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
  organizerId?: number | null;
  error?: string;
};
type AuditResponse =
  | {
      ok: true;
      items: {
        id: string;
        action: string;
        actorUserId: string | null;
        fromUserId: string | null;
        toUserId: string | null;
        metadata: unknown;
        createdAt: string;
      }[];
    }
  | { ok: false; error?: string };

type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
type Invite = {
  id: string;
  organizerId: number;
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
  organizerId?: number | null;
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const roleLabels: Record<MemberRole, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  ADMIN: "Admin",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

const roleTone: Record<MemberRole, string> = {
  OWNER: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100",
  CO_OWNER: "border-teal-300/50 bg-teal-300/10 text-teal-50",
  ADMIN: "border-sky-400/50 bg-sky-400/10 text-sky-100",
  STAFF: "border-white/20 bg-white/5 text-white/80",
  VIEWER: "border-white/10 bg-white/5 text-white/60",
};

const roleOrder: Record<MemberRole, number> = {
  OWNER: 0,
  CO_OWNER: 1,
  ADMIN: 2,
  STAFF: 3,
  VIEWER: 4,
};

const statusTone: Record<InviteStatus, string> = {
  PENDING: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  EXPIRED: "border-white/15 bg-white/5 text-white/60",
  ACCEPTED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  DECLINED: "border-red-400/40 bg-red-400/10 text-red-100",
  CANCELLED: "border-white/15 bg-white/5 text-white/60",
};

function canManageMember(actorRole: MemberRole | null, targetRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") return targetRole !== "OWNER" && targetRole !== "CO_OWNER";
  if (actorRole === "ADMIN") return targetRole === "STAFF" || targetRole === "VIEWER";
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
    const allowed = desiredRole === "STAFF" || desiredRole === "VIEWER";
    return allowed && targetRole !== "OWNER" && targetRole !== "CO_OWNER" && targetRole !== "ADMIN";
  }
  return false;
}

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] uppercase tracking-[0.16em] ${roleTone[role]}`}>
      {roleLabels[role]}
    </span>
  );
}

function InviteBadge({ status }: { status: InviteStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] uppercase tracking-[0.16em] ${statusTone[status]}`}>
      {status === "PENDING" ? "Pendente" : status === "EXPIRED" ? "Expirado" : status === "ACCEPTED" ? "Aceite" : status === "DECLINED" ? "Recusado" : "Cancelado"}
    </span>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initial = name?.trim()?.[0]?.toUpperCase() || "U";
  return (
    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-sm font-semibold">
      {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full object-cover" /> : <span>{initial}</span>}
    </div>
  );
}

type Toast = { id: number; message: string; type: "error" | "success" };

export default function OrganizerStaffPage() {
  const router = useRouter();
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

  const [toasts, setToasts] = useState<Toast[]>([]);

  const { data: meData } = useSWR<{ ok: boolean; organizer?: { id: number; displayName?: string | null } | null; orgTransferEnabled?: boolean | null }>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const eventIdParam = searchParams?.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const organizerIdParam =
    searchParams?.get("organizerId") ?? (meData?.organizer?.id ? String(meData.organizer.id) : null);
  const organizerId = organizerIdParam ? Number(organizerIdParam) : null;
  const orgTransferEnabled = meData?.orgTransferEnabled ?? false;

  const membersKey = useMemo(() => {
    if (!user) return null;
    if (organizerId) return `/api/organizador/organizations/members?organizerId=${organizerId}`;
    if (eventId && !Number.isNaN(eventId)) return `/api/organizador/organizations/members?eventId=${eventId}`;
    return null;
  }, [user, organizerId, eventId]);

  const invitesKey = useMemo(() => {
    if (!user) return null;
    if (organizerId) return `/api/organizador/organizations/members/invites?organizerId=${organizerId}`;
    if (eventId && !Number.isNaN(eventId)) return `/api/organizador/organizations/members/invites?eventId=${eventId}`;
    return null;
  }, [user, organizerId, eventId]);

  const { data: membersData, isLoading: isMembersLoading, mutate: mutateMembers } = useSWR<MembersResponse>(
    membersKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const auditKey = useMemo(() => {
    if (!user || !organizerId || !(viewerRole === "OWNER" || viewerRole === "CO_OWNER" || viewerRole === "ADMIN")) {
      return null;
    }
    return `/api/organizador/organizations/audit?organizerId=${organizerId}&limit=50`;
  }, [user, organizerId, viewerRole]);

  const { data: auditData, isLoading: auditLoading } = useSWR<AuditResponse>(auditKey, fetcher, {
    revalidateOnFocus: false,
  });

  const { data: invitesData, isLoading: isInvitesLoading, mutate: mutateInvites } = useSWR<InvitesResponse>(
    invitesKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const members = membersData?.items ?? [];
  const invites = invitesData?.items ?? [];
  const viewerRole: MemberRole | null = membersData?.viewerRole ?? invitesData?.viewerRole ?? null;
  const resolvedOrganizerId = organizerId ?? membersData?.organizerId ?? invitesData?.organizerId ?? null;
  const canInvite = viewerRole === "OWNER" || viewerRole === "CO_OWNER" || viewerRole === "ADMIN";
  const ownerCount = useMemo(() => members.filter((m) => m.role === "OWNER").length, [members]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
    });
  }, [members]);

  const isOrganizerProfile = profile?.roles?.includes("organizer") ?? false;
  const hasMembership = !!viewerRole;

  const pushToast = (message: string, type: "error" | "success" = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const handleRequireLogin = () => {
    openModal({ mode: "login", redirectTo: "/organizador/staff", showGoogle: true });
  };

  const handleInviteSubmit = async () => {
    if (!inviteIdentifier.trim() || !resolvedOrganizerId) {
      pushToast("Indica o email ou username a convidar.");
      return;
    }
    if (!canInvite || !canAssignRole(viewerRole, inviteRole, inviteRole)) {
      pushToast("Não tens permissão para enviar este convite.");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/organizador/organizations/members/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: resolvedOrganizerId,
          identifier: inviteIdentifier.trim(),
          role: inviteRole,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível enviar o convite.");
      } else {
        pushToast("Convite enviado.", "success");
        trackEvent("organizer_staff_invited", { organizerId: resolvedOrganizerId, role: inviteRole });
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
    if (!resolvedOrganizerId) return;
    setMemberActionLoading(userId);
    try {
      const res = await fetch("/api/organizador/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: resolvedOrganizerId, userId, role: newRole }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível alterar o papel.");
      } else {
        pushToast("Role atualizado.", "success");
        trackEvent("organizer_staff_role_changed", { organizerId: resolvedOrganizerId, userId, newRole });
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

  const handleRemove = async (member: Member) => {
    if (!resolvedOrganizerId) return;
    if (!canManageMember(viewerRole, member.role)) {
      pushToast("Sem permissão para remover este membro.");
      return;
    }
    setRemoveTarget(member);
  };

  const confirmRemove = async (member: Member) => {
    if (!resolvedOrganizerId) return;
    setMemberActionLoading(member.userId);
    try {
      const res = await fetch(
        `/api/organizador/organizations/members?organizerId=${resolvedOrganizerId}&userId=${member.userId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível remover o membro.");
      } else {
        pushToast("Membro removido.", "success");
        mutateMembers();
        trackEvent("organizer_staff_removed", {
          organizerId: resolvedOrganizerId,
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
    if (!resolvedOrganizerId) return;
    setInviteActionLoading(inviteId);
    try {
      const res = await fetch("/api/organizador/organizations/members/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: resolvedOrganizerId, inviteId, action }),
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
        trackEvent("organizer_staff_invite_action", { organizerId: resolvedOrganizerId, inviteId, action });
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
    if (!resolvedOrganizerId || !transferTarget.trim()) {
      pushToast("Indica o username/email de destino.");
      return;
    }
    if (transferTarget.trim() !== transferConfirm.trim()) {
      pushToast("Confirma o destino digitando o mesmo valor.");
      return;
    }
    setTransferLoading(true);
    try {
      const res = await fetch("/api/organizador/organizations/owner/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: resolvedOrganizerId, targetUserId: transferTarget.trim() }),
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
    if (!resolvedOrganizerId) return;
    setLeaveLoading(true);
    try {
      const res = await fetch("/api/organizador/organizations/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: resolvedOrganizerId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível sair desta organização.");
      } else {
        pushToast("Saíste da organização.", "success");
        router.push("/organizador/organizations");
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
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
        <p className="text-sm text-white/70">A carregar a tua conta…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4 md:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p>Precisas de iniciar sessão para gerir o staff.</p>
        <button
          type="button"
          onClick={handleRequireLogin}
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (!isOrganizerProfile && !hasMembership) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4 md:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="text-sm text-white/70">Ativa primeiro o perfil de organizador ou aceita um convite para entrares.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Staff & segurança</p>
          <h1 className="text-3xl font-semibold">
            Controla quem tem acesso {meData?.organizer?.displayName ? ` · ${meData.organizer.displayName}` : ""}
          </h1>
          <p className="text-sm text-white/60">
            Define papéis, gere convites e transfere a organização de forma segura. Pelo menos um Owner tem de existir sempre.
          </p>
          {viewerRole === "OWNER" && !orgTransferEnabled && (
            <p className="text-[11px] text-white/50">Transferência de Owner está desativada enquanto a flag global estiver off.</p>
          )}
          {auditData?.ok && auditData.items.length > 0 && (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Histórico rápido (sensível)</p>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {auditData.items.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-[12px] border-b border-white/5 py-1 last:border-b-0">
                    <span>{log.action}</span>
                    <span className="text-white/50">{new Date(log.createdAt).toLocaleString("pt-PT")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow hover:opacity-95"
          >
            Convidar membro
          </button>
          <Link
            href={eventId ? `/organizador/scan?eventId=${eventId}` : "/organizador/scan"}
            className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Abrir check-in (QR)
          </Link>
          {viewerRole === "OWNER" && orgTransferEnabled && (
            <button
              type="button"
              onClick={() => setTransferModalOpen(true)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Transferir organização
            </button>
          )}
          {viewerRole && (
            <button
              type="button"
              onClick={() => setLeaveConfirmOpen(true)}
              disabled={leaveLoading}
              className="rounded-full border border-white/20 bg-white/0 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              {leaveLoading ? "A sair…" : "Sair da organização"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Membros</h2>
              <p className="text-[12px] text-white/60">
                Papéis: Owner, Co-owner, Admin, Staff e Viewer.
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
              <p>Ainda não tens membros nesta organização. Convida alguém com Owner/Co-owner/Admin para começares.</p>
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
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={displayName} avatarUrl={m.avatarUrl} />
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
                        className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:opacity-60"
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
                        <option value="VIEWER" disabled={!canAssignRole(viewerRole, m.role, "VIEWER")}>
                          Viewer
                        </option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(m)}
                        disabled={removeDisabled}
                        className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-200 hover:bg-red-500/20 disabled:opacity-60"
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

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Convites</h2>
              <p className="text-[12px] text-white/60">Gerir convites pendentes, reenvios e respostas.</p>
            </div>
            <div className="text-[11px] text-white/60">
              {isInvitesLoading ? "A carregar…" : `${invites.length} convite${invites.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {isInvitesLoading && (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="flex animate-pulse justify-between rounded-xl border border-white/5 bg-black/30 p-3">
                  <div className="space-y-2">
                    <div className="h-3 w-40 rounded bg-white/10" />
                    <div className="h-3 w-24 rounded bg-white/5" />
                  </div>
                  <div className="h-8 w-24 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {!isInvitesLoading && invites.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
              Sem convites pendentes. Convida por email ou username para novos acessos.
            </div>
          )}

          {invites.length > 0 && (
            <div className="space-y-2">
              {invites.map((inv) => {
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
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-3"
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
                              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "ACCEPT")}
                              className="rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black shadow disabled:opacity-60"
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
                              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10 disabled:opacity-60"
                            >
                              Re-enviar
                            </button>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "CANCEL")}
                              className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
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

      {/* Invite modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Convite</p>
              <h3 className="text-xl font-semibold text-white">Convidar membro</h3>
              <p className="text-sm text-white/70">Aceita email, username ou ID ORYA. O convite expira em 14 dias.</p>
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
                  <option value="VIEWER" disabled={!canAssignRole(viewerRole, inviteRole, "VIEWER")}>
                    Viewer
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
