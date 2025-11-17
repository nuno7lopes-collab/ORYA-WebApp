// app/checkout/error/page.tsx

type ErrorPageProps = {
  // No Next 16, searchParams é uma Promise
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function CheckoutErrorPage({
  searchParams,
}: ErrorPageProps) {
  const params = (await searchParams) ?? {};

  const getParam = (key: string): string | undefined => {
    const value = params[key];
    if (Array.isArray(value)) return value[0];
    return typeof value === "string" ? value : undefined;
  };

  const eventSlug = getParam("event");
  const reason = getParam("reason");
  const code = getParam("code");

  const hasDetails = Boolean(reason || code);

  return (
    <main className="min-h-screen orya-body-bg text-white">
      {/* Top bar simples */}
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
                Algo correu mal com o pagamento.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-5 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] gap-8 items-start">
          {/* Bloco principal – mensagem de erro */}
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#1f293780] via-[#020617f2] to-[#020617f2] backdrop-blur-xl p-6 md:p-7 space-y-6 shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#F97316] via-[#FBBF24] to-[#FACC15] shadow-[0_0_26px_rgba(248,181,0,0.6)]">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Pagamento não concluído
                </h1>
                <p className="mt-2 text-sm text-white/70 max-w-xl">
                  O teu pagamento não foi finalizado. Isto pode acontecer se o
                  cartão for recusado, se tiveres fechado a janela da Stripe ou
                  se a transação tiver sido cancelada.
                </p>
              </div>
            </div>

            {hasDetails && (
              <div className="rounded-xl border border-white/12 bg-black/40 p-4 space-y-2 text-sm">
                <p className="text-white/70 font-medium">Detalhes do erro</p>
                {reason && (
                  <p className="text-xs text-white/80">
                    <span className="text-white/55">Motivo: </span>
                    {reason}
                  </p>
                )}
                {code && (
                  <p className="text-[11px] text-white/60">
                    <span className="text-white/45">Código técnico: </span>
                    <span className="font-mono">{code}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 text-xs text-white/65">
              <p>
                Se achas que isto foi um engano, podes tentar novamente o
                pagamento. Se o problema persistir, recomenda-se experimentar
                outro cartão ou contactar a entidade emissora.
              </p>
              <p>
                Em ambiente de testes, é normal veres erros quando usas certos
                cartões de teste da Stripe — o objetivo é garantir que o teu
                fluxo lida bem com estes cenários.
              </p>
            </div>
          </div>

          {/* Coluna lateral – ações seguintes */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/90 backdrop-blur-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/90">
                O que queres fazer a seguir?
              </h2>

              {eventSlug && (
                <a
                  href={`/eventos/${eventSlug}`}
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_32px_rgba(107,255,255,0.6)]"
                >
                  Voltar ao evento e tentar novamente
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
                Ver a minha conta
              </a>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 text-[11px] text-white/65 space-y-2">
              <p className="font-semibold text-white/80">
                Nota (modo de testes)
              </p>
              <p>
                Tal como na página de sucesso, esta página de erro pode ser usada
                em produção para falhas técnicas de pagamento. Em ambiente de
                testes, é normal provocar alguns erros de propósito para garantir
                que o redirect em caso de falha está a apontar para esta rota com
                os parâmetros certos.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}