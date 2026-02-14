import { PLATFORM_SUPPORT_EMAIL } from "@/lib/platformContact";

const LAST_UPDATED = "9 de fevereiro de 2026";
const SUPPORT_EMAIL = PLATFORM_SUPPORT_EMAIL;

export default function LegalPrivacyPage() {
  return (
    <article className="space-y-6">
      <header className="rounded-[28px] border border-white/12 bg-black/35 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Legal</p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-white/70">Última atualização: {LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-white/70">
          Esta política explica como recolhemos, usamos e protegemos os teus dados quando utilizas a ORYA.
        </p>
      </header>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">1. Dados que recolhemos</h2>
        <p className="mt-2 text-sm text-white/70">
          Podemos recolher dados de conta (email, username), perfil (nome, fotografia), utilização (interações
          na plataforma), transações (reservas, compras) e comunicações contigo.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">2. Como usamos os dados</h2>
        <p className="mt-2 text-sm text-white/70">
          Usamos os dados para fornecer o serviço, processar transações, garantir segurança, personalizar a
          experiência, cumprir obrigações legais e prestar suporte.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">3. Partilha com terceiros</h2>
        <p className="mt-2 text-sm text-white/70">
          Podemos partilhar dados com organizações parceiras quando participas em eventos ou compras, bem
          como com fornecedores que prestam serviços essenciais (pagamentos, email, infraestrutura). Nunca
          vendemos os teus dados.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">4. Retenção</h2>
        <p className="mt-2 text-sm text-white/70">
          Mantemos os dados apenas pelo tempo necessário para os fins descritos ou conforme exigido por lei.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">5. Os teus direitos</h2>
        <p className="mt-2 text-sm text-white/70">
          Podes pedir acesso, retificação, eliminação ou portabilidade dos teus dados, conforme a legislação
          aplicável. Para exercer estes direitos, contacta-nos.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">6. Segurança</h2>
        <p className="mt-2 text-sm text-white/70">
          Implementamos medidas técnicas e organizativas para proteger os dados. Apesar disso, nenhum
          sistema é 100% invulnerável.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">7. Contacto</h2>
        <p className="mt-2 text-sm text-white/70">Para questões de privacidade, contacta {SUPPORT_EMAIL}.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-flex text-sm text-white/90 hover:text-white">
          {SUPPORT_EMAIL}
        </a>
      </section>
    </article>
  );
}
