export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rebuildCrmCustomers } from "@/lib/crm/rebuild";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const orgParam = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
  const result = await rebuildCrmCustomers({ organizationId: orgParam ?? null });
  console.info("[crm][rebuild]", { organizationId: orgParam ?? null, ...result });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
