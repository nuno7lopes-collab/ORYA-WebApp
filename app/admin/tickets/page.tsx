

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminTopActions } from "@/app/admin/components/AdminTopActions";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

// Tipos esperados da API de admin tickets (flexíveis para não rebentar se mudares algo no backend)
type AdminTicketEvent = {
  id?: number | null;
  title?: string | null;
  slug?: string | null;
  startsAt?: string | null;
};

type AdminTicketUserProfile = {
  username?: string | null;
  fullName?: string | null;
};

type AdminTicketUser = {
  id?: string | null;
  email?: string | null;
  profile?: AdminTicketUserProfile | null;
};

type AdminTicket = {
  id: string;
  status?: string | null;
  event?: AdminTicketEvent | null;
  user?: AdminTicketUser | null;
  ticketType?: { id?: number | null; name?: string | null } | null;
  platformFeeCents?: number | null;
  totalPaidCents?: number | null;
  pricePaidCents?: number | null;
  currency?: string | null;
  purchasedAt?: string | null;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
  paymentEventStatus?: string | null;
};

type AdminTicketsApiResponse =
  | { ok: true; tickets: AdminTicket[]; page: number; pageSize: number; total: number }
  | { ok: false; error?: string };

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatMoney(cents?: number | null, currency: string = "EUR") {
  if (!cents || Number.isNaN(cents)) return "-";
  const value = cents / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/12 text-emerald-100 border-emerald-400/30";
    case "USED":
      return "bg-sky-500/12 text-sky-100 border-sky-400/30";
    case "REFUNDED":
      return "bg-amber-500/12 text-amber-100 border-amber-400/30";
    case "CANCELLED":
      return "bg-rose-500/12 text-rose-100 border-rose-400/30";
    case "RESALE_LISTED":
      return "bg-purple-500/12 text-purple-100 border-purple-400/30";
    default:
      return "bg-white/10 text-white/70 border-white/20";
  }
}

