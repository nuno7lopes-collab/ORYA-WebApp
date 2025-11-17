// app/checkout/success/page.tsx

type RawSearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

type CheckoutSuccessPageProps = {
  searchParams?: RawSearchParams;
};

export default async function CheckoutSuccessPage(
  props: CheckoutSuccessPageProps
) {
  const resolvedSearchParams =
    props.searchParams instanceof Promise
      ? await props.searchParams
      : props.searchParams ?? {};

  const getParam = (key: string): string | undefined => {
    const value = resolvedSearchParams[key];
    if (Array.isArray(value)) return value[0];
    return typeof value === "string" ? value : undefined;
  };

  const eventSlug = getParam("event");
  const eventTitle = getParam("eventTitle");
  const ticketName = getParam("ticketName");
  const qtyRaw = getParam("qty");
  const amountRaw = getParam("amount");
  const currency = getParam("currency") || "EUR";
  const sessionId = getParam("session_id");

  const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) || 1 : 1;
  const amount = amountRaw ? Number.parseFloat(amountRaw) || 0 : 0;
  const hasSummary = Boolean(ticketName || amountRaw);

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
                A tua compra foi concluída com sucesso.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-5 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] gap-8 items-start">
          {/* Bloco principal – mensagem de sucesso */}
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF1F] to-[#020617f2] backdrop-blur-xl p-6 md:p-7 space-y-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00F5A0] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_28px_rgba(0,245,160,0.55)]">
                <span className="text-xl">✅</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Compra confirmada
                </h1>
                <p className="mt-2 text-sm text-white/70 max-w-xl">
                  O teu bilhete está garantido.
                  {eventTitle ? (
                    <>
                      {" "}
                      Vais encontrar o bilhete para{" "}
                      <span className="font-medium text-white/90">
                        {eventTitle}
                      </span>{" "}
                      na tua conta ORYA.
                    </>
                  ) : (
                    " Vais encontrar o teu bilhete na tua conta ORYA."
                  )}
                </p>
              </div>
            </div>

            {hasSummary && (
              <div className="rounded-xl border border-white/12 bg-black/40 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/65">Bilhete</span>
                  <span className="font-medium">
                    {ticketName ?? "Bilhete ORYA"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Quantidade</span>
                  <span className="text-white/90">{qty}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Total pago</span>
                  <span className="text-white/90">
                    {amount.toFixed(2)} {currency}
                  </span>
                </div>
              </div>
            )}

            {sessionId && (
              <p className="text-[11px] text-white/40">
                Referência de pagamento:{" "}
                <span className="font-mono">{sessionId}</span>
              </p>
            )}

            <div className="space-y-2 text-xs text-white/65">
              <p>
                O teu pagamento foi registado e o bilhete foi associado à tua
                conta ORYA. Usa o bilhete digital para entrar no evento no dia.
              </p>
              <p>
                Podes ver e gerir os teus bilhetes em{" "}
                <span className="font-medium text-white/85">/me</span>, onde
                encontras também o QR code / código de entrada em{" "}
                <span className="font-medium text-white/85">Bilhetes</span>.
              </p>
            </div>
          </div>

          {/* Coluna lateral – ações seguintes */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/90 backdrop-blur-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/90">
                O que queres fazer a seguir?
              </h2>

              <a
                href="/me"
                className="block w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_32px_rgba(107,255,255,0.6)]"
              >
                Ver a minha conta e bilhetes
              </a>

              {eventSlug && (
                <a
                  href={`/eventos/${eventSlug}`}
                  className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white/85 hover:bg-white/10 transition-colors"
                >
                  Voltar à página do evento
                </a>
              )}

              <a
                href="/explorar"
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/10 bg-transparent text-[11px] text-white/70 hover:bg-white/5 transition-colors"
              >
                Descobrir mais eventos na ORYA
              </a>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 text-[11px] text-white/65 space-y-2">
              <p className="font-semibold text-white/80">
                Nota (modo de testes)
              </p>
              <p>
                Neste momento estás provavelmente em ambiente de testes. Quando
                passarmos para produção, basta trocar as chaves da gateway
                (Stripe / EuPago) e esta página continua a funcionar exatamente
                da mesma forma.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
