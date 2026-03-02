import Link from "next/link";
import { PLATFORM_SECURITY_EMAIL, PLATFORM_SUPPORT_EMAIL } from "@/lib/platformContact";

type FooterLink = { label: string; href?: string; external?: boolean };

const SUPPORT_LINKS: FooterLink[] = [
  { label: PLATFORM_SUPPORT_EMAIL, href: `mailto:${PLATFORM_SUPPORT_EMAIL}` },
  { label: PLATFORM_SECURITY_EMAIL, href: `mailto:${PLATFORM_SECURITY_EMAIL}` },
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

function renderLink(
  item: FooterLink,
  className = "text-white/72 transition hover:text-white",
  mutedClassName = "text-white/45",
) {
  if (!item.href) {
    return <span className={mutedClassName}>{item.label}</span>;
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {item.label}
      </a>
    );
  }

  if (item.href.startsWith("mailto:")) {
    return (
      <a href={item.href} className={className}>
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

function renderSocialChip(item: FooterLink) {
  const chipClassName =
    "inline-flex items-center rounded-full border border-white/28 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/82 transition hover:border-white/50 hover:bg-white/10 hover:text-white";

  if (!item.href) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/18 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/48">
        {item.label}
      </span>
    );
  }

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer noopener" className={chipClassName}>
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={chipClassName}>
      {item.label}
    </Link>
  );
}

export default function HomeFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="-mb-[120px] pb-[120px] pt-0 md:mb-0 md:pb-0">
      <div className="relative w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(72,92,255,0.58),rgba(34,235,255,0.5),rgba(255,255,255,0.24),rgba(72,92,255,0.58),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,rgba(34,235,255,0.14),rgba(11,16,20,0))]"
        />

        <div className="relative orya-page-width px-4 pb-6 pt-6 md:px-8 md:pb-6 md:pt-7">
          <div className="grid gap-7 sm:grid-cols-2 lg:gap-8">
            <nav aria-label="Suporte" className="space-y-3">
              <p className="text-[18px] font-semibold tracking-[0.02em] text-white/95">Suporte</p>
              <ul className="space-y-1.5 text-[14px]">
                {SUPPORT_LINKS.map((item) => (
                  <li key={item.label}>{renderLink(item, "text-white/72 transition hover:text-white underline-offset-2 hover:underline")}</li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Legal" className="space-y-3">
              <p className="text-[18px] font-semibold tracking-[0.02em] text-white/95">Legal</p>
              <ul className="space-y-1.5 text-[14px]">
                {LEGAL_LINKS.map((item) => (
                  <li key={item.label}>{renderLink(item)}</li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="h-px w-full bg-white/22" />

        <div className="orya-page-width px-4 pb-6 pt-4 md:px-8 md:pb-6 md:pt-4">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[16px] font-semibold text-white/95">Segue-nos</p>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_LINKS.map((item) => (
                  <span key={item.label}>{renderSocialChip(item)}</span>
                ))}
              </div>
            </div>
            <p className="text-[12px] text-white/62">© {year} ORYA. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
