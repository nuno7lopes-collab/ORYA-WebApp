import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { handleAcademyStudentsGet } from "@/lib/academy/studentsHandlers";

async function _GET(req: NextRequest) {
  return handleAcademyStudentsGet(req);
}

export const GET = withApiEnvelope(_GET);
