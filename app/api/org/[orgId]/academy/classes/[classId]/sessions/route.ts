import { NextRequest } from "next/server";
import { GET as LegacyClassSessionsGet } from "@/app/api/org/[orgId]/servicos/[id]/class-sessions/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function mapParams(classId: string) {
  return Promise.resolve({ id: classId });
}

export async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return LegacyClassSessionsGet(req, { params: mapParams(resolved.classId) });
}

export const GET = withApiEnvelope(_GET);
