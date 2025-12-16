"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "./contextoCheckout";
import { formatMoney } from "@/lib/money";
import { useState } from "react";

const scenarioCopy: Record<string, string> = {
  GROUP_SPLIT: "Pagaste apenas a tua parte desta dupla.",
  GROUP_FULL: "Pagaste 2 lugares (tu + parceiro).",
  RESALE: "Compra de bilhete em revenda.",
  FREE_CHECKOUT: "Inscrição gratuita concluída.",
};

export default function Step3Sucesso() {
  const { dados, fecharCheckout, breakdown: checkoutBreakdown } = useCheckout();
  const router = useRouter();
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (dados && !dados.additional?.paymentIntentId && !dados.additional?.purchaseId) {
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

  const guestEmail =
    dados?.additional &&
    typeof dados.additional === "object" &&
    typeof dados.additional.guestEmail === "string"
      ? dados.additional.guestEmail
      : null;

  const breakdown = (() => {
    const additional =
      dados.additional && typeof dados.additional === "object" ? dados.additional : {};
    const subtotalCentsRaw =
      checkoutBreakdown?.subtotalCents ??
      Number(additional.subtotalCents ?? additional.totalCents ?? additional.total ?? 0);
    const subtotalFromLines =
      checkoutBreakdown?.lines?.reduce((sum, line) => sum + Number(line.lineTotalCents ?? 0), 0) ??
      null;
    const subtotalCents =
      subtotalCentsRaw && subtotalCentsRaw > 0
        ? subtotalCentsRaw
        : subtotalFromLines && subtotalFromLines > 0
          ? subtotalFromLines
          : 0;
    const discountCents =
      checkoutBreakdown?.discountCents ?? Number(additional.discountCents ?? 0);
    const platformFeeCents =
      checkoutBreakdown?.platformFeeCents ?? Number(additional.platformFeeCents ?? 0);
    const totalCents =
      checkoutBreakdown?.totalCents ??
      Number(additional.totalCents ?? additional.total ?? 0) ??
      Math.max(0, subtotalCents - discountCents + platformFeeCents);
    const code =
      typeof additional.promoCodeRaw === "string"
        ? additional.promoCodeRaw
        : typeof additional.promoCode === "string"
          ? additional.promoCode
          : null;

    if (
      Number.isNaN(subtotalCents) &&
      Number.isNaN(discountCents) &&
      Number.isNaN(platformFeeCents) &&
      Number.isNaN(totalCents)
    ) {
      return null;
    }

    return {
      subtotalCents,
      discountCents,
      platformFeeCents,
      totalCents,
      code,
      currency: checkoutBreakdown?.currency ?? "EUR",
    };
  })();
  const subtotalEur = breakdown ? breakdown.subtotalCents / 100 : null;
  const discountEur = breakdown ? breakdown.discountCents / 100 : null;
  const platformFeeEur = breakdown ? breakdown.platformFeeCents / 100 : null;
  const totalEur = breakdown ? breakdown.totalCents / 100 : null;

  const scenario =
    (dados?.paymentScenario as string | null | undefined) ??
    (dados?.additional?.paymentScenario as string | null | undefined) ??
    null;
  const isFreeScenario = scenario === "FREE_CHECKOUT";
  const purchaseId =
    typeof dados?.additional?.purchaseId === "string"
      ? dados.additional.purchaseId
      : typeof dados?.additional?.paymentIntentId === "string"
        ? dados.additional.paymentIntentId
        : null;

  const initialStatus: "PROCESSING" | "PAID" | "FAILED" =
    !purchaseId || isFreeScenario ? "PAID" : "PROCESSING";
  const [status, setStatus] = useState<"PROCESSING" | "PAID" | "FAILED">(initialStatus);

  useEffect(() => {
    if (!purchaseId || isFreeScenario) return;

    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const url = new URL("/api/checkout/status", window.location.origin);
        url.searchParams.set("purchaseId", purchaseId);
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const mapped = typeof data?.status === "string" ? data.status.toUpperCase() : "PROCESSING";
        if (cancelled) return;
        if (mapped === "PAID") {
          setStatus("PAID");
          setStatusError(null);
          if (interval) clearInterval(interval);
        } else if (mapped === "FAILED") {
          setStatus("FAILED");
          setStatusError(typeof data?.error === "string" ? data.error : null);
          if (interval) clearInterval(interval);
        } else {
          setStatus("PROCESSING");
          setStatusError(null);
        }
      } catch (err) {
        console.warn("[Step3Sucesso] Poll status falhou", err);
        if (!cancelled) setStatusError("A confirmar pagamento…");
      }
    };

    poll();
    interval = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [purchaseId, isFreeScenario]);

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

  if (!dados.additional?.paymentIntentId && !dados.additional?.purchaseId) {
    return null;
  }

  return (
    <div className="flex flex-col items-center text-center gap-8 py-6 px-4 text-white">

      {/* Título */}
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
          {status === "PAID"
            ? isFreeScenario
              ? "Inscrição confirmada 🎉"
              : "Compra Confirmada 🎉"
            : status === "FAILED"
              ? "Pagamento não confirmado"
              : "A confirmar pagamento…"}
        </h2>
        <p className="text-sm text-white/70">
          {status === "FAILED"
            ? statusError ?? "Não conseguimos confirmar o pagamento. Tenta novamente ou contacta suporte."
            : guestEmail
              ? `Obrigado! Enviámos os teus bilhetes para ${guestEmail}.`
              : isFreeScenario
                ? "A tua inscrição gratuita está confirmada."
                : "Estamos a confirmar o pagamento. Mantém esta página aberta."}
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
          {scenario && scenarioCopy[scenario] && (
            <p className="text-[11px] text-white/70">{scenarioCopy[scenario]}</p>
          )}
        </div>

        {/* Breakdown */}
        {status === "PAID" && breakdown && (
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-white/60 text-[11px] uppercase tracking-widest">Total dos bilhetes</span>
              <span className="font-semibold">
                {formatMoney(subtotalEur)}
              </span>
            </div>
            {breakdown.discountCents > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-white/60">Desconto {breakdown.code ? `(${breakdown.code})` : ""}</span>
                <span className="text-emerald-300">-{formatMoney(discountEur)}</span>
              </div>
            )}
            {breakdown.platformFeeCents > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-white/60">Taxa da plataforma</span>
                <span className="text-orange-200">{formatMoney(platformFeeEur)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-white text-[12px] font-semibold uppercase tracking-widest">Total Pago</span>
              <span className="text-xl font-semibold">
                {formatMoney(totalEur)}
              </span>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="space-y-1 text-sm text-white/60">
          <p>
            {guestEmail
              ? "Guarda o email com os bilhetes. Podes criar conta e ligar estes bilhetes mais tarde."
              : "A tua compra foi concluída com sucesso."}
          </p>
          {scenario && scenarioCopy[scenario] && (
            <p className="text-white/75">{scenarioCopy[scenario]}</p>
          )}
        </div>

        {/* Botão ver bilhetes */}
        {status === "PAID" ? (
          <button
            onClick={() => (guestEmail ? router.push("/login") : router.push("/me"))}
            className="w-full rounded-full bg-white text-black py-3 text-sm font-semibold shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:scale-[1.03] active:scale-95 transition-transform"
          >
            {guestEmail ? "Criar conta e ligar bilhetes" : "Ver os teus bilhetes"}
          </button>
        ) : status === "FAILED" ? (
          <button
            onClick={fecharCheckout}
            className="w-full rounded-full bg-red-500 text-white py-3 text-sm font-semibold shadow hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Fechar
          </button>
        ) : (
          <div className="w-full rounded-full bg-white/10 text-white text-sm font-semibold py-3 text-center">
            A confirmar…
          </div>
        )}
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
