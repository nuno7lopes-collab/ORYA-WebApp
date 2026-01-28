import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CheckoutStatus, deriveCheckoutStatusFromPayment } from "@/domain/finance/status";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type Status = CheckoutStatus;

const FINAL_STATUSES: Status[] = ["PAID", "FAILED", "REFUNDED", "DISPUTED"];
const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
function cleanParam(v: string | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

async function _GET(req: NextRequest) {
  const url = new URL(req.url);
  const purchaseId = cleanParam(url.searchParams.get("purchaseId"));
  const paymentIntentIdRaw = cleanParam(url.searchParams.get("paymentIntentId"));
  // Free checkout não tem PaymentIntent Stripe; alguns flows antigos guardam um placeholder.
  const paymentIntentId =
    paymentIntentIdRaw === FREE_PLACEHOLDER_INTENT_ID ? null : paymentIntentIdRaw;

  if (!purchaseId && !paymentIntentId) {
    return jsonWrap(
      {
        ok: false,
        status: "FAILED" as Status,
        error: "MISSING_ID",
        code: "MISSING_ID",
        retryable: false,
        nextAction: "NONE",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    // -------------------------
    // 1) SSOT: Payment + Ledger (estado deriva do ledger)
    // -------------------------
    let resolvedPaymentId = purchaseId ?? null;
    if (!resolvedPaymentId && paymentIntentId) {
      const event = await prisma.paymentEvent.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { purchaseId: true },
      });
      resolvedPaymentId = event?.purchaseId ?? null;
    }

    if (resolvedPaymentId) {
      const payment = await prisma.payment.findUnique({
        where: { id: resolvedPaymentId },
        select: { id: true, status: true },
      });
      if (payment) {
        const ledgerEntries = await prisma.ledgerEntry.findMany({
          where: { paymentId: payment.id },
          select: { entryType: true },
        });
        const status = deriveCheckoutStatusFromPayment({
          paymentStatus: payment.status,
          ledgerEntries,
        });
        const final = FINAL_STATUSES.includes(status);
        const nextAction =
          status === "REQUIRES_ACTION" ? "PAY_NOW" : status === "FAILED" ? "CONTACT_SUPPORT" : "NONE";
        const retryable = status === "PENDING" || status === "PROCESSING" || status === "REQUIRES_ACTION";
        return jsonWrap(
          {
            ok: true,
            status,
            final,
            purchaseId: payment.id,
            paymentIntentId,
            code: status,
            retryable,
            nextAction,
            errorMessage: null,
          },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }

      const snapshot = await prisma.paymentSnapshot.findUnique({
        where: { paymentId: resolvedPaymentId },
        select: { status: true },
      });
      if (snapshot) {
        const status = deriveCheckoutStatusFromPayment({
          paymentStatus: snapshot.status,
          ledgerEntries: [],
        });
        const final = FINAL_STATUSES.includes(status);
        const nextAction =
          status === "REQUIRES_ACTION" ? "PAY_NOW" : status === "FAILED" ? "CONTACT_SUPPORT" : "NONE";
        const retryable = status === "PENDING" || status === "PROCESSING" || status === "REQUIRES_ACTION";
        return jsonWrap(
          {
            ok: true,
            status,
            final,
            purchaseId: resolvedPaymentId,
            paymentIntentId,
            code: status,
            retryable,
            nextAction,
            errorMessage: null,
          },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }
    }

    // -------------------------
    // 1b) Operations (modo worker): processamento em curso
    // -------------------------
    if (paymentIntentId || purchaseId) {
      const op = await prisma.operation.findFirst({
        where: {
          OR: [
            purchaseId ? { purchaseId } : undefined,
            paymentIntentId ? { paymentIntentId } : undefined,
          ].filter(Boolean) as Prisma.OperationWhereInput[],
        },
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          operationType: true,
          lastError: true,
          purchaseId: true,
          paymentIntentId: true,
          updatedAt: true,
        },
      });

      if (op) {
        const opStatusMap: Record<string, Status> = {
          PENDING: "PROCESSING",
          RUNNING: "PROCESSING",
          FAILED: "FAILED",
          DEAD_LETTER: "FAILED",
          SUCCEEDED: "PAID",
        };
        const mappedOp: Status = opStatusMap[op.status] ?? "PROCESSING";
        const final = mappedOp === "FAILED" || mappedOp === "PAID";
        const nextAction =
          mappedOp === "FAILED"
            ? "CONTACT_SUPPORT"
            : mappedOp === "REQUIRES_ACTION"
              ? "PAY_NOW"
              : "NONE";
        return jsonWrap(
          {
            ok: true,
            status: mappedOp,
            final,
            purchaseId: op.purchaseId ?? purchaseId ?? paymentIntentId,
            paymentIntentId: op.paymentIntentId ?? paymentIntentId,
            code: mappedOp,
            retryable: !final,
            nextAction,
            errorMessage: op.lastError ?? null,
          },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }
    }

    // -------------------------
    // 2) PaymentEvent (telemetria / processamento)
    // Regra: NÃO marcamos como PAID apenas por PaymentEvent.
    // -------------------------
    const eventWhere: Prisma.PaymentEventWhereInput = { OR: [] };
    if (purchaseId) eventWhere.OR!.push({ purchaseId });

    if (paymentIntentId) {
      eventWhere.OR!.push({ stripePaymentIntentId: paymentIntentId });
      // Compat: alguns flows antigos podem enviar o PI no campo purchaseId.
      eventWhere.OR!.push({ purchaseId: paymentIntentId });
    }

    const paymentEvent = await prisma.paymentEvent.findFirst({
      where: eventWhere,
      orderBy: { updatedAt: "desc" },
      select: {
        status: true,
        stripePaymentIntentId: true,
        purchaseId: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (paymentEvent) {
      // PaymentEvent é apenas telemetria; não inferimos estado final daqui.
      const status: Status = "PROCESSING";
      return jsonWrap(
        {
          ok: true,
          status,
          final: false,
          purchaseId: paymentEvent.purchaseId ?? purchaseId ?? paymentIntentId,
          paymentIntentId: paymentEvent.stripePaymentIntentId ?? paymentIntentId,
          code: status,
          retryable: true,
          nextAction: "NONE",
          errorMessage: paymentEvent.errorMessage ?? null,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    // -------------------------
    // 3) Nada encontrado ainda
    // -------------------------
    return jsonWrap(
      {
        ok: true,
        status: "PENDING" as Status,
        final: false,
        purchaseId: purchaseId ?? paymentIntentId,
        paymentIntentId,
        code: "PENDING",
        retryable: true,
        nextAction: "NONE",
        errorMessage: null,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    console.error("[checkout/status] erro inesperado", err);
    return jsonWrap(
      {
        ok: false,
        status: "FAILED" as Status,
        error: "INTERNAL_ERROR",
        code: "INTERNAL_ERROR",
        retryable: true,
        nextAction: "NONE",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
export const GET = withApiEnvelope(_GET);