const LAST_UPDATED = "9 de fevereiro de 2026";
const SUPPORT_EMAIL = "support@orya.pt";

export default function LegalTermsPage() {
  return (
    <article className="space-y-6">
      <header className="rounded-[28px] border border-white/12 bg-black/35 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Legal</p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Termos e Condições</h1>
        <p className="mt-2 text-sm text-white/70">Última atualização: {LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-white/70">
          Estes Termos regulam o uso da plataforma ORYA (website e aplicações). Ao aceder ou usar a ORYA,
          aceitas estes Termos.
        </p>
      </header>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">1. Conta e segurança</h2>
        <p className="mt-2 text-sm text-white/70">
          És responsável por manter a confidencialidade das tuas credenciais e por toda a atividade na tua
          conta. Informa-nos de imediato se detetares uso não autorizado.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">2. Conduta e conteúdo</h2>
        <p className="mt-2 text-sm text-white/70">
          Não é permitido usar a ORYA para fins ilegais, abusivos, ou que prejudiquem terceiros. Ao submeter
          conteúdo, confirmas que tens direito a fazê-lo e concedes uma licença não exclusiva para o
          exibirmos no serviço.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">3. Compras, reservas e pagamentos</h2>
        <p className="mt-2 text-sm text-white/70">
          Alguns serviços são prestados por organizações parceiras. Preços, disponibilidades e condições
          específicas são apresentados no checkout. Os pagamentos podem ser processados por terceiros.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">4. Cancelamentos e reembolsos</h2>
        <p className="mt-2 text-sm text-white/70">
          Políticas de cancelamento e reembolso variam por evento ou serviço. Consulta a política aplicável
          antes de concluir a compra. Para mais detalhes, visita a Política de Reembolsos.
        </p>
        <LinkInline href="/legal/reembolsos">Ver Política de Reembolsos</LinkInline>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">5. Propriedade intelectual</h2>
        <p className="mt-2 text-sm text-white/70">
          A ORYA e os seus conteúdos são protegidos por direitos de propriedade intelectual. Não é permitido
          reproduzir ou usar os nossos elementos sem autorização.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">6. Disponibilidade e limitações</h2>
        <p className="mt-2 text-sm text-white/70">
          Trabalhamos para manter o serviço disponível, mas não garantimos funcionamento ininterrupto.
          Quando permitido por lei, a nossa responsabilidade é limitada aos danos diretos comprovados.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">7. Alterações</h2>
        <p className="mt-2 text-sm text-white/70">
          Podemos atualizar estes Termos periodicamente. Se ocorrerem mudanças relevantes, faremos o esforço
          de informar através da plataforma.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">8. Contacto</h2>
        <p className="mt-2 text-sm text-white/70">
          Para questões sobre estes Termos, contacta-nos em {SUPPORT_EMAIL}.
        </p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-flex text-sm text-white/90 hover:text-white">
          {SUPPORT_EMAIL}
        </a>
      </section>
    </article>
  );
}

function LinkInline({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="mt-3 inline-flex text-sm text-white/90 hover:text-white">
      {children}
    </a>
  );
}
