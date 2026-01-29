// app/api/admin/refunds/retry/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return respondError(
        ctx,
        { errorCode: admin.error, message: admin.error, retryable: false },
        { status: admin.status },
      );
    }

    const body = (await req.json().catch(() => null)) as { operationId?: number | string } | null;
    const operationId =
      typeof body?.operationId === "number"
        ? body.operationId
        : typeof body?.operationId === "string"
          ? Number(body.operationId)
          : NaN;

    if (!Number.isFinite(operationId)) {
      return respondError(
        ctx,
        { errorCode: "INVALID_OPERATION", message: "Operação inválida.", retryable: false },
        { status: 400 },
      );
    }

    const op = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { id: true, operationType: true },
    });
    if (!op || op.operationType !== "PROCESS_REFUND_SINGLE") {
      return respondError(
        ctx,
        { errorCode: "NOT_FOUND", message: "Operação não encontrada.", retryable: false },
        { status: 404 },
      );
    }

    await prisma.operation.update({
      where: { id: operationId },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        lockedAt: null,
        nextRetryAt: null,
      },
    });

    return respondOk(ctx, { retried: true }, { status: 200 });
  } catch (err) {
    console.error("[admin/refunds/retry]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
