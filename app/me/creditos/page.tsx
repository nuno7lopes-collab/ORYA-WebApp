"use client";

import Link from "next/link";

const pageClass = "min-h-screen w-full text-white";

const cardClass =
  "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

export default function MeCreditosPage() {
  return (
    <main className={pageClass}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Fidelização</p>
          <h1 className="text-3xl font-semibold text-white">Pontos e benefícios</h1>
          <p className="text-sm text-white/65">Sem carteira monetária.</p>
        </div>

        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">A voltar numa fase futura</h2>
              <p className="text-sm text-white/65">
                As reservas continuam com pagamento direto do horário. Aqui vamos mostrar pontos e benefícios.
              </p>
            </div>
            <Link href="/descobrir/reservas" className="text-[12px] text-[#6BFFFF]">
              Explorar serviços
            </Link>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Quando os programas de fidelização estiverem ativos, verás aqui o teu histórico de pontos.
          </div>
        </section>
      </div>
    </main>
  );
}
