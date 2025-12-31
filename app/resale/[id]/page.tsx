"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";

type CheckoutResponse = {
  ok?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  purchaseId?: string;
  error?: string;
  code?: string;
};

type ResalePreview = {
  title: string;
  ticketTypeName: string | null;
  priceCents: number;
  currency: string;
  sellerName: string | null;
};

function PaymentForm({ onSuccess }: { onSuccess?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message || "Pagamento falhou");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className={`${CTA_PRIMARY} w-full justify-center py-3 text-sm disabled:opacity-60`}
      >
        {submitting ? "A processar…" : "Pagar agora"}
      </button>
    </form>
  );
}

export default function ResaleCheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ResalePreview | null>(null);

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  useEffect(() => {
    async function startResale() {
      if (!params?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/checkout/resale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resaleId: params.id }),
        });
        const data = (await res.json().catch(() => null)) as CheckoutResponse & { preview?: ResalePreview } | null;
        if (!res.ok || !data?.ok || !data?.clientSecret) {
          const code = data?.code;
          const msg =
            code === "PRICE_CHANGED"
              ? "O preço foi atualizado. Volta atrás e confirma se a oferta ainda está disponível."
              : code === "INSUFFICIENT_STOCK"
                ? "Esta revenda já não está disponível."
                : data?.error || "Não foi possível preparar o pagamento.";
          throw new Error(msg);
        }
        setClientSecret(data.clientSecret);
        if (data.preview) setPreview(data.preview);
      } catch (err) {
        console.error("[ResaleCheckout] error", err);
        setError(err instanceof Error ? err.message : "Erro ao preparar checkout.");
      } finally {
        setLoading(false);
      }
    }
    startResale();
  }, [params?.id]);

  const appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#FF00C8",
      colorBackground: "#0A0A0F",
      colorText: "#F5F5F5",
    },
  } as const;

  return (
    <div className="min-h-screen text-white px-4 py-10 flex justify-center">
      <div className="orya-page-width flex justify-center">
        <div className="w-full max-w-xl space-y-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Revenda</p>
            <h1 className="text-2xl font-semibold">Comprar bilhete de utilizador</h1>
            <p className="text-sm text-white/70">
              Pagamento seguro via ORYA. Se o vendedor já cancelou a oferta, o pagamento falha automaticamente.
            </p>
          </div>

          {preview && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-1">
              <p className="text-xs text-white/60">Evento</p>
              <p className="text-sm font-semibold text-white">{preview.title}</p>
              <p className="text-xs text-white/60">Bilhete</p>
              <p className="text-sm text-white">{preview.ticketTypeName ?? "Bilhete ORYA"}</p>
              <p className="text-xs text-white/60">Preço pedido</p>
              <p className="text-base font-semibold text-white">
                {new Intl.NumberFormat("pt-PT", {
                  style: "currency",
                  currency: preview.currency || "EUR",
                }).format(preview.priceCents / 100)}
              </p>
              {preview.sellerName && (
                <p className="text-xs text-white/60">Vendedor: {preview.sellerName}</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {loading && <p className="text-sm text-white/65">A preparar checkout…</p>}

          {!loading && clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <PaymentForm onSuccess={() => router.push("/me/carteira?checkout=success&mode=resale")} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