function statusLabel(status?: string | null) {
  if (!status) return "Desconhecido";
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "USED":
      return "Usado";
    case "REFUNDED":
      return "Reembolsado";
    case "CANCELLED":
      return "Cancelado";
    case "RESALE_LISTED":
      return "Em revenda";
    default:
      return status;
  }
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [intentFilter, setIntentFilter] = useState("");
  const [slugFilter, setSlugFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadTickets(opts?: {
    q?: string;
    status?: string;
    intent?: string;
    slug?: string;
    user?: string;
    page?: number;
  }) {
    try {
      setLoading(true);
      setErrorMsg(null);
      setActionMessage(null);

      const params = new URLSearchParams();
      const q = opts?.q ?? query;
      const status = opts?.status ?? statusFilter;
      const intent = opts?.intent ?? intentFilter;
      const slug = opts?.slug ?? slugFilter;
      const user = opts?.user ?? userFilter;
      const pageParam = opts?.page ?? page;

      if (q && q.trim().length > 0) {
        params.set("q", q.trim());
      }
      if (status && status !== "ALL") {
        params.set("status", status);
      }
      if (intent.trim()) params.set("intent", intent.trim());
      if (slug.trim()) params.set("slug", slug.trim());
      if (user.trim()) params.set("userQuery", user.trim());
      params.set("page", String(pageParam));
      params.set("pageSize", String(pageSize));

      const url = "/api/admin/tickets/list" + (params.toString() ? `?${params.toString()}` : "");

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        setErrorMsg("Acesso não autorizado. Esta área é apenas para administradores.");
        setTickets([]);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error("[AdminTickets] Erro ao carregar:", text);
        setErrorMsg("Não foi possível carregar os bilhetes. Tenta novamente em breve.");
        setTickets([]);
        return;
      }

      const json = (await res.json().catch(() => null)) as AdminTicketsApiResponse | null;

      if (!json || !json.ok) {
        console.error("[AdminTickets] Resposta inesperada:", json);
        setErrorMsg(json?.error || "Resposta inesperada da API de tickets.");
        setTickets([]);
        return;
      }

      setTickets(Array.isArray(json.tickets) ? json.tickets : []);
      setPage(json.page || 1);
      setTotal(json.total || 0);
    } catch (err) {
      console.error("[AdminTickets] Erro inesperado:", err);
      setErrorMsg("Ocorreu um erro inesperado ao carregar os bilhetes.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // carregar logo ao entrar
    void loadTickets({ page: 1 });
  }, []);

  const hasTickets = tickets.length > 0;

  async function handleRefund(intentId?: string | null) {
    if (!intentId) return;
    const confirmed = window.confirm(`Confirmar refund para ${intentId}?`);
    if (!confirmed) return;
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: intentId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionMessage(json?.error || "Falha ao pedir refund.");
      } else {
        setActionMessage(`Refund solicitado para ${intentId}.`);
        await loadTickets({ page });
      }
    } catch (err) {
      console.error("[AdminTickets] refund error", err);
      setActionMessage("Erro inesperado ao pedir refund.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout title="Bilhetes & histórico" subtitle="Consulta bilhetes, estados, intent e ações de refund.">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <AdminPageHeader
          title="Bilhetes & histórico"
          subtitle="Consulta bilhetes emitidos, estados atuais e ligações a eventos e utilizadores."
          eyebrow="Admin • Bilhetes"
          actions={<AdminTopActions showTicketsExport />}
        />

        {/* Filtros */}
        <section className="admin-section">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            onSubmit={(e) => {
              e.preventDefault();
              void loadTickets({ q: query });
            }}
          >
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">
                  Pesquisa
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ID do bilhete, título do evento…"
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Pagamento</label>
                <input
                  type="text"
                  value={intentFilter}
                  onChange={(e) => setIntentFilter(e.target.value)}
                  placeholder="payment_intent id"
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Slug do evento</label>
                <input
                  type="text"
                  value={slugFilter}
                  onChange={(e) => setSlugFilter(e.target.value)}
                  placeholder="ex.: test-connect"
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Utilizador</label>
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  placeholder="email ou username"
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/45">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStatusFilter(value);
                    void loadTickets({ status: value });
                  }}
                  className="admin-select"
                >
                  <option value="ALL">Todos</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="USED">Usados</option>
                  <option value="REFUNDED">Reembolsados</option>
                  <option value="CANCELLED">Cancelados</option>
                  <option value="RESALE_LISTED">Em revenda</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 self-end md:self-auto">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("ALL");
                  setIntentFilter("");
                  setSlugFilter("");
                  setUserFilter("");
                  setPage(1);
                  void loadTickets({ q: "", status: "ALL", intent: "", slug: "", user: "", page: 1 });
                }}
                className="admin-button-secondary px-3 py-2 text-xs"
              >
                Limpar filtros
              </button>
              <button type="submit" className="admin-button px-4 py-2 text-xs">
                Aplicar
              </button>
            </div>
          </form>
        </section>

        <section className="admin-section space-y-4">
          {/* Mensagens de erro / loading / vazio */}
          {loading && <div className="text-sm text-white/70">A carregar bilhetes…</div>}

          {!loading && errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
              {errorMsg}
            </div>
          )}

          {!loading && actionMessage && !errorMsg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              {actionMessage}
            </div>
          )}

          {!loading && !errorMsg && !hasTickets && (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/70">
              <p className="font-medium text-white">Sem bilhetes para estes filtros.</p>
              <p className="mt-1 text-white/55">Ajusta a pesquisa ou o estado para veres outros resultados.</p>
            </div>
          )}

          {/* Tabela de bilhetes */}
          {!loading && !errorMsg && hasTickets && (
            <div className="admin-card overflow-hidden">
              <div className="max-h-[70vh] overflow-auto">
                <table className="admin-table text-left">
                  <thead>
                    <tr>
                      <th className="px-3 py-3">Bilhete</th>
                      <th className="px-3 py-3">Evento</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Utilizador</th>
                      <th className="px-3 py-3">Preço / Fees</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Comprado em</th>
                      <th className="px-3 py-3">Pagamento</th>
                      <th className="px-3 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const event = t.event;
                      const user = t.user;
                      const profile = user?.profile;
                      const userLabel = profile?.username
                        ? `@${profile.username}`
                        : profile?.fullName
                          ? profile.fullName
                          : user?.email ?? "—";

                      return (
                        <tr key={t.id} className="hover:bg-white/5">
                          <td className="px-3 py-3 align-top font-mono text-[11px] text-white/60">{t.id}</td>
                          <td className="px-3 py-3 align-top">
                            {event?.title ? (
                              <div className="flex flex-col gap-0.5">
                                {event.slug ? (
                                  <Link href={`/eventos/${event.slug}`} className="text-xs font-medium text-white/90 hover:underline">
                                    {event.title}
                                  </Link>
                                ) : (
                                  <span className="text-xs font-medium text-white/90">{event.title}</span>
                                )}
                                {event.startsAt && (
                                  <span className="text-[11px] text-white/50">
                                    {formatDate(event.startsAt)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-white/50">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-white/80">{t.ticketType?.name ?? "—"}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-0.5 text-xs">
                              <span className="font-medium text-white/85">{userLabel}</span>
                              {user?.email && (
                                <span className="text-[11px] text-white/50">{user.email}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-[11px] text-white/80">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-white/85">
                                Pago: {formatMoney(t.pricePaidCents ?? null, t.currency || "EUR")}
                              </span>
                              <span className="text-[11px] text-white/50">
                                Fee: {formatMoney(t.platformFeeCents ?? null, t.currency || "EUR")}
                              </span>
                              <span className="text-[11px] text-white/50">
                                Total: {formatMoney(t.totalPaidCents ?? null, t.currency || "EUR")}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClasses(t.status || "")}`}>
                              {statusLabel(t.status)}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-[11px] text-white/60">
                            {formatDate(t.purchasedAt)}
                          </td>
                          <td className="px-3 py-3 align-top max-w-[160px] truncate font-mono text-[10px] text-white/50">
                            <div className="flex flex-col gap-1">
                              <span className="truncate">{(t.purchaseId ?? t.paymentIntentId) || "—"}</span>
                              {(t.purchaseId ?? t.paymentIntentId) && (
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => navigator.clipboard?.writeText(t.purchaseId ?? t.paymentIntentId ?? "")}
                                    className="admin-button-secondary px-2 py-0.5 text-[10px]"
                                  >
                                    Copiar
                                  </button>
                                  <Link
                                    href={`/admin/finance?payment_q=${encodeURIComponent(t.purchaseId ?? t.paymentIntentId ?? "")}#pagamentos`}
                                    className="admin-button-secondary px-2 py-0.5 text-[10px]"
                                  >
                                    Ver pagamento
                                  </Link>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/admin/finance?payment_q=${encodeURIComponent(t.purchaseId ?? t.paymentIntentId ?? "")}#pagamentos`}
                                className="admin-button-secondary px-2.5 py-1 text-[11px]"
                              >
                                Pagamento
                              </Link>
                              {(t.purchaseId ?? t.paymentIntentId) && t.paymentEventStatus !== "REFUNDED" && (
                                <button
                                  type="button"
                                  onClick={() => handleRefund(t.purchaseId ?? t.paymentIntentId)}
                                  className="admin-button-secondary px-2.5 py-1 text-[11px]"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && !errorMsg && hasTickets && (
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>
                Página {page} · {total} registos
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = Math.max(1, page - 1);
                    setPage(next);
                    void loadTickets({ page: next });
                  }}
                  className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page * pageSize >= total}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    void loadTickets({ page: next });
                  }}
                  className="admin-button-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  Seguinte
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
