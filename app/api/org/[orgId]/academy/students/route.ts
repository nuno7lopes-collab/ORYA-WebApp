import { NextRequest } from "next/server";
import { GET as LegacyGet } from "@/app/api/org/[orgId]/reservas/clientes/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  return LegacyGet(req);
}

export const GET = withApiEnvelope(_GET);
