import { NextRequest, NextResponse } from "next/server";
import { backfillPadelRegistrationOutbox } from "@/domain/padelRegistrationBackfill";

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
