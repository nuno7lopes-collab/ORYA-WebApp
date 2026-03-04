"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
} from "@/app/org/_internal/core/dashboardUi";
import { lockBodyScroll } from "@/lib/dom/bodyScrollLock";
import { ORYA_ORG_ID_HEADER } from "@/lib/http/headers";
import {
  COMMUNITY_ACCESS_MODE_OPTIONS,
  COMMUNITY_TALK_POLICY_OPTIONS,
  formatCommunityAccessModeLabel,
  formatCommunityTalkPolicyLabel,
} from "@/lib/messages/communityUi";
import {
  buildOrgHref,
  getOrganizationIdFromBrowser,
  parseOrganizationIdFromPathname,
} from "@/lib/organizationIdUtils";
type CommunityItem = {
  conversationId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  talkPolicy: "EVERYONE" | "TEAM_ONLY";
  accessMode: "PUBLIC" | "FOLLOWERS" | "APPROVAL" | "INVITE";
  participantsCount: number;
  pendingRequestsCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};
type CommunitiesResponse = {
  ok: boolean;
  items: CommunityItem[];
  error?: string;
};
type CommunityRequestItem = {
  id: string;
  requesterId: string | null;
  createdAt: string;
  expiresAt: string | null;
  requester: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};
type CommunityRequestsResponse = {
  ok: boolean;
  items: CommunityRequestItem[];
  error?: string;
};
type CommunityParticipantItem = {
  userId: string;
  role: "ADMIN" | "MEMBER";
  isTeamMember: boolean;
  joinedAt: string;
  leftAt: string | null;
  accessRevokedAt: string | null;
  bannedAt: string | null;
  writeMutedAt: string | null;
  writeMutedUntil: string | null;
  writeMutedByUserId: string | null;
  followGraceEndsAt: string | null;
  user: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
};
type CommunityParticipantsResponse = {
  ok: boolean;
  items: CommunityParticipantItem[];
  error?: string;
};
type CommunityManualInvitesResponse = {
  ok: boolean;
  invitedCount: number;
  invitedUserIds: string[];
  skipped: Array<{ userId: string; reason: string }>;
  missingUserIds: string[];
  error?: string;
};
type CommunityInviteLinkResponse = {
  ok: boolean;
  inviteLink: {
    id: string;
    token: string;
    invitePath: string;
    expiresAt: string | null;
    createdAt: string;
  };
  error?: string;
};
type TeamMemberOption = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  rolePack: string | null;
};
type CommunityTeamMembersResponse = {
  ok: boolean;
  items: TeamMemberOption[];
  error?: string;
};
type FormState = {
  title: string;
  description: string;
  coverImageUrl: string;
  talkPolicy: "EVERYONE" | "TEAM_ONLY";
  accessMode: "PUBLIC" | "FOLLOWERS" | "APPROVAL" | "INVITE";
  seedAdminUserIds: string[];
  seedMemberUserIds: string[];
};
type PanelTab = "requests" | "participants" | "invites";
type ActivePanelState = { communityId: string; tab: PanelTab };
type MutePreset = "1h" | "24h" | "indefinido";
const formDefaults: FormState = {
  title: "",
  description: "",
  coverImageUrl: "",
  talkPolicy: "EVERYONE",
  accessMode: "PUBLIC",
  seedAdminUserIds: [],
  seedMemberUserIds: [],
};
const invitePresetOptions: Array<{ value: "" | string; label: string }> = [
  { value: "", label: "Sem validade" },
  { value: "10m", label: "10 minutos" },
  { value: "30m", label: "30 minutos" },
  { value: "1h", label: "1 hora" },
  { value: "2h", label: "2 horas" },
  { value: "4h", label: "4 horas" },
  { value: "8h", label: "8 horas" },
  { value: "24h", label: "24 horas" },
  { value: "2d", label: "2 dias" },
  { value: "3d", label: "3 dias" },
  { value: "4d", label: "4 dias" },
  { value: "5d", label: "5 dias" },
  { value: "6d", label: "6 dias" },
  { value: "7d", label: "7 dias" },
];
const apiErrorLabels: Record<string, string> = {
  INVALID_CONVERSATION: "Conversa inválida.",
  FORBIDDEN: "Sem permissão para gerir comunidades.",
  INVALID_TITLE: "O título deve ter pelo menos 2 caracteres.",
  TITLE_TOO_LONG: "O título não pode exceder 120 caracteres.",
  DESCRIPTION_TOO_LONG: "A descrição não pode exceder 1000 caracteres.",
  INVALID_COVER_IMAGE_URL: "A capa tem de ser um URL http(s) válido.",
  INVALID_POLICY: "Política inválida.",
  INVALID_ACCESS_MODE: "Modo de acesso inválido.",
  INVALID_TALK_POLICY: "Política de fala inválida.",
  COMMUNITY_NOT_FOUND: "Comunidade não encontrada.",
  INVITE_LINK_INVALID: "Link de convite inválido.",
  INVITE_LINK_EXPIRED: "Link de convite expirado.",
  INVITE_LINK_REVOKED: "Link de convite revogado.",
  INVITES_REQUIRE_INVITE_MODE: "Convites manuais só no modo INVITE.",
  INVITE_LINKS_REQUIRE_INVITE_MODE: "Links de convite só no modo INVITE.",
  INVALID_PRESET: "Preset de validade inválido.",
  PARTICIPANT_NOT_FOUND: "Participante não encontrado.",
  PARTICIPANT_NOT_ACTIVE: "Participante inativo.",
  INVALID_MUTE_UNTIL: "Data de mute inválida.",
  ADMIN_MUST_BE_TEAM_MEMBER:
    "Só membros da equipa podem ser promovidos a admin.",
  NOT_ADMIN: "Este participante não é admin.",
  LAST_ADMIN: "Não podes remover o último admin.",
  BANNED: "Utilizador banido nesta comunidade.",
  INVALID_USERS: "Indica pelo menos um utilizador válido.",
  NOT_IN_ORGANIZATION:
    "Só podes adicionar participantes que pertençam à equipa da organização.",
  INVALID_PARAMS: "Parâmetros inválidos.",
  INVALID_ACTION: "Ação inválida.",
};
function resolveActiveOrganizationId() {
  if (typeof window === "undefined") return null;
  return (
    parseOrganizationIdFromPathname(window.location.pathname) ??
    getOrganizationIdFromBrowser()
  );
}
function withOrganizationId(url: string, organizationId: number | null) {
  if (!organizationId || typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return url;
    if (!parsed.pathname.startsWith("/api/")) return url;
    if (!parsed.searchParams.has("organizationId")) {
      parsed.searchParams.set("organizationId", String(organizationId));
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const organizationId = resolveActiveOrganizationId();
  const requestUrl = withOrganizationId(url, organizationId);
  const headers = new Headers(init?.headers ?? {});
  headers.set("content-type", "application/json");
  if (organizationId && !headers.has(ORYA_ORG_ID_HEADER)) {
    headers.set(ORYA_ORG_ID_HEADER, String(organizationId));
  }
  const res = await fetch(requestUrl, { ...init, headers, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as {
    error?: string;
    ok?: boolean;
  } | null;
  if (!res.ok || json?.ok === false) {
    const errorCode = (json?.error ?? "").trim().toUpperCase();
    const mapped = apiErrorLabels[errorCode];
    throw new Error(mapped || json?.error || "Erro no pedido.");
  }
  return (json ?? {}) as T;
}
function getUserLabel(user: {
  fullName: string | null;
  username: string | null;
}) {
  return (
    user.fullName?.trim() ||
    (user.username ? `@${user.username}` : "Utilizador")
  );
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function confirmAction(message: string) {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
function parseUserIdsInput(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[,\n\s]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}
function isActiveParticipant(participant: CommunityParticipantItem) {
  return (
    !participant.leftAt && !participant.accessRevokedAt && !participant.bannedAt
  );
}
function isMutedParticipant(participant: CommunityParticipantItem) {
  if (!participant.writeMutedAt) return false;
  if (!participant.writeMutedUntil) return true;
  return new Date(participant.writeMutedUntil).getTime() > Date.now();
}
function buildMuteUntil(preset: MutePreset) {
  if (preset === "indefinido") return null;
  if (preset === "1h")
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}
function resolveInviteLinkUrl(invitePath: string) {
  if (invitePath.startsWith("http://") || invitePath.startsWith("https://"))
    return invitePath;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${invitePath.startsWith("/") ? invitePath : `/${invitePath}`}`;
  }
  return invitePath;
}
function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem atividade";
  const diffMs = date.getTime() - Date.now();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });
  if (Math.abs(diffMs) < hour) {
    return rtf.format(Math.round(diffMs / minute), "minute");
  }
  if (Math.abs(diffMs) < day) {
    return rtf.format(Math.round(diffMs / hour), "hour");
  }
  return rtf.format(Math.round(diffMs / day), "day");
}
function buildCommunityChatPath(conversationId: string) {
  if (typeof window === "undefined") return "";
  const organizationId = resolveActiveOrganizationId();
  if (organizationId) {
    return buildOrgHref(organizationId, "/chat", { conversationId });
  }
  const current = new URL(window.location.href);
  if (current.pathname.endsWith("/comunidades")) {
    current.pathname = current.pathname.replace(/\/comunidades$/, "");
  }
  current.searchParams.delete("tab");
  current.searchParams.set("conversationId", conversationId);
  return `${current.pathname}${current.search}${current.hash}`;
}
function CommunityFormModal(props: {
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  initial: FormState;
  teamMembers: TeamMemberOption[];
  teamMembersLoading: boolean;
  teamMembersError: Error | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (state: FormState) => Promise<void>;
}) {
  const [state, setState] = useState<FormState>(props.initial);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const inputClass =
    "rounded-xl border border-white/20 bg-[#060a14] px-3 py-2 text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35";
  const canDismiss = !props.pending && !uploadingCover && !showCoverCropModal;
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);
  useEffect(() => {
    if (!portalRoot) return;
    return lockBodyScroll();
  }, [portalRoot]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !canDismiss) return;
      props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canDismiss, props.onClose]);
  const uploadCoverFile = async (file: File) => {
    const organizationId = resolveActiveOrganizationId();
    if (!organizationId) {
      setError(
        "Não foi possível identificar a organização ativa para o upload da capa.",
      );
      return;
    }
    setUploadingCover(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(
        `/api/upload?scope=event-cover&organizationId=${organizationId}`,
        { method: "POST", body: formData },
      );
      const json = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da capa.");
      }
      setState((prev) => ({ ...prev, coverImageUrl: json.url ?? "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload da capa.");
    } finally {
      setUploadingCover(false);
    }
  };
  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setError(null);
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };
  const handleCoverCropCancel = () => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
  };
  const handleCoverCropConfirm = async (file: File) => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
    await uploadCoverFile(file);
  };
  const handleSubmit = async () => {
    const normalizedTitle = state.title.trim();
    const normalizedDescription = state.description.trim();
    const normalizedCover = state.coverImageUrl.trim();
    if (!normalizedTitle || normalizedTitle.length < 2) {
      setError("O título deve ter pelo menos 2 caracteres.");
      return;
    }
    if (normalizedTitle.length > 120) {
      setError("O título não pode exceder 120 caracteres.");
      return;
    }
    if (normalizedDescription.length > 1000) {
      setError("A descrição não pode exceder 1000 caracteres.");
      return;
    }
    if (normalizedCover) {
      try {
        const parsed = new URL(normalizedCover);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setError("A capa tem de ser um URL http(s) válido.");
          return;
        }
      } catch {
        setError("A capa tem de ser um URL válido.");
        return;
      }
    }
    const normalizedAdminUserIds = Array.from(
      new Set(
        state.seedAdminUserIds.map((userId) => userId.trim()).filter(Boolean),
      ),
    );
    const normalizedMemberUserIds = Array.from(
      new Set(
        state.seedMemberUserIds
          .map((userId) => userId.trim())
          .filter(
            (userId) =>
              Boolean(userId) && !normalizedAdminUserIds.includes(userId),
          ),
      ),
    );
    setError(null);
    await props.onSubmit({
      ...state,
      title: normalizedTitle,
      description: normalizedDescription,
      coverImageUrl: normalizedCover,
      seedAdminUserIds: normalizedAdminUserIds,
      seedMemberUserIds: normalizedMemberUserIds,
    });
  };
  const setSeedRole = (userId: string, role: "ADMIN" | "MEMBER" | "NONE") => {
    setState((prev) => {
      const nextAdminIds = prev.seedAdminUserIds.filter(
        (value) => value !== userId,
      );
      const nextMemberIds = prev.seedMemberUserIds.filter(
        (value) => value !== userId,
      );
      if (role === "ADMIN") nextAdminIds.push(userId);
      if (role === "MEMBER") nextMemberIds.push(userId);
      return {
        ...prev,
        seedAdminUserIds: Array.from(new Set(nextAdminIds)),
        seedMemberUserIds: Array.from(new Set(nextMemberIds)),
      };
    });
  };
  const visibleTeamMembers = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    const list = [...props.teamMembers].sort((a, b) => {
      const left = (a.fullName || a.username || a.userId).toLowerCase();
      const right = (b.fullName || b.username || b.userId).toLowerCase();
      return left.localeCompare(right, "pt-PT");
    });
    if (!query) return list;
    return list.filter((member) => {
      const name = member.fullName?.toLowerCase() ?? "";
      const username = member.username?.toLowerCase() ?? "";
      return name.includes(query) || username.includes(query);
    });
  }, [props.teamMembers, teamSearch]);
  const coverPreviewStyle = state.coverImageUrl
    ? {
        backgroundColor: "#050a14",
        backgroundImage: `linear-gradient(180deg, rgba(7,9,17,0.35), rgba(7,9,17,0.88)), linear-gradient(180deg, rgba(5,10,20,0.98), rgba(5,10,20,0.98)), url(${state.coverImageUrl})`,
      }
    : {
        backgroundColor: "#050a14",
        backgroundImage:
          "linear-gradient(135deg, rgba(34,211,238,0.3), rgba(59,130,246,0.26) 45%, rgba(2,6,23,0.98))",
      };
  return (
    <>
      {" "}
      {portalRoot
        ? createPortal(
            <div
              className="fixed inset-0 z-[190] flex items-center justify-center bg-[rgba(2,6,14,0.88)] px-4 py-6"
              onMouseDown={(event) => {
                if (event.target !== event.currentTarget || !canDismiss) return;
                props.onClose();
              }}
            >
              {" "}
              <div
                className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-[#050a14] p-5 text-white"
                role="dialog"
                aria-modal="true"
                aria-label={props.title}
              >
                {" "}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_48%),linear-gradient(180deg,rgba(9,14,26,0.86),rgba(5,10,20,0.96))]" />{" "}
                <div className="relative z-10">
                  {" "}
                  <h3 className="text-lg font-semibold">{props.title}</h3>{" "}
                  <p className="mt-1 text-sm text-white/80">
                    {" "}
                    Define a configuração da comunidade e garante uma
                    experiência de chat clara para desktop e mobile.{" "}
                  </p>{" "}
                  <div className="mt-4 grid gap-3">
                    {" "}
                    <label className="grid gap-1 text-sm">
                      {" "}
                      <span className="text-white/90">Título</span>{" "}
                      <input
                        value={state.title}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Ex.: Comunidade Intermédio"
                        maxLength={120}
                      />{" "}
                      <span className="text-[11px] text-white/70">
                        {state.title.trim().length}/120
                      </span>{" "}
                    </label>{" "}
                    <label className="grid gap-1 text-sm">
                      {" "}
                      <span className="text-white/90">Descrição</span>{" "}
                      <textarea
                        value={state.description}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className={`${inputClass} min-h-[80px]`}
                        placeholder="Descrição opcional"
                        maxLength={1000}
                      />{" "}
                      <span className="text-[11px] text-white/70">
                        {state.description.trim().length}/1000
                      </span>{" "}
                    </label>{" "}
                    <div className="grid gap-2 text-sm">
                      {" "}
                      <span className="text-white/90">
                        Foto da capa (opcional)
                      </span>{" "}
                      <div className="rounded-xl border border-white/15 bg-[#07101f] p-2">
                        {" "}
                        <div
                          className="h-24 rounded-lg bg-cover bg-center"
                          style={coverPreviewStyle}
                        />{" "}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {" "}
                          <button
                            type="button"
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover || props.pending}
                            className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                          >
                            {" "}
                            {uploadingCover
                              ? "A carregar..."
                              : state.coverImageUrl
                                ? "Trocar capa"
                                : "Carregar capa"}{" "}
                          </button>{" "}
                          <button
                            type="button"
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                coverImageUrl: "",
                              }))
                            }
                            disabled={
                              !state.coverImageUrl ||
                              uploadingCover ||
                              props.pending
                            }
                            className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                          >
                            {" "}
                            Remover{" "}
                          </button>{" "}
                          <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleCoverUpload(e.target.files?.[0] ?? null)
                            }
                          />{" "}
                        </div>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {" "}
                      <label className="grid gap-1 text-sm">
                        {" "}
                        <span className="text-white/90">
                          Política de fala
                        </span>{" "}
                        <select
                          value={state.talkPolicy}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              talkPolicy: e.target
                                .value as FormState["talkPolicy"],
                            }))
                          }
                          className={inputClass}
                        >
                          {" "}
                          {COMMUNITY_TALK_POLICY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {" "}
                              {option.label}{" "}
                            </option>
                          ))}{" "}
                        </select>{" "}
                      </label>{" "}
                      <label className="grid gap-1 text-sm">
                        {" "}
                        <span className="text-white/90">Acesso</span>{" "}
                        <select
                          value={state.accessMode}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              accessMode: e.target
                                .value as FormState["accessMode"],
                            }))
                          }
                          className={inputClass}
                        >
                          {" "}
                          {COMMUNITY_ACCESS_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {" "}
                              {option.label}{" "}
                            </option>
                          ))}{" "}
                        </select>{" "}
                      </label>{" "}
                    </div>{" "}
                    {props.mode === "create" ? (
                      <div className="grid gap-3 rounded-xl border border-white/15 bg-[#07101f] p-3">
                        {" "}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {" "}
                          <p className="text-sm text-white/90">
                            Participantes iniciais (equipa)
                          </p>{" "}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                            {" "}
                            <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-cyan-100">
                              {" "}
                              Admins: {state.seedAdminUserIds.length}{" "}
                            </span>{" "}
                            <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5">
                              {" "}
                              Membros: {state.seedMemberUserIds.length}{" "}
                            </span>{" "}
                          </div>{" "}
                        </div>{" "}
                        <p className="text-xs text-white/75">
                          {" "}
                          Escolhe apenas utilizadores da equipa. O criador entra
                          sempre como admin.{" "}
                        </p>{" "}
                        <input
                          value={teamSearch}
                          onChange={(event) =>
                            setTeamSearch(event.target.value)
                          }
                          className={inputClass}
                          placeholder="Procurar por username ou nome"
                        />{" "}
                        {props.teamMembersError ? (
                          <p className="rounded-lg border border-red-300/40 bg-red-500/12 px-3 py-2 text-xs text-red-100">
                            {" "}
                            {props.teamMembersError.message ||
                              "Erro ao carregar a equipa."}{" "}
                          </p>
                        ) : null}{" "}
                        {props.teamMembersLoading ? (
                          <p className="text-xs text-white/70">
                            A carregar equipa...
                          </p>
                        ) : visibleTeamMembers.length ? (
                          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                            {" "}
                            {visibleTeamMembers.map((member) => {
                              const isAdmin = state.seedAdminUserIds.includes(
                                member.userId,
                              );
                              const isMember = state.seedMemberUserIds.includes(
                                member.userId,
                              );
                              const displayName =
                                member.fullName?.trim() ||
                                (member.username
                                  ? `@${member.username}`
                                  : "Utilizador");
                              const usernameLabel = member.username
                                ? `@${member.username}`
                                : "sem username";
                              return (
                                <div
                                  key={member.userId}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#060d1b] px-2.5 py-2"
                                >
                                  {" "}
                                  <div className="min-w-0">
                                    {" "}
                                    <p className="truncate text-sm font-medium text-white">
                                      {displayName}
                                    </p>{" "}
                                    <p className="truncate text-[11px] text-white/65">
                                      {usernameLabel}
                                    </p>{" "}
                                  </div>{" "}
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    {" "}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSeedRole(
                                          member.userId,
                                          isAdmin ? "NONE" : "ADMIN",
                                        )
                                      }
                                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${isAdmin ? "border-cyan-300/60 bg-cyan-500/25 text-cyan-100" : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"}`}
                                    >
                                      {" "}
                                      Admin{" "}
                                    </button>{" "}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSeedRole(
                                          member.userId,
                                          isMember ? "NONE" : "MEMBER",
                                        )
                                      }
                                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${isMember ? "border-emerald-300/60 bg-emerald-500/22 text-emerald-100" : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"}`}
                                    >
                                      {" "}
                                      Membro{" "}
                                    </button>{" "}
                                  </div>{" "}
                                </div>
                              );
                            })}{" "}
                          </div>
                        ) : (
                          <p className="text-xs text-white/70">
                            {" "}
                            {props.teamMembers.length
                              ? "Sem resultados para a pesquisa."
                              : "Não existem membros de equipa disponíveis."}{" "}
                          </p>
                        )}{" "}
                      </div>
                    ) : null}{" "}
                    {error ? (
                      <p className="text-sm text-red-300">{error}</p>
                    ) : null}{" "}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {" "}
                      <button
                        type="button"
                        onClick={props.onClose}
                        disabled={!canDismiss}
                        className={`${CTA_SECONDARY} text-sm disabled:opacity-60`}
                      >
                        {" "}
                        Cancelar{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={props.pending || uploadingCover}
                        className={`${CTA_PRIMARY} text-sm disabled:opacity-60`}
                      >
                        {" "}
                        {props.pending
                          ? "A guardar..."
                          : props.submitLabel}{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </div>,
            portalRoot,
          )
        : null}{" "}
      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={(file) => {
          void handleCoverCropConfirm(file);
        }}
      />{" "}
    </>
  );
}
export default function CommunitiesManagerClient() {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityItem | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanelState | null>(null);
  const [participantView, setParticipantView] = useState<"ACTIVE" | "ALL">(
    "ACTIVE",
  );
  const [participantSearch, setParticipantSearch] = useState("");
  const [adminDraftUserId, setAdminDraftUserId] = useState("");
  const [inviteUserIdsInput, setInviteUserIdsInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePreset, setInvitePreset] = useState<"" | string>("");
  const [generatedInviteLink, setGeneratedInviteLink] = useState<
    CommunityInviteLinkResponse["inviteLink"] | null
  >(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [manualInviteResult, setManualInviteResult] =
    useState<CommunityManualInvitesResponse | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const requestedCommunityId = searchParams.get("communityId")?.trim() ?? "";
  const requestedPanel = searchParams.get("panel")?.trim().toLowerCase() ?? "";
  const communitiesKey = "/api/messages/communities";
  const {
    data: communitiesData,
    isLoading: communitiesLoading,
    error: communitiesError,
    mutate: mutateCommunities,
  } = useSWR<CommunitiesResponse>(
    communitiesKey,
    (url: string) => apiRequest<CommunitiesResponse>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const {
    data: teamMembersData,
    isLoading: teamMembersLoading,
    error: teamMembersError,
    mutate: mutateTeamMembers,
  } = useSWR<CommunityTeamMembersResponse>(
    "/api/messages/communities/team-members",
    (url: string) => apiRequest<CommunityTeamMembersResponse>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const selectedCommunityId = activePanel?.communityId ?? null;
  const selectedTab = activePanel?.tab ?? null;
  const requestsKey =
    selectedCommunityId && selectedTab === "requests"
      ? `/api/messages/communities/${encodeURIComponent(selectedCommunityId)}/requests`
      : null;
  const {
    data: requestsData,
    isLoading: requestsLoading,
    isValidating: requestsValidating,
    error: requestsError,
    mutate: mutateRequests,
  } = useSWR<CommunityRequestsResponse>(
    requestsKey,
    (url: string) => apiRequest<CommunityRequestsResponse>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const participantsKey =
    selectedCommunityId && selectedTab === "participants"
      ? `/api/messages/communities/${encodeURIComponent(selectedCommunityId)}/participants`
      : null;
  const {
    data: participantsData,
    isLoading: participantsLoading,
    isValidating: participantsValidating,
    error: participantsError,
    mutate: mutateParticipants,
  } = useSWR<CommunityParticipantsResponse>(
    participantsKey,
    (url: string) => apiRequest<CommunityParticipantsResponse>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const communities = communitiesData?.items ?? [];
  const sortedCommunities = useMemo(
    () =>
      [...communities].sort((a, b) => {
        const left = new Date(
          a.lastMessageAt || a.updatedAt || a.createdAt,
        ).getTime();
        const right = new Date(
          b.lastMessageAt || b.updatedAt || b.createdAt,
        ).getTime();
        return right - left;
      }),
    [communities],
  );
  const selectedCommunity = useMemo(
    () =>
      communities.find(
        (community) => community.conversationId === selectedCommunityId,
      ) ?? null,
    [communities, selectedCommunityId],
  );
  const filteredParticipants = useMemo(() => {
    const list = participantsData?.items ?? [];
    const query = participantSearch.trim().toLowerCase();
    return list
      .filter((participant) =>
        participantView === "ALL" ? true : isActiveParticipant(participant),
      )
      .filter((participant) => {
        if (!query) return true;
        const name = participant.user.fullName?.toLowerCase() ?? "";
        const username = participant.user.username?.toLowerCase() ?? "";
        const userId = participant.userId.toLowerCase();
        return (
          name.includes(query) ||
          username.includes(query) ||
          userId.includes(query)
        );
      })
      .sort((a, b) => {
        const activeDelta =
          Number(isActiveParticipant(b)) - Number(isActiveParticipant(a));
        if (activeDelta !== 0) return activeDelta;
        const adminDelta =
          Number(b.role === "ADMIN") - Number(a.role === "ADMIN");
        if (adminDelta !== 0) return adminDelta;
        const mutedDelta =
          Number(isMutedParticipant(b)) - Number(isMutedParticipant(a));
        if (mutedDelta !== 0) return mutedDelta;
        const left = getUserLabel(a.user).toLocaleLowerCase("pt-PT");
        const right = getUserLabel(b.user).toLocaleLowerCase("pt-PT");
        return left.localeCompare(right, "pt-PT");
      });
  }, [participantSearch, participantView, participantsData?.items]);
  const sortedRequests = useMemo(
    () =>
      [...(requestsData?.items ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [requestsData?.items],
  );
  const openPanel = useCallback((communityId: string, tab: PanelTab) => {
    setActivePanel({ communityId, tab });
    setFeedback(null);
    setParticipantSearch("");
    setParticipantView("ACTIVE");
    setAdminDraftUserId("");
    setManualInviteResult(null);
    setCopiedInviteLink(false);
    setGeneratedInviteLink(null);
  }, []);
  useEffect(() => {
    setInviteUserIdsInput("");
    setInviteMessage("");
    setInvitePreset("");
    setManualInviteResult(null);
    setCopiedInviteLink(false);
    setGeneratedInviteLink(null);
  }, [selectedCommunityId]);
  useEffect(() => {
    if (!requestedCommunityId || !communities.length) return;
    const exists = communities.some(
      (community) => community.conversationId === requestedCommunityId,
    );
    if (!exists) return;
    const tab: PanelTab =
      requestedPanel === "requests" ||
      requestedPanel === "invites" ||
      requestedPanel === "participants"
        ? (requestedPanel as PanelTab)
        : "participants";
    if (
      activePanel?.communityId === requestedCommunityId &&
      activePanel.tab === tab
    )
      return;
    openPanel(requestedCommunityId, tab);
  }, [
    activePanel?.communityId,
    activePanel?.tab,
    communities,
    openPanel,
    requestedCommunityId,
    requestedPanel,
  ]);
  const runAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setPendingActionKey(key);
      setFeedback(null);
      try {
        await action();
      } catch (err) {
        setFeedback({
          tone: "error",
          message: err instanceof Error ? err.message : "Erro inesperado.",
        });
      } finally {
        setPendingActionKey(null);
      }
    },
    [],
  );
  const createCommunity = async (form: FormState) => {
    setSavingForm(true);
    setFeedback(null);
    try {
      const adminIds = Array.from(
        new Set(
          form.seedAdminUserIds.map((userId) => userId.trim()).filter(Boolean),
        ),
      );
      const memberIds = Array.from(
        new Set(
          form.seedMemberUserIds
            .map((userId) => userId.trim())
            .filter((userId) => Boolean(userId) && !adminIds.includes(userId)),
        ),
      );
      await apiRequest<CommunitiesResponse>("/api/messages/communities", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          coverImageUrl: form.coverImageUrl,
          talkPolicy: form.talkPolicy,
          accessMode: form.accessMode,
          adminIds,
          memberIds,
        }),
      });
      setCreateOpen(false);
      await mutateCommunities();
      setFeedback({
        tone: "success",
        message:
          adminIds.length || memberIds.length
            ? "Comunidade criada e participantes iniciais configurados."
            : "Comunidade criada com sucesso.",
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        message:
          err instanceof Error ? err.message : "Erro ao criar comunidade.",
      });
    } finally {
      setSavingForm(false);
    }
  };
  const updateCommunity = async (communityId: string, form: FormState) => {
    setSavingForm(true);
    setFeedback(null);
    try {
      await apiRequest<CommunitiesResponse>(
        `/api/messages/communities/${encodeURIComponent(communityId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            coverImageUrl: form.coverImageUrl,
            talkPolicy: form.talkPolicy,
            accessMode: form.accessMode,
          }),
        },
      );
      setEditing(null);
      await mutateCommunities();
      setFeedback({ tone: "success", message: "Comunidade atualizada." });
    } catch (err) {
      setFeedback({
        tone: "error",
        message:
          err instanceof Error ? err.message : "Erro ao atualizar comunidade.",
      });
    } finally {
      setSavingForm(false);
    }
  };
  const approveRequest = async (grantId: string) => {
    await runAction(`approve:${grantId}`, async () => {
      await apiRequest(
        `/api/messages/grants/${encodeURIComponent(grantId)}/accept`,
        { method: "POST" },
      );
      await Promise.all([mutateRequests(), mutateCommunities()]);
      setFeedback({ tone: "success", message: "Pedido aprovado." });
    });
  };
  const declineRequest = async (grantId: string) => {
    if (!confirmAction("Confirmas que queres recusar este pedido?")) return;
    await runAction(`decline:${grantId}`, async () => {
      await apiRequest(
        `/api/messages/grants/${encodeURIComponent(grantId)}/decline`,
        { method: "POST" },
      );
      await Promise.all([mutateRequests(), mutateCommunities()]);
      setFeedback({ tone: "success", message: "Pedido recusado." });
    });
  };
  const approveAllForCommunity = async (communityId: string) => {
    if (
      !confirmAction(
        "Isto vai aprovar todos os pedidos pendentes desta comunidade. Continuar?",
      )
    )
      return;
    await runAction(`approve-all:${communityId}`, async () => {
      await apiRequest(
        `/api/messages/communities/${encodeURIComponent(communityId)}/requests/approve-all`,
        { method: "POST" },
      );
      await Promise.all([mutateRequests(), mutateCommunities()]);
      setFeedback({ tone: "success", message: "Pedidos aprovados em lote." });
    });
  };
  const approveAll = async () => {
    if (!selectedCommunityId) return;
    await approveAllForCommunity(selectedCommunityId);
  };
  const participantAction = async (params: {
    conversationId: string;
    userId: string;
    action:
      | "PROMOTE_ADMIN"
      | "DEMOTE_ADMIN"
      | "REMOVE"
      | "MUTE"
      | "UNMUTE"
      | "BAN"
      | "UNBAN";
    mutedUntil?: string | null;
    confirmText?: string;
  }) => {
    if (params.confirmText && !confirmAction(params.confirmText)) return;
    const payload: Record<string, unknown> = { action: params.action };
    if (params.action === "MUTE" && params.mutedUntil) {
      payload.mutedUntil = params.mutedUntil;
    }
    await runAction(
      `${params.action}:${params.conversationId}:${params.userId}`,
      async () => {
        await apiRequest(
          `/api/messages/communities/${encodeURIComponent(params.conversationId)}/participants/${encodeURIComponent(params.userId)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        await Promise.all([mutateParticipants(), mutateCommunities()]);
        setFeedback({ tone: "success", message: "Participante atualizado." });
      },
    );
  };
  const promoteAdminByUserId = async () => {
    if (!selectedCommunityId) return;
    const targetInput = adminDraftUserId.trim();
    if (!targetInput) {
      setFeedback({
        tone: "error",
        message: "Indica o username da equipa para promover a admin.",
      });
      return;
    }
    const normalizedInput = targetInput.toLowerCase();
    const normalizedUsernameInput = normalizedInput.startsWith("@")
      ? normalizedInput.slice(1)
      : normalizedInput;
    const participantItems = participantsData?.items ?? [];
    const matchByUserId = participantItems.find(
      (participant) => participant.userId.toLowerCase() === normalizedInput,
    );
    const matchByUsername = participantItems.find(
      (participant) =>
        (participant.user.username?.toLowerCase() ?? "") ===
        normalizedUsernameInput,
    );
    const targetUserId =
      matchByUserId?.userId ?? matchByUsername?.userId ?? null;
    if (!targetUserId) {
      setFeedback({
        tone: "error",
        message:
          "Participante não encontrado. Usa o username de alguém que já esteja na comunidade.",
      });
      return;
    }
    await participantAction({
      conversationId: selectedCommunityId,
      userId: targetUserId,
      action: "PROMOTE_ADMIN",
    });
    setAdminDraftUserId("");
  };
  const sendManualInvites = async () => {
    if (!selectedCommunityId) return;
    const userIds = parseUserIdsInput(inviteUserIdsInput);
    if (!userIds.length) {
      setFeedback({
        tone: "error",
        message: "Indica pelo menos um utilizador para convidar.",
      });
      return;
    }
    await runAction(`manual-invites:${selectedCommunityId}`, async () => {
      const result = await apiRequest<CommunityManualInvitesResponse>(
        `/api/messages/communities/${encodeURIComponent(selectedCommunityId)}/invites`,
        {
          method: "POST",
          body: JSON.stringify({
            userIds,
            message: inviteMessage.trim() || undefined,
          }),
        },
      );
      setManualInviteResult(result);
      await mutateCommunities();
      setFeedback({ tone: "success", message: "Convites processados." });
    });
  };
  const generateInviteLink = async () => {
    if (!selectedCommunityId) return;
    const preset = invitePreset.trim();
    await runAction(`invite-link:${selectedCommunityId}`, async () => {
      const result = await apiRequest<CommunityInviteLinkResponse>(
        `/api/messages/communities/${encodeURIComponent(selectedCommunityId)}/invite-link`,
        {
          method: "POST",
          body: JSON.stringify({ preset: preset || undefined }),
        },
      );
      setGeneratedInviteLink(result.inviteLink);
      setCopiedInviteLink(false);
      await mutateCommunities();
      setFeedback({
        tone: "success",
        message: "Novo link gerado. O anterior foi invalidado.",
      });
    });
  };
  const copyInviteLink = async () => {
    if (!generatedInviteLink) return;
    const url = resolveInviteLinkUrl(generatedInviteLink.invitePath);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof window !== "undefined") {
        window.prompt("Copia manualmente este link:", url);
      }
      setCopiedInviteLink(true);
      setFeedback({ tone: "success", message: "Link copiado." });
    } catch {
      setFeedback({
        tone: "error",
        message: "Não foi possível copiar automaticamente o link.",
      });
    }
  };
  const stats = useMemo(() => {
    const totalParticipants = communities.reduce(
      (sum, community) => sum + community.participantsCount,
      0,
    );
    const totalPending = communities.reduce(
      (sum, community) => sum + community.pendingRequestsCount,
      0,
    );
    const inviteModeTotal = communities.filter(
      (community) => community.accessMode === "INVITE",
    ).length;
    const teamOnlyTalkTotal = communities.filter(
      (community) => community.talkPolicy === "TEAM_ONLY",
    ).length;
    return {
      totalParticipants,
      totalPending,
      inviteModeTotal,
      teamOnlyTalkTotal,
    };
  }, [communities]);
  const selectedParticipantStats = useMemo(() => {
    const items = participantsData?.items ?? [];
    return items.reduce(
      (acc, participant) => {
        acc.total += 1;
        if (isActiveParticipant(participant)) acc.active += 1;
        if (participant.role === "ADMIN") acc.admins += 1;
        if (participant.isTeamMember) acc.team += 1;
        if (participant.bannedAt) acc.banned += 1;
        if (isMutedParticipant(participant)) acc.muted += 1;
        return acc;
      },
      { total: 0, active: 0, admins: 0, team: 0, banned: 0, muted: 0 },
    );
  }, [participantsData?.items]);
  const selectedRequestsCount = requestsData?.items?.length ?? 0;
  const activeCommunityActionScope =
    selectedCommunity?.conversationId ?? selectedCommunityId ?? "";
  const manualInvitesActionKey = activeCommunityActionScope
    ? `manual-invites:${activeCommunityActionScope}`
    : "";
  const inviteLinkActionKey = activeCommunityActionScope
    ? `invite-link:${activeCommunityActionScope}`
    : "";
  const isManualInvitesPending =
    Boolean(manualInvitesActionKey) &&
    pendingActionKey === manualInvitesActionKey;
  const isInviteLinkPending =
    Boolean(inviteLinkActionKey) && pendingActionKey === inviteLinkActionKey;
  const isRequestsSyncing =
    selectedTab === "requests" && (requestsLoading || requestsValidating);
  const isParticipantsSyncing =
    selectedTab === "participants" &&
    (participantsLoading || participantsValidating);
  const isPromoteByIdPending =
    Boolean(selectedCommunityId) &&
    Boolean(
      pendingActionKey?.startsWith(`PROMOTE_ADMIN:${selectedCommunityId}:`),
    );
  const dangerActionClass =
    "rounded-full border border-red-300/55 bg-red-500/24 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-500/34 disabled:opacity-60";
  const warningActionClass =
    "rounded-full border border-amber-300/55 bg-amber-500/26 px-3 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/36 disabled:opacity-60";
  const positiveActionClass =
    "rounded-full border border-emerald-300/45 bg-emerald-500/18 px-3 py-1.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/28 disabled:opacity-60";
  const manualInviteDraftTokens = useMemo(
    () =>
      inviteUserIdsInput
        .split(/[,\n\s]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
    [inviteUserIdsInput],
  );
  const manualInviteUniqueCount = useMemo(
    () => new Set(manualInviteDraftTokens).size,
    [manualInviteDraftTokens],
  );
  const manualInviteDuplicateCount =
    manualInviteDraftTokens.length - manualInviteUniqueCount;
  const openCommunityChat = useCallback((conversationId: string) => {
    const path = buildCommunityChatPath(conversationId);
    if (!path || typeof window === "undefined") return;
    window.location.assign(path);
  }, []);
  return (
    <div className="h-full min-h-0 overflow-y-auto pb-8 text-white">
      {" "}
      <div className="space-y-5">
        {" "}
        <header className="rounded-3xl border border-white/20 bg-white/[0.04] p-5">
          {" "}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {" "}
            <div className="max-w-3xl">
              {" "}
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/90">
                Mensagens
              </p>{" "}
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Comunidades
              </h2>{" "}
              <p className="mt-2 text-sm text-white/90">
                {" "}
                Gestão completa de comunidades com foco em moderação, qualidade
                de conversação e fluxo direto para o chat de grupo.{" "}
              </p>{" "}
            </div>{" "}
            <div className="flex flex-wrap items-center gap-2">
              {" "}
              <button
                type="button"
                onClick={() => {
                  void mutateCommunities();
                  void mutateTeamMembers();
                  setFeedback(null);
                }}
                className={`${CTA_SECONDARY} text-sm`}
              >
                {" "}
                Atualizar{" "}
              </button>{" "}
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setCreateOpen(true);
                }}
                className={`${CTA_PRIMARY} text-sm`}
              >
                {" "}
                Nova comunidade{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {" "}
            <div className="rounded-xl border border-white/20 bg-black/25 p-3">
              {" "}
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">
                Comunidades
              </p>{" "}
              <p className="mt-1 text-2xl font-semibold text-white">
                {communities.length}
              </p>{" "}
            </div>{" "}
            <div className="rounded-xl border border-white/20 bg-black/25 p-3">
              {" "}
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">
                Participantes
              </p>{" "}
              <p className="mt-1 text-2xl font-semibold text-white">
                {stats.totalParticipants}
              </p>{" "}
            </div>{" "}
            <div className="rounded-xl border border-white/20 bg-black/25 p-3">
              {" "}
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">
                Pedidos pendentes
              </p>{" "}
              <p className="mt-1 text-2xl font-semibold text-white">
                {stats.totalPending}
              </p>{" "}
            </div>{" "}
            <div className="rounded-xl border border-white/20 bg-black/25 p-3">
              {" "}
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">
                Regras
              </p>{" "}
              <p className="mt-1 text-sm font-semibold text-white">
                {" "}
                {stats.inviteModeTotal} em INVITE · {stats.teamOnlyTalkTotal}{" "}
                com fala da equipa{" "}
              </p>{" "}
            </div>{" "}
          </div>{" "}
          {feedback ? (
            <p
              className={`mt-4 rounded-xl border px-3 py-2 text-sm ${feedback.tone === "error" ? "border-red-300/40 bg-red-500/15 text-red-100" : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"}`}
            >
              {" "}
              {feedback.message}{" "}
            </p>
          ) : null}{" "}
          {communitiesError ? (
            <p className="mt-3 rounded-xl border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">
              {" "}
              {communitiesError instanceof Error
                ? communitiesError.message
                : "Erro ao carregar comunidades."}{" "}
            </p>
          ) : null}{" "}
        </header>{" "}
        {communitiesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {" "}
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`community-skeleton-${idx}`}
                className="h-64 animate-pulse rounded-2xl border border-white/15 bg-white/[0.04]"
              />
            ))}{" "}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {" "}
            {sortedCommunities.map((community) => {
              const approveAllKey = `approve-all:${community.conversationId}`;
              const isActiveCard =
                selectedCommunityId === community.conversationId;
              const coverStyle = community.coverImageUrl
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(5,10,20,0.25), rgba(5,10,20,0.9)), url(${community.coverImageUrl})`,
                  }
                : {
                    backgroundImage:
                      "linear-gradient(140deg, rgba(30,64,175,0.7), rgba(2,132,199,0.4) 45%, rgba(2,6,23,0.95))",
                  };
              return (
                <article
                  key={community.conversationId}
                  className={`overflow-hidden rounded-2xl border bg-[#060d1a] ${isActiveCard ? "border-cyan-300/65 ring-1 ring-cyan-300/30" : "border-white/20"}`}
                >
                  {" "}
                  <div className="h-28 bg-cover bg-center" style={coverStyle}>
                    {" "}
                    <div className="flex h-full items-end justify-between gap-2 p-3">
                      {" "}
                      <span className="rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        {" "}
                        {formatCommunityTalkPolicyLabel(
                          community.talkPolicy,
                        )}{" "}
                      </span>{" "}
                      <span className="rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        {" "}
                        {formatCommunityAccessModeLabel(
                          community.accessMode,
                        )}{" "}
                      </span>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="space-y-3 p-4">
                    {" "}
                    <div className="space-y-1.5">
                      {" "}
                      <h3 className="text-base font-semibold text-white">
                        {community.title}
                      </h3>{" "}
                      <p className="line-clamp-2 text-sm text-white/85">
                        {community.description || "Sem descrição."}
                      </p>{" "}
                    </div>{" "}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {" "}
                      <div className="rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5 text-white/90">
                        {" "}
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                          Participantes
                        </p>{" "}
                        <p className="mt-0.5 font-semibold text-white">
                          {community.participantsCount}
                        </p>{" "}
                      </div>{" "}
                      <div className="rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5 text-white/90">
                        {" "}
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                          Pendentes
                        </p>{" "}
                        <p className="mt-0.5 font-semibold text-white">
                          {community.pendingRequestsCount}
                        </p>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-xs text-white/85">
                      {" "}
                      Última atividade{" "}
                      {formatRelativeTime(community.lastMessageAt)} · Atualizada
                      em{""} {formatDateTime(community.updatedAt)}{" "}
                    </div>{" "}
                    <div className="flex flex-wrap gap-2">
                      {" "}
                      <button
                        type="button"
                        onClick={() =>
                          openCommunityChat(community.conversationId)
                        }
                        className={`${CTA_PRIMARY} text-xs`}
                      >
                        {" "}
                        Abrir chat{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() =>
                          openPanel(community.conversationId, "participants")
                        }
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        {" "}
                        Gerir participantes{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() =>
                          openPanel(community.conversationId, "requests")
                        }
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        {" "}
                        Pedidos{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() =>
                          openPanel(community.conversationId, "invites")
                        }
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        {" "}
                        Convites{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => setEditing(community)}
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        {" "}
                        Editar{" "}
                      </button>{" "}
                      {community.pendingRequestsCount > 0 ? (
                        <button
                          type="button"
                          disabled={pendingActionKey === approveAllKey}
                          onClick={async () => {
                            openPanel(community.conversationId, "requests");
                            await approveAllForCommunity(
                              community.conversationId,
                            );
                          }}
                          className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                        >
                          {" "}
                          {pendingActionKey === approveAllKey
                            ? "A aprovar..."
                            : "Aprovar todos"}{" "}
                        </button>
                      ) : null}{" "}
                    </div>{" "}
                  </div>{" "}
                </article>
              );
            })}{" "}
            {!communities.length ? (
              <div className="col-span-full rounded-2xl border border-white/20 bg-[#060d1a] p-5">
                {" "}
                <p className="text-sm font-semibold text-white">
                  Ainda não existem comunidades.
                </p>{" "}
                <p className="mt-1 text-sm text-white/90">
                  {" "}
                  Cria a primeira para começar o chat de grupo com regras,
                  moderação e convites.{" "}
                </p>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setCreateOpen(true);
                  }}
                  className={`${CTA_PRIMARY} mt-3 text-xs`}
                >
                  {" "}
                  Criar primeira comunidade{" "}
                </button>{" "}
              </div>
            ) : null}{" "}
          </div>
        )}{" "}
        {activePanel && selectedCommunity ? (
          <section className="rounded-2xl border border-white/20 bg-[#060d1a] p-4">
            {" "}
            <div className="mb-4 space-y-3">
              {" "}
              <div className="flex flex-wrap items-start justify-between gap-3">
                {" "}
                <div>
                  {" "}
                  <h3 className="text-lg font-semibold text-white">
                    {selectedCommunity.title}
                  </h3>{" "}
                  <p className="text-sm text-white/92">
                    {" "}
                    {formatCommunityTalkPolicyLabel(
                      selectedCommunity.talkPolicy,
                    )}{" "}
                    ·{""}{" "}
                    {formatCommunityAccessModeLabel(
                      selectedCommunity.accessMode,
                    )}{" "}
                  </p>{" "}
                  <p className="mt-1 text-xs text-white/80">
                    {" "}
                    Gestão operacional desta comunidade com impacto direto no
                    chat e no fluxo mobile.{" "}
                  </p>{" "}
                </div>{" "}
                <div className="flex flex-wrap items-center gap-2">
                  {" "}
                  <button
                    type="button"
                    onClick={() =>
                      openCommunityChat(selectedCommunity.conversationId)
                    }
                    className={`${CTA_PRIMARY} text-xs`}
                  >
                    {" "}
                    Abrir chat do grupo{" "}
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => setEditing(selectedCommunity)}
                    className={`${CTA_SECONDARY} text-xs`}
                  >
                    {" "}
                    Editar comunidade{" "}
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => setActivePanel(null)}
                    className={`${CTA_SECONDARY} text-xs`}
                  >
                    {" "}
                    Fechar painel{" "}
                  </button>{" "}
                </div>{" "}
              </div>{" "}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {" "}
                <div className="rounded-xl border border-white/20 bg-black/25 p-3">
                  {" "}
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/75">
                    Participantes
                  </p>{" "}
                  <p className="mt-1 text-xl font-semibold text-white">
                    {selectedCommunity.participantsCount}
                  </p>{" "}
                </div>{" "}
                <div className="rounded-xl border border-white/20 bg-black/25 p-3">
                  {" "}
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/75">
                    Pendentes
                  </p>{" "}
                  <p className="mt-1 text-xl font-semibold text-white">
                    {" "}
                    {selectedTab === "requests"
                      ? requestsLoading
                        ? selectedCommunity.pendingRequestsCount
                        : selectedRequestsCount
                      : selectedCommunity.pendingRequestsCount}{" "}
                  </p>{" "}
                </div>{" "}
                <div className="rounded-xl border border-white/20 bg-black/25 p-3">
                  {" "}
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/75">
                    Ativos / Admins
                  </p>{" "}
                  <p className="mt-1 text-xl font-semibold text-white">
                    {" "}
                    {selectedTab === "participants"
                      ? selectedParticipantStats.active
                      : "—"}{" "}
                    /{""}{" "}
                    {selectedTab === "participants"
                      ? selectedParticipantStats.admins
                      : "—"}{" "}
                  </p>{" "}
                </div>{" "}
                <div className="rounded-xl border border-white/20 bg-black/25 p-3">
                  {" "}
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/75">
                    Moderação
                  </p>{" "}
                  <p className="mt-1 text-sm font-semibold text-white">
                    {" "}
                    {selectedTab === "participants"
                      ? `${selectedParticipantStats.muted} muted · ${selectedParticipantStats.banned} banidos`
                      : "Abre Participantes para detalhe"}{" "}
                  </p>{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
            <div className="mb-4 flex flex-wrap gap-2">
              {" "}
              <button
                type="button"
                onClick={() =>
                  openPanel(selectedCommunity.conversationId, "requests")
                }
                className={`${selectedTab === "requests" ? CTA_PRIMARY : CTA_SECONDARY} text-xs`}
              >
                {" "}
                Pedidos (
                {selectedTab === "requests"
                  ? requestsLoading
                    ? selectedCommunity.pendingRequestsCount
                    : selectedRequestsCount
                  : selectedCommunity.pendingRequestsCount}
                ){" "}
              </button>{" "}
              <button
                type="button"
                onClick={() =>
                  openPanel(selectedCommunity.conversationId, "participants")
                }
                className={`${selectedTab === "participants" ? CTA_PRIMARY : CTA_SECONDARY} text-xs`}
              >
                {" "}
                Participantes ({selectedCommunity.participantsCount}){" "}
              </button>{" "}
              <button
                type="button"
                onClick={() =>
                  openPanel(selectedCommunity.conversationId, "invites")
                }
                className={`${selectedTab === "invites" ? CTA_PRIMARY : CTA_SECONDARY} text-xs`}
              >
                {" "}
                Convites e links{" "}
              </button>{" "}
            </div>{" "}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {" "}
              {isRequestsSyncing ? (
                <span className="rounded-full border border-cyan-200/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-100">
                  {" "}
                  A sincronizar pedidos...{" "}
                </span>
              ) : null}{" "}
              {isParticipantsSyncing ? (
                <span className="rounded-full border border-cyan-200/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-100">
                  {" "}
                  A sincronizar participantes...{" "}
                </span>
              ) : null}{" "}
              {isManualInvitesPending ? (
                <span className="rounded-full border border-cyan-200/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-100">
                  {" "}
                  A processar convites manuais...{" "}
                </span>
              ) : null}{" "}
              {isInviteLinkPending ? (
                <span className="rounded-full border border-cyan-200/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-100">
                  {" "}
                  A gerar link de convite...{" "}
                </span>
              ) : null}{" "}
            </div>{" "}
            {selectedTab === "requests" ? (
              <div className="space-y-3">
                {" "}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {" "}
                  <p className="text-sm text-white/92">
                    Aprova ou recusa entradas pendentes nesta comunidade.
                  </p>{" "}
                  <div className="flex flex-wrap gap-2">
                    {" "}
                    <button
                      type="button"
                      onClick={() => void mutateRequests()}
                      className={`${CTA_SECONDARY} text-xs`}
                    >
                      {" "}
                      {isRequestsSyncing
                        ? "A sincronizar..."
                        : "Atualizar"}{" "}
                    </button>{" "}
                    <button
                      type="button"
                      onClick={approveAll}
                      disabled={
                        pendingActionKey ===
                        `approve-all:${selectedCommunity.conversationId}`
                      }
                      className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                    >
                      {" "}
                      {pendingActionKey ===
                      `approve-all:${selectedCommunity.conversationId}`
                        ? "A aprovar..."
                        : "Aprovar todos"}{" "}
                    </button>{" "}
                  </div>{" "}
                </div>{" "}
                {requestsLoading && !requestsData?.items?.length ? (
                  <div className="h-24 animate-pulse rounded-xl border border-white/15 bg-white/[0.03]" />
                ) : requestsError ? (
                  <div className="rounded-xl border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">
                    {" "}
                    {requestsError instanceof Error
                      ? requestsError.message
                      : "Erro ao carregar pedidos."}{" "}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {" "}
                    {sortedRequests.map((request) => {
                      const approveKey = `approve:${request.id}`;
                      const declineKey = `decline:${request.id}`;
                      const isBusy =
                        pendingActionKey === approveKey ||
                        pendingActionKey === declineKey;
                      return (
                        <article
                          key={request.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5"
                        >
                          {" "}
                          <div>
                            {" "}
                            <p className="text-sm font-semibold text-white">
                              {" "}
                              {request.requester
                                ? getUserLabel(request.requester)
                                : request.requesterId || "Utilizador"}{" "}
                            </p>{" "}
                            <p className="text-xs text-white/80">
                              {" "}
                              Pedido em {formatDateTime(request.createdAt)}{" "}
                              {request.expiresAt
                                ? ` · Expira ${formatDateTime(request.expiresAt)}`
                                : ""}{" "}
                            </p>{" "}
                            <p className="mt-0.5 text-[11px] text-white/75">
                              {" "}
                              {request.requester?.username
                                ? `@${request.requester.username}`
                                : request.requesterId
                                  ? `ID: ${request.requesterId}`
                                  : "Sem identificador público"}{" "}
                            </p>{" "}
                          </div>{" "}
                          <div className="flex items-center gap-2">
                            {" "}
                            <button
                              type="button"
                              onClick={() => void declineRequest(request.id)}
                              disabled={isBusy}
                              className={dangerActionClass}
                            >
                              {" "}
                              Recusar{" "}
                            </button>{" "}
                            <button
                              type="button"
                              onClick={() => void approveRequest(request.id)}
                              disabled={isBusy}
                              className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                            >
                              {" "}
                              Aprovar{" "}
                            </button>{" "}
                          </div>{" "}
                        </article>
                      );
                    })}{" "}
                    {!sortedRequests.length ? (
                      <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                        {" "}
                        <p className="text-sm font-semibold text-white">
                          Sem pedidos pendentes.
                        </p>{" "}
                        <p className="mt-1 text-xs text-white/80">
                          {" "}
                          Quando surgirem novos pedidos de entrada, aparecem
                          aqui para aprovação rápida.{" "}
                        </p>{" "}
                        <button
                          type="button"
                          onClick={() =>
                            openPanel(
                              selectedCommunity.conversationId,
                              "participants",
                            )
                          }
                          className={`${CTA_SECONDARY} mt-2 text-xs`}
                        >
                          {" "}
                          Ir para participantes{" "}
                        </button>{" "}
                      </div>
                    ) : null}{" "}
                  </div>
                )}{" "}
              </div>
            ) : null}{" "}
            {selectedTab === "participants" ? (
              <div className="space-y-3">
                {" "}
                <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
                  {" "}
                  <input
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Pesquisar por nome, username ou utilizador"
                    className="w-full rounded-full border border-white/20 bg-[#050b16] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35"
                  />{" "}
                  <select
                    value={participantView}
                    onChange={(e) =>
                      setParticipantView(e.target.value as "ACTIVE" | "ALL")
                    }
                    className="rounded-full border border-white/20 bg-[#050b16] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35"
                  >
                    {" "}
                    <option value="ACTIVE">Ativos</option>{" "}
                    <option value="ALL">Todos</option>{" "}
                  </select>{" "}
                  <button
                    type="button"
                    onClick={() => void mutateParticipants()}
                    className={`${CTA_SECONDARY} text-xs`}
                  >
                    {" "}
                    {isParticipantsSyncing
                      ? "A sincronizar..."
                      : "Atualizar"}{" "}
                  </button>{" "}
                </div>{" "}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-black/20 p-2">
                  {" "}
                  <input
                    value={adminDraftUserId}
                    onChange={(e) => setAdminDraftUserId(e.target.value)}
                    placeholder="Username da equipa para promover a admin"
                    className="min-w-[250px] flex-1 rounded-full border border-white/20 bg-[#050b16] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35"
                  />{" "}
                  <button
                    type="button"
                    onClick={() => void promoteAdminByUserId()}
                    disabled={isPromoteByIdPending}
                    className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                  >
                    {" "}
                    {isPromoteByIdPending
                      ? "A promover..."
                      : "Promover admin (ID)"}{" "}
                  </button>{" "}
                </div>{" "}
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {" "}
                  <div className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2">
                    {" "}
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                      Total
                    </p>{" "}
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {selectedParticipantStats.total}
                    </p>{" "}
                  </div>{" "}
                  <div className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2">
                    {" "}
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                      Ativos
                    </p>{" "}
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {selectedParticipantStats.active}
                    </p>{" "}
                  </div>{" "}
                  <div className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2">
                    {" "}
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                      Admins
                    </p>{" "}
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {selectedParticipantStats.admins}
                    </p>{" "}
                  </div>{" "}
                  <div className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2">
                    {" "}
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                      Muted
                    </p>{" "}
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {selectedParticipantStats.muted}
                    </p>{" "}
                  </div>{" "}
                  <div className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2">
                    {" "}
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                      Banidos
                    </p>{" "}
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {selectedParticipantStats.banned}
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {" "}
                  <span className="rounded-full border border-emerald-300/40 bg-emerald-500/16 px-2.5 py-1 text-emerald-100">
                    {" "}
                    Ação segura: permissões{" "}
                  </span>{" "}
                  <span className="rounded-full border border-amber-300/40 bg-amber-500/16 px-2.5 py-1 text-amber-100">
                    {" "}
                    Atenção: mute e ban{" "}
                  </span>{" "}
                  <span className="rounded-full border border-red-300/40 bg-red-500/16 px-2.5 py-1 text-red-100">
                    {" "}
                    Crítico: remover participante{" "}
                  </span>{" "}
                </div>{" "}
                {participantsLoading && !participantsData?.items?.length ? (
                  <div className="h-24 animate-pulse rounded-xl border border-white/15 bg-white/[0.03]" />
                ) : participantsError ? (
                  <div className="rounded-xl border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">
                    {" "}
                    {participantsError instanceof Error
                      ? participantsError.message
                      : "Erro ao carregar participantes."}{" "}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {" "}
                    {filteredParticipants.map((participant) => {
                      const busySuffix = `${selectedCommunity.conversationId}:${participant.userId}`;
                      const isBusy = Boolean(
                        pendingActionKey?.endsWith(`:${busySuffix}`),
                      );
                      const canPromote =
                        participant.role !== "ADMIN" &&
                        participant.isTeamMember;
                      const canDemote = participant.role === "ADMIN";
                      const isBanned = Boolean(participant.bannedAt);
                      const isMuted = isMutedParticipant(participant);
                      const isActive = isActiveParticipant(participant);
                      const userLabel = getUserLabel(participant.user);
                      const avatarSeed =
                        userLabel.trim().charAt(0).toUpperCase() || "U";
                      return (
                        <article
                          key={participant.userId}
                          className="rounded-xl border border-white/15 bg-black/25 px-3 py-3"
                        >
                          {" "}
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            {" "}
                            <div className="flex min-w-0 items-start gap-3">
                              {" "}
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/40 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                                {" "}
                                {avatarSeed}{" "}
                              </div>{" "}
                              <div className="min-w-0">
                                {" "}
                                <p className="truncate text-sm font-semibold text-white">
                                  {userLabel}
                                </p>{" "}
                                <p className="text-xs text-white/90">
                                  {" "}
                                  {participant.role} ·{" "}
                                  {participant.isTeamMember
                                    ? "Equipa"
                                    : "Cliente"}{" "}
                                  ·{""} {isActive ? "Ativo" : "Inativo"}{" "}
                                </p>{" "}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {" "}
                                  {isBanned ? (
                                    <span className="rounded-full border border-red-300/35 bg-red-500/20 px-2 py-0.5 text-[10px] text-red-100">
                                      {" "}
                                      Banido{" "}
                                    </span>
                                  ) : null}{" "}
                                  {isMuted ? (
                                    <span className="rounded-full border border-amber-300/35 bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-100">
                                      {" "}
                                      Mute ativo{" "}
                                    </span>
                                  ) : null}{" "}
                                  {!isBanned && !isMuted && isActive ? (
                                    <span className="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">
                                      {" "}
                                      Estado normal{" "}
                                    </span>
                                  ) : null}{" "}
                                </div>{" "}
                                <p className="mt-1 text-[11px] text-white/75">
                                  {" "}
                                  Entrou: {formatDateTime(
                                    participant.joinedAt,
                                  )}{" "}
                                  {participant.followGraceEndsAt
                                    ? ` · grace seguidores até ${formatDateTime(participant.followGraceEndsAt)}`
                                    : ""}{" "}
                                </p>{" "}
                              </div>{" "}
                            </div>{" "}
                            <div className="flex flex-wrap gap-2">
                              {" "}
                              {canPromote ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId:
                                        selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "PROMOTE_ADMIN",
                                    })
                                  }
                                  className={positiveActionClass}
                                >
                                  {" "}
                                  Promover admin{" "}
                                </button>
                              ) : null}{" "}
                              {canDemote ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId:
                                        selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "DEMOTE_ADMIN",
                                      confirmText:
                                        "Confirmas que queres remover privilégios de admin?",
                                    })
                                  }
                                  className={positiveActionClass}
                                >
                                  {" "}
                                  Remover admin{" "}
                                </button>
                              ) : null}{" "}
                              {!isBanned ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId:
                                        selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "BAN",
                                      confirmText:
                                        "Banir este utilizador remove-o da comunidade e impede novas entradas.",
                                    })
                                  }
                                  className={warningActionClass}
                                >
                                  {" "}
                                  Banir{" "}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId:
                                        selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "UNBAN",
                                    })
                                  }
                                  className={positiveActionClass}
                                >
                                  {" "}
                                  Remover ban{" "}
                                </button>
                              )}{" "}
                              {!isMuted ? (
                                <>
                                  {" "}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void participantAction({
                                        conversationId:
                                          selectedCommunity.conversationId,
                                        userId: participant.userId,
                                        action: "MUTE",
                                        mutedUntil: buildMuteUntil("1h"),
                                      })
                                    }
                                    className={warningActionClass}
                                  >
                                    {" "}
                                    Mutar 1h{" "}
                                  </button>{" "}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void participantAction({
                                        conversationId:
                                          selectedCommunity.conversationId,
                                        userId: participant.userId,
                                        action: "MUTE",
                                        mutedUntil: buildMuteUntil("24h"),
                                      })
                                    }
                                    className={warningActionClass}
                                  >
                                    {" "}
                                    Mutar 24h{" "}
                                  </button>{" "}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void participantAction({
                                        conversationId:
                                          selectedCommunity.conversationId,
                                        userId: participant.userId,
                                        action: "MUTE",
                                      })
                                    }
                                    className={warningActionClass}
                                  >
                                    {" "}
                                    Mutar indefinido{" "}
                                  </button>{" "}
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId:
                                        selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "UNMUTE",
                                    })
                                  }
                                  className={positiveActionClass}
                                >
                                  {" "}
                                  Desmutar{" "}
                                </button>
                              )}{" "}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void participantAction({
                                    conversationId:
                                      selectedCommunity.conversationId,
                                    userId: participant.userId,
                                    action: "REMOVE",
                                    confirmText:
                                      "Confirmas a remoção deste participante da comunidade?",
                                  })
                                }
                                className={dangerActionClass}
                              >
                                {" "}
                                Remover{" "}
                              </button>{" "}
                            </div>{" "}
                          </div>{" "}
                        </article>
                      );
                    })}{" "}
                    {!filteredParticipants.length ? (
                      <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                        {" "}
                        <p className="text-sm font-semibold text-white">
                          {" "}
                          Nenhum participante encontrado com os filtros
                          atuais.{" "}
                        </p>{" "}
                        <p className="mt-1 text-xs text-white/80">
                          {" "}
                          Ajusta a pesquisa ou muda a vista para{" "}
                          <strong>Todos</strong>.{" "}
                        </p>{" "}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {" "}
                          <button
                            type="button"
                            onClick={() => {
                              setParticipantSearch("");
                              setParticipantView("ALL");
                            }}
                            className={`${CTA_SECONDARY} text-xs`}
                          >
                            {" "}
                            Limpar filtros{" "}
                          </button>{" "}
                        </div>{" "}
                      </div>
                    ) : null}{" "}
                  </div>
                )}{" "}
              </div>
            ) : null}{" "}
            {selectedTab === "invites" ? (
              <div className="space-y-4">
                {" "}
                {selectedCommunity.accessMode !== "INVITE" ? (
                  <div className="rounded-xl border border-amber-300/40 bg-amber-500/15 p-3 text-sm text-amber-100">
                    {" "}
                    Esta comunidade não está no modo INVITE. Altera o modo de
                    acesso para ativar convites manuais e links.{" "}
                  </div>
                ) : null}{" "}
                <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                  {" "}
                  <h4 className="text-sm font-semibold text-white">
                    Convite manual
                  </h4>{" "}
                  <p className="mt-1 text-xs text-white/85">
                    {" "}
                    Introduz utilizadores (username ou identificador) separados
                    por vírgula, espaço ou nova linha.{" "}
                  </p>{" "}
                  <div className="mt-3 grid gap-2">
                    {" "}
                    <textarea
                      value={inviteUserIdsInput}
                      onChange={(e) => setInviteUserIdsInput(e.target.value)}
                      className="min-h-[100px] rounded-xl border border-white/20 bg-[#050b16] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35"
                      placeholder="username_1, username_2"
                    />{" "}
                    <input
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      className="rounded-xl border border-white/20 bg-[#050b16] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35"
                      placeholder="Mensagem opcional do convite"
                      maxLength={600}
                    />{" "}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                      {" "}
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5">
                        {" "}
                        Entradas: {manualInviteDraftTokens.length}{" "}
                      </span>{" "}
                      <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">
                        {" "}
                        Únicos: {manualInviteUniqueCount}{" "}
                      </span>{" "}
                      {manualInviteDuplicateCount > 0 ? (
                        <span className="rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-0.5 text-amber-100">
                          {" "}
                          Duplicados: {manualInviteDuplicateCount}{" "}
                        </span>
                      ) : null}{" "}
                    </div>{" "}
                    {manualInviteDuplicateCount > 0 ? (
                      <p className="text-[11px] text-amber-100/90">
                        {" "}
                        Entradas duplicadas são removidas automaticamente antes
                        do envio.{" "}
                      </p>
                    ) : null}{" "}
                    <div className="flex items-center justify-between">
                      {" "}
                      <span className="text-[11px] text-white/75">
                        {inviteMessage.trim().length}/600
                      </span>{" "}
                      <button
                        type="button"
                        disabled={
                          selectedCommunity.accessMode !== "INVITE" ||
                          manualInviteUniqueCount < 1 ||
                          isManualInvitesPending
                        }
                        onClick={() => void sendManualInvites()}
                        className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                      >
                        {" "}
                        {isManualInvitesPending
                          ? "A enviar..."
                          : "Enviar convites"}{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                  {manualInviteResult ? (
                    <div className="mt-3 space-y-1 rounded-lg border border-white/20 bg-black/30 p-2 text-xs text-white/85">
                      {" "}
                      <p>
                        Enviados:{" "}
                        <strong>{manualInviteResult.invitedCount}</strong>
                      </p>{" "}
                      {manualInviteResult.skipped.length ? (
                        <p>Ignorados: {manualInviteResult.skipped.length}</p>
                      ) : null}{" "}
                      {manualInviteResult.missingUserIds.length ? (
                        <p>
                          Utilizadores em falta:{" "}
                          {manualInviteResult.missingUserIds.length}
                        </p>
                      ) : null}{" "}
                      {manualInviteResult.skipped.length ? (
                        <p className="text-white/75">
                          {" "}
                          Motivos ignorados:{" "}
                          {Array.from(
                            new Set(
                              manualInviteResult.skipped.map(
                                (item) => item.reason,
                              ),
                            ),
                          ).join(",")}{" "}
                        </p>
                      ) : null}{" "}
                    </div>
                  ) : null}{" "}
                </div>{" "}
                <div className="rounded-xl border border-white/15 bg-black/25 p-3">
                  {" "}
                  <h4 className="text-sm font-semibold text-white">
                    Link de convite
                  </h4>{" "}
                  <p className="mt-1 text-xs text-white/85">
                    Gerar novo link invalida o link anterior.
                  </p>{" "}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {" "}
                    <select
                      value={invitePreset}
                      onChange={(e) => setInvitePreset(e.target.value)}
                      className="rounded-full border border-white/20 bg-[#050b16] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/35"
                    >
                      {" "}
                      {invitePresetOptions.map((option) => (
                        <option key={option.label} value={option.value}>
                          {" "}
                          {option.label}{" "}
                        </option>
                      ))}{" "}
                    </select>{" "}
                    <button
                      type="button"
                      disabled={
                        selectedCommunity.accessMode !== "INVITE" ||
                        isInviteLinkPending
                      }
                      onClick={() => void generateInviteLink()}
                      className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                    >
                      {" "}
                      {isInviteLinkPending
                        ? "A gerar..."
                        : generatedInviteLink
                          ? "Regenerar link"
                          : "Gerar link"}{" "}
                    </button>{" "}
                  </div>{" "}
                  {generatedInviteLink ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-white/20 bg-black/30 p-2">
                      {" "}
                      <label className="grid gap-1 text-[11px] text-white/85">
                        {" "}
                        <span>Link</span>{" "}
                        <input
                          value={resolveInviteLinkUrl(
                            generatedInviteLink.invitePath,
                          )}
                          readOnly
                          className="rounded-md border border-white/20 bg-[#050b16] px-2 py-1.5 text-xs text-white"
                        />{" "}
                      </label>{" "}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/80">
                        {" "}
                        <span>
                          Criado em{" "}
                          {formatDateTime(generatedInviteLink.createdAt)}
                        </span>{" "}
                        <span>
                          {" "}
                          {generatedInviteLink.expiresAt
                            ? `Expira em ${formatDateTime(generatedInviteLink.expiresAt)}`
                            : "Sem validade"}{" "}
                        </span>{" "}
                      </div>{" "}
                      <div className="flex flex-wrap gap-2">
                        {" "}
                        <button
                          type="button"
                          onClick={() => void copyInviteLink()}
                          className={`${CTA_SECONDARY} text-xs`}
                        >
                          {" "}
                          {copiedInviteLink ? "Copiado" : "Copiar link"}{" "}
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() =>
                            openCommunityChat(selectedCommunity.conversationId)
                          }
                          className={`${CTA_PRIMARY} text-xs`}
                        >
                          {" "}
                          Ver chat desta comunidade{" "}
                        </button>{" "}
                      </div>{" "}
                    </div>
                  ) : null}{" "}
                </div>{" "}
              </div>
            ) : null}{" "}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-white/25 bg-[#060d1a] p-4">
            {" "}
            <p className="text-sm font-semibold text-white">
              Painel avançado de comunidade
            </p>{" "}
            <p className="mt-1 text-sm text-white/85">
              {" "}
              Seleciona uma comunidade para abrir gestão de pedidos,
              participantes, convites e moderação.{" "}
            </p>{" "}
            {sortedCommunities.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {" "}
                {sortedCommunities.slice(0, 4).map((community) => (
                  <button
                    key={`quick-open-${community.conversationId}`}
                    type="button"
                    onClick={() =>
                      openPanel(community.conversationId, "participants")
                    }
                    className={`${CTA_SECONDARY} text-xs`}
                  >
                    {" "}
                    {community.title}{" "}
                  </button>
                ))}{" "}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className={`${CTA_PRIMARY} mt-3 text-xs`}
              >
                {" "}
                Criar comunidade{" "}
              </button>
            )}{" "}
          </section>
        )}{" "}
      </div>{" "}
      {createOpen ? (
        <CommunityFormModal
          mode="create"
          title="Criar comunidade"
          submitLabel="Criar"
          initial={formDefaults}
          teamMembers={teamMembersData?.items ?? []}
          teamMembersLoading={teamMembersLoading}
          teamMembersError={
            teamMembersError instanceof Error ? teamMembersError : null
          }
          pending={savingForm}
          onClose={() => setCreateOpen(false)}
          onSubmit={createCommunity}
        />
      ) : null}{" "}
      {editing ? (
        <CommunityFormModal
          mode="edit"
          title={`Editar · ${editing.title}`}
          submitLabel="Guardar"
          initial={{
            title: editing.title,
            description: editing.description ?? "",
            coverImageUrl: editing.coverImageUrl ?? "",
            talkPolicy: editing.talkPolicy,
            accessMode: editing.accessMode,
            seedAdminUserIds: [],
            seedMemberUserIds: [],
          }}
          teamMembers={teamMembersData?.items ?? []}
          teamMembersLoading={teamMembersLoading}
          teamMembersError={
            teamMembersError instanceof Error ? teamMembersError : null
          }
          pending={savingForm}
          onClose={() => setEditing(null)}
          onSubmit={(form) => updateCommunity(editing.conversationId, form)}
        />
      ) : null}{" "}
    </div>
  );
}
