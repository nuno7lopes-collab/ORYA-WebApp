// app/eventos/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import JoinEventButton from "./JoinEventButton";

type UITicket = {
  id: string;
  price: number;
  available: boolean;
};

type EventPageParams = {
  slug: string;
};

type EventPageProps = {
  // No Next 16, params é uma Promise
  params: Promise<EventPageParams>;
};

export default async function EventPage({ params }: EventPageProps) {
  // 👇 Desembrulhar a Promise antes de usar o slug
  const { slug } = await params;

  // Segurança extra: se por alguma razão o slug vier vazio → 404
  if (!slug) {
    console.error("EventPage: slug param em falta", await params);
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      tickets: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Datas formatadas
  const startDateObj = new Date(event.startDate);
  const endDateObj = new Date(event.endDate);

  const date = startDateObj.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const time = startDateObj.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = endDateObj.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Imagem de capa com fallback
  const cover =
    event.coverImageUrl && event.coverImageUrl.trim().length > 0
      ? event.coverImageUrl
      : "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

  // Enquanto não tens estes campos na DB, usamos 0
  const goingCount = 0;
  const interestedCount = 0;

  const tickets: UITicket[] = event.tickets.map((t) => ({
    id: t.id,
    price: t.price,
    available: t.available,
  }));

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
      {/* ========== HERO ============ */}
      <section className="relative h-[65vh] w-full flex items-end">
        <img
          src={cover}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />

        {/* GRADIENTE CINEMÁTICO */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/70 to-[#050509]" />

        <div className="relative z-10 w-full flex justify-center px-4 pb-10 md:pb-16">
          <div className="max-w-5xl w-full">
            <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-4">
              Evento ORYA · {event.locationName}
            </p>

            {/* CARTÃO VIDRO / GLASSMORPHISM */}
            <div className="inline-flex flex-col gap-4 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-2xl px-6 py-5 md:px-8 md:py-7 shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
              {/* Badges / info rápida */}
              <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-white/80">
                <span className="rounded-full bg-black/40 border border-white/25 px-3 py-1">
                  {date.charAt(0).toUpperCase() + date.slice(1)} · {time} –{" "}
                  {endTime}
                </span>
                <span className="rounded-full bg-black/40 border border-white/25 px-3 py-1">
                  {event.locationName}
                </span>
                {event.isFree ? (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 px-3 py-1">
                    Entrada gratuita
                  </span>
                ) : (
                  <span className="rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-200 px-3 py-1">
                    Desde{" "}
                    {tickets.length > 0
                      ? tickets[0].price.toFixed(2)
                      : (event.basePrice ?? 0).toFixed(2)}
                    €
                  </span>
                )}
              </div>

              {/* Título */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
                {event.title}
              </h1>

              {/* Estado / pessoas */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <span className="block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Evento ativo · {goingCount} pessoas vão</span>
                </div>
                <span className="text-white/55">
                  {interestedCount} pessoas interessadas
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CONTENT AREA ============ */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-16 grid grid-cols-1 md:grid-cols-3 gap-16">
        {/* LEFT SIDE — Info + Descrição */}
        <div className="md:col-span-2 space-y-10">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Sobre o evento</h2>
            <p className="text-white/70 leading-relaxed">
              {event.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Informações adicionais
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <span className="text-white/50">Fuso horário: </span>
                  {event.timezone}
                </li>
                <li>
                  <span className="text-white/50">Organizador: </span>
                  {event.organizerName ?? "ORYA"}
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Como funciona</h3>
              <p className="text-sm text-white/70">
                Este evento junta desporto, música e energia real. Reserva o teu
                lugar, aparece com antecedência e traz a tua melhor atitude para
                um dia competitivo, mas sempre com espírito ORYA.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — CARD DE INFORMAÇÕES / TICKETS */}
        <div className="bg-white/5 p-6 rounded-2xl backdrop-blur-2xl border border-white/10 shadow-[0_22px_50px_rgba(0,0,0,0.85)] space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">Data &amp; Hora</h3>
            <p className="text-white/70">
              {date.charAt(0).toUpperCase() + date.slice(1)} · {time} –{" "}
              {endTime}
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Local</h3>
            <p className="text-white/70">{event.locationName}</p>
            <p className="text-white/40 text-sm">{event.address}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Interesse</h3>
            <p className="text-white/70">{interestedCount} interessados</p>
            <p className="text-white/70">{goingCount} vão</p>
          </div>

          {/* BOTÃO JUNTAR-ME AO EVENTO */}
          <JoinEventButton initialGoingCount={goingCount} />

          {/* TICKETS */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <h3 className="text-xl font-semibold mb-2">Bilhetes</h3>

            {event.isFree ? (
              <span className="text-green-400 font-semibold">
                Entrada gratuita
              </span>
            ) : tickets.length === 0 ? (
              <span className="text-white/60 text-sm">
                Ainda não há bilhetes configurados.
              </span>
            ) : (
              tickets.map((t: UITicket) => (
                <button
                  key={t.id}
                  className="w-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold py-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-[#6bffff33]"
                  disabled={!t.available}
                >
                  {t.available
                    ? `Comprar — ${t.price.toFixed(2)} €`
                    : "Esgotado"}
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}