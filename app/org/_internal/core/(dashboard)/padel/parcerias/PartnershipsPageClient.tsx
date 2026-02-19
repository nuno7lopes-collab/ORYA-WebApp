"use client";

import { useMemo, useState } from "react";
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

type TournamentRequestItem = {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  title: string;
  startsAt: string;
  endsAt: string;
  ownerOrganizationId: number;
  partnerOrganizationId: number;
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

type OrganizationSuggestion = {
  id: number;
  username: string | null;
  name: string;
  clubId: number | null;
  clubName: string | null;
};

type OrganizationSearchResponse = {
  ok: boolean;
  items?: OrganizationSuggestion[];
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

function formatOrganizationLabel(item: OrganizationSuggestion) {
  if (item.username) return `${item.name} · @${item.username}`;
  return item.name;
}

export default function PartnershipsPageClient({ organizationId, embedded = false }: Props) {
  const [targetQuery, setTargetQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<OrganizationSuggestion | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const normalizedTargetQuery = targetQuery.trim();

  const baseUrl = useMemo(() => {
    if (!organizationId) return null;
    return `/api/padel/partnerships/agreements?organizationId=${organizationId}`;
  }, [organizationId]);
  const requestsUrl = useMemo(() => {
    if (!organizationId) return null;
    return `/api/padel/partnerships/tournament-requests?organizationId=${organizationId}`;
  }, [organizationId]);
  const organizationsUrl = useMemo(() => {
    if (!organizationId) return null;
    if (selectedTarget) return null;
    if (normalizedTargetQuery.length < 2) return null;
    const params = new URLSearchParams({
      organizationId: String(organizationId),
      q: normalizedTargetQuery,
      limit: "8",
    });
    return `/api/padel/partnerships/organizations?${params.toString()}`;
  }, [organizationId, normalizedTargetQuery, selectedTarget]);

  const { data, mutate, isLoading } = useSWR<AgreementsResponse>(baseUrl, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: tournamentRequestsData, mutate: mutateTournamentRequests } = useSWR<TournamentRequestsResponse>(
    requestsUrl,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: organizationsData, isLoading: organizationsLoading } = useSWR<OrganizationSearchResponse>(
    organizationsUrl,
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
  const organizationSuggestions = Array.isArray(organizationsData?.items) ? organizationsData.items : [];

  const createAgreement = async () => {
    if (!organizationId) return;
    if (!selectedTarget) {
      setFeedback("Seleciona a organização de destino.");
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
          partnerOrganizationId: selectedTarget.id,
          notes: notes || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setFeedback(sanitizeUiErrorMessage(json?.error, "Não foi possível criar o pedido."));
        return;
      }
      setTargetQuery("");
      setSelectedTarget(null);
      setNotes("");
      setFeedback("Pedido de parceria enviado.");
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
  const sectionClass =
    "rounded-2xl border border-white/12 bg-[linear-gradient(145deg,rgba(107,255,255,0.08),rgba(10,16,28,0.78))] p-4";

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <header className={sectionClass}>
          <h1 className="text-xl font-semibold">Parcerias de Padel</h1>
          <p className="text-sm text-white/70">Pedidos entre organizações e gestão operacional partilhada.</p>
        </header>
      )}

      <section className={sectionClass}>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Novo pedido</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="relative space-y-1 md:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">Organização destino</span>
            <input
              value={targetQuery}
              onChange={(event) => {
                setTargetQuery(event.target.value);
                setSelectedTarget(null);
              }}
              placeholder="Pesquisar por username ou nome"
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
            />
            {!selectedTarget && normalizedTargetQuery.length >= 2 && (
              <div className="absolute left-0 right-0 top-[72px] z-20 rounded-xl border border-white/15 bg-[#050b16]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                {organizationsLoading ? (
                  <p className="px-2 py-1 text-xs text-white/65">A pesquisar organizações...</p>
                ) : organizationSuggestions.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-white/65">Sem organizações elegíveis com clube ativo.</p>
                ) : (
                  <div className="max-h-52 space-y-1 overflow-auto">
                    {organizationSuggestions.map((item) => (
                      <button
                        key={`target-org-${item.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedTarget(item);
                          setTargetQuery(formatOrganizationLabel(item));
                        }}
                        className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10"
                      >
                        <p className="truncate text-sm text-white">{formatOrganizationLabel(item)}</p>
                        <p className="truncate text-[11px] text-white/60">Organização elegível para parceria.</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {selectedTarget ? (
              <p className="text-[11px] text-emerald-100">Destino selecionado: {formatOrganizationLabel(selectedTarget)}</p>
            ) : null}
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
            {busy ? "A enviar..." : "Criar pedido"}
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
                  <p className="font-semibold text-white">Acordo de parceria</p>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/70">
                  {item.ownerOrganizationName || "Organização origem"} →{" "}
                  {item.partnerOrganizationName || "Organização destino"}
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
                    {requestItem.ownerOrganizationName || "Organização origem"} →{" "}
                    {requestItem.partnerOrganizationName || "Organização destino"}
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
