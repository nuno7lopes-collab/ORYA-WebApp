export default function LoadingEventPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <section className="relative z-10 w-full pb-16 pt-20 md:pb-20 md:pt-28">
        <div className="orya-page-width px-4 md:px-8">
          <div className="h-4 w-32 rounded-full bg-white/10" />
        </div>

        <div className="orya-page-width mt-6 grid grid-cols-1 gap-6 px-4 md:px-8 lg:grid-cols-[minmax(320px,0.92fr)_minmax(420px,1.08fr)]">
          <div className="relative order-1">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[34px] bg-[conic-gradient(from_120deg,rgba(107,255,255,0.4),rgba(255,0,200,0.3),rgba(22,70,245,0.4),rgba(107,255,255,0.4))] opacity-50 blur-[2px]" />
            <div className="relative aspect-square w-full overflow-hidden rounded-[32px] border border-white/15 orya-skeleton-surface shadow-[0_28px_70px_rgba(0,0,0,0.75)]" />
          </div>

          <div className="relative order-2">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[34px] bg-[linear-gradient(135deg,rgba(255,0,200,0.35),rgba(107,255,255,0.3),rgba(22,70,245,0.35))] opacity-50 blur-[2px]" />
            <div className="relative rounded-[32px] border border-white/15 orya-skeleton-surface-strong p-6 shadow-[0_28px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:p-8">
              <div className="space-y-3">
                <div className="h-10 w-5/6 rounded-full bg-white/10" />
                <div className="h-10 w-3/4 rounded-full bg-white/10" />
              </div>

              <div className="mt-6 h-3 w-24 rounded-full bg-white/10" />
              <div className="mt-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded-full bg-white/10" />
                  <div className="h-3 w-24 rounded-full bg-white/10" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="h-3 w-16 rounded-full bg-white/10" />
                  <div className="mt-2 h-4 w-48 rounded-full bg-white/10" />
                </div>
                <div>
                  <div className="h-3 w-16 rounded-full bg-white/10" />
                  <div className="mt-2 h-4 w-44 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-56 rounded-full bg-white/10" />
                </div>
              </div>

              <div className="mt-7 h-10 w-36 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </section>

      <div className="pointer-events-none relative z-10 orya-page-width px-6 md:px-10" aria-hidden="true">
        <div className="relative my-8 md:my-10">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent" />
          <div className="absolute inset-0 blur-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/25 to-transparent" />
          </div>
        </div>
      </div>

      <section className="relative z-10 orya-page-width grid grid-cols-1 gap-12 px-6 pb-28 pt-10 md:grid-cols-3 md:px-10">
        <div className="space-y-12 md:col-span-2">
          <div className="rounded-3xl border border-white/15 orya-skeleton-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8">
            <div className="h-6 w-44 rounded-full bg-white/10" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded-full bg-white/10" />
              <div className="h-4 w-11/12 rounded-full bg-white/10" />
              <div className="h-4 w-10/12 rounded-full bg-white/10" />
              <div className="h-4 w-8/12 rounded-full bg-white/10" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 orya-skeleton-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8">
            <div className="h-5 w-40 rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-56 rounded-full bg-white/10" />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`detail-skel-${idx}`} className="h-16 rounded-2xl bg-white/10" />
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-8 md:sticky md:top-28 md:self-start">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[30px] bg-[linear-gradient(135deg,rgba(255,0,200,0.3),rgba(107,255,255,0.3),rgba(22,70,245,0.3))] opacity-50 blur-[2px]" />
            <div className="relative rounded-[28px] border border-white/15 orya-skeleton-surface-strong p-7 shadow-[0_28px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="h-5 w-24 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-36 rounded-full bg-white/10" />
                </div>
                <div className="h-6 w-20 rounded-full bg-white/10" />
              </div>

              <div className="mt-5 space-y-4 border-t border-white/12 pt-5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded-full bg-white/10" />
                  <div className="h-4 w-20 rounded-full bg-white/10" />
                </div>
                <div className="h-12 w-full rounded-2xl bg-white/10" />
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
