import Link from "next/link";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

export default function NotFound() {
  return (
    <main className="min-h-screen text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-black/50 backdrop-blur-2xl px-6 py-8 md:px-8 md:py-10 shadow-[0_24px_80px_rgba(0,0,0,0.75)] space-y-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-extrabold tracking-[0.18em]">
            OR
          </span>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
              ORYA
            </p>
            <p className="text-sm text-white/80">
              Página não encontrada
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Não encontrámos nada aqui.
          </h1>
          <p className="text-sm text-white/65">
            A página que procuraste pode ter mudado, deixado de existir ou o
            link pode estar incorreto. Mas a cidade continua cheia de eventos
            à tua espera.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/explorar/eventos"
            className={`${CTA_PRIMARY} w-full justify-center px-4 py-2.5 text-xs active:scale-95`}
          >
            Voltar a explorar eventos
            <span className="text-[14px]">↻</span>
          </Link>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[11px] font-medium text-white/80 hover:bg-white/10 transition-colors"
          >
            Ir para a página inicial
          </Link>
        </div>

        <p className="text-[10px] text-white/45 text-center">
          Se achares que isto é um erro, tenta voltar atrás ou usar a pesquisa
          na página inicial para encontrares o evento certo.
        </p>
      </div>
    </main>
  );
}
