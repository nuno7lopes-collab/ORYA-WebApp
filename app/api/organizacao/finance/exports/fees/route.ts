export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { LedgerEntryType, OrganizationModule } from "@prisma/client";
import { toCsv } from "@/lib/exports/csv";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseRange(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return null;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  return { fromDate, toDate };
}

async function _GET(req: NextRequest) {
  const range = parseRange(req);
  if (!range) return jsonWrap({ ok: false, error: "INVALID_RANGE" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const access = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.FINANCEIRO,
    required: "VIEW",
  });
  if (!access.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      createdAt: { gte: range.fromDate, lte: range.toDate },
      entryType: LedgerEntryType.PLATFORM_FEE,
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
  const filename = `fees_${range.fromDate.toISOString().slice(0, 10)}_${range.toDate
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
export const GET = withApiEnvelope(_GET);