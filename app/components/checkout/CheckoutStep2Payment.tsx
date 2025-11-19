"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useCheckout } from "@/app/components/checkout/checkoutContext";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

function InnerPaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { eventSlug, price, qty, setStep } = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const total = price != null ? price * qty : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // depois podemos trocar isto por /checkout/success com mais info
        return_url: `${window.location.origin}/eventos/${eventSlug}?payment=return`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(
        error.message ?? "Não foi possível concluir o pagamento.",
      );
      setSubmitting(false);
      return;
    }

    // Pagamento confirmado (ou não foi preciso redirect)
    setStep(3);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
        <PaymentElement />
      </div>

      {total != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Total</span>
          <span className="text-lg font-semibold text-white">
            {total.toFixed(2)} €
          </span>
        </div>
      )}

      {errorMessage && (
        <p className="text-sm text-red-300">{errorMessage}</p>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex items-center justify-center rounded-full border border-white/25 bg-transparent px-4 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10"
          disabled={submitting}
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={submitting || !stripe || !elements}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-1.5 text-sm font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.5)] disabled:opacity-60"
        >
          {submitting ? "A processar..." : "Pagar agora"}
        </button>
      </div>
    </form>
  );
}

function CheckoutStep2Payment() {
  const { eventSlug, price, qty, userId, ticketId, eventId } = useCheckout();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[CheckoutStep2] contexto atual:", {
      eventSlug,
      price,
      qty,
      userId,
      ticketId,
      eventId,
    });

    // Enquanto os dados ainda não chegaram, não marcamos como erro.
    if (
      !eventSlug ||
      price == null ||
      qty <= 0 ||
      !userId ||
      !ticketId ||
      !eventId
    ) {
      setError(null); // garante que não fica preso na mensagem antiga
      return;
    }

    async function loadIntent() {
      try {
        setError(null);
        setClientSecret(null);

        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: eventSlug,
            amount: price * qty,
            userId,
            ticketId,
            eventId,
            quantity: qty,
            price,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Erro ao criar pagamento.");
        }

        setClientSecret(data.clientSecret);
      } catch (err: any) {
        console.error("[CheckoutStep2] Erro ao criar PaymentIntent:", err);
        setError(err.message || "Erro inesperado ao preparar o pagamento.");
      }
    }

    loadIntent();
  }, [eventSlug, price, qty, userId, ticketId, eventId]);

  // 1) Ainda a preparar (sem erro grave) → mostra loading
  if (!clientSecret && !error) {
    return (
      <p className="py-10 text-center text-white/70">
        A preparar pagamento…
      </p>
    );
  }

  // 2) Erro a criar o intent → mostra mensagem (pode ser falta de dados OU falha na API)
  if (!clientSecret && error) {
    return (
      <p className="py-10 text-center text-red-400">
        {error}
      </p>
    );
  }

  // 3) Tudo OK → renderizar Stripe Elements
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: clientSecret! }}>
      <InnerPaymentForm />
    </Elements>
  );
}

export default CheckoutStep2Payment;