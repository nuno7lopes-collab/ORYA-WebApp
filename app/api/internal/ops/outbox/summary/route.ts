import { NextRequest, NextResponse } from "next/server";
import { getOutboxOpsSummary } from "@/lib/ops/outboxSummary";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const summary = await getOutboxOpsSummary();
  return NextResponse.json({ ok: true, ...summary }, { status: 200 });
}
