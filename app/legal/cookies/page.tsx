const LAST_UPDATED = "9 de fevereiro de 2026";
const SUPPORT_EMAIL = "support@orya.pt";

export default function LegalCookiesPage() {
  return (
    <article className="space-y-6">
      <header className="rounded-[28px] border border-white/12 bg-black/35 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Legal</p>
        <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Política de Cookies</h1>
        <p className="mt-2 text-sm text-white/70">Última atualização: {LAST_UPDATED}</p>
        <p className="mt-4 text-sm text-white/70">
          Esta política explica como usamos cookies e tecnologias semelhantes na ORYA.
        </p>
      </header>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">1. O que são cookies</h2>
        <p className="mt-2 text-sm text-white/70">
          Cookies são pequenos ficheiros armazenados no teu dispositivo para lembrar preferências e melhorar
          a experiência de navegação.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">2. Tipos de cookies</h2>
        <p className="mt-2 text-sm text-white/70">
          Podemos utilizar cookies essenciais (funcionamento básico), de preferências (idioma e definições),
          analíticos (melhoria do serviço) e, quando aplicável, de marketing.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">3. Como gerir</h2>
        <p className="mt-2 text-sm text-white/70">
          Podes controlar cookies através das definições do browser. A desativação de cookies essenciais pode
          afetar o funcionamento da plataforma.
        </p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">4. Contacto</h2>
        <p className="mt-2 text-sm text-white/70">Para questões sobre cookies, contacta {SUPPORT_EMAIL}.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-flex text-sm text-white/90 hover:text-white">
          {SUPPORT_EMAIL}
        </a>
      </section>
    </article>
  );
}
