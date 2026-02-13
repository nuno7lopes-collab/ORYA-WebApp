import Image from "next/image";
import Link from "next/link";

type FooterLink = { label: string; href?: string; external?: boolean };

const PRODUCT_LINKS: FooterLink[] = [
  { label: "Descobrir", href: "/descobrir" },
  { label: "Eventos", href: "/eventos" },
  { label: "Padel", href: "/padel" },
  { label: "Loja", href: "/loja" },
  { label: "Agora", href: "/agora" },
  { label: "Rede", href: "/rede" },
];

const ORG_LINKS: FooterLink[] = [
  { label: "Criar organização", href: "/org-hub/create" },
  { label: "Painel da organização", href: "/org-hub/organizations" },
  { label: "Promoções", href: "/org-hub/organizations" },
];

const ACCOUNT_LINKS: FooterLink[] = [
  { label: "Entrar", href: "/login" },
  { label: "Criar conta", href: "/signup" },
  { label: "Perfil", href: "/me" },
  { label: "Definições", href: "/me/settings" },
];

const SUPPORT_LINKS: FooterLink[] = [
  { label: "support@orya.pt", href: "mailto:support@orya.pt" },
  { label: "security@orya.pt", href: "mailto:security@orya.pt" },
];

const SOCIAL_LINKS: FooterLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/oryapt/", external: true },
  { label: "TikTok", href: "https://tiktok.com/@oryapt", external: true },
  { label: "LinkedIn (em breve)" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Termos", href: "/legal/termos" },
  { label: "Privacidade", href: "/legal/privacidade" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "Reembolsos", href: "/legal/reembolsos" },
  { label: "Termos de organização", href: "/legal/organizacao" },
];

function renderLink(item: FooterLink) {
  if (!item.href) {
    return <span className="text-white/45">{item.label}</span>;
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        className="transition hover:text-white"
      >
        {item.label}
      </a>
    );
  }

  if (item.href.startsWith("mailto:")) {
    return (
      <a href={item.href} className="transition hover:text-white">
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className="transition hover:text-white">
      {item.label}
    </Link>
  );
}

export default function HomeFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="pt-6 md:pt-2">
      <div className="relative w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(72,92,255,0.55),rgba(34,235,255,0.45),rgba(255,255,255,0.2),rgba(72,92,255,0.55),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-[linear-gradient(180deg,rgba(11,16,20,0),rgba(11,16,20,0.55))]"
        />
        <div className="relative orya-page-width px-4 md:px-8 py-7 md:py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl space-y-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/logo_icon.png"
                  alt="Logo ORYA"
                  width={52}
                  height={52}
                  sizes="52px"
                  className="h-11 w-11 object-contain"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">ORYA</p>
                  <p className="text-[18px] font-semibold text-white">O centro da tua vida social.</p>
                </div>
              </div>
              <p className="text-[13px] text-white/70">
                Eventos, padel e experiências num só lugar. Descobre, reserva e compra em segundos — com a
                tua rede sempre por perto.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white px-5 py-2 text-[12px] font-semibold text-black shadow-[0_14px_30px_rgba(0,0,0,0.45)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
                >
                  Quero a app
                </Link>
                <Link
                  href="/descobrir"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] text-white/80 transition hover:border-white/35 hover:bg-white/10"
                >
                  Explorar agora
                </Link>
              </div>
            </div>

            <div className="grid w-full gap-6 sm:grid-cols-2 lg:max-w-[620px] lg:grid-cols-3">
              <nav aria-label="Produto" className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Produto</p>
                <ul className="space-y-2 text-[13px] text-white/70">
                  {PRODUCT_LINKS.map((item) => (
                    <li key={item.label}>{renderLink(item)}</li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Organização" className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Organização</p>
                <ul className="space-y-2 text-[13px] text-white/70">
                  {ORG_LINKS.map((item) => (
                    <li key={item.label}>{renderLink(item)}</li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Suporte" className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Suporte</p>
                <ul className="space-y-2 text-[13px] text-white/70">
                  {SUPPORT_LINKS.map((item) => (
                    <li key={item.label}>{renderLink(item)}</li>
                  ))}
                </ul>
                <div className="pt-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Social</p>
                  <ul className="mt-2 space-y-2 text-[13px] text-white/70">
                    {SOCIAL_LINKS.map((item) => (
                      <li key={item.label}>{renderLink(item)}</li>
                    ))}
                  </ul>
                </div>
              </nav>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-3">
            <div className="flex flex-col gap-3 text-[12px] text-white/55 md:flex-row md:items-center md:justify-between">
              <p>© {year} ORYA. Todos os direitos reservados.</p>
              <div className="flex flex-wrap gap-4">
                {LEGAL_LINKS.map((item) => (
                  <span key={item.label} className="text-white/60">
                    {renderLink(item)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-white/55">
              <span className="text-white/45">Conta:</span>
              {ACCOUNT_LINKS.map((item) => (
                <span key={item.label} className="text-white/60">
                  {renderLink(item)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
