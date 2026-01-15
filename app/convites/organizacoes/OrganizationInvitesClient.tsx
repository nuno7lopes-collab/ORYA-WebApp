"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { OrganizationMemberRole } from "@prisma/client";
import { RoleBadge } from "@/app/organizacao/RoleBadge";
import { getProfileCoverUrl } from "@/lib/profileCover";
import { cn } from "@/lib/utils";

type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

type InviteItem = {
  id: string;
  organizationId: number;
  role: OrganizationMemberRole;
  status: InviteStatus;
  canRespond: boolean;
  expiresAt: string | null;
  createdAt: string | null;
  invitedBy: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  organization: {
    id: number;
    publicName: string | null;
    username: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    brandingAvatarUrl: string | null;
    brandingCoverUrl: string | null;
  } | null;
};

type InvitesResponse = {
  ok: boolean;
  items: InviteItem[];
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_LABEL: Record<InviteStatus, string> = {
  PENDING: "Pendente",
  EXPIRED: "Expirado",
  ACCEPTED: "Aceite",
  DECLINED: "Recusado",
  CANCELLED: "Cancelado",
};

const STATUS_STYLES: Record<InviteStatus, string> = {
  PENDING: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
  EXPIRED: "border-white/15 bg-white/5 text-white/55",
  ACCEPTED: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100",
  DECLINED: "border-rose-300/40 bg-rose-400/10 text-rose-100",
  CANCELLED: "border-white/15 bg-white/5 text-white/55",
};

export default function OrganizationInvitesClient({
  initialInviteId,
  initialToken,
}: {
  initialInviteId: string | null;
  initialToken: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const inviteIdParam = searchParams.get("invite") ?? searchParams.get("inviteId") ?? initialInviteId;
  const tokenParam = searchParams.get("token") ?? initialToken;

  const invitesKey = useMemo(() => {
    if (!inviteIdParam && !tokenParam) return "/api/organizacao/invites";
    const params = new URLSearchParams();
    if (inviteIdParam) params.set("invite", inviteIdParam);
    if (tokenParam) params.set("token", tokenParam);
    return `/api/organizacao/invites?${params.toString()}`;
  }, [inviteIdParam, tokenParam]);

  const { data, isLoading, mutate } = useSWR<InvitesResponse>(invitesKey, fetcher);

  const invites = useMemo(() => data?.items ?? [], [data?.items]);
  const focusedInviteId = inviteIdParam ?? null;

  const handleInviteAction = async (invite: InviteItem, action: "ACCEPT" | "DECLINE") => {
    setActionMessage(null);
    setActionLoading((prev) => ({ ...prev, [invite.id]: true }));
    try {
      const res = await fetch("/api/organizacao/organizations/members/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: invite.organizationId,
          inviteId: invite.id,
          token: tokenParam ?? null,
          action,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        setActionMessage(payload?.error ?? "Não foi possível atualizar o convite.");
      } else {
        setActionMessage(action === "ACCEPT" ? "Convite aceite. Já podes entrar na organização." : "Convite recusado.");
        await mutate();
        if (action === "ACCEPT") {
          setTimeout(() => router.push("/organizacao"), 600);
        }
      }
    } catch (err) {
      console.error("[convites][action]", err);
      setActionMessage("Não foi possível atualizar o convite.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [invite.id]: false }));
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(167,139,250,0.18),_transparent_60%),linear-gradient(135deg,_#02040d,_#0b1225_55%,_#09091b)] px-4 py-10 text-white md:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Convites</p>
              <h1 className="text-2xl font-semibold">Convites de organização</h1>
              <p className="text-sm text-white/60">
                Aceita ou recusa convites sem precisares de criar uma organização.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/organizacao"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/30"
              >
                Ir para organizações
              </Link>
              <Link
                href="/organizacao/become"
                className="rounded-full border border-white/20 bg-gradient-to-r from-cyan-300/80 via-sky-300/80 to-purple-300/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#05060f] shadow-[0_10px_30px_rgba(56,189,248,0.35)] transition hover:brightness-110"
              >
                Criar organização
              </Link>
            </div>
          </div>
        </div>

        {actionMessage && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            {actionMessage}
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-40 rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && invites.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <h2 className="text-xl font-semibold">Sem convites pendentes</h2>
            <p className="mt-2 text-sm text-white/60">
              Quando receberes um convite para uma organização, ele aparece aqui.
            </p>
          </div>
        )}

        <div className="grid gap-4">
          {invites.map((invite) => {
            const orgName = invite.organization?.publicName ?? invite.organization?.businessName ?? "Organização";
            const orgHandle = invite.organization?.username ? `@${invite.organization.username}` : null;
            const locationLabel = [invite.organization?.city, invite.organization?.entityType].filter(Boolean).join(" · ");
            const cardHighlight = focusedInviteId === invite.id;
            const invitedByName =
              invite.invitedBy?.fullName ?? invite.invitedBy?.username ?? "Equipa ORYA";
            const statusLabel = STATUS_LABEL[invite.status];
            const statusClass = STATUS_STYLES[invite.status];
            const coverUrl = getProfileCoverUrl(invite.organization?.brandingCoverUrl ?? null, {
              width: 1200,
              height: 400,
              quality: 65,
              format: "webp",
            });
            const avatarUrl = invite.organization?.brandingAvatarUrl ?? null;

            return (
              <article
                key={invite.id}
                className={cn(
                  "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition",
                  cardHighlight && "border-cyan-200/40 shadow-[0_22px_70px_rgba(34,211,238,0.35)]",
                )}
              >
                {coverUrl && (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `url(${coverUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt={orgName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-semibold text-white/70">
                          {orgName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Organização</p>
                      <h3 className="text-lg font-semibold">{orgName}</h3>
                      {orgHandle && <p className="text-xs text-white/60">{orgHandle}</p>}
                      {locationLabel && <p className="text-xs text-white/50">{locationLabel}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <RoleBadge role={invite.role} subtle />
                    <span className={cn("rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em]", statusClass)}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 mt-4 flex flex-col gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1 text-sm text-white/70">
                    <p>Convidado por <span className="text-white/90">{invitedByName}</span>.</p>
                    {invite.expiresAt && invite.status === "PENDING" && (
                      <p className="text-xs text-white/50">
                        Expira em {new Date(invite.expiresAt).toLocaleDateString("pt-PT")}.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {invite.organization?.username && (
                      <Link
                        href={`/${invite.organization.username}`}
                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 transition hover:border-white/30"
                      >
                        Ver página
                      </Link>
                    )}
                    {invite.status === "PENDING" && invite.canRespond && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading[invite.id]}
                          onClick={() => handleInviteAction(invite, "DECLINE")}
                          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/30 disabled:opacity-50"
                        >
                          Recusar
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading[invite.id]}
                          onClick={() => handleInviteAction(invite, "ACCEPT")}
                          className="rounded-full border border-cyan-200/40 bg-gradient-to-r from-cyan-300/80 via-sky-300/80 to-indigo-300/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#05060f] shadow-[0_10px_30px_rgba(56,189,248,0.35)] transition hover:brightness-110 disabled:opacity-60"
                        >
                          Aceitar
                        </button>
                      </>
                    )}
                    {invite.status !== "PENDING" && (
                      <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                        Convite {statusLabel.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
