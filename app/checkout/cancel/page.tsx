// app/checkout/cancel/page.tsx

type CancelPageProps = {
  // No Next 16, searchParams vem como Promise
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function CheckoutCancelPage({
  searchParams,
}: CancelPageProps) {
  // Desenrolar a Promise
  const params = (await searchParams) ?? {};

  const getParam = (key: string): string | undefined => {
    const value = params[key];
    if (Array.isArray(value)) return value[0];
    return typeof value === "string" ? value : undefined;
  };

  const eventSlug = getParam("event");
  const ticketName = getParam("ticketName");
  const qtyRaw = getParam("qty");
  const amountRaw = getParam("amount");
  const currency = getParam("currency") || "EUR";

  const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) || 1 : 1;
  const amount = amountRaw ? Number.parseFloat(amountRaw) || 0 : 0;

  const hasSummary = Boolean(ticketName || amountRaw);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Checkout
              </p>
              <p className="text-sm text-white/85">
                O pagamento foi cancelado — ainda não foi cobrado nada.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-5 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] gap-8 items-start">
          {/* Bloco principal */}
          <div className="rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl p-6 md:p-7 space-y-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF8A00] via-[#FF00C8] to-[#1646F5] shadow-[0_0_28px_rgba(255,138,0,0.55)]">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Pagamento cancelado
                </h1>
                <p className="mt-2 text-sm text-white/70 max-w-xl">
                  Não há problema — ainda não foi cobrado nada. Podes voltar ao
                  evento, rever os detalhes e tentar novamente quando fizer
                  sentido.
                </p>
              </div>
            </div>

            {hasSummary && (
              <div className="rounded-xl border border-white/12 bg-black/40 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/65">Bilhete escolhido</span>
                  <span className="font-medium">
                    {ticketName ?? "Bilhete ORYA"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Quantidade</span>
                  <span className="text-white/90">{qty}</span>
                </div>
                {amount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Valor previsto</span>
                    <span className="text-white/90">
                      {amount.toFixed(2)} {currency}
                    </span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-white/50">
                  Estes valores são apenas referência — como o pagamento foi
                  cancelado, nenhuma compra foi registada.
                </p>
              </div>
            )}

            <div className="space-y-2 text-xs text-white/65">
              <p>
                Podes cancelar o pagamento em segurança: enquanto não
                confirmares o pagamento na Stripe, não é feita qualquer
                cobrança e nenhum bilhete é emitido.
              </p>
              <p>
                Podes sempre voltar a escolher outra wave ou outro evento, sem
                qualquer compromisso enquanto não confirmares o pagamento.
              </p>
            </div>
          </div>

          {/* Coluna lateral – ações seguintes */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/90 backdrop-blur-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/90">
                O que queres fazer agora?
              </h2>

              {eventSlug && (
                <a
                  href={`/eventos/${eventSlug}`}
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_32px_rgba(107,255,255,0.6)]"
                >
                  Voltar ao evento
                </a>
              )}

              <a
                href="/explorar"
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white/85 hover:bg-white/10 transition-colors"
              >
                Explorar outros eventos
              </a>

              <a
                href="/me"
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/10 bg-transparent text-[11px] text-white/70 hover:bg-white/5 transition-colors"
              >
                Ir à minha conta
              </a>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 text-[11px] text-white/65 space-y-2">
              <p className="font-semibold text-white/80">
                Nota (modo de testes)
              </p>
              <p>
                Se estiveres a testar com Stripe em modo de testes, podes
                cancelar e repetir o checkout as vezes que quiseres — nada será
                cobrado no mundo real.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}