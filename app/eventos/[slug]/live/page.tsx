// app/eventos/[slug]/live/page.tsx
import Link from "next/link";
import EventLiveClient from "../EventLiveClient";

export default function EventLivePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>

      <section className="relative mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10">
        <div className="flex items-center justify-between">
          <Link
            href={`/eventos/${slug}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-white/70 hover:text-white"
          >
            <span className="text-lg leading-none">←</span>
            <span>Voltar ao evento</span>
          </Link>
        </div>
        <EventLiveClient slug={slug} />
      </section>
    </main>
  );
}
