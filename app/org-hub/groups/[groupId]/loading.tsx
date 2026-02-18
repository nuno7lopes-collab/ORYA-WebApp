export default function GroupDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-white md:px-6 md:py-12 lg:px-8">
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <div className="h-6 w-40 rounded-full bg-white/10" />
          <div className="mt-4 h-8 w-80 rounded-xl bg-white/10" />
          <div className="mt-2 h-4 w-96 rounded-xl bg-white/5" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-2xl border border-white/10 bg-white/5" />
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <div className="h-5 w-40 rounded-xl bg-white/10" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-2xl border border-white/10 bg-white/5" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
