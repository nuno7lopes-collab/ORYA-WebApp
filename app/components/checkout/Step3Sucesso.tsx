"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "./contextoCheckout";
import { formatMoney } from "@/lib/money";

export default function Step3Sucesso() {
  const { dados, fecharCheckout } = useCheckout();
  const router = useRouter();

  useEffect(() => {
    if (dados && !dados.additional?.paymentIntentId) {
      router.replace("/explorar");
    }
  }, [dados, router]);

  // Revalidar bilhetes após sucesso (traz novos bilhetes mais depressa)
  useEffect(() => {
    async function revalidateTickets() {
      try {
        await fetch("/api/me/tickets", { method: "GET", cache: "no-store" });
      } catch (err) {
        console.warn("[Step3Sucesso] Falha ao revalidar /api/me/tickets", err);
      }
    }
    revalidateTickets();
  }, []);

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

  const guestEmail =
    dados.additional &&
    typeof dados.additional === "object" &&
    typeof dados.additional.guestEmail === "string"
      ? dados.additional.guestEmail
      : null;

  const breakdown = (() => {
    if (!dados.additional || typeof dados.additional !== "object") return null;
    const subtotalCents = Number(dados.additional.subtotalCents ?? 0);
    const discountCents = Number(dados.additional.discountCents ?? 0);
    const platformFeeCents = Number(dados.additional.platformFeeCents ?? 0);
    const totalCents = Number(
      dados.additional.totalCents ?? dados.additional.total ?? 0,
    );
    const code =
      typeof dados.additional.promoCodeRaw === "string"
        ? dados.additional.promoCodeRaw
        : typeof dados.additional.promoCode === "string"
          ? dados.additional.promoCode
          : null;
    return {
      subtotalCents,
      discountCents,
      platformFeeCents,
      totalCents,
      code,
    };
  })();

  return (
    <div className="flex flex-col items-center text-center gap-8 py-6 px-4 text-white">

      {/* Título */}
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
          Compra Confirmada 🎉
        </h2>
        <p className="text-sm text-white/70">
          {guestEmail
            ? `Obrigado! Enviámos os teus bilhetes para ${guestEmail}.`
            : "A tua compra foi processada com sucesso."}
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

        {/* Breakdown */}
        {breakdown && (
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-white/60 text-[11px] uppercase tracking-widest">Total dos bilhetes</span>
              <span className="font-semibold">{formatMoney(breakdown.subtotalCents, "EUR")}</span>
            </div>
            {breakdown.discountCents > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-white/60">Desconto {breakdown.code ? `(${breakdown.code})` : ""}</span>
                <span className="text-emerald-300">-{formatMoney(breakdown.discountCents, "EUR")}</span>
              </div>
            )}
            {breakdown.platformFeeCents > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-white/60">Taxa da plataforma</span>
                <span className="text-orange-200">{formatMoney(breakdown.platformFeeCents, "EUR")}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-white text-[12px] font-semibold uppercase tracking-widest">Total Pago</span>
              <span className="text-xl font-semibold">
                {formatMoney(breakdown.totalCents, "EUR")}
              </span>
            </div>
          </div>
        )}

        {/* Info */}
        <p className="text-white/60 text-sm">
          {guestEmail
            ? "Guarda o email com os bilhetes. Podes criar conta e ligar estes bilhetes mais tarde."
            : "A tua compra foi concluída com sucesso."}
        </p>

        {/* Botão ver bilhetes */}
        <button
          onClick={() => (guestEmail ? router.push("/login") : router.push("/me"))}
          className="w-full rounded-full bg-white text-black py-3 text-sm font-semibold shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:scale-[1.03] active:scale-95 transition-transform"
        >
          {guestEmail ? "Criar conta e ligar bilhetes" : "Ver os teus bilhetes"}
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
