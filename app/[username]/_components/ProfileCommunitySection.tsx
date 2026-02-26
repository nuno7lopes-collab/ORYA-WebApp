"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCommunityAccessModeLabel } from "@/lib/messages/communityUi";

export type ProfileCommunityItem = {
  conversationId: string;
  title: string;
  description: string | null;
  accessMode: string;
  participantsCount: number;
};

type ProfileCommunitySectionProps = {
  username: string;
  communities: ProfileCommunityItem[];
  isAuthenticated: boolean;
};

function resolveCommunityErrorMessage(errorCode: string | null) {
  switch (errorCode) {
    case "FOLLOW_REQUIRED":
      return "Precisas de seguir a organização para entrar nesta comunidade.";
    case "INVITE_REQUIRED":
      return "Esta comunidade requer convite.";
    case "BANNED":
      return "Não tens acesso a esta comunidade.";
    case "COMMUNITY_NOT_FOUND":
      return "Comunidade indisponível.";
    case "UNAUTHENTICATED":
      return "Inicia sessão para continuar.";
    case "MOBILE_APP_REQUIRED":
      return "Continua na app ORYA no telemóvel.";
    default:
      return "Não foi possível abrir a comunidade agora.";
  }
}

export default function ProfileCommunitySection({
  username,
  communities,
  isAuthenticated,
}: ProfileCommunitySectionProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedbackByCommunity, setFeedbackByCommunity] = useState<Record<string, string>>({});
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
    setIsMobileDevice(mobile);
  }, []);

  const loginRedirectTo = useMemo(
    () => `/login?redirectTo=${encodeURIComponent(`/${username}?sec=comunidade`)}`,
    [username],
  );

  const openAppWithFallback = (conversationId: string) => {
    const deepLink = `orya://messages/${encodeURIComponent(conversationId)}?source=profile_community`;
    window.location.href = deepLink;

    window.setTimeout(() => {
      setFeedbackByCommunity((prev) => ({
        ...prev,
        [conversationId]: "Se a app não abriu automaticamente, abre a ORYA manualmente no telemóvel.",
      }));
    }, 1200);
  };

  const handleOpenCommunity = async (community: ProfileCommunityItem) => {
    setFeedbackByCommunity((prev) => ({ ...prev, [community.conversationId]: "" }));

    if (!isAuthenticated) {
      window.location.href = loginRedirectTo;
      return;
    }

    setPendingId(community.conversationId);

    try {
      const response = await fetch("/api/messages/conversations/resolve?scope=b2c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextType: "ORG_COMMUNITY",
          contextId: community.conversationId,
          conversationId: community.conversationId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            conversationId?: string;
            grantStatus?: string;
            requiresApproval?: boolean;
            requiresGrantAccept?: boolean;
          }
        | null;

      if (!response.ok || !payload?.ok) {
        if (payload?.error === "UNAUTHENTICATED") {
          window.location.href = loginRedirectTo;
          return;
        }
        setFeedbackByCommunity((prev) => ({
          ...prev,
          [community.conversationId]: resolveCommunityErrorMessage(payload?.error ?? null),
        }));
        return;
      }

      if (payload.requiresApproval || payload.grantStatus === "PENDING") {
        setFeedbackByCommunity((prev) => ({
          ...prev,
          [community.conversationId]: "Pedido enviado. A organização vai aprovar na app ORYA.",
        }));
        return;
      }

      if (payload.requiresGrantAccept) {
        setFeedbackByCommunity((prev) => ({
          ...prev,
          [community.conversationId]: "Tens um convite pendente. Aceita-o na app ORYA.",
        }));
        return;
      }

      const targetConversationId =
        typeof payload.conversationId === "string" && payload.conversationId
          ? payload.conversationId
          : community.conversationId;

      if (!isMobileDevice) {
        setFeedbackByCommunity((prev) => ({
          ...prev,
          [community.conversationId]: "Continua na app ORYA no telemóvel.",
        }));
        return;
      }

      openAppWithFallback(targetConversationId);
    } catch {
      setFeedbackByCommunity((prev) => ({
        ...prev,
        [community.conversationId]: "Não foi possível abrir a comunidade agora.",
      }));
    } finally {
      setPendingId((current) => (current === community.conversationId ? null : current));
    }
  };

  if (communities.length === 0) {
    return (
      <div className="rounded-2xl border border-white/18 bg-white/[0.04] p-4 text-[13px] text-white/84">
        Sem comunidades disponíveis.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/82">Comunidade</p>
          <h3 className="text-lg font-semibold text-white">Comunidades da organização</h3>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/78">
          {communities.length} {communities.length === 1 ? "comunidade" : "comunidades"}
        </span>
      </div>

      {!isMobileDevice ? (
        <p className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[12px] text-white/75">
          No desktop, o acesso continua na app ORYA no telemóvel.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {communities.map((community) => {
          const feedback = feedbackByCommunity[community.conversationId] ?? "";
          const isPending = pendingId === community.conversationId;
          return (
            <article
              key={community.conversationId}
              className="rounded-2xl border border-white/18 bg-white/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{community.title}</p>
                  <p className="mt-1 text-[12px] text-white/80">
                    {community.description || "Comunidade oficial da organização."}
                  </p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/80">
                  {formatCommunityAccessModeLabel(community.accessMode)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/62">{community.participantsCount} participantes</p>
                <button
                  type="button"
                  onClick={() => handleOpenCommunity(community)}
                  disabled={isPending}
                  className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-[11px] font-semibold text-white hover:border-white/40 hover:bg-white/18 disabled:opacity-70"
                >
                  {isPending ? "A abrir..." : "Abrir na app"}
                </button>
              </div>

              {feedback ? <p className="mt-2 text-[11px] text-cyan-100/85">{feedback}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
