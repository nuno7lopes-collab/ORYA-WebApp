export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { runOperationsBatch } from "@/app/api/internal/worker/operations/route";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const results = await runOperationsBatch();
  return NextResponse.json({ ok: true, processed: results.length, results }, { status: 200 });
}
