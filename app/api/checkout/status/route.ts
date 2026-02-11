import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CheckoutStatus, deriveCheckoutStatusFromPayment } from "@/domain/finance/status";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type Status = CheckoutStatus;

type CheckoutStatusV1 = "PENDING" | "PROCESSING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELED" | "EXPIRED";

const FINAL_STATUSES: Status[] = ["PAID", "FAILED", "REFUNDED", "DISPUTED", "CANCELED"];
const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function normalizeStatusV1(status: Status): CheckoutStatusV1 {
  if (status === "PAID") return "SUCCEEDED";
  if (status === "CANCELED") return "CANCELED";
  if (status === "FAILED" || status === "REFUNDED" || status === "DISPUTED") return "FAILED";
  return status;
}

function buildStatusPayload(params: {
  status: Status;
  purchaseId: string | null;
  paymentIntentId: string | null;
  final: boolean;
  retryable: boolean;
  nextAction: string;
  errorMessage: string | null;
}) {
  return {
    status: params.status,
    statusV1: normalizeStatusV1(params.status),
    final: params.final,
    checkoutId: params.purchaseId,
    purchaseId: params.purchaseId,
    paymentIntentId: params.paymentIntentId,
    code: params.status,
    retryable: params.retryable,
    nextAction: params.nextAction,
    errorMessage: params.errorMessage,
  };
}

function cleanParam(v: string | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const url = new URL(req.url);
  const checkoutId = cleanParam(url.searchParams.get("checkoutId"));
  const purchaseId = cleanParam(url.searchParams.get("purchaseId")) ?? checkoutId;
  const paymentIntentIdRaw = cleanParam(url.searchParams.get("paymentIntentId"));
  // Free checkout não tem PaymentIntent Stripe; alguns flows antigos guardam um placeholder.
  const paymentIntentId =
    paymentIntentIdRaw === FREE_PLACEHOLDER_INTENT_ID ? null : paymentIntentIdRaw;

  if (!purchaseId && !paymentIntentId) {
    return respondError(
      ctx,
      {
        errorCode: "MISSING_ID",
        message: "purchaseId ou paymentIntentId obrigatórios.",
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
        return respondOk(
          ctx,
          buildStatusPayload({
            status,
            final,
            purchaseId: payment.id,
            paymentIntentId,
            retryable,
            nextAction,
            errorMessage: null,
          }),
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
        return respondOk(
          ctx,
          buildStatusPayload({
            status,
            final,
            purchaseId: resolvedPaymentId,
            paymentIntentId,
            retryable,
            nextAction,
            errorMessage: null,
          }),
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
        return respondOk(
          ctx,
          buildStatusPayload({
            status: mappedOp,
            final,
            purchaseId: op.purchaseId ?? purchaseId ?? paymentIntentId ?? null,
            paymentIntentId: op.paymentIntentId ?? paymentIntentId,
            retryable: !final,
            nextAction,
            errorMessage: op.lastError ?? null,
          }),
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
      return respondOk(
        ctx,
        buildStatusPayload({
          status,
          final: false,
          purchaseId: paymentEvent.purchaseId ?? purchaseId ?? paymentIntentId ?? null,
          paymentIntentId: paymentEvent.stripePaymentIntentId ?? paymentIntentId,
          retryable: true,
          nextAction: "NONE",
          errorMessage: paymentEvent.errorMessage ?? null,
        }),
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    // -------------------------
    // 3) Nada encontrado ainda
    // -------------------------
    return respondOk(
      ctx,
      buildStatusPayload({
        status: "PENDING",
        final: false,
        purchaseId: purchaseId ?? paymentIntentId,
        paymentIntentId,
        retryable: true,
        nextAction: "NONE",
        errorMessage: null,
      }),
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    logError("checkout.status.unexpected_error", err, { requestId: ctx.requestId });
    return respondError(
      ctx,
      {
        errorCode: "INTERNAL_ERROR",
        message: "Erro interno.",
        retryable: true,
        nextAction: "NONE",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
export const GET = withApiEnvelope(_GET);
