type StorefrontFooterProps = {
  storeName?: string | null;
  storePolicies?: {
    supportEmail?: string | null;
    supportPhone?: string | null;
    returnPolicy?: string | null;
    privacyPolicy?: string | null;
    termsUrl?: string | null;
  };
  className?: string;
};

export default function StorefrontFooter({ storeName, storePolicies, className }: StorefrontFooterProps) {
  const hasContent = Boolean(
    storePolicies?.supportEmail ||
      storePolicies?.supportPhone ||
      storePolicies?.returnPolicy ||
      storePolicies?.privacyPolicy ||
      storePolicies?.termsUrl,
  );

  if (!hasContent) return null;

  return (
    <footer
      className={`mt-10 rounded-3xl border border-white/12 bg-black/35 px-5 py-6 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${
        className ?? ""
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/55">Politicas & suporte</p>
          <h2 className="text-lg font-semibold text-white">
            {storeName ? `Informacoes da ${storeName}` : "Informacoes da loja"}
          </h2>
          <p className="text-sm text-white/65">
            As compras seguem as politicas abaixo. Os links estao sempre disponiveis.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-white/70">
            {storePolicies?.termsUrl ? (
              <a
                href={storePolicies.termsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
              >
                Termos e condicoes
              </a>
            ) : null}
            {storePolicies?.returnPolicy ? (
              <a
                href="#politica-devolucoes"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
              >
                Politica de devolucoes
              </a>
            ) : null}
            {storePolicies?.privacyPolicy ? (
              <a
                href="#politica-privacidade"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
              >
                Politica de privacidade
              </a>
            ) : null}
          </div>
          {(storePolicies?.supportEmail || storePolicies?.supportPhone) && (
            <div className="text-xs text-white/60">
              {storePolicies.supportEmail ? <p>Email: {storePolicies.supportEmail}</p> : null}
              {storePolicies.supportPhone ? <p>Telefone: {storePolicies.supportPhone}</p> : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {storePolicies?.returnPolicy ? (
          <section
            id="politica-devolucoes"
            className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Devolucoes</p>
            <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-white/70">
              {storePolicies.returnPolicy}
            </div>
          </section>
        ) : null}
        {storePolicies?.privacyPolicy ? (
          <section
            id="politica-privacidade"
            className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Privacidade</p>
            <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-white/70">
              {storePolicies.privacyPolicy}
            </div>
          </section>
        ) : null}
      </div>
    </footer>
  );
}
