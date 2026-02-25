export default function LoadingEventPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <section className="relative z-10 w-full pb-10 pt-12 md:pb-12 md:pt-16">
        <div className="orya-page-width grid grid-cols-1 gap-6 px-4 md:grid-cols-[minmax(300px,0.76fr)_minmax(0,1.24fr)] md:items-start md:gap-8 md:px-8 lg:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.28fr)]">
          <div className="relative order-1 mx-auto w-full max-w-[430px] md:mx-0 md:max-w-none md:self-start">
            <div className="relative aspect-square w-full overflow-hidden rounded-[30px] border border-white/15 orya-skeleton-surface shadow-[0_26px_64px_rgba(0,0,0,0.72)] md:aspect-[4/5] lg:aspect-square" />
          </div>

          <div className="relative order-2 max-w-4xl md:pt-1">
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="h-12 w-5/6 rounded-full bg-white/10" />
                <div className="h-12 w-3/4 rounded-full bg-white/10" />
              </div>

              <div className="h-6 w-64 rounded-full bg-white/10" />
              <div className="h-6 w-72 rounded-full bg-white/10" />

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="h-6 w-32 rounded-full bg-white/12" />
                <div className="h-6 w-24 rounded-full bg-white/12" />
              </div>

              <div className="h-14 rounded-2xl border border-white/12 bg-white/8" />

              <div className="space-y-2">
                <div className="h-4 w-full rounded-full bg-white/10" />
                <div className="h-4 w-11/12 rounded-full bg-white/10" />
                <div className="h-4 w-9/12 rounded-full bg-white/10" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-36 rounded-full bg-white/18" />
                <div className="h-10 w-28 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="pointer-events-none relative z-10 orya-page-width px-6 md:px-10" aria-hidden="true">
        <div className="relative my-7 md:my-9">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent" />
          <div className="absolute inset-0 blur-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/25 to-transparent" />
          </div>
        </div>
      </div>

      <section className="relative z-10 orya-page-width grid grid-cols-1 gap-12 px-6 pb-24 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(290px,0.44fr)] md:gap-12 md:px-10">
        <div className="space-y-12">
          <div className="border-t border-white/14 pt-7">
            <div className="h-8 w-44 rounded-full bg-white/10" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded-full bg-white/10" />
              <div className="h-4 w-11/12 rounded-full bg-white/10" />
              <div className="h-4 w-10/12 rounded-full bg-white/10" />
              <div className="h-4 w-8/12 rounded-full bg-white/10" />
            </div>
          </div>

          <div className="border-t border-white/14 pt-7">
            <div className="h-8 w-52 rounded-full bg-white/10" />
            <div className="mt-3 h-4 w-64 rounded-full bg-white/10" />
            <div className="mt-3 h-4 w-72 rounded-full bg-white/10" />
          </div>
        </div>

        <aside className="space-y-8 md:sticky md:top-28 md:self-start">
          <div className="border-t border-white/16 pt-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="h-6 w-28 rounded-full bg-white/10" />
                <div className="mt-2 h-3 w-36 rounded-full bg-white/10" />
              </div>
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>

            <div className="mt-5 space-y-4 border-y border-white/12 py-4">
              <div className="h-12 w-full rounded-lg bg-white/8" />
              <div className="h-12 w-full rounded-lg bg-white/8" />
              <div className="h-12 w-full rounded-lg bg-white/8" />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
