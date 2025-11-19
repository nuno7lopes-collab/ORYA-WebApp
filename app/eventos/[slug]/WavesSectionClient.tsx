"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "@/app/components/checkout/checkoutContext";

export type WaveStatus = "on_sale" | "upcoming" | "closed" | "sold_out";

export type WaveTicket = {
  id: string;
  name: string;
  price: number;
  currency: string;
  remaining: number | null; // null = stock ilimitado
  status: WaveStatus;
  startsAt: string | null;
  endsAt: string | null;
  available: boolean;
  isVisible: boolean;
  // info extra de stock (opcional, vindo da API)
  totalQuantity?: number | null;
  soldQuantity?: number;
};

type WavesSectionClientProps = {
  slug: string;
  tickets: WaveTicket[];
  // para sabermos se devemos ir para checkout ou fazer “join” direto
  isFreeEvent?: boolean;
};

type FeedbackType = "success" | "error";

type FeedbackState = {
  [ticketId: string]: {
    type: FeedbackType;
    message: string;
  };
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeRemainingAndStatus(
  prev: WaveTicket,
  updated: { totalQuantity?: number | null; soldQuantity?: number },
): { remaining: number | null; status: WaveStatus } {
  const total =
    updated.totalQuantity !== undefined
      ? updated.totalQuantity
      : prev.totalQuantity ?? null;

  const sold =
    updated.soldQuantity !== undefined
      ? updated.soldQuantity
      : prev.soldQuantity ?? 0;

  let remaining: number | null = null;

  if (total === null || total === undefined) {
    remaining = null; // ilimitado
  } else {
    const diff = total - sold;
    remaining = diff < 0 ? 0 : diff;
  }

  let status: WaveStatus = prev.status;

  if (total !== null && total !== undefined && sold >= total) {
    status = "sold_out";
  } else if (status === "sold_out") {
    status = "sold_out";
  }

  // Se estiver marcada como indisponível/oculta, tratamos como encerrada visualmente
  if (!prev.available || !prev.isVisible) {
    status = "closed";
  }

  return { remaining, status };
}

export default function WavesSectionClient({
  slug,
  tickets: initialTickets,
  isFreeEvent,
}: WavesSectionClientProps) {
  const router = useRouter();
  const { openCheckout } = useCheckout();
  const [tickets, setTickets] = useState<WaveTicket[]>(initialTickets);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({});

  async function handlePurchase(ticketId: string) {
    const selectedTicket = tickets.find((t) => t.id === ticketId);
    if (!selectedTicket) return;

    // limpar feedback antigo
    setFeedback((prev) => {
      const clone = { ...prev };
      delete clone[ticketId];
      return clone;
    });

    setLoadingId(ticketId);

    try {
      const isPaidTicket = !isFreeEvent && selectedTicket.price > 0;

      // 🔥 Evento pago → abre modal de checkout (novo fluxo)
      if (isPaidTicket) {
        openCheckout({
          slug,
          ticketId,
          price: selectedTicket.price,
          ticketName: selectedTicket.name,
        });
        setLoadingId(null);
        return;
      }

      // Evento grátis (ou wave a 0€) → fluxo atual de "compra" direta
      const res = await fetch(`/api/eventos/${slug}/comprar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          quantity: 1,
        }),
      });

      // Não autenticado → mandar para login com redirect
      if (res.status === 401) {
        setFeedback((prev) => ({
          ...prev,
          [ticketId]: {
            type: "error",
            message:
              "Precisas de entrar na tua conta para reservar este lugar.",
          },
        }));
        router.push(`/login?redirect=/eventos/${slug}`);
        return;
      }

      if (!res.ok) {
        let errorMessage =
          "Não foi possível concluir a reserva. Tenta outra vez.";
        try {
          const errBody = await res.json();
          if (errBody && typeof errBody.error === "string") {
            errorMessage = errBody.error;
          }
        } catch {
          const text = await res.text().catch(() => null);
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed.error === "string") {
                errorMessage = parsed.error;
              }
            } catch {
              // ignore
            }
          }
        }

        setFeedback((prev) => ({
          ...prev,
          [ticketId]: {
            type: "error",
            message: errorMessage,
          },
        }));
        return;
      }

      const data = await res.json();

      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;

          const updatedTicket = data.ticket ?? {};
          const { remaining, status } = computeRemainingAndStatus(t, {
            totalQuantity: updatedTicket.totalQuantity,
            soldQuantity: updatedTicket.soldQuantity,
          });

          return {
            ...t,
            totalQuantity:
              updatedTicket.totalQuantity !== undefined
                ? updatedTicket.totalQuantity
                : t.totalQuantity ?? null,
            soldQuantity:
              updatedTicket.soldQuantity !== undefined
                ? updatedTicket.soldQuantity
                : t.soldQuantity ?? 0,
            remaining,
            status,
          };
        }),
      );

      setFeedback((prev) =>({
        ...prev,
        [ticketId]: {
          type: "success",
          message:
            "Lugar garantido! Em breve vais poder ver este bilhete na tua conta ORYA.",
        },
      }));
    } catch (err) {
      console.error(err);
      setFeedback((prev) => ({
        ...prev,
        [ticketId]: {
          type: "error",
          message: "Erro inesperado ao processar a ação. Tenta outra vez.",
        },
      }));
    } finally {
      setLoadingId(null);
    }
  }

  const visibleTickets = tickets.filter((t) => t.isVisible);

  // Escolher wave "principal" (recomendada): a wave à venda mais barata
  const primaryWaveId = (() => {
    const onSale = visibleTickets.filter(
      (t) => t.status === "on_sale" && t.available && t.isVisible,
    );
    if (!onSale.length) return null;
    const sorted = [...onSale].sort((a, b) => a.price - b.price);
    return sorted[0]?.id ?? null;
  })();

  if (!visibleTickets || visibleTickets.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-white/15 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF1F] to-[#020617f2] px-4 py-3 text-xs text-white/70 backdrop-blur-xl">
        Ainda não há waves configuradas para este evento.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {visibleTickets.map((ticket, index) => {
        const effectiveStatus: WaveStatus =
          !ticket.available || !ticket.isVisible ? "closed" : ticket.status;

        let statusLabel: string;
        let statusClasses: string;

        switch (effectiveStatus) {
          case "on_sale":
            statusLabel = "À venda";
            statusClasses =
              "bg-emerald-500/15 border-emerald-400/40 text-emerald-100";
            break;
          case "upcoming":
            statusLabel = "Em breve";
            statusClasses =
              "bg-[#6BFFFF]/10 border-[#6BFFFF]/40 text-[#E0FEFF]";
            break;
          case "sold_out":
            statusLabel = "Esgotado";
            statusClasses = "bg-red-500/10 border-red-400/50 text-red-200";
            break;
          case "closed":
          default:
            statusLabel = "Encerrado";
            statusClasses = "bg-white/6 border-white/30 text-white/60";
            break;
        }

        const feedbackForTicket = feedback[ticket.id];

        const isPaidTicket = !isFreeEvent && ticket.price > 0;

        const buttonDisabled =
          effectiveStatus !== "on_sale" ||
          loadingId === ticket.id ||
          (ticket.remaining !== null && ticket.remaining <= 0);

        const buttonLabel = (() => {
          if (effectiveStatus !== "on_sale") {
            return statusLabel;
          }
          if (loadingId === ticket.id) {
            return "A processar...";
          }
          return isPaidTicket ? "Comprar" : "Reservar";
        })();

        const remainingText = (() => {
          if (ticket.remaining === null) {
            return "Sem limite máximo de lugares nesta wave.";
          }
          if (ticket.remaining <= 0) {
            return "Sem lugares disponíveis nesta wave.";
          }
          if (ticket.remaining <= 5) {
            return `Últimos ${ticket.remaining} bilhete(s) disponíveis.`;
          }
          return `${ticket.remaining} lugar(es) disponíveis.`;
        })();

        const startsAtLabel = formatDateTime(ticket.startsAt);
        const endsAtLabel = formatDateTime(ticket.endsAt);

        const priceLabel =
          ticket.price > 0
            ? `${ticket.price.toFixed(2)} ${ticket.currency || "EUR"}`
            : "Grátis";

        return (
          <div
            key={ticket.id}
            className={`flex flex-col gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-xl transition-transform ${
              ticket.id === primaryWaveId
                ? "border-white/18 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF26] to-[#020617f2] shadow-[0_0_34px_rgba(15,23,42,0.9)]"
                : "border-white/12 bg-gradient-to-br from-white/[0.03] via-slate-950/85 to-slate-950"
            }`}
          >
            {/* Topo: nome + estado + stock + preço */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-white/95">
                    {ticket.name || `Wave ${index + 1}`}
                  </span>
                  {ticket.id === primaryWaveId && (
                    <span className="inline-flex items-center rounded-full bg-[#6BFFFF]/15 border border-[#6BFFFF]/60 text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 text-[#E5FEFF]">
                      Recomendado
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusClasses}`}
                  >
                    {statusLabel}
                  </span>
                  <span className="text-[10px] text-white/60">
                    {remainingText}
                  </span>
                </div>
              </div>

              <div className="mt-1 flex flex-col items-start gap-1 sm:mt-0 sm:items-end">
                <span className="text-sm font-semibold text-white">
                  {priceLabel}
                </span>
                <span className="text-[10px] text-white/50">
                  Preço por bilhete
                </span>
              </div>
            </div>

            {/* Botão de compra */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                disabled={buttonDisabled}
                onClick={() => handlePurchase(ticket.id)}
                className={`min-w-[120px] rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all ${
                  buttonDisabled
                    ? "cursor-default border border-white/15 bg-white/8 text-white/40"
                    : "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_18px_rgba(107,255,255,0.5)] hover:scale-[1.02] active:scale-95"
                }`}
              >
                {buttonLabel}
              </button>
            </div>

            {/* Linha de info extra (wave #, datas) */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/50">
              <span className="rounded-full border border-white/14 bg-white/8 px-2 py-0.5">
                Wave #{index + 1}
              </span>
              {startsAtLabel && endsAtLabel && (
                <span className="rounded-full border border-white/14 bg-white/5 px-2 py-0.5">
                  Ativa de: {startsAtLabel} até {endsAtLabel}
                </span>
              )}
              {startsAtLabel && !endsAtLabel && (
                <span className="rounded-full border border-white/14 bg-white/5 px-2 py-0.5">
                  Abre: {startsAtLabel}
                </span>
              )}
              {!startsAtLabel && endsAtLabel && (
                <span className="rounded-full border border-white/14 bg-white/5 px-2 py-0.5">
                  Fecha: {endsAtLabel}
                </span>
              )}
            </div>

            {feedbackForTicket && (
              <div
                className={`mt-1 rounded-lg px-3 py-1.5 text-[11px] ${
                  feedbackForTicket.type === "success"
                    ? "border border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                    : "border border-red-400/50 bg-red-500/10 text-red-100"
                }`}
              >
                {feedbackForTicket.message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}