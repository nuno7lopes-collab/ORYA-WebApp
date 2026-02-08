type ExploreWorld = "EVENTOS" | "PADEL" | "RESERVAS";

type ExplorarSkeletonProps = {
  initialWorld?: ExploreWorld;
  showTopBar?: boolean;
};

const WORLD_META: Record<ExploreWorld, { title: string; subtitle: string }> = {
  EVENTOS: {
    title: "Eventos",
    subtitle: "A preparar destaques, categorias e eventos para ti.",
  },
  PADEL: {
    title: "Torneios",
    subtitle: "A preparar torneios, clubes e jogos comunitários.",
  },
  RESERVAS: {
    title: "Reservas",
    subtitle: "A preparar serviços e reservas com horários disponíveis.",
  },
};

export default function ExplorarSkeleton({
  initialWorld = "EVENTOS",
  showTopBar = true,
}: ExplorarSkeletonProps) {
  const meta = WORLD_META[initialWorld];

  return (
    <main className="min-h-screen text-white">
      {showTopBar ? (
        <div className="sticky top-0 z-40 md:hidden">
          <div className="orya-mobile-topbar px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-white/10 animate-pulse" />
                <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
                <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="orya-page-width px-4 md:px-8 pt-10 pb-12 space-y-6">
        <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Explorar</p>
          <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{meta.title}</h1>
          <p className="mt-2 text-sm text-white/60">{meta.subtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square w-full rounded-2xl border border-white/10 orya-skeleton-surface animate-pulse"
            />
          ))}
        </div>
      </section>
    </main>
  );
}
