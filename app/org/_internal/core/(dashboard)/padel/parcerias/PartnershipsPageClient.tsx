"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

type Props = {
  organizationId: number | null;
  embedded?: boolean;
};

type AgreementItem = {
  id: number;
  ownerOrganizationId: number;
  partnerOrganizationId: number;
  ownerClubId: number;
  partnerClubId: number | null;
  status: "PENDING" | "APPROVED" | "PAUSED" | "REVOKED" | "EXPIRED";
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  ownerOrganizationName?: string | null;
  partnerOrganizationName?: string | null;
  ownerClubName?: string | null;
  partnerClubName?: string | null;
  policy?: {
    priorityMode: string;
    ownerOverrideAllowed: boolean;
    autoCompensationOnOverride: boolean;
  } | null;
  activeWindowsCount?: number;
  activeGrantsCount?: number;
};

type AgreementsResponse = {
  ok: boolean;
  items?: AgreementItem[];
  error?: string;
};

type ClubItem = {
  id: number;
  name: string;
  kind?: "OWN" | "PARTNER" | null;
  isActive?: boolean;
};

type ClubsResponse = {
  ok: boolean;
  items?: ClubItem[];
  error?: string;
};

type TournamentRequestItem = {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  title: string;
  startsAt: string;
  endsAt: string;
  ownerOrganizationId: number;
  partnerOrganizationId: number;
  ownerClubId: number;
  partnerClubId: number;
  ownerOrganizationName?: string | null;
  partnerOrganizationName?: string | null;
  ownerClubName?: string | null;
  partnerClubName?: string | null;
  requestedByUserId?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  eventId?: number | null;
  createdAt: string;
};

