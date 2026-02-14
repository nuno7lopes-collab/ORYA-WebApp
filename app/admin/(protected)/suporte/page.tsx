"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type TicketListItem = {
  id: string;
  ticketNumber: string | number;
  requesterEmail: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
};

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "Todas" },
  { value: "ORGANIZACOES", label: "Organizações" },
  { value: "BILHETES", label: "Bilhetes" },
  { value: "PAGAMENTOS_REEMBOLSOS", label: "Pagamentos/Reembolsos" },
  { value: "CONTA_ACESSO", label: "Conta/Acesso" },
  { value: "RESERVAS", label: "Reservas" },
  { value: "OUTRO", label: "Outro" },
] as const;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CLOSED", label: "Closed" },
] as const;

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

export default function AdminSupportPage() {
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("category", category);
      if (q.trim()) params.set("q", q.trim());

      const response = await fetch(`/api/admin/support/tickets/list?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? "Falha ao carregar tickets.");
        setItems([]);
        return;
      }

      const rows = Array.isArray(json.data?.items) ? json.data.items : [];
      setItems(rows as TicketListItem[]);
    } catch (err) {
      console.error("[admin/suporte] load", err);
      setError("Erro inesperado ao carregar tickets.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load();
  }

  return (
    <AdminLayout title="Suporte" subtitle="Gestão de tickets de suporte">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <AdminPageHeader
          title="Suporte"
          subtitle="Tickets do formulário público /suporte"
          eyebrow="Admin • Suporte"
        />

        <section className="admin-section">
          <form onSubmit={onFilter} className="grid gap-3 md:grid-cols-4">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Pesquisar por assunto/email"
              className="admin-input"
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="admin-select">
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="admin-select">
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="submit" className="admin-button px-4 py-2 text-sm">
              Filtrar
            </button>
          </form>
        </section>

        <section className="admin-section space-y-3">
          {loading ? <p className="text-sm text-white/70">A carregar tickets...</p> : null}
          {error ? <p className="text-sm text-rose-200">{error}</p> : null}

          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-white/70">Sem tickets para os filtros atuais.</p>
          ) : null}

          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-xs text-white/80">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Criado</th>
                    <th className="px-3 py-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-medium">#{String(item.ticketNumber)}</td>
                      <td className="px-3 py-2">{item.requesterEmail}</td>
                      <td className="px-3 py-2">{item.category}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/suporte/${item.id}`} className="text-cyan-200 underline underline-offset-2">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </AdminLayout>
  );
}
