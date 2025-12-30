"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Se quiseres, podes enviar o erro para um serviço externo (Sentry, etc.)
    console.error("[ORYA error boundary]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-black/55 backdrop-blur-2xl px-6 py-8 md:px-8 md:py-10 shadow-[0_24px_80px_rgba(0,0,0,0.8)] space-y-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-extrabold tracking-[0.18em]">
            OR
          </span>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
              ORYA
            </p>
            <p className="text-sm text-white/80">Ups, algo correu mal.</p>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Ocorreu um erro inesperado.
          </h1>
          <p className="text-sm text-white/65">
            Isto pode ter sido causado por um problema temporário na ligação,
            por dados inválidos ou por um bug que ainda estamos a caçar. Não te
            preocupes — nada foi cobrado nem perdido sem confirmação clara.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-xs font-semibold text-black shadow-[0_0_32px_rgba(107,255,255,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            Tentar novamente
            <span className="text-[14px]">↻</span>
          </button>
          <Link
            href="/explorar"
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[11px] font-medium text-white/80 hover:bg-white/10 transition-colors"
          >
            Voltar a explorar eventos
          </Link>
        </div>

        {process.env.NODE_ENV === "development" && error?.digest && (
          <p className="text-[10px] text-white/40 text-center">
            Código do erro: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
