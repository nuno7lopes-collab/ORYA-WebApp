"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "./contextoCheckout";
import { formatEuro } from "@/lib/money";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { getTicketCopy } from "./checkoutCopy";

const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";

function normalizeCheckoutStatus(raw: unknown): "PROCESSING" | "PAID" | "FAILED" {
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (["PAID", "OK", "SUCCEEDED", "SUCCESS", "COMPLETED", "CONFIRMED"].includes(v)) return "PAID";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED", "REQUIRES_PAYMENT_METHOD"].includes(v)) return "FAILED";
  return "PROCESSING";
}

function numberFromUnknown(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function eurosToCents(v: number): number {
  return Math.max(0, Math.round(v * 100));
}

function centsFromAdditional(additional: Record<string, unknown>, key: string): number | null {
  // Convention used in this checkout:
  // - `*Cents` fields are cents
  // - `total` (without suffix) has historically been stored as euros
  const centsKey = `${key}Cents`;
  const cents = numberFromUnknown(additional[centsKey]);
  if (cents !== null) return cents;

  if (key === "total") {
    const totalEuros = numberFromUnknown(additional.total);
    if (totalEuros !== null) return eurosToCents(totalEuros);
  }

  return null;
}

export default function Step3Sucesso() {
  const { dados, fecharCheckout, breakdown: checkoutBreakdown } = useCheckout();
  const router = useRouter();
  const [statusError, setStatusError] = useState<string | null>(null);

  const additional:
    | Record<string, unknown>
    | undefined =
    dados?.additional && typeof dados.additional === "object"
      ? (dados.additional as Record<string, unknown>)
      : undefined;
  const checkoutVariant =
    additional && typeof additional.checkoutUiVariant === "string"
      ? additional.checkoutUiVariant
      : "DEFAULT";
  const ticketCopy = getTicketCopy(checkoutVariant);
  const ticketPluralWithArticle = `${ticketCopy.articlePlural} ${ticketCopy.plural}`;
  const freeLabelLower = ticketCopy.freeLabel.toLowerCase();
  const freeSuccessTitle = ticketCopy.isPadel ? "Inscrição confirmada 🎉" : "Entrada confirmada 🎉";
  const scenarioCopy: Record<string, string> = {
    GROUP_SPLIT: "Pagaste apenas a tua parte desta dupla.",
    GROUP_FULL: "Pagaste 2 lugares (tu + parceiro).",
    RESALE: `Compra de ${ticketCopy.singular} em revenda.`,
    FREE_CHECKOUT: `${ticketCopy.freeLabel} concluída.`,
  };

  const scenario =
    (dados?.paymentScenario as string | null | undefined) ??
    (additional && typeof additional.paymentScenario === "string"
      ? (additional.paymentScenario as string)
      : null);

  const isGratisScenario = scenario === "FREE_CHECKOUT";

  const paymentIntentId =
    additional && typeof additional.paymentIntentId === "string"
      ? additional.paymentIntentId
      : null;

  const fallbackPurchaseId =
    paymentIntentId && paymentIntentId !== FREE_PLACEHOLDER_INTENT_ID ? paymentIntentId : null;

  const purchaseId =
    additional && typeof additional.purchaseId === "string"
      ? additional.purchaseId
      : fallbackPurchaseId;

  useEffect(() => {
    if (dados && !purchaseId && !isGratisScenario) {
      router.replace("/explorar/eventos");
    }
  }, [dados, router, purchaseId, isGratisScenario]);

  // Revalidar bilhetes após sucesso (traz novos bilhetes mais depressa)
  useEffect(() => {
    async function revalidateTickets() {
      try {
        await fetch("/api/me/wallet", { method: "GET", cache: "no-store" });
      } catch (err) {
        console.warn("[Step3Sucesso] Falha ao revalidar /api/me/wallet", err);
      }
    }
    revalidateTickets();
  }, []);

  const guestEmail =
    additional && typeof additional.guestEmail === "string" ? additional.guestEmail : null;

  const breakdown = (() => {
    const add = additional ?? {};

    const subtotalFromContext =
      typeof checkoutBreakdown?.subtotalCents === "number" ? checkoutBreakdown.subtotalCents : null;

    const subtotalFromLines =
      checkoutBreakdown?.lines?.reduce((sum, line) => sum + Number(line.lineTotalCents ?? 0), 0) ?? null;

    // If we lost the context breakdown (refresh), we fallback to additional.
    // NOTE: `additional.total` is stored as euros in Step2, so we convert to cents.
    const subtotalCentsRaw =
      subtotalFromContext ??
      numberFromUnknown(add.subtotalCents) ??
      numberFromUnknown(add.totalCents) ??
      centsFromAdditional(add, "total") ??
      0;

    const subtotalCents =
      subtotalCentsRaw && subtotalCentsRaw > 0
        ? subtotalCentsRaw
        : subtotalFromLines && subtotalFromLines > 0
          ? subtotalFromLines
          : 0;

    const discountCents =
      typeof checkoutBreakdown?.discountCents === "number"
        ? checkoutBreakdown.discountCents
        : numberFromUnknown(add.discountCents) ?? 0;

    const totalCentsFromContext =
      typeof checkoutBreakdown?.totalCents === "number" ? checkoutBreakdown.totalCents : null;

    const totalCentsFromAdditional =
      numberFromUnknown(add.totalCents) ?? centsFromAdditional(add, "total");

    const computedTotalFallback = Math.max(0, subtotalCents - discountCents);

    const totalCents = totalCentsFromContext ?? totalCentsFromAdditional ?? computedTotalFallback;

    const code =
      typeof add.appliedPromoLabel === "string"
        ? add.appliedPromoLabel
        : typeof add.promoCodeRaw === "string"
          ? add.promoCodeRaw
          : typeof add.promoCode === "string"
            ? add.promoCode
            : null;

    const currency =
      typeof checkoutBreakdown?.currency === "string"
        ? checkoutBreakdown.currency
        : typeof add.currency === "string"
          ? add.currency
          : "EUR";

    if (
      Number.isNaN(subtotalCents) &&
      Number.isNaN(discountCents) &&
      Number.isNaN(totalCents)
    ) {
      return null;
    }

    return {
      subtotalCents,
      discountCents,
      totalCents,
      code,
      currency,
    };
  })();
  const discountCents = breakdown?.discountCents ?? 0;
  const discountEur = breakdown ? breakdown.discountCents / 100 : null;
  const totalEur = breakdown ? breakdown.totalCents / 100 : null;

  const initialStatus: "PROCESSING" | "PAID" | "FAILED" =
    isGratisScenario ? "PAID" : purchaseId ? "PROCESSING" : "PROCESSING";
  const [status, setStatus] = useState<"PROCESSING" | "PAID" | "FAILED">(initialStatus);

  useEffect(() => {
    if (isGratisScenario) setStatus("PAID");
  }, [isGratisScenario]);

  useEffect(() => {
    if (!purchaseId || isGratisScenario) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const url = new URL("/api/checkout/status", window.location.origin);
        url.searchParams.set("purchaseId", purchaseId);
        if (paymentIntentId && paymentIntentId !== purchaseId) {
          url.searchParams.set("paymentIntentId", paymentIntentId);
        }
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const mapped = normalizeCheckoutStatus(data?.status);
        if (cancelled) return;

        if (mapped === "PAID") {
          setStatus("PAID");
          setStatusError(null);
          if (interval) clearInterval(interval);
          // revalidate once more after confirmed
          try {
            await fetch("/api/me/wallet", { method: "GET", cache: "no-store" });
          } catch {}
          return;
        }

        if (mapped === "FAILED") {
          setStatus("FAILED");
          setStatusError(typeof data?.error === "string" ? data.error : null);
          if (interval) clearInterval(interval);
          return;
        }

        setStatus("PROCESSING");
        setStatusError(null);
      } catch (err) {
        console.warn("[Step3Sucesso] Poll status falhou", err);
        if (!cancelled) setStatusError(null);
      }
    };

    poll();
    interval = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [purchaseId, isGratisScenario]);

  if (!dados) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-black">Algo correu mal 🤔</h2>
        <p className="text-sm text-black/70">
          Não encontrámos os dados da tua {ticketCopy.singular}. Fecha esta janela e tenta novamente.
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

  if (!purchaseId && !isGratisScenario) {
    return null;
  }

  return (
    <div className="flex flex-col items-center text-center gap-6 py-6 px-4 text-white">
      <div className="w-full">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
          Passo 3 de 3
        </p>
        <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
        </div>
      </div>

      {/* Título */}
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
          {status === "PAID"
            ? isGratisScenario
              ? freeSuccessTitle
              : "Compra Confirmada 🎉"
            : status === "FAILED"
              ? "Pagamento não confirmado"
              : "A confirmar pagamento…"}
        </h2>
        <p className="text-sm text-white/70">
          {status === "FAILED"
            ? statusError ?? "Não conseguimos confirmar o pagamento. Tenta novamente ou contacta suporte."
            : status === "PAID"
              ? guestEmail
                ? `Obrigado! Enviámos ${ticketPluralWithArticle} para ${guestEmail}.`
                : isGratisScenario
                  ? `A tua ${freeLabelLower} está confirmada.`
                  : `Compra confirmada. Já podes ver ${ticketPluralWithArticle}.`
              : guestEmail
                ? `Estamos a confirmar o pagamento. Assim que estiver confirmado, vais receber ${ticketPluralWithArticle} em ${guestEmail}.`
                : "Estamos a confirmar o pagamento. Mantém esta página aberta."}
        </p>
      </div>

      {/* Card principal estilo Apple Wallet */}
      <div className="w-full rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/12 px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.55)] space-y-6">

        {/* Evento */}
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-white/50">Evento</p>
          <p className="text-xl font-semibold">
            {dados.ticketName ?? ticketCopy.singularCap}
          </p>
          {scenario && scenarioCopy[scenario] && (
            <p className="text-[11px] text-white/70">{scenarioCopy[scenario]}</p>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1 text-sm text-white/60">
          {status === "PAID" && discountCents > 0 && (
            <p className="text-emerald-200">
              Desconto aplicado{breakdown?.code ? ` (${breakdown.code})` : ""}: -{formatEuro(discountEur)}
            </p>
          )}
          {status === "PAID" && totalEur !== null && (
            <p className="text-white/85">Total pago: {formatEuro(totalEur)}</p>
          )}
          <p>
            {status === "PAID"
              ? guestEmail
                ? `Guarda o email com ${ticketPluralWithArticle}. Podes criar conta e ligar ${ticketCopy.articlePlural} ${ticketCopy.plural} mais tarde.`
                : "A tua compra foi concluída com sucesso."
              : status === "FAILED"
                ? `O pagamento não ficou confirmado. Se o teu banco debitou, contacta suporte${purchaseId ? ` com o ID de compra: ${purchaseId}` : ""}.`
                : "Estamos a confirmar o pagamento. Se demorares mais de alguns minutos, fecha e volta a abrir o checkout."}
          </p>
        </div>

        {/* Botão ver bilhetes */}
        {status === "PAID" ? (
          <button
            onClick={() => (guestEmail ? router.push("/login") : router.push("/me"))}
            className={`${CTA_PRIMARY} w-full justify-center py-3 text-sm active:scale-95`}
          >
            {guestEmail
              ? `Criar conta e ligar ${ticketPluralWithArticle}`
              : `Ver ${ticketPluralWithArticle}`}
          </button>
        ) : status === "FAILED" ? (
          <div className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 text-sm text-red-100 py-3 text-center">
            Pagamento não confirmado. Verifica o método de pagamento ou tenta novamente.
          </div>
        ) : (
          <div className="w-full rounded-full border border-white/15 bg-white/10 text-white text-sm font-semibold py-3 text-center">
            A confirmar…
          </div>
        )}
      </div>

      {/* Fechar */}
      <button
        onClick={fecharCheckout}
        className="w-full rounded-full border border-white/15 bg-white/10 text-white font-semibold py-2.5 text-sm shadow-[0_14px_30px_rgba(0,0,0,0.45)] hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition"
      >
        Fechar
      </button>
    </div>
  );
}
