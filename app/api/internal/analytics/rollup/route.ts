import { NextRequest, NextResponse } from "next/server";
import { runAnalyticsRollupJob } from "@/domain/analytics/rollup";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const payload = (await req.json().catch(() => null)) as
    | { organizationId?: number; fromDate?: string; toDate?: string; maxDays?: number }
    | null;

  const result = await runAnalyticsRollupJob({
    organizationId: typeof payload?.organizationId === "number" ? payload.organizationId : undefined,
    fromDate: typeof payload?.fromDate === "string" ? payload.fromDate : undefined,
    toDate: typeof payload?.toDate === "string" ? payload.toDate : undefined,
    maxDays: typeof payload?.maxDays === "number" ? payload.maxDays : undefined,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
