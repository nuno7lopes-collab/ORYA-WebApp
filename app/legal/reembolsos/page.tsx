const LAST_UPDATED = "9 de fevereiro de 2026";
const SUPPORT_EMAIL = "support@orya.pt";

export default function LegalRefundsPage() {
  return (
    <article className="space-y-6">
      <header className="rounded-[28px] border border-white/12 bg-black/35 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Legal</p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Política de Reembolsos</h1>
        <p className="mt-2 text-sm text-white/70">Última atualização: {LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-white/70">
          Esta política descreve como funcionam cancelamentos e reembolsos para eventos, reservas e compras
          realizados através da ORYA.
        </p>
      </header>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">1. Responsável pela política</h2>
        <p className="mt-2 text-sm text-white/70">
          Cada evento ou serviço define as suas próprias regras de cancelamento e reembolso. Essas condições
          são apresentadas antes da confirmação da compra.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">2. Elegibilidade</h2>
        <p className="mt-2 text-sm text-white/70">
          Um reembolso só é possível quando permitido pela política do organizador ou serviço. Itens digitais
          e bilhetes podem ter regras específicas.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">3. Processamento</h2>
        <p className="mt-2 text-sm text-white/70">
          Reembolsos aprovados são processados para o mesmo método de pagamento, sempre que possível. O prazo
          final depende do teu banco ou processador de pagamentos.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">4. Como pedir</h2>
        <p className="mt-2 text-sm text-white/70">
          A maioria dos pedidos deve ser feita diretamente com o organizador. Se precisares de ajuda, a ORYA
          pode apoiar o contacto.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">5. Contacto</h2>
        <p className="mt-2 text-sm text-white/70">Para dúvidas sobre reembolsos, contacta {SUPPORT_EMAIL}.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-flex text-sm text-white/90 hover:text-white">
          {SUPPORT_EMAIL}
        </a>
      </section>
    </article>
  );
}
