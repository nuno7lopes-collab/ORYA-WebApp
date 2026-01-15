import Link from "next/link";
import { PadelIcon, PuzzleIcon, TicketIcon } from "./_components/WorldIcons";

const worldCards = [
  {
    href: "/explorar/eventos",
    icon: TicketIcon,
    title: "Eventos",
    desc: "Concertos, festas, talks e experiências na tua cidade.",
    accent: "from-[#FF5EDB] via-[#9B8CFF] to-[#2E55FF]",
  },
  {
    href: "/explorar/torneios",
    icon: PadelIcon,
    title: "Torneios",
    desc: "Competições de padel com formatos, níveis e clubes premium.",
    accent: "from-[#6BFFFF] via-[#4ADE80] to-[#1E40AF]",
  },
  {
    href: "/explorar/reservas",
    icon: PuzzleIcon,
    title: "Reservas",
    desc: "Serviços prontos a reservar com horários e preços claros.",
    accent: "from-[#FCD34D] via-[#FB923C] to-[#F97316]",
  },
];

export default function ExplorarLandingPage() {
  return (
    <main className="min-h-screen w-full text-white">
      <section className="orya-page-width px-6 md:px-10 py-10 md:py-14 space-y-10">
        <header className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Explorar</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Escolhe o teu mundo
          </h1>
          <p className="max-w-2xl text-sm text-white/60">
            Cada mundo tem filtros dedicados e uma experiência desenhada para aquilo que procuras.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {worldCards.map((card) => {
            const Icon = card.icon;
            return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-3xl border border-white/12 bg-gradient-to-br from-white/6 via-black/20 to-black/40 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-[6px] hover:border-white/25"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  <Icon className="h-6 w-6" />
                </span>
                <span
                  className={`h-2 w-16 rounded-full bg-gradient-to-r ${card.accent} shadow-[0_0_16px_rgba(255,255,255,0.3)]`}
                />
              </div>
              <div className="mt-6 space-y-2">
                <h2 className="text-lg font-semibold text-white group-hover:text-white">
                  {card.title}
                </h2>
                <p className="text-sm text-white/60">{card.desc}</p>
              </div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.24em] text-white/45">
                Entrar →
              </div>
            </Link>
          );
        })}
        </div>
      </section>
    </main>
  );
}
