// app/api/admin/refunds/retry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as { operationId?: number | string } | null;
    const operationId =
      typeof body?.operationId === "number"
        ? body.operationId
        : typeof body?.operationId === "string"
          ? Number(body.operationId)
          : NaN;

    if (!Number.isFinite(operationId)) {
      return NextResponse.json({ ok: false, error: "INVALID_OPERATION" }, { status: 400 });
    }

    const op = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { id: true, operationType: true },
    });
    if (!op || op.operationType !== "PROCESS_REFUND_SINGLE") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[admin/refunds/retry]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
