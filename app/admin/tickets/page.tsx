

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  pricePaidCents?: number | null;
  currency?: string | null;
  purchasedAt?: string | null;
  stripePaymentIntentId?: string | null;
};

type AdminTicketsApiResponse =
  | { ok: true; tickets: AdminTicket[] }
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
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "USED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "REFUNDED":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "RESALE_LISTED":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-200";
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

  async function loadTickets(opts?: { q?: string; status?: string }) {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      const q = opts?.q ?? query;
      const status = opts?.status ?? statusFilter;

      if (q && q.trim().length > 0) {
        params.set("q", q.trim());
      }
      if (status && status !== "ALL") {
        params.set("status", status);
      }

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
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasTickets = tickets.length > 0;

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Cabeçalho */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Admin · Tickets
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-50">
              Bilhetes & histórico
            </h1>
            <p className="mt-1 max-w-xl text-sm text-neutral-400">
              Consulta bilhetes emitidos em toda a plataforma, estados atuais e
              ligações a eventos e utilizadores. Ideal para debugging e análise de
              casos específicos.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/admin"
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-neutral-200 hover:bg-neutral-800/80"
            >
              ← Voltar ao dashboard
            </Link>
          </div>
        </header>

        {/* Filtros */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            onSubmit={(e) => {
              e.preventDefault();
              void loadTickets({ q: query });
            }}
          >
            <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-neutral-400">
                  Pesquisa
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ID do bilhete, slug do evento, username ou email…"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400/60"
                />
              </div>

              <div className="w-full md:w-48">
                <label className="mb-1 block text-xs font-medium text-neutral-400">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStatusFilter(value);
                    void loadTickets({ status: value });
                  }}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400/60"
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
                  void loadTickets({ q: "", status: "ALL" });
                }}
                className="rounded-full border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800/80"
              >
                Limpar filtros
              </button>
              <button
                type="submit"
                className="rounded-full bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                Aplicar
              </button>
            </div>
          </form>
        </section>

        {/* Mensagens de erro / loading / vazio */}
        {loading && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
            A carregar bilhetes…
          </div>
        )}

        {!loading && errorMsg && (
          <div className="rounded-2xl border border-rose-700/60 bg-rose-950/60 p-4 text-sm text-rose-100">
            {errorMsg}
          </div>
        )}

        {!loading && !errorMsg && !hasTickets && (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/60 p-6 text-sm text-neutral-300">
            <p className="font-medium">Nenhum bilhete encontrado para estes filtros.</p>
            <p className="mt-1 text-neutral-400">
              Ajusta a pesquisa ou o estado para veres outros resultados.
            </p>
          </div>
        )}

        {/* Tabela de bilhetes */}
        {!loading && !errorMsg && hasTickets && (
          <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/80">
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full text-left text-xs text-neutral-200">
                <thead className="sticky top-0 z-10 bg-neutral-950/95">
                  <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    <th className="px-3 py-3">Bilhete</th>
                    <th className="px-3 py-3">Evento</th>
                    <th className="px-3 py-3">Utilizador</th>
                    <th className="px-3 py-3">Preço</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Comprado em</th>
                    <th className="px-3 py-3">Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const event = t.event;
                    const user = t.user;
                    const profile = user?.profile;

                    const userLabel =
                      profile?.username
                        ? `@${profile.username}`
                        : profile?.fullName
                        ? profile.fullName
                        : user?.email ?? "—";

                    return (
                      <tr
                        key={t.id}
                        className="border-b border-neutral-900/80 last:border-0 hover:bg-neutral-900/80"
                      >
                        <td className="px-3 py-3 align-top font-mono text-[11px] text-neutral-300">
                          {t.id}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {event?.title ? (
                            <div className="flex flex-col gap-0.5">
                              {event.slug ? (
                                <Link
                                  href={`/eventos/${event.slug}`}
                                  className="text-xs font-medium text-neutral-50 hover:underline"
                                >
                                  {event.title}
                                </Link>
                              ) : (
                                <span className="text-xs font-medium text-neutral-50">
                                  {event.title}
                                </span>
                              )}
                              {event.startsAt && (
                                <span className="text-[11px] text-neutral-400">
                                  {formatDate(event.startsAt)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="font-medium text-neutral-50">
                              {userLabel}
                            </span>
                            {user?.email && (
                              <span className="text-[11px] text-neutral-500">
                                {user.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-neutral-100">
                          {formatMoney(t.pricePaidCents ?? null, t.currency || "EUR")}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClasses(
                              t.status || "",
                            )}`}
                          >
                            {statusLabel(t.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-[11px] text-neutral-300">
                          {formatDate(t.purchasedAt)}
                        </td>
                        <td className="px-3 py-3 align-top font-mono text-[10px] text-neutral-500 max-w-[160px] truncate">
                          {t.stripePaymentIntentId || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}