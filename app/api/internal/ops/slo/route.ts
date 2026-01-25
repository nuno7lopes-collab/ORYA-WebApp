import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsSlo } from "@/domain/ops/slo";

export async function GET(req: NextRequest) {
  const guard = requireInternalSecret(req);
  if (!guard.ok) return guard.response;

  const slo = await getOpsSlo();
  return NextResponse.json(slo);
}
