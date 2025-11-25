"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "./contextoCheckout";

export default function Step3Sucesso() {
  const { dados, fecharCheckout } = useCheckout();
  const router = useRouter();

  useEffect(() => {
    if (dados && !dados.additional?.paymentIntentId) {
      router.replace("/explorar");
    }
  }, [dados, router]);

  if (!dados) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-black">Algo correu mal 🤔</h2>
        <p className="text-sm text-black/70">
          Não encontrámos os dados do bilhete. Fecha esta janela e tenta novamente.
        </p>
        <button
          onClick={fecharCheckout}
          className="mt-4 w-full rounded-xl bg-black text-white py-2 text-sm font-medium hover:bg-black/80"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (!dados.additional?.paymentIntentId) {
    return null;
  }

  return (
    <div className="flex flex-col items-center text-center gap-8 py-6 px-4 text-white">

      {/* Título */}
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
          Compra Confirmada 🎉
        </h2>
        <p className="text-sm text-white/70">
          A tua compra foi processada com sucesso.
        </p>
      </div>

      {/* Card principal estilo Apple Wallet */}
      <div className="w-full rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 px-6 py-8 shadow-[0_0_40px_rgba(0,0,0,0.45)] space-y-6">

        {/* Evento */}
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-white/50">Evento</p>
          <p className="text-xl font-semibold">
            {dados.ticketName ?? "Bilhete"}
          </p>
        </div>

        {/* Total Pago */}
        {dados.additional?.total !== undefined && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-white/50">Total Pago</p>
            <p className="text-xl font-semibold">
              {Number(dados.additional.total).toFixed(2)} €
            </p>
          </div>
        )}

        {/* Info */}
        <p className="text-white/60 text-sm">
          A tua compra foi concluída com sucesso.
        </p>

        {/* Botão ver bilhetes */}
        <button
          onClick={() => router.push("/me")}
          className="w-full rounded-full bg-white text-black py-3 text-sm font-semibold shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:scale-[1.03] active:scale-95 transition-transform"
        >
          Ver os teus bilhetes
        </button>
      </div>

      {/* Fechar */}
      <button
        onClick={fecharCheckout}
        className="w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold py-2.5 text-sm shadow-[0_0_25px_rgba(107,255,255,0.45)] hover:scale-[1.02] active:scale-95 transition-transform"
      >
        Fechar
      </button>
    </div>
  );
}