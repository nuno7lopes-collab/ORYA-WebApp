import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsHealth } from "@/domain/ops/health";
import { getOpsSlo } from "@/domain/ops/slo";

export async function GET(req: NextRequest) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  const [health, slo] = await Promise.all([getOpsHealth(), getOpsSlo()]);
  return NextResponse.json({ ts: new Date().toISOString(), health, slo });
}
