// app/eventos/[slug]/live/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import EventLiveClient from "../EventLiveClient";
import { prisma } from "@/lib/prisma";
import { resolveLocale, t } from "@/lib/i18n";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function EventLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
  }) {
    const resolved = await params;
    const slug = resolved.slug;
    const headersList = await headers();
    const langParam =
      typeof searchParams?.lang === "string"
        ? searchParams.lang
        : Array.isArray(searchParams?.lang)
          ? searchParams?.lang?.[0]
        : null;
  const acceptLanguage = headersList.get("accept-language");
  const locale = resolveLocale(langParam ?? (acceptLanguage ? acceptLanguage.split(",")[0] : null));
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
            <span>{t("backToEvent", locale)}</span>
          </Link>
        </div>
        <EventLiveClient slug={slug} locale={locale} />
      </section>
    </main>
  );
}
