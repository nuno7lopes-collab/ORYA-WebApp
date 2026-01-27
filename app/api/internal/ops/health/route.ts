import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsHealth } from "@/domain/ops/health";

export async function GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const health = await getOpsHealth();
  return NextResponse.json(health);
}