type TournamentRequestsResponse = {
  ok: boolean;
  items?: TournamentRequestItem[];
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_LABEL: Record<AgreementItem["status"], string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PAUSED: "Pausado",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

const REQUEST_STATUS_LABEL: Record<TournamentRequestItem["status"], string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export default function PartnershipsPageClient({ organizationId, embedded = false }: Props) {
  const [ownerClubId, setOwnerClubId] = useState("");
  const [partnerOrganizationId, setPartnerOrganizationId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (!organizationId) return null;
    return `/api/padel/partnerships/agreements?organizationId=${organizationId}`;
  }, [organizationId]);
  const clubsUrl = useMemo(() => {
    if (!organizationId) return null;
    return `/api/padel/clubs?organizationId=${organizationId}&includeInactive=0`;
  }, [organizationId]);
  const requestsUrl = useMemo(() => {
    if (!organizationId) return null;
    return `/api/padel/partnerships/tournament-requests?organizationId=${organizationId}`;
  }, [organizationId]);

  const { data, mutate, isLoading } = useSWR<AgreementsResponse>(baseUrl, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: clubsData } = useSWR<ClubsResponse>(clubsUrl, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: tournamentRequestsData, mutate: mutateTournamentRequests } = useSWR<TournamentRequestsResponse>(
    requestsUrl,
    fetcher,
    { revalidateOnFocus: false },
  );

  const resolveWorkspaceHref = (agreementId: number) => {
    if (!organizationId) return "#";
    return buildOrgHref(organizationId, `/padel/parcerias/${agreementId}`, {
      tab: "manage",
      section: "padel-club",
      padel: "partnerships",
    });
  };

  const items = Array.isArray(data?.items) ? data.items : [];
  const tournamentRequests = Array.isArray(tournamentRequestsData?.items) ? tournamentRequestsData.items : [];
  const ownerClubs = useMemo(() => {
    const list = Array.isArray(clubsData?.items) ? clubsData.items : [];
    return list.filter((club) => club.isActive !== false && (club.kind ?? "OWN") === "OWN");
  }, [clubsData?.items]);

  useEffect(() => {
    if (ownerClubId || ownerClubs.length === 0) return;
    setOwnerClubId(String(ownerClubs[0]!.id));
  }, [ownerClubId, ownerClubs]);

  const knownPartnerOrganizations = useMemo(() => {
    if (!organizationId) return [];
    const map = new Map<number, string>();
    for (const item of items) {
      const isOwnerSide = item.ownerOrganizationId === organizationId;
      const orgId = isOwnerSide ? item.partnerOrganizationId : item.ownerOrganizationId;
      const orgName = isOwnerSide ? item.partnerOrganizationName : item.ownerOrganizationName;
      if (!orgId || orgId === organizationId || map.has(orgId)) continue;
      map.set(orgId, orgName || `Organização #${orgId}`);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  }, [items, organizationId]);

  const createAgreement = async () => {
    if (!organizationId) return;
    const ownerClub = Number(ownerClubId);
    if (!Number.isFinite(ownerClub) || ownerClub <= 0) {
      setFeedback("Seleciona um clube dono.");
      return;
    }
    const partnerOrganization = partnerOrganizationId ? Number(partnerOrganizationId) : null;
    if (partnerOrganizationId && (!Number.isFinite(partnerOrganization) || partnerOrganization <= 0)) {
      setFeedback("Seleciona uma organização parceira válida.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/padel/partnerships/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ownerClubId: ownerClub,
          partnerOrganizationId: partnerOrganization || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setFeedback(sanitizeUiErrorMessage(json?.error, "Não foi possível criar o pedido."));
        return;
      }
      setPartnerOrganizationId("");
      setNotes("");
      setFeedback("Pedido de parceria criado.");
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const runTournamentRequestAction = async (requestId: number, action: "approve" | "reject") => {
    if (!organizationId) return;
    setRequestBusyId(requestId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/padel/partnerships/tournament-requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setFeedback(sanitizeUiErrorMessage(json?.error, "Não foi possível atualizar o pedido."));
        return;
      }
      setFeedback(action === "approve" ? "Pedido de torneio aprovado." : "Pedido de torneio rejeitado.");
      await mutateTournamentRequests();
    } finally {
      setRequestBusyId(null);
    }
  };

  const wrapperClass = embedded ? "space-y-4 text-white" : "mx-auto w-full max-w-6xl space-y-5 px-4 py-6 text-white";
  const sectionClass = embedded
    ? "rounded-2xl border border-white/12 bg-white/[0.03] p-4"
    : "rounded-2xl border border-white/12 bg-white/[0.03] p-4";

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <header className={sectionClass}>
          <h1 className="text-xl font-semibold">Parcerias de Padel</h1>
          <p className="text-sm text-white/70">Pedido, aprovação e entrada no workspace operacional partilhado.</p>
        </header>
      )}

      <section className={sectionClass}>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Novo pedido</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">Clube dono</span>
            <select
              value={ownerClubId}
              onChange={(event) => setOwnerClubId(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
            >
              <option value="">Seleciona o clube</option>
              {ownerClubs.map((club) => (
                <option key={`owner-club-${club.id}`} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">Organização parceira</span>
            <select
              value={partnerOrganizationId}
              onChange={(event) => setPartnerOrganizationId(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
            >
              <option value="">Usar organização atual (automático)</option>
              {knownPartnerOrganizations.map((org) => (
                <option key={`partner-org-${org.id}`} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">Notas</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notas (opcional)"
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={busy || !organizationId}
            onClick={createAgreement}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-60"
          >
            {busy ? "A criar..." : "Criar pedido"}
          </button>
          {feedback && <p className="text-sm text-white/75">{feedback}</p>}
        </div>
      </section>

      <section className={`${sectionClass} space-y-3`}>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Acordos</h2>
        {isLoading ? (
          <p className="text-sm text-white/65">A carregar...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-white/65">Sem acordos registados.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={`agreement-${item.id}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">Acordo #{item.id}</p>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/70">
                  Dono: {item.ownerOrganizationName || `Org #${item.ownerOrganizationId}`} · Clube{" "}
                  {item.ownerClubName || `#${item.ownerClubId}`}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  Parceiro: {item.partnerOrganizationName || `Org #${item.partnerOrganizationId}`}
                  {item.partnerClubId ? ` · Clube ${item.partnerClubName || `#${item.partnerClubId}`}` : ""}
                </p>
                <p className="mt-1 text-xs text-white/65">
                  {item.activeWindowsCount != null ? `Janelas ativas ${item.activeWindowsCount}` : "Janelas ativas 0"}
                  {item.activeGrantsCount != null ? ` · Grants ativos ${item.activeGrantsCount}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={resolveWorkspaceHref(item.id)}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/85 hover:border-white/40"
                  >
                    Abrir workspace
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`${sectionClass} space-y-3`}>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Pedidos de torneio parceiro</h2>
        {tournamentRequests.length === 0 ? (
          <p className="text-sm text-white/65">Sem pedidos de torneio.</p>
        ) : (
          <div className="space-y-3">
            {tournamentRequests.map((requestItem) => {
              const isOwnerSide = organizationId === requestItem.ownerOrganizationId;
              const canReview = isOwnerSide && requestItem.status === "PENDING";
              return (
                <article key={`tournament-request-${requestItem.id}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{requestItem.title}</p>
                    <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">
                      {REQUEST_STATUS_LABEL[requestItem.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/70">
                    {requestItem.ownerOrganizationName || `Org #${requestItem.ownerOrganizationId}`} ·{" "}
                    {requestItem.ownerClubName || `Clube #${requestItem.ownerClubId}`}
                  </p>
                  <p className="mt-1 text-xs text-white/70">
                    {requestItem.partnerOrganizationName || `Org #${requestItem.partnerOrganizationId}`} ·{" "}
                    {requestItem.partnerClubName || `Clube #${requestItem.partnerClubId}`}
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    {new Date(requestItem.startsAt).toLocaleString("pt-PT")} →{" "}
                    {new Date(requestItem.endsAt).toLocaleString("pt-PT")}
                  </p>
                  {canReview && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => runTournamentRequestAction(requestItem.id, "approve")}
                        disabled={requestBusyId === requestItem.id}
                        className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100 hover:border-emerald-200/70 disabled:opacity-60"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => runTournamentRequestAction(requestItem.id, "reject")}
                        disabled={requestBusyId === requestItem.id}
                        className="rounded-full border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
