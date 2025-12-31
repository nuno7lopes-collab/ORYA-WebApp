// app/eventos/[slug]/live/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EventLiveClient from "../EventLiveClient";
import { prisma } from "@/lib/prisma";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function EventLivePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = resolved.slug;
  if (!slug) {
    notFound();
  }
  const event = await prisma.event.findUnique({ where: { slug }, select: { slug: true } });
  if (!event) {
    const normalized = slugify(slug);
    if (normalized && normalized !== slug) {
      const fallback = await prisma.event.findUnique({ where: { slug: normalized }, select: { slug: true } });
      if (fallback) {
        redirect(`/eventos/${fallback.slug}/live`);
      }
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <section className="relative orya-page-width flex flex-col gap-4 px-4 py-10">
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
