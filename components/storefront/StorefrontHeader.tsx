import Link from "next/link";

type StorefrontHeaderProps = {
  title: string;
  subtitle?: string;
  cartHref?: string;
};

export default function StorefrontHeader({ title, subtitle, cartHref }: StorefrontHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/55">Loja</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-white/70">{subtitle}</p> : null}
      </div>
      {cartHref ? (
        <Link
          href={cartHref}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/90 px-5 py-2 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(255,255,255,0.3)] transition hover:scale-[1.01] active:scale-[0.99]"
        >
          Carrinho
        </Link>
      ) : null}
    </header>
  );
}
