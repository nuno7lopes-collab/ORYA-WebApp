import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { runOperationsBatch } from "@/app/api/internal/worker/operations/route";

type Status =
  | "PENDING"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "DISPUTED";

const FINAL_STATUSES: Status[] = ["PAID", "FAILED", "REFUNDED", "DISPUTED"];
const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const STUCK_MS = 5 * 60 * 1000; // 5 minutos para considerar uma Operation presa

function cleanParam(v: string | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const purchaseId = cleanParam(url.searchParams.get("purchaseId"));
  const paymentIntentIdRaw = cleanParam(url.searchParams.get("paymentIntentId"));
  // Free checkout não tem PaymentIntent Stripe; alguns flows antigos guardam um placeholder.
  const paymentIntentId =
    paymentIntentIdRaw === FREE_PLACEHOLDER_INTENT_ID ? null : paymentIntentIdRaw;

  if (!purchaseId && !paymentIntentId) {
    return NextResponse.json(
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
    // 1) SSOT: SaleSummary (DB confirmou a compra)
    // -------------------------
    const summaryWhere: Prisma.SaleSummaryWhereInput = { OR: [] };
    if (purchaseId) summaryWhere.OR!.push({ purchaseId });
    if (paymentIntentId) summaryWhere.OR!.push({ paymentIntentId });

    const summary = await prisma.saleSummary.findFirst({
      where: summaryWhere,
      select: {
        id: true,
        paymentIntentId: true,
        purchaseId: true,
        totalCents: true,
        createdAt: true,
      },
    });

    if (summary) {
      return NextResponse.json(
        {
          ok: true,
          status: "PAID" as Status,
          final: true,
          // purchaseId é a âncora universal; se não existir (edge), fazemos fallback seguro.
          purchaseId: summary.purchaseId ?? purchaseId ?? paymentIntentId,
          paymentIntentId: summary.paymentIntentId ?? paymentIntentId,
          code: "PAID",
          retryable: false,
          nextAction: "NONE",
          errorMessage: null,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    // -------------------------
    // 1b) Operations (modo worker): se não há SaleSummary ainda, ver estado da Operation
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

      const now = Date.now();
      const opUpdatedAt = op?.updatedAt ? op.updatedAt.getTime() : 0;
      const stuck =
        op && (op.status === "PENDING" || op.status === "RUNNING") && now - opUpdatedAt > STUCK_MS;
      const needsQueue = !op || op.status === "FAILED" || op.status === "DEAD_LETTER" || stuck;

      // Auto-requeue para evitar ficar preso em PROCESSING
      if (needsQueue && (paymentIntentId || purchaseId)) {
        const dedupe = paymentIntentId ?? purchaseId!;
        await enqueueOperation({
          operationType: "FULFILL_PAYMENT",
          dedupeKey: dedupe,
          correlations: { purchaseId: purchaseId ?? null, paymentIntentId: paymentIntentId ?? null },
          payload: { purchaseId, paymentIntentId },
        });
      }

      // Auto-disparar worker em linha (mesmo em prod) mas com salvaguarda: até 3 batches
      if (op && (op.status === "PENDING" || op.status === "RUNNING" || needsQueue)) {
        for (let i = 0; i < 3; i++) {
          try {
            await runOperationsBatch();
          } catch (err) {
            console.warn("[checkout/status] auto-run worker falhou (ignorado)", err);
            break;
          }
          // Após cada batch, verifica se o SaleSummary já existe para este purchase/paymentIntent
          const summaryAfter = await prisma.saleSummary.findFirst({
            where: {
              OR: [
                purchaseId ? { purchaseId } : undefined,
                paymentIntentId ? { paymentIntentId } : undefined,
              ].filter(Boolean) as Prisma.SaleSummaryWhereInput[],
            },
            select: { purchaseId: true, paymentIntentId: true },
          });
          if (summaryAfter) {
            return NextResponse.json(
              {
                ok: true,
                status: "PAID" as Status,
                final: true,
                purchaseId: summaryAfter.purchaseId ?? purchaseId ?? paymentIntentId,
                paymentIntentId: summaryAfter.paymentIntentId ?? paymentIntentId,
                code: "PAID",
                retryable: false,
                nextAction: "NONE",
                errorMessage: null,
              },
              { status: 200, headers: NO_STORE_HEADERS },
            );
          }
        }
      }

      if (op) {
        const opStatusMap: Record<string, Status> = {
          PENDING: "PROCESSING",
          RUNNING: "PROCESSING",
          FAILED: "FAILED",
          DEAD_LETTER: "FAILED",
          SUCCEEDED: "PROCESSING",
        };
        const mappedOp: Status = opStatusMap[op.status] ?? "PROCESSING";
        const final = mappedOp === "FAILED";
        const nextAction =
          mappedOp === "FAILED"
            ? "CONTACT_SUPPORT"
            : mappedOp === "REQUIRES_ACTION"
              ? "PAY_NOW"
              : "NONE";
        return NextResponse.json(
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
    // Regra: NÃO marcamos como PAID apenas por PaymentEvent=OK;
    // PAID é SSOT via SaleSummary.
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
      // Mapeamento conservador: OK != PAID (até existir SaleSummary)
      const statusMap: Record<string, Status> = {
        OK: "PROCESSING",
        PROCESSING: "PROCESSING",
        REQUIRES_ACTION: "REQUIRES_ACTION",
        ERROR: "FAILED",
        FAILED: "FAILED",
        CANCELED: "FAILED",
        CANCELLED: "FAILED",
        REFUNDED: "REFUNDED",
        DISPUTED: "DISPUTED",
      };

      const mapped: Status = statusMap[paymentEvent.status] ?? "PROCESSING";
      const final = FINAL_STATUSES.includes(mapped);

      // Contrato simples para o FE (sem adivinhar)
      const nextAction =
        mapped === "REQUIRES_ACTION" ? "PAY_NOW" : mapped === "FAILED" ? "CONTACT_SUPPORT" : "NONE";

      const retryable =
        mapped === "PENDING" || mapped === "PROCESSING" || mapped === "REQUIRES_ACTION";

      return NextResponse.json(
        {
          ok: true,
          status: mapped,
          final,
          purchaseId: paymentEvent.purchaseId ?? purchaseId ?? paymentIntentId,
          paymentIntentId: paymentEvent.stripePaymentIntentId ?? paymentIntentId,
          code: mapped,
          retryable,
          nextAction,
          errorMessage: paymentEvent.errorMessage ?? null,
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    // -------------------------
    // 3) Nada encontrado ainda
    // -------------------------
    return NextResponse.json(
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
    return NextResponse.json(
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
