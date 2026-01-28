// app/api/admin/refunds/retry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as { operationId?: number | string } | null;
    const operationId =
      typeof body?.operationId === "number"
        ? body.operationId
        : typeof body?.operationId === "string"
          ? Number(body.operationId)
          : NaN;

    if (!Number.isFinite(operationId)) {
      return jsonWrap({ ok: false, error: "INVALID_OPERATION" }, { status: 400 });
    }

    const op = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { id: true, operationType: true },
    });
    if (!op || op.operationType !== "PROCESS_REFUND_SINGLE") {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
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

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[admin/refunds/retry]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);