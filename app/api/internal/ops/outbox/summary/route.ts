import { NextRequest, NextResponse } from "next/server";
import { getOutboxOpsSummary } from "@/lib/ops/outboxSummary";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await getOutboxOpsSummary();
  return NextResponse.json({ ok: true, ...summary }, { status: 200 });
}
