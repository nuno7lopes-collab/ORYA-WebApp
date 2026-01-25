import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsHealth } from "@/domain/ops/health";

export async function GET(req: NextRequest) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  const health = await getOpsHealth();
  return NextResponse.json(health);
}
