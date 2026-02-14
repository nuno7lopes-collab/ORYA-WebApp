import { PLATFORM_SUPPORT_EMAIL } from "@/lib/platformContact";

const LAST_UPDATED = "9 de fevereiro de 2026";
const SUPPORT_EMAIL = PLATFORM_SUPPORT_EMAIL;

export default function LegalOrganizationPage() {
  return (
    <article className="space-y-6">
      <header className="rounded-[28px] border border-white/12 bg-black/35 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Legal</p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Termos da Organização</h1>
        <p className="mt-2 text-sm text-white/70">Última atualização: {LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-white/70">
          Estes termos aplicam-se a organizações e entidades que utilizam a ORYA para publicar eventos,
          reservas, serviços ou vendas.
        </p>
      </header>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">1. Responsabilidades da organização</h2>
        <p className="mt-2 text-sm text-white/70">
          A organização é responsável pela exatidão das informações publicadas, pela execução dos serviços
          prometidos e pelo cumprimento de obrigações legais e fiscais aplicáveis.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">2. Conteúdo e comunicação</h2>
        <p className="mt-2 text-sm text-white/70">
          Ao publicar conteúdos na ORYA, garantis que tens direitos para os utilizar. A ORYA pode apresentar
          esses conteúdos para promover o serviço e facilitar a descoberta.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">3. Pagamentos e reembolsos</h2>
        <p className="mt-2 text-sm text-white/70">
          As políticas de preços, cancelamentos e reembolsos são definidas pela organização e devem estar
          claras no checkout. A ORYA pode intermediar o processamento de pagamentos.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">4. Suspensão e conformidade</h2>
        <p className="mt-2 text-sm text-white/70">
          A ORYA pode suspender conteúdos ou contas em caso de violação destes termos, risco para utilizadores
          ou incumprimento legal.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">5. Contacto</h2>
        <p className="mt-2 text-sm text-white/70">Para questões de organização, contacta {SUPPORT_EMAIL}.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-flex text-sm text-white/90 hover:text-white">
          {SUPPORT_EMAIL}
        </a>
      </section>
    </article>
  );
}
