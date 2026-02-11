"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
  CTA_PRIMARY,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CONSENT_LABELS = {
  MARKETING: "Marketing",
  CONTACT_EMAIL: "Email de contacto",
  CONTACT_SMS: "SMS de contacto",
} as const;

const CONSENT_STATUS_LABELS: Record<string, string> = {
  GRANTED: "Concedido",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

type ConsentTypeKey = keyof typeof CONSENT_LABELS;

type ConsentSnapshot = {
  status: string | null;
  source: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string | null;
};

type InteractionRow = {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string | null;
  occurredAt: string;
  amountCents: number | null;
  currency: string | null;
};

type NoteRow = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null };
};

type CustomerDetailResponse = {
  ok: boolean;
  customer: {
    id: string;
    userId: string | null;
    contactType: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    marketingOptIn: boolean;
    firstInteractionAt: string | null;
    lastActivityAt: string | null;
    lastPurchaseAt: string | null;
    totalSpentCents: number;
    totalOrders: number;
    totalBookings: number;
    totalAttendances: number;
    totalTournaments: number;
    totalStoreOrders: number;
    tags: string[];
    notesCount: number;
    consents: Record<ConsentTypeKey, ConsentSnapshot | null>;
  };
  interactions: InteractionRow[];
  notes: NoteRow[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export default function CrmCustomerDetailPage() {
  const params = useParams();
  const customerId = typeof params?.customerId === "string" ? params.customerId : "";
  const { data, isLoading, mutate } = useSWR<CustomerDetailResponse>(
    customerId ? `/api/organizacao/crm/clientes/${customerId}` : null,
    fetcher,
  );

  const customer = data?.customer ?? null;
  const [tagInput, setTagInput] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setTagInput(customer.tags.join(", "));
    }
  }, [customer?.id]);

  const interactions = useMemo(() => data?.interactions ?? [], [data]);
  const notes = useMemo(() => data?.notes ?? [], [data]);

  const handleSaveTags = async () => {
    if (!customer) return;
    setTagSaving(true);
    setError(null);
    try {
      const tags = tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const res = await fetch(`/api/organizacao/crm/clientes/${customer.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error("Falha ao guardar tags");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar tags");
    } finally {
      setTagSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!customer || noteBody.trim().length < 2) return;
    setNoteSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizacao/crm/clientes/${customer.id}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao criar nota");
      setNoteBody("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar nota");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleConsentToggle = async (type: ConsentTypeKey, granted: boolean) => {
    if (!customer) return;
    const key = `${customer.id}:${type}`;
    setConsentSaving((prev) => ({ ...prev, [key]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/organizacao/consentimentos/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, granted }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar consentimento");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar consentimento");
    } finally {
      setConsentSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Perfil do cliente</h1>
        <p className={DASHBOARD_MUTED}>Dados, histórico e notas internas da organização.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-5")}
      >
        {isLoading && !customer ? (
          <p className="text-[12px] text-white/60">A carregar cliente...</p>
        ) : customer ? (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {customer.displayName || "Cliente sem nome"}
                </p>
                <p className="text-[12px] text-white/60">{customer.contactEmail || customer.contactPhone || "Contacto indisponível"}</p>
                {customer.contactType ? (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {customer.contactType}
                  </p>
                ) : null}
                {customer.bio ? <p className="mt-1 text-[12px] text-white/50">{customer.bio}</p> : null}
              </div>
              <div className="grid gap-2 text-[12px] text-white/70 sm:grid-cols-2">
                <span>Primeira interação: {formatDate(customer.firstInteractionAt)}</span>
                <span>Última atividade: {formatDate(customer.lastActivityAt)}</span>
                <span>Última compra: {formatDate(customer.lastPurchaseAt)}</span>
                <span>Opt-in marketing: {customer.marketingOptIn ? "Sim" : "Não"}</span>
                <span>Gasto total: {formatCurrency(customer.totalSpentCents ?? 0, "EUR")}</span>
                <span>Pedidos: {customer.totalOrders}</span>
                <span>Reservas: {customer.totalBookings}</span>
                <span>Check-ins: {customer.totalAttendances}</span>
                <span>Torneios: {customer.totalTournaments}</span>
                <span>Store: {customer.totalStoreOrders}</span>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[12px] text-white/70">
                Tags
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="ex.: VIP, mensal"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={cn(CTA_NEUTRAL, "w-full justify-center")}
                onClick={handleSaveTags}
                disabled={tagSaving}
              >
                {tagSaving ? "A guardar..." : "Guardar tags"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-white/60">Cliente não encontrado.</p>
        )}
      </section>

      {customer ? (
        <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Consentimentos</h2>
            <span className="text-[11px] text-white/50">Atualiza apenas com consentimento explícito.</span>
          </div>
          <div className="grid gap-2 text-[12px] text-white/80 md:grid-cols-3">
            {(Object.keys(CONSENT_LABELS) as ConsentTypeKey[]).map((type) => {
              const snapshot = customer.consents?.[type] ?? null;
              const status = snapshot?.status ?? null;
              const label = CONSENT_STATUS_LABELS[status ?? ""] ?? "Indefinido";
              const key = `${customer.userId}:${type}`;
              const isSaving = Boolean(consentSaving[key]);
              const isGranted = status === "GRANTED";
              return (
                <label
                  key={key}
                  className="flex flex-col gap-1 rounded-xl border border-white/12 bg-white/5 px-3 py-2"
                >
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/45">{CONSENT_LABELS[type]}</span>
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isGranted}
                      onChange={(event) => handleConsentToggle(type, event.target.checked)}
                      disabled={isSaving}
                      className="h-3 w-3 accent-[#6BFFFF]"
                    />
                    <span className="text-[12px] text-white/80">{label}</span>
                    {isSaving ? <span className="text-[11px] text-white/45">A guardar...</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Timeline</h2>
            <span className="text-[11px] text-white/50">{interactions.length} interações</span>
          </div>
          <div className="space-y-2">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-white">{interaction.type}</p>
                    <p className="text-[11px] text-white/50">{interaction.sourceType}</p>
                  </div>
                  <div className="text-right text-[11px] text-white/50">
                    <p>{formatDate(interaction.occurredAt)}</p>
                    {interaction.amountCents !== null ? (
                      <p className="text-white/80">
                        {formatCurrency(interaction.amountCents, interaction.currency || "EUR")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {interactions.length === 0 && !isLoading ? (
              <p className="text-[12px] text-white/50">Sem interações registadas.</p>
            ) : null}
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Notas internas</h2>
            <span className="text-[11px] text-white/50">{notes.length} notas</span>
          </div>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[12px] text-white/80">{note.body}</p>
                <p className="mt-1 text-[11px] text-white/40">
                  {note.author.fullName || note.author.username || "Staff"} · {formatDate(note.createdAt)}
                </p>
              </div>
            ))}
            {notes.length === 0 && !isLoading ? (
              <p className="text-[12px] text-white/50">Sem notas internas.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <textarea
              className="min-h-[96px] w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Adicionar nota interna"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
            />
            <button
              type="button"
              className={cn(CTA_PRIMARY, "w-full justify-center")}
              onClick={handleAddNote}
              disabled={noteSaving}
            >
              {noteSaving ? "A guardar..." : "Guardar nota"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
