"use client";
import { useCheckout } from "@/app/components/checkout/contextoCheckout";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

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
  padelCategoryId?: number | null;
  padelCategoryLabel?: string | null;
  padelCategoryLinkId?: number | null;
};

type WavesSectionClientProps = {
  slug: string;
  tickets: WaveTicket[];
  // para sabermos se devemos ir para checkout ou fazer “join” direto
  isFreeEvent?: boolean;
  checkoutUiVariant?: "DEFAULT" | "PADEL";
  padelMeta?: {
    eventId: number;
    organizationId: number | null;
    categoryId?: number | null;
    categoryLinkId?: number | null;
  };
  inviteEmail?: string | null;
};

export default function WavesSectionClient({
  slug,
  tickets: initialTickets,
  isFreeEvent,
  checkoutUiVariant = "DEFAULT",
  padelMeta,
  inviteEmail,
}: WavesSectionClientProps) {
  const { abrirCheckout, atualizarDados } = useCheckout();
  const tickets = initialTickets;
  const inviteAdditional =
    inviteEmail && inviteEmail.trim()
      ? { guestEmail: inviteEmail.trim(), guestEmailConfirm: inviteEmail.trim() }
      : {};

  const visibleTickets = tickets.filter((t) => t.isVisible);
  const purchasableTickets = visibleTickets.filter(
    (t) => t.status === "on_sale" || t.status === "upcoming",
  );

  // 🔥 Calcular preço mínimo (defensivo para o caso de não haver bilhetes visíveis)
  const minPrice =
    purchasableTickets.length > 0
      ? Math.min(...purchasableTickets.map((t) => t.price))
      : null;
  const isFreeLabel = Boolean(isFreeEvent);

  return (
    <div className="mt-6 w-full">
      <div className="relative flex flex-col gap-3 rounded-2xl border border-white/12 bg-black/55 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#7CFFEA]/70 to-transparent" />
        <p className="text-sm text-white/85">
          {isFreeLabel ? (
            <span className="text-white font-semibold">Entrada gratuita</span>
          ) : minPrice !== null ? (
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
              additional: {
                checkoutUiVariant,
                padelMeta,
                ...inviteAdditional,
              },
            });

            const defaultTicket = purchasableTickets[0];

            abrirCheckout({
              slug,
              ticketId: defaultTicket.id,
              price: defaultTicket.price,
              ticketName: defaultTicket.name,
              eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
              additional: {
                checkoutUiVariant,
                padelMeta,
                ...inviteAdditional,
              },
              waves: visibleTickets,
            });

            setTimeout(() => {
              try {
                const evt = new Event("orya-force-step1");
                window.dispatchEvent(evt);
              } catch {}
            }, 10);
          }}
          className={`${CTA_PRIMARY} w-full justify-center py-3 text-sm shadow-[0_12px_30px_rgba(124,255,234,0.18)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {purchasableTickets.length === 0
            ? "Esgotado"
            : isFreeLabel
              ? "Garantir lugar"
              : "Comprar agora"}
        </button>
      </div>
    </div>
  );
}
