import Link from "next/link";

type StorefrontHeaderProps = {
  title: string;
  subtitle?: string;
  cartHref?: string;
};

export default function StorefrontHeader({ title, subtitle, cartHref }: StorefrontHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#111a33]/75 to-[#080e18]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 -top-8 h-32 w-32 rounded-full bg-[#6BFFFF]/15 blur-[90px]" />
        <div className="absolute -right-8 top-6 h-28 w-28 rounded-full bg-[#FF7AD1]/15 blur-[90px]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/8 to-transparent" />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-2xl space-y-2">
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Loja</p>
          <h1 className="text-3xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
        </div>
        {cartHref ? (
          <Link
            href={cartHref}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-5 py-2 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(255,255,255,0.3)] transition hover:scale-[1.01] active:scale-[0.99]"
          >
            Carrinho
          </Link>
        ) : null}
      </div>
    </header>
  );
}
