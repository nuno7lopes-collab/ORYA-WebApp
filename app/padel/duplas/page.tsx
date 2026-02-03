import Link from "next/link";
import PadelOpenPairingsClient from "./PadelOpenPairingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PadelDuplasPage() {
  return (
    <main className="min-h-screen bg-[#0b0f1d] text-white">
      <section className="orya-page-width px-6 pb-8 pt-12 md:px-10">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Duplas abertas</p>
              <h1 className="text-3xl font-semibold">Encontra o parceiro ideal</h1>
              <p className="text-sm text-white/70">
                Lista pública de inscrições abertas com vagas para completar duplas.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                <Link
                  href="/descobrir?tab=torneios"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  Descobrir torneios
                </Link>
                <Link
                  href="/padel/rankings"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  Ranking global
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-[11px] text-white/65">
              <p className="uppercase tracking-[0.2em] text-white/50">Como funciona</p>
              <p className="mt-2 text-sm text-white/80">
                Seleciona uma dupla aberta e completa a inscrição no torneio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="orya-page-width px-6 pb-16 md:px-10">
        <PadelOpenPairingsClient />
      </section>
    </main>
  );
}
