"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/org/_internal/core/dashboardUi";
import { ORYA_ORG_ID_HEADER } from "@/lib/http/headers";
import {
  COMMUNITY_ACCESS_MODE_OPTIONS,
  COMMUNITY_TALK_POLICY_OPTIONS,
  formatCommunityAccessModeLabel,
  formatCommunityTalkPolicyLabel,
} from "@/lib/messages/communityUi";
import { getOrganizationIdFromBrowser, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";

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

type FormState = {
  title: string;
  description: string;
  coverImageUrl: string;
  talkPolicy: "EVERYONE" | "TEAM_ONLY";
  accessMode: "PUBLIC" | "FOLLOWERS" | "APPROVAL" | "INVITE";
};

type PanelTab = "requests" | "participants" | "invites";

type ActivePanelState = {
  communityId: string;
  tab: PanelTab;
};

type MutePreset = "1h" | "24h" | "indefinido";

const formDefaults: FormState = {
  title: "",
  description: "",
  coverImageUrl: "",
  talkPolicy: "EVERYONE",
  accessMode: "PUBLIC",
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
  ADMIN_MUST_BE_TEAM_MEMBER: "Só membros da equipa podem ser promovidos a admin.",
  NOT_ADMIN: "Este participante não é admin.",
  LAST_ADMIN: "Não podes remover o último admin.",
  BANNED: "Utilizador banido nesta comunidade.",
  INVALID_USERS: "Indica pelo menos um user id válido.",
  INVALID_PARAMS: "Parâmetros inválidos.",
  INVALID_ACTION: "Ação inválida.",
};

function resolveActiveOrganizationId() {
  if (typeof window === "undefined") return null;
  return parseOrganizationIdFromPathname(window.location.pathname) ?? getOrganizationIdFromBrowser();
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

  const res = await fetch(requestUrl, {
    ...init,
    headers,
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
  if (!res.ok || json?.ok === false) {
    const errorCode = (json?.error ?? "").trim().toUpperCase();
    const mapped = apiErrorLabels[errorCode];
    throw new Error(mapped || json?.error || "Erro no pedido.");
  }

  return (json ?? {}) as T;
}

function getUserLabel(user: { fullName: string | null; username: string | null }) {
  return user.fullName?.trim() || (user.username ? `@${user.username}` : "Utilizador");
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
  return !participant.leftAt && !participant.accessRevokedAt && !participant.bannedAt;
}

function isMutedParticipant(participant: CommunityParticipantItem) {
  if (!participant.writeMutedAt) return false;
  if (!participant.writeMutedUntil) return true;
  return new Date(participant.writeMutedUntil).getTime() > Date.now();
}

function buildMuteUntil(preset: MutePreset) {
  if (preset === "indefinido") return null;
  if (preset === "1h") return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function resolveInviteLinkUrl(invitePath: string) {
  if (invitePath.startsWith("http://") || invitePath.startsWith("https://")) return invitePath;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${invitePath.startsWith("/") ? invitePath : `/${invitePath}`}`;
  }
  return invitePath;
}

function CommunityFormModal(props: {
  title: string;
  submitLabel: string;
  initial: FormState;
  pending: boolean;
  onClose: () => void;
  onSubmit: (state: FormState) => Promise<void>;
}) {
  const [state, setState] = useState<FormState>(props.initial);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const uploadCoverFile = async (file: File) => {
    const organizationId = resolveActiveOrganizationId();
    if (!organizationId) {
      setError("Não foi possível identificar a organização ativa para o upload da capa.");
      return;
    }

    setUploadingCover(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/upload?scope=event-cover&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
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

    setError(null);
    await props.onSubmit({
      ...state,
      title: normalizedTitle,
      description: normalizedDescription,
      coverImageUrl: normalizedCover,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#090d17] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
          <h3 className="text-lg font-semibold">{props.title}</h3>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-white/70">Título</span>
              <input
                value={state.title}
                onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300"
                placeholder="Ex.: Comunidade Intermédio"
                maxLength={120}
              />
              <span className="text-[11px] text-white/45">{state.title.trim().length}/120</span>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-white/70">Descrição</span>
              <textarea
                value={state.description}
                onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[80px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300"
                placeholder="Descrição opcional"
                maxLength={1000}
              />
              <span className="text-[11px] text-white/45">{state.description.trim().length}/1000</span>
            </label>

            <div className="grid gap-2 text-sm">
              <span className="text-white/70">Foto da capa (opcional)</span>
              <div className="rounded-xl border border-white/15 bg-black/25 p-2">
                <div
                  className="h-24 rounded-lg bg-cover bg-center"
                  style={
                    state.coverImageUrl
                      ? {
                          backgroundImage: `linear-gradient(180deg, rgba(7,9,17,0.15), rgba(7,9,17,0.6)), url(${state.coverImageUrl})`,
                        }
                      : {
                          backgroundImage:
                            "linear-gradient(135deg, rgba(34,211,238,0.24), rgba(59,130,246,0.18) 42%, rgba(2,6,23,0.95))",
                        }
                  }
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover || props.pending}
                    className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                  >
                    {uploadingCover ? "A carregar..." : state.coverImageUrl ? "Trocar capa" : "Carregar capa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, coverImageUrl: "" }))}
                    disabled={!state.coverImageUrl || uploadingCover || props.pending}
                    className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                  >
                    Remover
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-white/70">Política de fala</span>
                <select
                  value={state.talkPolicy}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      talkPolicy: e.target.value as FormState["talkPolicy"],
                    }))
                  }
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300"
                >
                  {COMMUNITY_TALK_POLICY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-white/70">Acesso</span>
                <select
                  value={state.accessMode}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      accessMode: e.target.value as FormState["accessMode"],
                    }))
                  }
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300"
                >
                  {COMMUNITY_ACCESS_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={props.onClose}
                disabled={props.pending}
                className={`${CTA_SECONDARY} text-sm disabled:opacity-60`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={props.pending || uploadingCover}
                className={`${CTA_PRIMARY} text-sm disabled:opacity-60`}
              >
                {props.pending ? "A guardar..." : props.submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={(file) => {
          void handleCoverCropConfirm(file);
        }}
      />
    </>
  );
}

export default function CommunitiesManagerClient() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityItem | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanelState | null>(null);
  const [participantView, setParticipantView] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [participantSearch, setParticipantSearch] = useState("");
  const [adminDraftUserId, setAdminDraftUserId] = useState("");
  const [inviteUserIdsInput, setInviteUserIdsInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePreset, setInvitePreset] = useState<"" | string>("");
  const [generatedInviteLink, setGeneratedInviteLink] = useState<
    CommunityInviteLinkResponse["inviteLink"] | null
  >(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [manualInviteResult, setManualInviteResult] = useState<CommunityManualInvitesResponse | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const communitiesKey = "/api/messages/communities";
  const {
    data: communitiesData,
    isLoading: communitiesLoading,
    error: communitiesError,
    mutate: mutateCommunities,
  } = useSWR<CommunitiesResponse>(communitiesKey, (url: string) => apiRequest<CommunitiesResponse>(url), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const selectedCommunityId = activePanel?.communityId ?? null;
  const selectedTab = activePanel?.tab ?? null;

  const requestsKey =
    selectedCommunityId && selectedTab === "requests"
      ? `/api/messages/communities/${encodeURIComponent(selectedCommunityId)}/requests`
      : null;

  const {
    data: requestsData,
    isLoading: requestsLoading,
    error: requestsError,
    mutate: mutateRequests,
  } = useSWR<CommunityRequestsResponse>(requestsKey, (url: string) => apiRequest<CommunityRequestsResponse>(url), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const participantsKey =
    selectedCommunityId && selectedTab === "participants"
      ? `/api/messages/communities/${encodeURIComponent(selectedCommunityId)}/participants`
      : null;

  const {
    data: participantsData,
    isLoading: participantsLoading,
    error: participantsError,
    mutate: mutateParticipants,
  } = useSWR<CommunityParticipantsResponse>(
    participantsKey,
    (url: string) => apiRequest<CommunityParticipantsResponse>(url),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const communities = communitiesData?.items ?? [];

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.conversationId === selectedCommunityId) ?? null,
    [communities, selectedCommunityId],
  );

  const filteredParticipants = useMemo(() => {
    const list = participantsData?.items ?? [];
    const query = participantSearch.trim().toLowerCase();

    return list
      .filter((participant) => (participantView === "ALL" ? true : isActiveParticipant(participant)))
      .filter((participant) => {
        if (!query) return true;
        const name = participant.user.fullName?.toLowerCase() ?? "";
        const username = participant.user.username?.toLowerCase() ?? "";
        const userId = participant.userId.toLowerCase();
        return name.includes(query) || username.includes(query) || userId.includes(query);
      });
  }, [participantSearch, participantView, participantsData?.items]);

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

  const runAction = useCallback(async (key: string, action: () => Promise<void>) => {
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
  }, []);

  const createCommunity = async (form: FormState) => {
    setSavingForm(true);
    setFeedback(null);
    try {
      await apiRequest<CommunitiesResponse>("/api/messages/communities", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCreateOpen(false);
      await mutateCommunities();
      setFeedback({ tone: "success", message: "Comunidade criada com sucesso." });
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Erro ao criar comunidade.",
      });
    } finally {
      setSavingForm(false);
    }
  };

  const updateCommunity = async (communityId: string, form: FormState) => {
    setSavingForm(true);
    setFeedback(null);
    try {
      await apiRequest<CommunitiesResponse>(`/api/messages/communities/${encodeURIComponent(communityId)}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setEditing(null);
      await mutateCommunities();
      setFeedback({ tone: "success", message: "Comunidade atualizada." });
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Erro ao atualizar comunidade.",
      });
    } finally {
      setSavingForm(false);
    }
  };

  const approveRequest = async (grantId: string) => {
    await runAction(`approve:${grantId}`, async () => {
      await apiRequest(`/api/messages/grants/${encodeURIComponent(grantId)}/accept`, { method: "POST" });
      await Promise.all([mutateRequests(), mutateCommunities()]);
      setFeedback({ tone: "success", message: "Pedido aprovado." });
    });
  };

  const declineRequest = async (grantId: string) => {
    if (!confirmAction("Confirmas que queres recusar este pedido?")) return;
    await runAction(`decline:${grantId}`, async () => {
      await apiRequest(`/api/messages/grants/${encodeURIComponent(grantId)}/decline`, { method: "POST" });
      await Promise.all([mutateRequests(), mutateCommunities()]);
      setFeedback({ tone: "success", message: "Pedido recusado." });
    });
  };

  const approveAllForCommunity = async (communityId: string) => {
    if (!confirmAction("Isto vai aprovar todos os pedidos pendentes desta comunidade. Continuar?")) return;

    await runAction(`approve-all:${communityId}`, async () => {
      await apiRequest(
        `/api/messages/communities/${encodeURIComponent(communityId)}/requests/approve-all`,
        {
          method: "POST",
        },
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
    action: "PROMOTE_ADMIN" | "DEMOTE_ADMIN" | "REMOVE" | "MUTE" | "UNMUTE" | "BAN" | "UNBAN";
    mutedUntil?: string | null;
    confirmText?: string;
  }) => {
    if (params.confirmText && !confirmAction(params.confirmText)) return;

    const payload: Record<string, unknown> = { action: params.action };
    if (params.action === "MUTE" && params.mutedUntil) {
      payload.mutedUntil = params.mutedUntil;
    }

    await runAction(`${params.action}:${params.conversationId}:${params.userId}`, async () => {
      await apiRequest(
        `/api/messages/communities/${encodeURIComponent(params.conversationId)}/participants/${encodeURIComponent(
          params.userId,
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      await Promise.all([mutateParticipants(), mutateCommunities()]);
      setFeedback({ tone: "success", message: "Participante atualizado." });
    });
  };

  const promoteAdminByUserId = async () => {
    if (!selectedCommunityId) return;
    const targetUserId = adminDraftUserId.trim();
    if (!targetUserId) {
      setFeedback({ tone: "error", message: "Indica o user id da equipa para promover a admin." });
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
      setFeedback({ tone: "error", message: "Indica pelo menos um user id para convidar." });
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
      setFeedback({ tone: "error", message: "Não foi possível copiar automaticamente o link." });
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto text-white">
      <div className="space-y-4 pb-6">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0e1630]/90 via-[#0a1021]/90 to-[#05080f]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Mensagens</p>
              <h2 className="text-2xl font-semibold">Comunidades</h2>
              <p className="mt-1 text-sm text-white/70">
                Cria, modera e gere convites/pedidos de entrada de cada comunidade.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void mutateCommunities();
                  setFeedback(null);
                }}
                className={`${CTA_SECONDARY} text-sm`}
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setCreateOpen(true);
                }}
                className={`${CTA_PRIMARY} text-sm`}
              >
                Nova comunidade
              </button>
            </div>
          </div>

          {feedback ? (
            <p className={`mt-3 text-sm ${feedback.tone === "error" ? "text-red-300" : "text-emerald-300"}`}>
              {feedback.message}
            </p>
          ) : null}

          {communitiesError ? (
            <p className="mt-3 text-sm text-red-300">
              {communitiesError instanceof Error ? communitiesError.message : "Erro ao carregar comunidades."}
            </p>
          ) : null}
        </div>

        {communitiesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`community-skeleton-${idx}`}
                className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {communities.map((community) => {
              const approveAllKey = `approve-all:${community.conversationId}`;
              const isActiveCard = selectedCommunityId === community.conversationId;
              const coverStyle = community.coverImageUrl
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(7,9,17,0.28), rgba(7,9,17,0.84)), url(${community.coverImageUrl})`,
                  }
                : {
                    backgroundImage:
                      "linear-gradient(135deg, rgba(34,211,238,0.28), rgba(59,130,246,0.18) 42%, rgba(2,6,23,0.95))",
                  };

              return (
                <article
                  key={community.conversationId}
                  className={`rounded-2xl border bg-[#070b15]/90 shadow-[0_16px_50px_rgba(0,0,0,0.5)] ${
                    isActiveCard ? "border-cyan-300/45" : "border-white/12"
                  }`}
                >
                  <div className="h-28 rounded-t-2xl bg-cover bg-center" style={coverStyle}>
                    <div className="flex h-full items-end justify-between p-3">
                      <span className="rounded-full border border-white/25 bg-black/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
                        {formatCommunityTalkPolicyLabel(community.talkPolicy)}
                      </span>
                      <span className="rounded-full border border-white/25 bg-black/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
                        {formatCommunityAccessModeLabel(community.accessMode)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    <div>
                      <h3 className="text-base font-semibold">{community.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-white/65">
                        {community.description || "Sem descrição."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{community.participantsCount} participantes</span>
                      <span>{community.pendingRequestsCount} pendentes</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(community)}
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => openPanel(community.conversationId, "requests")}
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        Pedidos
                      </button>

                      <button
                        type="button"
                        onClick={() => openPanel(community.conversationId, "participants")}
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        Participantes
                      </button>

                      <button
                        type="button"
                        onClick={() => openPanel(community.conversationId, "invites")}
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        Convites
                      </button>

                      {community.pendingRequestsCount > 0 ? (
                        <button
                          type="button"
                          disabled={pendingActionKey === approveAllKey}
                          onClick={async () => {
                            openPanel(community.conversationId, "requests");
                            await approveAllForCommunity(community.conversationId);
                          }}
                          className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                        >
                          {pendingActionKey === approveAllKey ? "A aprovar..." : "Aprovar todos"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}

            {!communities.length ? (
              <div className="col-span-full rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/70">
                Ainda não existem comunidades. Cria a primeira para começar.
              </div>
            ) : null}
          </div>
        )}

        {activePanel && selectedCommunity ? (
          <section className="rounded-2xl border border-white/12 bg-[#060a14]/90 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{selectedCommunity.title}</h3>
                <p className="text-xs text-white/60">
                  {formatCommunityTalkPolicyLabel(selectedCommunity.talkPolicy)} ·{" "}
                  {formatCommunityAccessModeLabel(selectedCommunity.accessMode)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  className={`${CTA_SECONDARY} text-xs`}
                >
                  Fechar painel
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openPanel(selectedCommunity.conversationId, "requests")}
                className={`${
                  selectedTab === "requests" ? CTA_PRIMARY : CTA_SECONDARY
                } text-xs`}
              >
                Pedidos ({selectedCommunity.pendingRequestsCount})
              </button>
              <button
                type="button"
                onClick={() => openPanel(selectedCommunity.conversationId, "participants")}
                className={`${
                  selectedTab === "participants" ? CTA_PRIMARY : CTA_SECONDARY
                } text-xs`}
              >
                Participantes
              </button>
              <button
                type="button"
                onClick={() => openPanel(selectedCommunity.conversationId, "invites")}
                className={`${selectedTab === "invites" ? CTA_PRIMARY : CTA_SECONDARY} text-xs`}
              >
                Convites
              </button>
            </div>

            {selectedTab === "requests" ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-white/60">Aprova ou recusa entradas pendentes.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void mutateRequests()}
                      className={`${CTA_SECONDARY} text-xs`}
                    >
                      Atualizar
                    </button>
                    <button
                      type="button"
                      onClick={approveAll}
                      disabled={pendingActionKey === `approve-all:${selectedCommunity.conversationId}`}
                      className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                    >
                      {pendingActionKey === `approve-all:${selectedCommunity.conversationId}`
                        ? "A aprovar..."
                        : "Aprovar todos"}
                    </button>
                  </div>
                </div>

                {requestsLoading ? (
                  <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                ) : requestsError ? (
                  <div className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {requestsError instanceof Error ? requestsError.message : "Erro ao carregar pedidos."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(requestsData?.items ?? []).map((request) => {
                      const approveKey = `approve:${request.id}`;
                      const declineKey = `decline:${request.id}`;
                      const isBusy = pendingActionKey === approveKey || pendingActionKey === declineKey;
                      return (
                        <div
                          key={request.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {request.requester
                                ? getUserLabel(request.requester)
                                : request.requesterId || "Utilizador"}
                            </p>
                            <p className="text-xs text-white/55">
                              Pedido em {formatDateTime(request.createdAt)}
                              {request.expiresAt ? ` · expira ${formatDateTime(request.expiresAt)}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void declineRequest(request.id)}
                              disabled={isBusy}
                              className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              onClick={() => void approveRequest(request.id)}
                              disabled={isBusy}
                              className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                            >
                              Aprovar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!requestsData?.items?.length ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                        Sem pedidos pendentes.
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : null}

            {selectedTab === "participants" ? (
              <>
                <div className="mb-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="Pesquisar por nome, username ou user id"
                      className="min-w-[260px] flex-1 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                    <select
                      value={participantView}
                      onChange={(e) => setParticipantView(e.target.value as "ACTIVE" | "ALL")}
                      className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      <option value="ACTIVE">Ativos</option>
                      <option value="ALL">Todos</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void mutateParticipants()}
                      className={`${CTA_SECONDARY} text-xs`}
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
                    <input
                      value={adminDraftUserId}
                      onChange={(e) => setAdminDraftUserId(e.target.value)}
                      placeholder="User id da equipa para promover a admin"
                      className="min-w-[260px] flex-1 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={() => void promoteAdminByUserId()}
                      disabled={pendingActionKey === `PROMOTE_ADMIN:${selectedCommunity.conversationId}:${adminDraftUserId.trim()}`}
                      className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                    >
                      Promover admin (ID)
                    </button>
                  </div>
                </div>

                {participantsLoading ? (
                  <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                ) : participantsError ? (
                  <div className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {participantsError instanceof Error
                      ? participantsError.message
                      : "Erro ao carregar participantes."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredParticipants.map((participant) => {
                      const busySuffix = `${selectedCommunity.conversationId}:${participant.userId}`;
                      const isBusy = Boolean(pendingActionKey?.endsWith(`:${busySuffix}`));
                      const canPromote = participant.role !== "ADMIN" && participant.isTeamMember;
                      const canDemote = participant.role === "ADMIN";
                      const isBanned = Boolean(participant.bannedAt);
                      const isMuted = isMutedParticipant(participant);
                      const isActive = isActiveParticipant(participant);

                      return (
                        <div
                          key={participant.userId}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{getUserLabel(participant.user)}</p>
                              <p className="text-xs text-white/55">
                                {participant.role} · {participant.isTeamMember ? "Equipa" : "Cliente"}
                                {isActive ? " · Ativo" : " · Inativo"}
                                {isBanned ? " · Banido" : ""}
                                {isMuted ? " · Mute" : ""}
                              </p>
                              <p className="text-[11px] text-white/45">
                                Entrou: {formatDateTime(participant.joinedAt)}
                                {participant.followGraceEndsAt
                                  ? ` · grace seguidores até ${formatDateTime(participant.followGraceEndsAt)}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canPromote ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId: selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "PROMOTE_ADMIN",
                                    })
                                  }
                                  className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                >
                                  Promover admin
                                </button>
                              ) : null}

                              {canDemote ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId: selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "DEMOTE_ADMIN",
                                      confirmText: "Confirmas que queres remover privilégios de admin?",
                                    })
                                  }
                                  className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                >
                                  Remover admin
                                </button>
                              ) : null}

                              {!isBanned ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId: selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "BAN",
                                      confirmText:
                                        "Banir este utilizador remove-o da comunidade e impede novas entradas.",
                                    })
                                  }
                                  className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                >
                                  Banir
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId: selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "UNBAN",
                                    })
                                  }
                                  className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                >
                                  Remover ban
                                </button>
                              )}

                              {!isMuted ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void participantAction({
                                        conversationId: selectedCommunity.conversationId,
                                        userId: participant.userId,
                                        action: "MUTE",
                                        mutedUntil: buildMuteUntil("1h"),
                                      })
                                    }
                                    className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                  >
                                    Mutar 1h
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void participantAction({
                                        conversationId: selectedCommunity.conversationId,
                                        userId: participant.userId,
                                        action: "MUTE",
                                        mutedUntil: buildMuteUntil("24h"),
                                      })
                                    }
                                    className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                  >
                                    Mutar 24h
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void participantAction({
                                        conversationId: selectedCommunity.conversationId,
                                        userId: participant.userId,
                                        action: "MUTE",
                                      })
                                    }
                                    className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                  >
                                    Mutar indefinido
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void participantAction({
                                      conversationId: selectedCommunity.conversationId,
                                      userId: participant.userId,
                                      action: "UNMUTE",
                                    })
                                  }
                                  className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                                >
                                  Desmutar
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void participantAction({
                                    conversationId: selectedCommunity.conversationId,
                                    userId: participant.userId,
                                    action: "REMOVE",
                                    confirmText: "Confirmas a remoção deste participante da comunidade?",
                                  })
                                }
                                className={`${CTA_SECONDARY} text-xs disabled:opacity-60`}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!filteredParticipants.length ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                        Nenhum participante encontrado com os filtros atuais.
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : null}

            {selectedTab === "invites" ? (
              <div className="space-y-4">
                {selectedCommunity.accessMode !== "INVITE" ? (
                  <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Esta comunidade não está no modo INVITE. Altera o modo de acesso para usar convites.
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h4 className="text-sm font-semibold">Convite manual</h4>
                  <p className="mt-1 text-xs text-white/60">
                    Introduz user ids separados por vírgula, espaço ou nova linha.
                  </p>

                  <div className="mt-3 grid gap-2">
                    <textarea
                      value={inviteUserIdsInput}
                      onChange={(e) => setInviteUserIdsInput(e.target.value)}
                      className="min-h-[90px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                      placeholder="user_id_1, user_id_2"
                    />
                    <input
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                      placeholder="Mensagem opcional do convite"
                      maxLength={600}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/45">{inviteMessage.trim().length}/600</span>
                      <button
                        type="button"
                        disabled={
                          selectedCommunity.accessMode !== "INVITE" ||
                          pendingActionKey === `manual-invites:${selectedCommunity.conversationId}`
                        }
                        onClick={() => void sendManualInvites()}
                        className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                      >
                        {pendingActionKey === `manual-invites:${selectedCommunity.conversationId}`
                          ? "A enviar..."
                          : "Enviar convites"}
                      </button>
                    </div>
                  </div>

                  {manualInviteResult ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-white/75">
                      <p>
                        Enviados: <strong>{manualInviteResult.invitedCount}</strong>
                      </p>
                      {manualInviteResult.skipped.length ? (
                        <p>Ignorados: {manualInviteResult.skipped.length}</p>
                      ) : null}
                      {manualInviteResult.missingUserIds.length ? (
                        <p>Utilizadores em falta: {manualInviteResult.missingUserIds.length}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h4 className="text-sm font-semibold">Link de convite</h4>
                  <p className="mt-1 text-xs text-white/60">
                    Gerar novo link inválida o link anterior.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={invitePreset}
                      onChange={(e) => setInvitePreset(e.target.value)}
                      className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      {invitePresetOptions.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={
                        selectedCommunity.accessMode !== "INVITE" ||
                        pendingActionKey === `invite-link:${selectedCommunity.conversationId}`
                      }
                      onClick={() => void generateInviteLink()}
                      className={`${CTA_PRIMARY} text-xs disabled:opacity-60`}
                    >
                      {pendingActionKey === `invite-link:${selectedCommunity.conversationId}`
                        ? "A gerar..."
                        : generatedInviteLink
                          ? "Regenerar link"
                          : "Gerar link"}
                    </button>
                  </div>

                  {generatedInviteLink ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/30 p-2">
                      <label className="grid gap-1 text-[11px] text-white/60">
                        <span>Link</span>
                        <input
                          value={resolveInviteLinkUrl(generatedInviteLink.invitePath)}
                          readOnly
                          className="rounded-md border border-white/12 bg-black/35 px-2 py-1.5 text-xs text-white"
                        />
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
                        <span>Criado em {formatDateTime(generatedInviteLink.createdAt)}</span>
                        <span>
                          {generatedInviteLink.expiresAt
                            ? `Expira em ${formatDateTime(generatedInviteLink.expiresAt)}`
                            : "Sem validade"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => void copyInviteLink()}
                        className={`${CTA_SECONDARY} text-xs`}
                      >
                        {copiedInviteLink ? "Copiado" : "Copiar link"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {createOpen ? (
        <CommunityFormModal
          title="Criar comunidade"
          submitLabel="Criar"
          initial={formDefaults}
          pending={savingForm}
          onClose={() => setCreateOpen(false)}
          onSubmit={createCommunity}
        />
      ) : null}

      {editing ? (
        <CommunityFormModal
          title={`Editar · ${editing.title}`}
          submitLabel="Guardar"
          initial={{
            title: editing.title,
            description: editing.description ?? "",
            coverImageUrl: editing.coverImageUrl ?? "",
            talkPolicy: editing.talkPolicy,
            accessMode: editing.accessMode,
          }}
          pending={savingForm}
          onClose={() => setEditing(null)}
          onSubmit={(form) => updateCommunity(editing.conversationId, form)}
        />
      ) : null}
    </div>
  );
}
