export const runtime = "nodejs";

import Link from "next/link";

export default function EmBrevePage() {
  return (
    <div className="min-h-screen bg-[#060711] text-white flex items-center justify-center px-4">
      <div className="orya-page-width flex justify-center">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] text-center space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">ORYA</p>
          <h1 className="text-2xl font-semibold">Em breve</h1>
          <p className="text-sm text-white/70">
            Esta área está temporariamente disponível apenas para administradores. Estamos a preparar a melhor
            evento para ti.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/explorar"
              className="w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(107,255,255,0.22)] transition hover:brightness-110"
            >
              Voltar a explorar eventos
            </Link>
            <Link
              href="/"
              className="w-full rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Ir para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
