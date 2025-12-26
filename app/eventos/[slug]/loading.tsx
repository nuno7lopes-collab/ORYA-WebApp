export default function LoadingEventPage() {
  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[26vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>

      <section className="relative z-10 w-full pb-16 pt-20 md:pb-20 md:pt-28">
        <div className="orya-page-width flex items-center justify-between px-4 md:px-8">
          <div className="h-4 w-32 rounded-full bg-white/10" />
          <div className="hidden h-6 w-44 rounded-full bg-white/10 sm:block" />
        </div>

        <div className="orya-page-width mt-6 grid grid-cols-1 gap-6 px-4 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[34px] bg-[linear-gradient(135deg,rgba(255,0,200,0.35),rgba(107,255,255,0.3),rgba(22,70,245,0.35))] opacity-50 blur-[2px]" />
            <div className="relative rounded-[32px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(3,7,18,0.85))] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-3 w-28 rounded-full bg-white/10" />
                <div className="h-3 w-3 rounded-full bg-white/10" />
                <div className="h-3 w-20 rounded-full bg-white/10" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="h-6 w-44 rounded-full bg-white/10" />
                <div className="h-6 w-28 rounded-full bg-white/10" />
                <div className="h-6 w-24 rounded-full bg-white/10" />
              </div>

              <div className="mt-6 space-y-3">
                <div className="h-9 w-4/5 rounded-full bg-white/10" />
                <div className="h-9 w-2/3 rounded-full bg-white/10" />
              </div>

              <div className="mt-4 space-y-2">
                <div className="h-4 w-full rounded-full bg-white/10" />
                <div className="h-4 w-5/6 rounded-full bg-white/10" />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="h-10 w-32 rounded-full bg-white/20" />
                <div className="h-10 w-28 rounded-full bg-white/10" />
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[34px] bg-[conic-gradient(from_120deg,rgba(107,255,255,0.4),rgba(255,0,200,0.3),rgba(22,70,245,0.4),rgba(107,255,255,0.4))] opacity-50 blur-[2px]" />
            <div className="relative min-h-[320px] h-full overflow-hidden rounded-[32px] border border-white/15 bg-white/5 shadow-[0_28px_70px_rgba(0,0,0,0.75)] flex flex-col">
              <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
              <div className="relative mt-auto px-6 pb-6">
                <div className="h-3 w-24 rounded-full bg-white/10" />
                <div className="mt-3 h-8 w-full rounded-2xl bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        <div className="orya-page-width mt-6 px-4 md:px-8">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur">
              <div className="h-3 w-16 rounded-full bg-white/10" />
              <div className="mt-3 h-4 w-32 rounded-full bg-white/10" />
              <div className="mt-2 h-3 w-24 rounded-full bg-white/10" />
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur">
              <div className="h-3 w-16 rounded-full bg-white/10" />
              <div className="mt-3 h-4 w-32 rounded-full bg-white/10" />
              <div className="mt-2 h-3 w-24 rounded-full bg-white/10" />
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur">
              <div className="h-3 w-16 rounded-full bg-white/10" />
              <div className="mt-3 h-4 w-24 rounded-full bg-white/10" />
              <div className="mt-2 h-3 w-28 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      <div className="pointer-events-none relative z-10 orya-page-width px-6 md:px-10" aria-hidden="true">
        <div className="relative my-10 md:my-12">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 blur-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/30 to-transparent" />
          </div>
        </div>
      </div>

      <section className="relative z-10 orya-page-width grid grid-cols-1 gap-12 px-6 pb-28 pt-10 md:grid-cols-3 md:px-10">
        <div className="space-y-12 md:col-span-2">
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8">
            <div className="h-3 w-24 rounded-full bg-white/10" />
            <div className="mt-4 h-6 w-40 rounded-full bg-white/10" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded-full bg-white/10" />
              <div className="h-4 w-5/6 rounded-full bg-white/10" />
              <div className="h-4 w-2/3 rounded-full bg-white/10" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 w-32 rounded-full bg-white/10" />
                <div className="mt-2 h-3 w-44 rounded-full bg-white/10" />
              </div>
              <div className="h-6 w-24 rounded-full bg-white/10" />
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`detail-skel-${idx}`}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4"
                >
                  <div className="h-3 w-20 rounded-full bg-white/10" />
                  <div className="mt-3 h-4 w-32 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-24 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-8 md:sticky md:top-28 md:self-start">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[30px] bg-[linear-gradient(135deg,rgba(255,0,200,0.3),rgba(107,255,255,0.3),rgba(22,70,245,0.3))] opacity-50 blur-[2px]" />
            <div className="relative rounded-[28px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.85))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="h-5 w-24 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-36 rounded-full bg-white/10" />
                </div>
                <div className="h-6 w-20 rounded-full bg-white/10" />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="h-3 w-12 rounded-full bg-white/10" />
                  <div className="mt-3 h-4 w-28 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-20 rounded-full bg-white/10" />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="h-3 w-12 rounded-full bg-white/10" />
                  <div className="mt-3 h-4 w-28 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-20 rounded-full bg-white/10" />
                </div>
              </div>

              <div className="mt-4 space-y-4 border-t border-white/12 pt-5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded-full bg-white/10" />
                  <div className="h-4 w-20 rounded-full bg-white/10" />
                </div>
                <div className="h-12 w-full rounded-2xl bg-white/10" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 w-12 rounded-full bg-white/10" />
                <div className="mt-2 h-4 w-28 rounded-full bg-white/10" />
              </div>
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`padel-skel-${idx}`} className="h-16 rounded-xl bg-white/10" />
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-[13px] md:grid-cols-2">
              <div className="h-24 rounded-xl bg-white/10" />
              <div className="h-24 rounded-xl bg-white/10" />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
