import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { mapEventToCardDTO, type EventCardDTO } from "@/lib/events";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildEventLink(event: EventCardDTO) {
  return event.type === "EXPERIENCE" ? `/experiencias/${event.slug}` : `/eventos/${event.slug}`;
}

function formatDateLabel(event: EventCardDTO) {
  if (!event.startsAt) return "Data a anunciar";
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  const day = start.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const startTime = start.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime =
    end &&
    end.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (endTime) {
    return `${day} · ${startTime} – ${endTime}`;
  }
  return `${day} · ${startTime}`;
}

function formatPriceLabel(event: EventCardDTO) {
  if (event.isFree) return "Entrada gratuita";
  if (event.priceFrom == null) return "Preço a anunciar";
  const formatted = event.priceFrom.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Desde ${formatted} €`;
}

export default async function HomePage() {
  const eventsRaw = await prisma.event.findMany({
    where: { status: "PUBLISHED", isTest: false },
    orderBy: { startsAt: "asc" },
    include: {
      ticketTypes: {
        orderBy: { sortOrder: "asc" },
      },
    },
    take: 12,
  });

  const events: EventCardDTO[] = eventsRaw
    .map(mapEventToCardDTO)
    .filter((e): e is EventCardDTO => e !== null);

  const spotlight = events[0] ?? null;
  const spotlightCover = spotlight
    ? optimizeImageUrl(spotlight.coverImageUrl, 1400, 70, "webp")
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050915] to-[#080b12] text-white pb-28 md:pb-8">
      <section className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">ORYA</h1>
          <Link
            href="/explorar"
            className="text-[12px] text-[#6BFFFF] underline underline-offset-4"
          >
            Explorar
          </Link>
        </div>

        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0B1229] via-[#0A0E1A] to-[#05060f] shadow-[0_24px_70px_rgba(15,23,42,0.85)]">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Em alta agora</h2>
            <Link href="/explorar" className="text-[11px] text-[#6BFFFF]">
              Ver tudo
            </Link>
          </div>

          <div className="mx-3 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {spotlight ? (
              <>
                <div className="relative h-44 w-full overflow-hidden">
                  {spotlightCover ? (
                    <Image
                      src={spotlightCover}
                      alt={spotlight.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                      priority
                      className="object-cover transition-transform duration-500"
                      placeholder="blur"
                      blurDataURL={defaultBlurDataURL}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,0,200,0.35),transparent_25%),radial-gradient(circle_at_80%_20%,rgba(107,255,255,0.3),transparent_30%),linear-gradient(135deg,#0b1224_0%,#050915_60%)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />

                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-50">
                        {spotlight.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-200">
                        {formatDateLabel(spotlight)}
                      </p>
                    </div>
                    <p className="rounded-full bg-black/75 px-3 py-1 text-[11px] font-medium text-zinc-50">
                      {formatPriceLabel(spotlight)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 px-4 pb-4 pt-3">
                  <p className="text-xs text-zinc-300">
                    Evento em destaque. Abre para veres todos os detalhes.
                  </p>
                  <Link
                    href={buildEventLink(spotlight)}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-[#6bffff80] hover:brightness-110"
                  >
                    Abrir página do evento
                  </Link>
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-sm text-zinc-200">
                Ainda não tens eventos criados.
                <br />
                <Link
                  href="/organizador/(dashboard)/eventos/novo"
                  className="mt-2 inline-flex text-[13px] font-medium text-[#6BFFFF] underline underline-offset-4"
                >
                  Cria o teu primeiro evento →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/25 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Os teus eventos</h2>
            <Link href="/explorar" className="text-[11px] text-[#6BFFFF]">
              Ver mais
            </Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            Ainda não tens eventos. Explora e junta-te a um evento para aparecer aqui.
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sugestões personalizadas</h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            Ainda estamos a conhecer-te. À medida que usares a ORYA, as sugestões vão aparecer aqui.
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Oportunidades perto de ti agora</h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            Sem oportunidades perto de ti neste momento. Vais ser o primeiro a saber quando surgir
            algo porreiro.
          </div>
        </div>

        <div className="space-y-2 rounded-3xl border border-white/10 bg-black/25 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)]">
          <h2 className="text-sm font-semibold">Amigos vão a…</h2>
          <p className="text-sm text-zinc-300">
            Quando os teus amigos começarem a ir a eventos, vais ver aqui onde eles vão.
          </p>
        </div>
      </section>
    </main>
  );
}
