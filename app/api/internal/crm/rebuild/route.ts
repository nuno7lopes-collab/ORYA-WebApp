import { NextRequest, NextResponse } from "next/server";
import { rebuildCrmCustomers } from "@/lib/crm/rebuild";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get(INTERNAL_HEADER);
    if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { organizationId?: unknown } | null;
    const orgParam = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
    const organizationId =
      typeof body?.organizationId === "number" && Number.isFinite(body.organizationId)
        ? body.organizationId
        : orgParam;

    const result = await rebuildCrmCustomers({ organizationId: organizationId ?? null });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("POST /api/internal/crm/rebuild error:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
