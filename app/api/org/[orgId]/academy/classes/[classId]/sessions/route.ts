import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { handleAcademyClassSessionsGet } from "@/lib/academy/classSeriesHandlers";

export async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassSessionsGet(req, resolved.classId);
}

export const GET = withApiEnvelope(_GET);
