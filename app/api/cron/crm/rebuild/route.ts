export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rebuildCrmCustomers } from "@/lib/crm/rebuild";

const CRON_HEADER = "X-ORYA-CRON-SECRET";

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get(CRON_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const orgParam = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
  const result = await rebuildCrmCustomers({ organizationId: orgParam ?? null });
  console.info("[crm][rebuild]", { organizationId: orgParam ?? null, ...result });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
