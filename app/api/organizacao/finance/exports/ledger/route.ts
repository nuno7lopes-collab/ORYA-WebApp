export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { toCsv } from "@/lib/exports/csv";
import { requireOfficialEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

function parseRange(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return null;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  return { fromDate, toDate };
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const range = parseRange(req);
  if (!range) return fail(400, "INVALID_RANGE");

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return fail(401, "UNAUTHENTICATED");

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
  });
  if (!organization || !membership) return fail(403, "FORBIDDEN");

  const emailGate = await requireOfficialEmailVerified({
    organizationId: organization.id,
    organization,
    reasonCode: "EXPORTS_FINANCE",
    actorUserId: user.id,
  });
  if (!emailGate.ok) {
    return respondError(
      ctx,
      {
        errorCode: emailGate.error ?? "FORBIDDEN",
        message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
        retryable: false,
        details: emailGate,
      },
      { status: 403 },
    );
  }

  const access = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "VIEW",
  });
  if (!access.ok) return fail(403, "FORBIDDEN");

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      payment: { organizationId: organization.id },
    },
    orderBy: { id: "asc" },
  });

  const headers = [
    "createdAt",
    "paymentId",
    "entryType",
    "amount",
    "currency",
    "sourceType",
    "sourceId",
    "causationId",
    "correlationId",
  ];
  const rows = entries.map((entry) => [
    entry.createdAt,
    entry.paymentId,
    entry.entryType,
    entry.amount,
    entry.currency,
    entry.sourceType,
    entry.sourceId,
    entry.causationId,
    entry.correlationId,
  ]);
  const csv = toCsv([headers, ...rows]);
  const filename = `ledger_${range.fromDate.toISOString().slice(0, 10)}_${range.toDate
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
