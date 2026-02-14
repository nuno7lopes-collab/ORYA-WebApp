"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type TicketEvent = {
  id: string;
  actorType: string;
  actorUserId: string | null;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  ticketNumber: string | number;
  requesterEmail: string;
  category: string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  createdAt: string;
  closedAt: string | null;
  events: TicketEvent[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminSupportDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params?.id;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? "Falha ao carregar ticket.");
        setTicket(null);
        return;
      }
      setTicket(json.data?.ticket ?? null);
    } catch (err) {
      console.error("[admin/suporte/:id] load", err);
      setError("Erro inesperado.");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId]);

  async function changeStatus(status: TicketDetail["status"]) {
    if (!ticketId || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? "Falha ao atualizar estado.");
        return;
      }
      await load();
    } catch (err) {
      console.error("[admin/suporte/:id] status", err);
      setError("Erro inesperado ao atualizar estado.");
    } finally {
      setActionLoading(false);
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId || !note.trim() || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "ADMIN_NOTE", note: note.trim() }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? "Falha ao adicionar nota.");
        return;
      }
      setNote("");
      await load();
    } catch (err) {
      console.error("[admin/suporte/:id] note", err);
      setError("Erro inesperado ao adicionar nota.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminLayout title="Detalhe de suporte" subtitle="Ticket e trilha operacional">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <AdminPageHeader
          title={ticket ? `Ticket #${String(ticket.ticketNumber)}` : "Ticket"}
          subtitle={ticket?.subject ?? "Detalhe do ticket"}
          eyebrow="Admin • Suporte"
          actions={
            <Link href="/admin/suporte" className="admin-button-secondary px-3 py-2 text-xs">
              Voltar à lista
            </Link>
          }
        />

        {loading ? <p className="text-sm text-white/70">A carregar...</p> : null}
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}

        {ticket ? (
          <>
            <section className="admin-section space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Requester</p>
                  <p className="text-sm text-white">{ticket.requesterEmail}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Categoria</p>
                  <p className="text-sm text-white">{ticket.category}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Estado</p>
                  <p className="text-sm text-white">{ticket.status}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Descrição</p>
                <p className="whitespace-pre-wrap text-sm text-white/85">{ticket.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => changeStatus("OPEN")} className="admin-button-secondary px-3 py-2 text-xs" disabled={actionLoading}>
                  OPEN
                </button>
                <button onClick={() => changeStatus("IN_PROGRESS")} className="admin-button-secondary px-3 py-2 text-xs" disabled={actionLoading}>
                  IN_PROGRESS
                </button>
                <button onClick={() => changeStatus("CLOSED")} className="admin-button-secondary px-3 py-2 text-xs" disabled={actionLoading}>
                  CLOSED
                </button>
              </div>
            </section>

            <section className="admin-section space-y-3">
              <h2 className="text-sm font-semibold text-white">Adicionar nota</h2>
              <form onSubmit={submitNote} className="space-y-3">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="admin-input min-h-28"
                  placeholder="Nota interna para o ticket"
                />
                <button type="submit" disabled={actionLoading || !note.trim()} className="admin-button px-4 py-2 text-xs">
                  Guardar nota
                </button>
              </form>
            </section>

            <section className="admin-section space-y-3">
              <h2 className="text-sm font-semibold text-white">Eventos</h2>
              {ticket.events.length === 0 ? <p className="text-sm text-white/70">Sem eventos.</p> : null}
              {ticket.events.length > 0 ? (
                <div className="space-y-2">
                  {ticket.events.map((event) => (
                    <div key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-white/70">
                        {formatDate(event.createdAt)} • {event.actorType} • {event.eventType}
                      </p>
                      {event.payload ? (
                        <pre className="mt-2 overflow-x-auto text-[11px] text-white/80">{JSON.stringify(event.payload, null, 2)}</pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
