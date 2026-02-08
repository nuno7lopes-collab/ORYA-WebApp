"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { Avatar } from "@/components/ui/avatar";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import PairingInviteCard from "@/app/components/notifications/PairingInviteCard";
import { appendOrganizationIdToHref, getOrganizationIdFromBrowser } from "@/lib/organizationIdUtils";
import { useSearchParams } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type NotificationItem = {
  id: string;
  type: string;
  category: "network" | "events" | "system" | "marketing" | "chat";
  title: string;
  body?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  createdAt: string;
  isRead?: boolean;
  organizationId?: number | null;
  eventId?: number | null;
  actions?: Array<{ type: string; label: string; style?: string; payload?: Record<string, unknown> }>;
  payload?: Record<string, unknown> | null;
};

type SuggestionsResponse = {
  ok: boolean;
  items?: Array<{
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    city: string | null;
    mutualsCount: number;
    isFollowing: boolean;
  }>;
};

type SearchUser = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean;
  isRequested?: boolean;
};

type SearchOrganization = {
  id: number;
  username: string | null;
  publicName: string | null;
  businessName: string | null;
  brandingAvatarUrl: string | null;
  city: string | null;
  isFollowing?: boolean;
};

type SearchResponse<T> = {
  ok: boolean;
  results?: T[];
};

