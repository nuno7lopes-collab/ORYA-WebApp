"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

type Props = {
  organizationId: number | null;
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_LABEL: Record<AgreementItem["status"], string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PAUSED: "Pausado",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

export default function PartnershipsPageClient({ organizationId }: Props) {
  const [ownerClubId, setOwnerClubId] = useState("");
  const [partnerOrganizationId, setPartnerOrganizationId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (!organizationId) return null;
    return `/api/padel/partnerships/agreements?organizationId=${organizationId}`;
  }, [organizationId]);

  const { data, mutate, isLoading } = useSWR<AgreementsResponse>(baseUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const items = Array.isArray(data?.items) ? data.items : [];

  const createAgreement = async () => {
    if (!organizationId) return;
    const ownerClub = Number(ownerClubId);
    if (!Number.isFinite(ownerClub) || ownerClub <= 0) {
      setFeedback("Indica o ID do clube dono.");
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
          partnerOrganizationId: partnerOrganizationId ? Number(partnerOrganizationId) : undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setFeedback(typeof json?.error === "string" ? json.error : "Não foi possível criar o pedido.");
        return;
      }
      setOwnerClubId("");
      setPartnerOrganizationId("");
      setNotes("");
      setFeedback("Pedido de parceria criado.");
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <header className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-white">
        <h1 className="text-xl font-semibold">Parcerias de Padel</h1>
        <p className="text-sm text-white/70">Pedido, aprovação e entrada no workspace operacional partilhado.</p>
      </header>

      <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-white">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Novo pedido</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={ownerClubId}
            onChange={(event) => setOwnerClubId(event.target.value)}
            placeholder="ID clube dono"
            className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
          />
          <input
            value={partnerOrganizationId}
            onChange={(event) => setPartnerOrganizationId(event.target.value)}
            placeholder="ID organização parceira (opcional)"
            className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
          />
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notas (opcional)"
            className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
          />
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

      <section className="space-y-3 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-white">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Acordos</h2>
        {isLoading ? (
          <p className="text-sm text-white/65">A carregar...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-white/65">Sem acordos registados.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={`agreement-${item.id}`}
                className="rounded-xl border border-white/10 bg-black/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">Acordo #{item.id}</p>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/70">
                  Clube dono #{item.ownerClubId}
                  {item.partnerClubId ? ` · Clube parceiro #${item.partnerClubId}` : ""}
                  {item.activeWindowsCount != null ? ` · Janelas ativas ${item.activeWindowsCount}` : ""}
                  {item.activeGrantsCount != null ? ` · Grants ativos ${item.activeGrantsCount}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/organizacao/padel/parcerias/${item.id}${organizationId ? `?organizationId=${organizationId}` : ""}`}
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
    </div>
  );
}

