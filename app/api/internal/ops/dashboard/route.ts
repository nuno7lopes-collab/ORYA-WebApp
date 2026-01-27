import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsHealth } from "@/domain/ops/health";
import { getOpsSlo } from "@/domain/ops/slo";

export async function GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [health, slo] = await Promise.all([getOpsHealth(), getOpsSlo()]);
  return NextResponse.json({ ts: new Date().toISOString(), health, slo });
}
