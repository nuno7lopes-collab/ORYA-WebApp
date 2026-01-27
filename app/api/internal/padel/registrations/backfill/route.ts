import { NextRequest, NextResponse } from "next/server";
import { backfillPadelRegistrationOutbox } from "@/domain/padelRegistrationBackfill";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as { limit?: unknown; before?: unknown } | null;
  const limit = typeof payload?.limit === "number" ? payload.limit : undefined;
  const before = typeof payload?.before === "string" ? new Date(payload.before) : null;

  const result = await backfillPadelRegistrationOutbox({
    limit: limit ?? 200,
    before,
  });

  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    emitted: result.emitted,
    nextBefore: result.nextBefore?.toISOString() ?? null,
  });
}