type FollowRequestItem = {
  id: number;
  requesterId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type HubTab = "social" | "notifications";

type NotificationFilter = "all" | "invites" | "social";

const SOCIAL_TYPES = new Set([
  "FOLLOWED_YOU",
  "FOLLOW_ACCEPT",
  "NEW_EVENT_FROM_FOLLOWED_ORGANIZATION",
  "FRIEND_GOING_TO_EVENT",
]);

const REQUEST_TYPES = new Set(["ORGANIZATION_INVITE", "CLUB_INVITE", "PAIRING_INVITE", "EVENT_INVITE"]);

const NOTIFICATION_FILTERS: Record<NotificationFilter, string[]> = {
  all: [],
  invites: ["ORGANIZATION_INVITE", "CLUB_INVITE", "ORGANIZATION_TRANSFER", "PAIRING_INVITE", "EVENT_INVITE"],
  social: ["FOLLOWED_YOU", "FOLLOW_REQUEST", "FOLLOW_ACCEPT", "FRIEND_GOING_TO_EVENT"],
};

const NOTIFICATION_LABELS: Record<string, string> = {
  ORGANIZATION_INVITE: "Convite",
  ORGANIZATION_TRANSFER: "Transferência",
  PAIRING_INVITE: "Dupla",
  CLUB_INVITE: "Clube",
  EVENT_SALE: "Venda",
  EVENT_PAYOUT_STATUS: "Pagamento",
  STRIPE_STATUS: "Stripe",
  FOLLOW_REQUEST: "Pedido para seguir",
  FOLLOW_ACCEPT: "Pedido aceite",
  EVENT_REMINDER: "Lembrete",
  CHECKIN_READY: "Check-in",
  TICKET_SHARED: "Bilhete",
  MARKETING_PROMO_ALERT: "Marketing",
  CRM_CAMPAIGN: "Campanha",
  SYSTEM_ANNOUNCE: "Sistema",
  CHAT_OPEN: "Chat",
  CHAT_ANNOUNCEMENT: "Chat",
  CHAT_MESSAGE: "Mensagem de chat",
  FOLLOWED_YOU: "Segue-te",
  FRIEND_GOING_TO_EVENT: "Amigo vai ao evento",
  EVENT_INVITE: "Convite para evento",
  TICKET_TRANSFER_RECEIVED: "Transferencia",
  TICKET_TRANSFER_ACCEPTED: "Transferencia",
  TICKET_TRANSFER_DECLINED: "Transferencia",
  NEW_EVENT_FROM_FOLLOWED_ORGANIZATION: "Novo evento",
};

function formatTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function buildUserLabel(item: { fullName: string | null; username: string | null }) {
  return item.fullName || (item.username ? `@${item.username}` : "Utilizador ORYA");
}

export default function SocialHubPage() {
  const { user, isLoggedIn } = useUser();
  const searchParams = useSearchParams();
  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const orgFallbackHref = appendOrganizationIdToHref("/organizacao", getOrganizationIdFromBrowser());
  const [activeTab, setActiveTab] = useState<HubTab>(
    searchParams?.get("tab") === "notifications" ? "notifications" : "social",
  );
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [followPending, setFollowPending] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<SuggestionsResponse["items"]>([]);
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const [organizationResults, setOrganizationResults] = useState<SearchOrganization[]>([]);

  const { data: notificationsData, mutate: mutateNotifications } = useSWR(
    isLoggedIn ? "/api/me/notifications/feed?limit=120" : null,
    fetcher,
  );
  const { data: followRequestsData, mutate: mutateFollowRequests } = useSWR(
    isLoggedIn ? "/api/social/follow-requests" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: suggestionsData } = useSWR<SuggestionsResponse>(
    isLoggedIn ? "/api/social/suggestions?limit=8" : null,
    fetcher,
  );

  const searchTerm = searchQuery.trim();
  const searchUsersUrl = searchTerm ? `/api/users/search?q=${encodeURIComponent(searchTerm)}&limit=8` : null;
  const searchOrganizationsUrl = searchTerm
    ? `/api/organizations/search?q=${encodeURIComponent(searchTerm)}&limit=6`
    : null;

  const { data: usersData } = useSWR<SearchResponse<SearchUser>>(searchUsersUrl, fetcher);
  const { data: orgsData } = useSWR<SearchResponse<SearchOrganization>>(searchOrganizationsUrl, fetcher);

  useEffect(() => {
    if (searchParams?.get("tab") === "notifications") {
      setActiveTab("notifications");
    }
  }, [searchParams]);

  useEffect(() => {
    if (suggestionsData?.items) setSuggestions(suggestionsData.items);
  }, [suggestionsData?.items]);

  useEffect(() => {
    if (usersData?.results) setUserResults(usersData.results);
  }, [usersData?.results]);

  useEffect(() => {
    if (orgsData?.results) setOrganizationResults(orgsData.results);
  }, [orgsData?.results]);

  const notificationsRaw = notificationsData?.items ?? [];
  const notifications: NotificationItem[] = Array.isArray(notificationsRaw) ? notificationsRaw : [];
  const unreadCount = notificationsData?.unreadCount ?? 0;
  const followRequests: FollowRequestItem[] = followRequestsData?.items ?? [];

  const activityItems = useMemo(
    () => notifications.filter((item) => SOCIAL_TYPES.has(item.type)).slice(0, 6),
    [notifications],
  );

  const requestItems = useMemo(
    () => notifications.filter((item) => REQUEST_TYPES.has(item.type)).slice(0, 6),
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    const types = NOTIFICATION_FILTERS[notificationFilter];
    if (notificationFilter === "social") {
      return notifications.filter((item) => item.category === "network");
    }
    if (types.length === 0) return notifications;
    return notifications.filter((item) => types.includes(item.type));
  }, [notifications, notificationFilter]);

  const setFollowPendingFlag = (key: string, value: boolean) => {
    setFollowPending((prev) => ({ ...prev, [key]: value }));
  };

  const toggleUserFollow = async (targetId: string, status: "following" | "requested" | "none") => {
    if (!isLoggedIn) return;
    const key = `user_${targetId}`;
    setFollowPendingFlag(key, true);
    try {
      if (status === "following") {
        const res = await fetch("/api/social/unfollow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: targetId }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setUserResults((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, isFollowing: false, isRequested: false } : item,
            ),
          );
        } else {
          setUserResults((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, isFollowing: true, isRequested: false } : item,
            ),
          );
        }
        return;
      }

      if (status === "requested") {
        const res = await fetch("/api/social/follow-requests/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: targetId }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setUserResults((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, isFollowing: false, isRequested: false } : item,
            ),
          );
        } else {
          setUserResults((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, isFollowing: false, isRequested: true } : item,
            ),
          );
        }
        return;
      }

      const res = await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        if (json.status === "REQUESTED") {
          setUserResults((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, isFollowing: false, isRequested: true } : item,
            ),
          );
        } else if (json.status === "FOLLOWING") {
          setUserResults((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, isFollowing: true, isRequested: false } : item,
            ),
          );
        }
      }
    } finally {
      setFollowPendingFlag(key, false);
    }
  };

  const toggleOrganizationFollow = async (targetId: number, next: boolean) => {
    if (!isLoggedIn) return;
    const key = `org_${targetId}`;
    setFollowPendingFlag(key, true);
    setOrganizationResults((prev) => prev.map((item) => (item.id === targetId ? { ...item, isFollowing: next } : item)));
    try {
      await fetch(next ? "/api/social/follow-organization" : "/api/social/unfollow-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: targetId }),
      });
    } finally {
      setFollowPendingFlag(key, false);
    }
  };

  const handleFollowSuggestion = async (targetId: string, next: boolean) => {
    if (!isLoggedIn) return;
    const key = `suggest_${targetId}`;
    setFollowPendingFlag(key, true);
    setSuggestions(
      (prev) =>
        prev?.map((item) => (item.id === targetId ? { ...item, isFollowing: next } : item)) ?? [],
    );
    try {
      await fetch(next ? "/api/social/follow" : "/api/social/unfollow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId }),
      });
    } finally {
      setFollowPendingFlag(key, false);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    mutateNotifications();
  };

  const markOneRead = async (notificationId: string) => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    mutateNotifications();
  };

  const markClick = (notificationId: string) => {
    fetch("/api/notifications/mark-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
      keepalive: true,
    })
      .then(() => mutateNotifications())
      .catch(() => null);
  };

  const deleteNotification = async (notificationId: string) => {
    await fetch("/api/me/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    mutateNotifications();
  };

  const [notificationActionPending, setNotificationActionPending] = useState<Record<string, boolean>>({});
  const [notificationStatus, setNotificationStatus] = useState<Record<string, "Aceite" | "Recusado">>({});
  const [followBackState, setFollowBackState] = useState<Record<string, boolean>>({});
  const handleNotificationAction = async (
    item: NotificationItem,
    action: { type: string; label: string; payload?: Record<string, unknown> },
  ) => {
    const key = `${item.id}:${action.type}`;
    if (notificationActionPending[key]) return;
    setNotificationActionPending((prev) => ({ ...prev, [key]: true }));
    try {
      if (action.type === "accept_follow" || action.type === "decline_follow") {
        const requestId = Number(action.payload?.requestId);
        if (Number.isFinite(requestId)) {
          await fetch(`/api/social/follow-requests/${action.type === "accept_follow" ? "accept" : "decline"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId }),
          });
          setNotificationStatus((prev) => ({
            ...prev,
            [item.id]: action.type === "accept_follow" ? "Aceite" : "Recusado",
          }));
        }
      } else if (action.type === "follow_back") {
        const targetUserId = typeof action.payload?.userId === "string" ? action.payload.userId : null;
        if (targetUserId) {
          const isFollowing = followBackState[targetUserId] === true;
          await fetch(isFollowing ? "/api/social/unfollow" : "/api/social/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId }),
          });
          setFollowBackState((prev) => ({ ...prev, [targetUserId]: !isFollowing }));
        }
      } else if (action.type === "accept_org_invite" || action.type === "decline_org_invite") {
        const inviteId = typeof action.payload?.inviteId === "string" ? action.payload.inviteId : null;
        if (inviteId) {
          await fetch("/api/organizacao/organizations/members/invites", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteId, action: action.type === "accept_org_invite" ? "ACCEPT" : "DECLINE" }),
          });
          setNotificationStatus((prev) => ({
            ...prev,
            [item.id]: action.type === "accept_org_invite" ? "Aceite" : "Recusado",
          }));
        }
      } else if (action.type === "open") {
        const url = typeof action.payload?.url === "string" ? action.payload.url : item.ctaUrl;
        if (url) {
          markClick(item.id);
          window.location.href = url;
          return;
        }
      }
      await markOneRead(item.id);
    } catch (err) {
      console.error("[social] notification action error", err);
    } finally {
      setNotificationActionPending((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      mutateNotifications();
    }
  };

  const [requestActionPending, setRequestActionPending] = useState<Record<number, boolean>>({});
  const handleFollowRequestAction = async (requestId: number, action: "accept" | "decline") => {
    setRequestActionPending((prev) => ({ ...prev, [requestId]: true }));
    try {
      await fetch(`/api/social/follow-requests/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      mutateFollowRequests();
      mutateNotifications();
    } catch (err) {
      console.error("[social] follow request action error", err);
    } finally {
      setRequestActionPending((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  return (
    <div className="orya-page-width px-4 md:px-8 py-10 space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Social Hub</p>
        <h1 className="text-3xl font-semibold text-white">Social e notificacoes</h1>
        <p className="text-sm text-white/65">Pessoas, convites e alertas.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/12 bg-white/5 p-1 text-[11px] text-white/70">
        <button
          type="button"
          onClick={() => setActiveTab("social")}
          className={`rounded-full px-4 py-2 font-semibold transition ${
            activeTab === "social"
              ? "bg-white/18 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          Social
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`rounded-full px-4 py-2 font-semibold transition ${
            activeTab === "notifications"
              ? "bg-white/18 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          <span className="flex items-center gap-2">
            Notificacoes
            {unreadCount > 0 && (
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-semibold text-black">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {!isLoggedIn && (
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6 text-sm text-white/70 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <p>Entra para ver tudo.</p>
          <button
            type="button"
            onClick={() => {
              if (!isAuthOpen) {
                openAuthModal({ mode: "login", redirectTo: "/social", showGoogle: true });
              }
            }}
            className="mt-3 inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black"
          >
            Entrar
          </button>
        </div>
      )}

      {isLoggedIn && activeTab === "social" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <SectionCard title="Atividade" subtitle="Atividade recente.">
              {activityItems.length === 0 && <EmptyLabel label="Sem atividade." />}
            {activityItems.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onDelete={deleteNotification}
                onCtaClick={markClick}
              />
            ))}
            </SectionCard>

            <SectionCard title="Pedidos" subtitle="Convites pendentes.">
              {followRequests.length === 0 && requestItems.length === 0 && (
                <EmptyLabel label="Sem pedidos." />
              )}
              {followRequests.map((request) => {
                const label = request.fullName || request.username || "Utilizador ORYA";
                const isLoading = requestActionPending[request.id] === true;
                return (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={request.avatarUrl}
                        name={label}
                        className="h-11 w-11 border border-white/10"
                        textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                        fallbackText="OR"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-[12px] text-white/60">
                          {request.username ? `@${request.username}` : "Pedido para seguir"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleFollowRequestAction(request.id, "decline")}
                        className="rounded-full border border-white/25 bg-transparent px-4 py-2 text-[12px] font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleFollowRequestAction(request.id, "accept")}
                        className="rounded-full border border-[#3797F0] bg-[#3797F0] px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                      >
                        Aceitar
                      </button>
                    </div>
                  </div>
                );
              })}
              {requestItems.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onDelete={deleteNotification}
                  onCtaClick={markClick}
                />
              ))}
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionCard title="Sugestoes" subtitle="Pessoas proximas para seguir.">
              {(!suggestions || suggestions.length === 0) && (
                <EmptyLabel label="Sem sugestoes por agora." />
              )}
              {suggestions?.map((item) => {
                const key = `suggest_${item.id}`;
                const pending = followPending[key];
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 p-3"
                  >
                    <Link
                      href={item.username ? `/${item.username}` : "/me"}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        src={item.avatarUrl}
                        name={buildUserLabel(item)}
                        className="h-11 w-11 border border-white/10"
                        textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                        fallbackText="OR"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.fullName || item.username || "Utilizador ORYA"}
                        </p>
                        <p className="text-[12px] text-white/60">
                          {item.username ? `@${item.username}` : ""}
                          {item.city ? ` · ${item.city}` : ""}
                        </p>
                        <p className="text-[11px] text-white/50">
                          {item.mutualsCount > 0
                            ? `${item.mutualsCount} seguidor${item.mutualsCount === 1 ? "" : "es"} em comum`
                            : "Novo na tua zona"}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleFollowSuggestion(item.id, !item.isFollowing)}
                      className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition ${
                        item.isFollowing
                          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                          : "border-white/20 bg-white/10 text-white/85 hover:bg-white/20"
                      } ${pending ? "opacity-60" : ""}`}
                    >
                      {pending ? "A seguir..." : item.isFollowing ? "Deixar de seguir" : "Seguir"}
                    </button>
                  </div>
                );
              })}
            </SectionCard>

            <SectionCard title="Procurar" subtitle="Encontra utilizadores e organizações.">
              <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/10 px-4 py-2">
                <span className="text-[11px] text-white/60">Procurar</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar utilizadores ou organizações"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                />
              </div>

              {searchTerm.length === 0 && <EmptyLabel label="Comeca a escrever para procurar." />}

              {searchTerm.length > 0 && userResults.length === 0 && organizationResults.length === 0 && (
                <EmptyLabel label="Sem resultados com esse termo." />
              )}

              {userResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Utilizadores</p>
                  {userResults.map((item) => {
                    const isFollowing = Boolean(item.isFollowing);
                    const isRequested = Boolean(item.isRequested);
                    const followStatus: "following" | "requested" | "none" = isFollowing
                      ? "following"
                      : isRequested
                        ? "requested"
                        : "none";
                    const key = `search_user_${item.id}`;
                    const pending = followPending[key];
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 p-3"
                      >
                        <Link href={item.username ? `/${item.username}` : "/me"} className="flex items-center gap-3">
                          <Avatar
                            src={item.avatarUrl}
                            name={buildUserLabel(item)}
                            className="h-10 w-10 border border-white/10"
                            textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                            fallbackText="OR"
                          />
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {item.fullName || item.username || "Utilizador ORYA"}
                            </p>
                            <p className="text-[12px] text-white/60">{item.username ? `@${item.username}` : ""}</p>
                          </div>
                        </Link>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleUserFollow(item.id, followStatus)}
                          className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                            followStatus !== "none"
                              ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                              : "border border-white/20 bg-white/10 text-white/85 hover:bg-white/20"
                          } ${pending ? "opacity-60" : ""}`}
                        >
                          {pending
                            ? "..."
                            : followStatus === "following"
                              ? "Deixar de seguir"
                              : followStatus === "requested"
                                ? "Pedido enviado"
                                : "Seguir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {organizationResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Organizações</p>
                  {organizationResults.map((item) => {
                    const displayName = item.publicName || item.businessName || item.username || "Organização";
                    const isFollowing = Boolean(item.isFollowing);
                    const key = `search_org_${item.id}`;
                    const pending = followPending[key];
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 p-3"
                      >
                        <Link
                          href={item.username ? `/${item.username}` : orgFallbackHref}
                          className="flex items-center gap-3"
                        >
                          <Avatar
                            src={item.brandingAvatarUrl}
                            name={displayName}
                            className="h-10 w-10 border border-white/10"
                            textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                            fallbackText="OR"
                          />
                          <div>
                            <p className="text-sm font-semibold text-white">{displayName}</p>
                            <p className="text-[12px] text-white/60">
                              {item.username ? `@${item.username}` : ""}
                              {item.city ? ` · ${item.city}` : ""}
                            </p>
                          </div>
                        </Link>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleOrganizationFollow(item.id, !isFollowing)}
                          className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                            isFollowing
                              ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                              : "border border-white/20 bg-white/10 text-white/85 hover:bg-white/20"
                          } ${pending ? "opacity-60" : ""}`}
                        >
                          {pending ? "..." : isFollowing ? "Deixar de seguir" : "Seguir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {isLoggedIn && activeTab === "notifications" && (
        <section className="rounded-3xl border border-white/15 bg-white/5 p-5 space-y-4 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">Notificacoes</h2>
              <p className="text-[11px] text-white/68">Tudo o que precisa de atencao.</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:bg-white/20"
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {([
              { key: "all", label: "Todas" },
              { key: "invites", label: "Convites" },
              { key: "social", label: "Social" },
            ] as const).map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setNotificationFilter(filter.key)}
                className={`rounded-full border px-3 py-1 ${
                  notificationFilter === filter.key
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {filteredNotifications.length === 0 && (
            <EmptyLabel label="Sem notificacoes nesta vista." />
          )}

          <div className="space-y-2">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  item.isRead
                    ? "border-white/10 bg-white/5"
                    : "border-emerald-400/30 bg-emerald-400/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">
                      {NOTIFICATION_LABELS[item.type] ?? "Atualizacao"}
                    </p>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/50">{formatTimeLabel(item.createdAt)}</span>
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => markOneRead(item.id)}
                        className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] text-white/70"
                      >
                        Marcar lida
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(item.id)}
                      className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:bg-white/10"
                      aria-label="Apagar notificacao"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {item.type === "PAIRING_INVITE" ? (
                  <div className="mt-3">
                    <PairingInviteCard
                      title={item.title || "Convite para dupla"}
                      body={item.body}
                      payload={item.payload}
                      fallbackUrl={item.ctaUrl ?? null}
                      fallbackLabel={item.ctaLabel ?? null}
                    />
                  </div>
                ) : (
                  <>
                    {item.body ? <p className="mt-1 text-[12px] text-white/70">{item.body}</p> : null}
                    {item.actions && item.actions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {notificationStatus[item.id] ? (
                          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/85">
                            {notificationStatus[item.id]}
                          </span>
                        ) : (
                          item.actions.map((action) => {
                            const key = `${item.id}:${action.type}`;
                            const isPending = notificationActionPending[key];
                            const targetUserId = typeof action.payload?.userId === "string" ? action.payload.userId : null;
                            const isFollowAction = action.type === "follow_back" && Boolean(targetUserId);
                            const isFollowing = targetUserId ? followBackState[targetUserId] === true : false;
                            const resolvedLabel = isFollowAction ? (isFollowing ? "A seguir" : action.label) : action.label;
                            const isPrimary = isFollowAction ? !isFollowing : action.style === "primary";
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={isPending}
                                onClick={() => handleNotificationAction(item, action)}
                                className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                                  isPrimary
                                    ? "border border-[#3797F0] bg-[#3797F0] text-white hover:brightness-110"
                                    : "border border-white/25 bg-transparent text-white/85 hover:bg-white/10"
                                } ${isPending ? "opacity-60" : ""}`}
                              >
                                {resolvedLabel}
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                    {item.ctaUrl && item.ctaLabel ? (
                      <Link
                        href={item.ctaUrl}
                        className="mt-2 inline-flex text-[12px] text-[#6BFFFF] hover:underline"
                        onClick={() => markClick(item.id)}
                      >
                        {item.ctaLabel}
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">{title}</h2>
          <p className="text-[11px] text-white/68">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function EmptyLabel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-white/60">
      {label}
    </div>
  );
}

function NotificationRow({
  item,
  onDelete,
  onCtaClick,
}: {
  item: NotificationItem;
  onDelete?: (notificationId: string) => void;
  onCtaClick?: (notificationId: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        item.isRead
          ? "border-white/10 bg-white/5"
          : "border-emerald-400/30 bg-emerald-400/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-white/90 font-semibold">{item.title}</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/50">{formatTimeLabel(item.createdAt)}</span>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10"
              aria-label="Apagar notificacao"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {item.body && <p className="mt-1 text-[12px] text-white/70">{item.body}</p>}
      {item.ctaUrl && item.ctaLabel && (
        <Link
          href={item.ctaUrl}
          className="mt-2 inline-flex text-[12px] text-[#6BFFFF] hover:underline"
          onClick={() => onCtaClick?.(item.id)}
        >
          {item.ctaLabel}
        </Link>
      )}
    </div>
  );
}
