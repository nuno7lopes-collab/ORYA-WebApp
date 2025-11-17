"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CheckoutError = {
  message: string;
  code?: string;
};


export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CheckoutError | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // começa em 0 até termos dados reais da reserva
  const [hasExpired, setHasExpired] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isReservationReady, setIsReservationReady] = useState(false);

  // 1) Ler dados da query (vindos da página do evento)
  const eventSlug = searchParams.get("event") ?? "";
  const eventTitle = searchParams.get("eventTitle") ?? "";
  const ticketName = searchParams.get("ticketName") ?? "Bilhete ORYA";
  const qtyRaw = searchParams.get("qty");
  const amountRaw = searchParams.get("amount");
  const currency = searchParams.get("currency") ?? "EUR";
  const ticketId = searchParams.get("ticketId");

  const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) || 1 : 1;
  const amount = amountRaw ? Number.parseFloat(amountRaw) || 0 : 0;
  const hasValidAmount = Number.isFinite(amount) && amount > 0;

  const hasBasicData = Boolean(eventSlug && ticketId);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    const doReserve = async () => {
      if (!eventSlug || !ticketId) return;

      try {
        setIsReserving(true);
        setError(null);
        setIsReservationReady(false);

        const res = await fetch("/api/checkout/reserve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug,
            ticketId,
            qty,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401 && data?.code === "NOT_AUTHENTICATED") {
            const currentUrl =
              typeof window !== "undefined" ? window.location.href : "/";
            setRedirectUrl(currentUrl);
            setError({
              message:
                "Precisas de iniciar sessão para continuar este checkout.",
              code: "NOT_AUTHENTICATED",
            });
            return;
          }

          setError({
            message:
              data?.error ??
              "Não foi possível reservar o teu lugar. Volta à página do evento e tenta novamente.",
            code: data?.code,
          });

          if (data?.code === "SOLD_OUT" && eventSlug) {
            setHasExpired(true);
          }

          return;
        }

        const expiresAtStr = data?.expiresAt as string | undefined;
        const nowStr = data?.now as string | undefined;

        if (!expiresAtStr || !nowStr || !data?.reservationId) {
          setError({
            message:
              "Não foi possível obter dados da reserva. Tenta novamente dentro de instantes.",
          });
          return;
        }

        setReservationId(data.reservationId);

        const expiresAtDate = new Date(expiresAtStr);
        const nowDate = new Date(nowStr);
        const diffSeconds = Math.max(
          0,
          Math.floor((expiresAtDate.getTime() - nowDate.getTime()) / 1000),
        );

        setTimeLeft(diffSeconds);
        setIsReservationReady(true);

        if (diffSeconds <= 0) {
          setHasExpired(true);
        }
      } catch (err) {
        console.error("[/checkout] Erro ao criar reserva:", err);
        setError({
          message:
            "Não foi possível reservar o teu lugar neste momento. Verifica a ligação e tenta novamente.",
        });
      } finally {
        setIsReserving(false);
      }
    };

    doReserve();
  }, [eventSlug, ticketId, qty, router]);

  // 2) Timer de reserva (apenas front-end)
  useEffect(() => {
    if (!isReservationReady) return; // só começamos o timer quando temos dados de reserva reais
    if (hasExpired) return;

    if (timeLeft <= 0) {
      setHasExpired(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, hasExpired, isReservationReady]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [timeLeft]);

  const handleGoToLogin = () => {
    const currentUrl =
      redirectUrl ||
      (typeof window !== "undefined" ? window.location.href : "/");

    router.push(
      `/login?redirect=${encodeURIComponent(
        currentUrl,
      )}&reason=checkout`,
    );
  };

  // 3) Handler do botão "Continuar para pagamento"
  const handleGoToPayment = async () => {
    if (!hasBasicData) {
      setError({
        message:
          "Os dados do bilhete não são válidos. Volta à página do evento e tenta novamente.",
      });
      return;
    }

    if (!reservationId) {
      setError({
        message:
          "Não foi possível validar a tua reserva. Atualiza a página ou volta à página do evento.",
      });
      return;
    }

    if (hasExpired) {
      setError({
        message:
          "O tempo desta reserva terminou. Volta à página do evento para tentar novamente.",
        code: "RESERVATION_EXPIRED",
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventSlug,
          ticketId,
          qty,
          reservationId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 401 → user não autenticado → mostrar erro e botão para login
        if (res.status === 401 && data?.code === "NOT_AUTHENTICATED") {
          const currentUrl =
            typeof window !== "undefined" ? window.location.href : "/";

          setRedirectUrl(currentUrl);
          setError({
            message:
              "Precisas de iniciar sessão para concluir o pagamento.",
            code: "NOT_AUTHENTICATED",
          });
          return;
        }

        // Outros erros vindos da API (wave esgotada, etc.)
        setError({
          message:
            data?.error ??
            "Não foi possível preparar o checkout. Tenta novamente dentro de instantes.",
          code: data?.code,
        });
        return;
      }

      if (!data?.url) {
        setError({
          message:
            "Não foi possível obter o link de pagamento. Tenta novamente.",
        });
        return;
      }

      // Tudo ok → seguir para Stripe
      window.location.href = data.url as string;
    } catch (err) {
      console.error("[/checkout] Erro inesperado:", err);
      setError({
        message:
          "Ocorreu um erro inesperado ao ligar ao sistema de pagamentos. Verifica a tua ligação e tenta novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 4) Layout visual (Shotgun vibes, identidade ORYA)
  return (
    <main className="min-h-screen orya-body-bg text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Checkout
              </p>
              <p className="text-sm text-white/85">
                Confirma o teu pedido e segue para o pagamento seguro.
              </p>
            </div>
          </div>

          {/* Timer de reserva */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50">Reserva ativa por</span>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
                hasExpired
                  ? "border-red-500/60 bg-red-500/10 text-red-300"
                  : "border-[#6BFFFF]/60 bg-[#020617] text-[#6BFFFF]"
              }`}
            >
              {!hasExpired ? (
                isReservationReady ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#00F5A0] animate-pulse" />
                    <span className="font-mono text-[11px]">{timerLabel}</span>
                  </>
                ) : (
                  // Skeleton suave enquanto estamos a carregar a reserva do backend
                  <span className="block h-3 w-12 rounded-full bg-white/10 animate-pulse" />
                )
              ) : (
                <span className="font-mono text-[11px]">Tempo expirado</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] gap-8 items-start">
          {/* Coluna esquerda – Detalhes do pedido */}
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#020617] via-[#020617ee] to-[#020617f8] backdrop-blur-xl p-6 md:p-7 space-y-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Revê o teu pedido
              </h1>
              <p className="text-sm text-white/70 max-w-xl">
                Garante que os detalhes estão corretos antes de ires para o
                pagamento. O bilhete fica automaticamente associado à tua conta
                ORYA.
              </p>
            </div>

            <div className="rounded-xl border border-white/12 bg-black/40 p-4 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Evento
                  </p>
                  <p className="text-sm font-medium text-white/90">
                    {eventTitle || "Evento ORYA"}
                  </p>
                  {eventSlug && (
                    <button
                      className="text-[11px] text-white/60 underline underline-offset-4 hover:text-white/90"
                      type="button"
                      onClick={() => router.push(`/eventos/${eventSlug}`)}
                    >
                      Ver detalhes do evento
                    </button>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/65">Tipo de bilhete</span>
                  <span className="font-medium">{ticketName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Quantidade</span>
                  <span className="text-white/90">{qty}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Total</span>
                  <span className="text-white/90">
                    {hasValidAmount ? `${amount.toFixed(2)} ${currency}` : `--,-- ${currency}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Mensagens de erro / estado */}
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200 space-y-1">
                <p className="font-semibold">Não foi possível avançar.</p>
                <p>{error.message}</p>
                {error.code === "RESERVATION_EXPIRED" && eventSlug && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-400/50 px-3 py-1 text-[11px] font-medium text-red-100 hover:bg-red-500/10"
                    onClick={() => router.push(`/eventos/${eventSlug}`)}
                  >
                    Voltar à página do evento
                  </button>
                )}
                {error.code === "NOT_AUTHENTICATED" && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                    onClick={handleGoToLogin}
                  >
                    Iniciar sessão e continuar checkout
                  </button>
                )}
              </div>
            )}

            <p className="text-[11px] text-white/45">
              Ao continuar, aceitas os termos do evento definidos pelo
              organizador. Em caso de alteração ou cancelamento, vais receber
              informação diretamente no email associado à tua conta ORYA.
            </p>
          </div>

          {/* Coluna direita – Botão + resumo rápido */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/90 backdrop-blur-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/90">
                Pronto para fechar?
              </h2>
              <p className="text-xs text-white/65">
                Vais ser redirecionado para um checkout seguro (Stripe) para
                completar o pagamento. Assim que estiver concluído, o bilhete
                aparece automaticamente em{" "}
                <span className="font-medium">A minha conta &gt; Os meus
                bilhetes</span>.
              </p>

              <button
                type="button"
                onClick={handleGoToPayment}
                disabled={isLoading || isReserving || hasExpired || !hasBasicData}
                className="block w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_32px_rgba(107,255,255,0.6)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {hasExpired
                  ? "Reserva expirada"
                  : isReserving
                  ? "A reservar o teu lugar..."
                  : isLoading
                  ? "A ligar ao sistema de pagamentos..."
                  : "Continuar para pagamento seguro"}
              </button>

              <button
                type="button"
                onClick={() =>
                  eventSlug ? router.push(`/eventos/${eventSlug}`) : router.push("/explorar")
                }
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-[11px] font-semibold text-white/85 hover:bg-white/10 transition-colors"
              >
                Voltar aos bilhetes
              </button>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 text-[11px] text-white/65 space-y-2">
              <p className="font-semibold text-white/80">
                Pagamento seguro &amp; transparente
              </p>
              <p>
                Usamos parceiros de pagamento reconhecidos (como Stripe) para
                garantir que os teus dados bancários são tratados com segurança
                a nível mundial.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}