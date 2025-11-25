"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type TransferUser = {
  id: string;
  username?: string | null;
  fullName?: string | null;
};

type TransferEvent = {
  slug?: string | null;
  title?: string | null;
  startDate?: string | null;
  locationName?: string | null;
};

type TransferTicketType = {
  name?: string | null;
};

type TransferTicket = {
  id: string;
  event?: TransferEvent | null;
  ticketType?: TransferTicketType | null;
};

type TransferItem = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED" | string;
  createdAt: string;
  completedAt?: string | null;
  ticket?: TransferTicket | null;
  fromUser?: TransferUser | null;
  toUser?: TransferUser | null;
};

type TransfersApiResponse = {
  ok: boolean;
  incoming: TransferItem[];
  outgoing: TransferItem[];
  // se a API devolver { ok: false, error }, tratamos pelo status HTTP
};

export default function TicketTransfersPage() {
  const router = useRouter();
  const { openModal } = useAuthModal();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<TransferItem[]>([]);
  const [outgoing, setOutgoing] = useState<TransferItem[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTransfers() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch("/api/me/tickets/transfers", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (res.status === 401) {
          // não autenticado → abrir modal de login e redirecionar de volta para esta página
          openModal({ mode: "login", redirectTo: "/me/tickets/transfers" });
          return;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("Erro ao carregar transferências:", text);
          if (!cancelled) {
            setErrorMsg(
              "Não foi possível carregar as tuas transferências. Tenta novamente em alguns segundos."
            );
          }
          return;
        }

        const json = (await res.json().catch(() => null)) as TransfersApiResponse | null;

        if (!json || !json.ok) {
          if (!cancelled) {
            setErrorMsg("Resposta inesperada ao tentar carregar as transferências.");
          }
          return;
        }

        if (!cancelled) {
          setIncoming(Array.isArray(json.incoming) ? json.incoming : []);
          setOutgoing(Array.isArray(json.outgoing) ? json.outgoing : []);
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar transferências:", err);
        if (!cancelled) {
          setErrorMsg(
            "Ocorreu um problema inesperado. Tenta novamente dentro de instantes."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTransfers();

    return () => {
      cancelled = true;
    };
  }, [openModal]);

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function formatUser(user?: TransferUser | null) {
    if (!user) return "Utilizador ORYA";
    if (user.username) return `@${user.username}`;
    if (user.fullName) return user.fullName;
    return "Utilizador ORYA";
  }

  function statusLabel(status: string) {
    switch (status) {
      case "PENDING":
        return "Pendente";
      case "ACCEPTED":
        return "Aceite";
      case "CANCELLED":
        return "Cancelada";
      case "EXPIRED":
        return "Expirada";
      default:
        return status;
    }
  }

  function statusClasses(status: string) {
    switch (status) {
      case "PENDING":
        return "border-amber-400/50 bg-amber-500/10 text-amber-100";
      case "ACCEPTED":
        return "border-emerald-400/50 bg-emerald-500/10 text-emerald-100";
      case "CANCELLED":
      case "EXPIRED":
        return "border-white/25 bg-white/5 text-white/80";
      default:
        return "border-white/25 bg-white/5 text-white/80";
    }
  }

  async function handleRespond(transferId: string, action: "ACCEPT" | "DECLINE") {
    try {
      setRespondingId(transferId);

      const res = await fetch("/api/tickets/transfer/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transferId, action }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        console.error("Erro ao responder à transferência:", data);
        alert("Não foi possível atualizar esta transferência. Tenta novamente.");
        return;
      }

      // Atualizar estado local: a resposta do backend já mudou o dono / status;
      // aqui só precisamos de refletir o novo estado na lista de incoming.
      setIncoming((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? {
                ...t,
                status: action === "ACCEPT" ? "ACCEPTED" : "CANCELLED",
                completedAt: new Date().toISOString(),
              }
            : t
        )
      );
    } catch (err) {
      console.error("Erro ao responder à transferência:", err);
      alert("Ocorreu um erro inesperado. Tenta novamente dentro de instantes.");
    } finally {
      setRespondingId(null);
    }
  }

  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;

  return (
    <main className="orya-body-bg min-h-screen w-full text-white pb-16">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                A minha conta
              </p>
              <p className="text-sm text-white/85">
                Transferências de bilhetes ligadas à tua conta ORYA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/me/tickets"
              className="hidden sm:inline-flex text-[11px] px-3 py-1.5 rounded-xl border border-white/15 text-white/75 hover:bg-white/5 transition-colors"
            >
              &larr; Voltar aos bilhetes
            </Link>
            <Link
              href="/me"
              className="hidden sm:inline-flex text-[11px] px-3 py-1.5 rounded-xl border border-white/15 text-white/75 hover:bg-white/5 transition-colors"
            >
              Conta
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 pt-8 md:pt-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Transferências de bilhetes
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-xl">
              Aqui vais conseguir ver convites de bilhetes que te enviaram, as
              transferências que fizeste para amigos e o estado de cada uma.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/me/tickets"
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 active:scale-95 transition-transform shadow-[0_0_26px_rgba(107,255,255,0.45)]"
            >
              Ver os meus bilhetes
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-6 space-y-4" role="status" aria-live="polite">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              A carregar as tuas transferências…
            </div>
          </div>
        )}

        {errorMsg && !loading && (
          <div
            className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100 flex items-start gap-2"
            role="alert"
          >
            <span className="mt-[2px] text-sm">⚠️</span>
            <div className="space-y-1">
              <p className="font-medium text-red-100">Não foi possível carregar</p>
              <p className="text-[11px] text-red-100/80">{errorMsg}</p>
            </div>
          </div>
        )}

        {!loading && !errorMsg && !hasIncoming && !hasOutgoing && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-8 text-center space-y-3">
            <p className="text-lg font-medium">Ainda não tens transferências</p>
            <p className="text-sm text-white/65 max-w-md mx-auto">
              Quando enviares um bilhete a um amigo — ou alguém te enviar um a
              ti — esse pedido vai aparecer aqui, com o estado da transferência.
            </p>
            <Link
              href="/me/tickets"
              className="inline-flex mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-105 active:scale-95 transition-transform shadow-[0_0_28px_rgba(107,255,255,0.5)]"
            >
              Voltar aos bilhetes
            </Link>
          </div>
        )}

        {!loading && !errorMsg && (hasIncoming || hasOutgoing) && (
          <div className="space-y-8">
            {/* Convites recebidos */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white/85">
                  Convites recebidos
                </h2>
                <span className="text-[11px] text-white/60">
                  {incoming.length} transferência(s)
                </span>
              </div>

              {incoming.length === 0 ? (
                <p className="text-[11px] text-white/55">
                  Neste momento não tens convites de bilhetes por aceitar.
                </p>
              ) : (
                <div className="space-y-3">
                  {incoming.map((t) => {
                    const event = t.ticket?.event;
                    const ticketType = t.ticket?.ticketType;
                    const from = t.fromUser;
                    const isPending = t.status === "PENDING";

                    return (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1 text-[11px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-white/80 font-semibold">
                              {event?.title || "Evento ORYA"}
                            </span>
                            {ticketType?.name && (
                              <span className="rounded-full border border-white/15 px-2 py-[2px] text-[10px] text-white/70">
                                Wave {ticketType.name}
                              </span>
                            )}
                          </div>
                          <p className="text-white/60">
                            Enviado por{" "}
                            <span className="font-medium text-white/85">
                              {formatUser(from)}
                            </span>
                          </p>
                          {event?.startDate && (
                            <p className="text-white/55">
                              Data do evento:{" "}
                              <span className="text-white/80">
                                {formatDate(event.startDate)}
                              </span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium ${statusClasses(
                                t.status
                              )}`}
                            >
                              {statusLabel(t.status)}
                            </span>
                            <span className="text-[10px] text-white/50">
                              Pedido criado em {formatDate(t.createdAt)}
                            </span>
                            {t.completedAt && (
                              <span className="text-[10px] text-white/45">
                                · Atualizado em {formatDate(t.completedAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end mt-2 md:mt-0 text-[11px]">
                          {event?.slug && (
                            <button
                              type="button"
                              onClick={() => router.push(`/eventos/${event.slug}`)}
                              className="px-3 py-1.5 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                            >
                              Ver evento
                            </button>
                          )}

                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRespond(t.id, "DECLINE")}
                                disabled={respondingId === t.id}
                                className="px-3 py-1.5 rounded-full border border-white/20 text-white/75 hover:bg-white/8 transition-colors disabled:opacity-60"
                              >
                                {respondingId === t.id && "A atualizar…"}
                                {respondingId !== t.id && "Recusar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRespond(t.id, "ACCEPT")}
                                disabled={respondingId === t.id}
                                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
                              >
                                {respondingId === t.id ? "A aceitar…" : "Aceitar bilhete"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Transferências enviadas */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white/85">
                  Transferências enviadas
                </h2>
                <span className="text-[11px] text-white/60">
                  {outgoing.length} transferência(s)
                </span>
              </div>

              {outgoing.length === 0 ? (
                <p className="text-[11px] text-white/55">
                  Ainda não enviaste nenhum bilhete para amigos. Podes começar a
                  partir da página dos teus bilhetes.
                </p>
              ) : (
                <div className="space-y-3">
                  {outgoing.map((t) => {
                    const event = t.ticket?.event;
                    const ticketType = t.ticket?.ticketType;
                    const to = t.toUser;

                    return (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1 text-[11px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-white/80 font-semibold">
                              {event?.title || "Evento ORYA"}
                            </span>
                            {ticketType?.name && (
                              <span className="rounded-full border border-white/15 px-2 py-[2px] text-[10px] text-white/70">
                                Wave {ticketType.name}
                              </span>
                            )}
                          </div>
                          <p className="text-white/60">
                            Enviado para{" "}
                            <span className="font-medium text-white/85">
                              {formatUser(to)}
                            </span>
                          </p>
                          {event?.startDate && (
                            <p className="text-white/55">
                              Data do evento:{" "}
                              <span className="text-white/80">
                                {formatDate(event.startDate)}
                              </span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium ${statusClasses(
                                t.status
                              )}`}
                            >
                              {statusLabel(t.status)}
                            </span>
                            <span className="text-[10px] text-white/50">
                              Pedido criado em {formatDate(t.createdAt)}
                            </span>
                            {t.completedAt && (
                              <span className="text-[10px] text-white/45">
                                · Atualizado em {formatDate(t.completedAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end mt-2 md:mt-0 text-[11px]">
                          {event?.slug && (
                            <button
                              type="button"
                              onClick={() => router.push(`/eventos/${event.slug}`)}
                              className="px-3 py-1.5 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                            >
                              Ver evento
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
