"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "@/app/components/checkout/contextoCheckout";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

import { useUser } from "@/app/hooks/useUser";

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
  const { abrirCheckout, atualizarDados } = useCheckout();
  const { openModal } = useAuthModal();
  const { user } = useUser();
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
        abrirCheckout({
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
  const purchasableTickets = visibleTickets.filter(
    (t) => t.status === "on_sale" || t.status === "upcoming",
  );

  // 🔥 Calcular preço mínimo (defensivo para o caso de não haver bilhetes visíveis)
  const minPrice =
    purchasableTickets.length > 0
      ? Math.min(...purchasableTickets.map((t) => t.price))
      : null;

  return (
    <div className="mt-6 w-full">
      <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 backdrop-blur-xl flex flex-col gap-3 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
        <p className="text-white/80 text-sm">
          {minPrice !== null ? (
            <>
              A partir de{" "}
              <span className="text-white font-semibold">
                {minPrice.toFixed(2)}€
              </span>
            </>
          ) : (
            <span className="text-white/60">Sem bilhetes disponíveis</span>
          )}
        </p>

        <button
          type="button"
          disabled={purchasableTickets.length === 0}
          onClick={() => {
            if (purchasableTickets.length === 0) return;

            atualizarDados({
              slug,
              waves: visibleTickets,
            });

            const defaultTicket = purchasableTickets[0];

            abrirCheckout({
              slug,
              ticketId: defaultTicket.id,
              price: defaultTicket.price,
              ticketName: defaultTicket.name,
              waves: visibleTickets,
            });

            setTimeout(() => {
              try {
                const evt = new Event("orya-force-step1");
                window.dispatchEvent(evt);
              } catch {}
            }, 10);
          }}
          className="w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold py-3 shadow-[0_0_20px_rgba(107,255,255,0.45)] hover:scale-[1.02] active:scale-95 transition-transform text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {purchasableTickets.length === 0 ? "Esgotado" : "Comprar agora"}
        </button>
      </div>
    </div>
  );
}
