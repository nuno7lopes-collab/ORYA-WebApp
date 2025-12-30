export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { runOperationsBatch } from "@/app/api/internal/worker/operations/route";

const CRON_HEADER = "X-ORYA-CRON-SECRET";

export async function POST(req: NextRequest) {
  const secret = req.headers.get(CRON_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const results = await runOperationsBatch();
  return NextResponse.json({ ok: true, processed: results.length, results }, { status: 200 });
}
