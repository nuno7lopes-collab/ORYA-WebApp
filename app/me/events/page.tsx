// app/me/events/page.tsx
"use client";

import Link from "next/link";

type MockEvent = {
  id: number;
  title: string;
  slug: string;
  date: string;
  location: string;
  status: "draft" | "published" | "finished";
  ticketsSold: number;
  ticketsTotal?: number | null;
};

const MOCK_EVENTS: MockEvent[] = [
  {
    id: 1,
    title: "ORYA Open Fly Padel",
    slug: "orya-open-fly-padel",
    date: "20 Dez 2025 • 09:00 – 19:00",
    location: "Fly Padel, Maia",
    status: "published",
    ticketsSold: 42,
    ticketsTotal: 64,
  },
  {
    id: 2,
    title: "Bandas na Arena – Póvoa",
    slug: "bandas-na-arena-povoa",
    date: "Data a anunciar",
    location: "Póvoa Arena, Póvoa de Varzim",
    status: "draft",
    ticketsSold: 0,
    ticketsTotal: null,
  },
];

function statusConfig(status: MockEvent["status"]) {
  switch (status) {
    case "draft":
      return {
        label: "Rascunho",
        className:
          "bg-yellow-500/10 border-yellow-400/60 text-yellow-100",
      };
    case "published":
      return {
        label: "Ativo",
        className:
          "bg-emerald-500/12 border-emerald-400/60 text-emerald-100",
      };
    case "finished":
      return {
        label: "Terminado",
        className:
          "bg-white/8 border-white/30 text-white/80",
      };
    default:
      return {
        label: "—",
        className:
          "bg-white/8 border-white/20 text-white/80",
      };
  }
}

export default function MyEventsPage() {
  const hasEvents = MOCK_EVENTS.length > 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
      {/* Header topo */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Meus eventos
              </p>
              <p className="text-sm text-white/85">
                Visão rápida dos eventos que crias e geres na ORYA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/me"
              className="text-[11px] text-white/70 hover:text-white/90 underline-offset-4 hover:underline"
            >
              A minha conta
            </Link>
            <Link
              href="/eventos/novo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black hover:scale-[1.03] active:scale-95 transition-transform shadow-[0_0_25px_rgba(107,255,255,0.5)]"
            >
              <span>＋</span>
              <span>Criar novo evento</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 py-8 md:py-10 space-y-6">
        {/* Bloco intro */}
        <div className="rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl p-5 md:p-6 space-y-3">
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">
            O teu painel de eventos
          </h1>
          <p className="text-[11px] md:text-sm text-white/70 max-w-2xl">
            Aqui vais conseguir acompanhar o estado dos eventos que crias:
            vendas de bilhetes, datas, locais e muito mais. Nesta fase estás
            a ver uma prévia do layout — em breve isto vai estar ligado
            diretamente à base de dados ORYA.
          </p>
        </div>

        {/* Lista de eventos (mock por enquanto) */}
        <section className="rounded-2xl border border-[#6BFFFF]/30 bg-[#02040b]/90 backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white/95">
                Eventos criados por ti
              </h2>
              <p className="text-[11px] text-white/65">
                Assim que crias eventos em /eventos/novo, eles vão aparecer
                aqui com estatísticas de vendas e estado em tempo real.
              </p>
            </div>
            <span className="px-2 py-1 rounded-full border border-white/20 bg-white/5 text-[10px] text-white/70">
              Versão inicial • Layout mock
            </span>
          </div>

          {!hasEvents && (
            <div className="mt-2 rounded-xl border border-white/12 bg-black/40 px-4 py-4 text-[11px] text-white/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-medium text-white/85">
                  Ainda não criaste nenhum evento
                </p>
                <p className="mt-1 text-white/60">
                  Quando criares o primeiro evento na ORYA, ele aparece aqui
                  automaticamente, com vendas e estado atual.
                </p>
              </div>
              <Link
                href="/eventos/novo"
                className="inline-flex px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black hover:scale-[1.03] active:scale-95 transition-transform shadow-[0_0_25px_rgba(107,255,255,0.5)]"
              >
                Criar primeiro evento
              </Link>
            </div>
          )}

          {hasEvents && (
            <div className="mt-2 space-y-3">
              {MOCK_EVENTS.map((ev) => {
                const status = statusConfig(ev.status);
                const hasCap = ev.ticketsTotal != null;

                return (
                  <article
                    key={ev.id}
                    className="rounded-xl border border-white/14 bg-gradient-to-br from-white/4 via-black/75 to-black/95 px-4 py-3.5 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-semibold text-white/95">
                          {ev.title}
                        </h3>
                        <p className="text-[11px] text-white/65">
                          {ev.date}
                          {ev.location ? ` • ${ev.location}` : ""}
                        </p>
                        <p className="text-[10px] text-white/45">
                          slug:{" "}
                          <span className="font-mono text-[10px] text-white/65">
                            {ev.slug}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`px-2 py-1 rounded-full border text-[10px] ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <Link
                          href={`/eventos/${ev.slug}`}
                          className="text-[10px] text-[#6BFFFF] hover:text-[#6BFFFF] underline underline-offset-4"
                        >
                          Ver página do evento
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/80">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/55">
                          Bilhetes vendidos:
                        </span>
                        <span className="font-semibold">
                          {ev.ticketsSold}
                          {hasCap && ev.ticketsTotal
                            ? ` / ${ev.ticketsTotal}`
                            : ""}
                        </span>
                      </div>
                      {hasCap && ev.ticketsTotal && (
                        <div className="flex-1 min-w-[120px] max-w-xs">
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (ev.ticketsSold / ev.ticketsTotal) * 100,
                                ).toFixed(1)}%`,
                              }}
                            />
                          </div>
                          <p className="mt-0.5 text-[9px] text-white/55">
                            Ocupação aproximada (mock)
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-1 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[10px] text-white/55">
                      <p>
                        Em breve aqui vais ter filtros, estatísticas por
                        wave, canais de venda e performance de promotores.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg border border-white/18 bg-white/5 text-[10px] hover:bg-white/10 transition"
                        >
                          Editar evento (em breve)
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg border border-red-500/40 bg-red-500/10 text-[10px] text-red-100 hover:bg-red-500/20 transition"
                        >
                          Gerir vendas (em breve)
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}