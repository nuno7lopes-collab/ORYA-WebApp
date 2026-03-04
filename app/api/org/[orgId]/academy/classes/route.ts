import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { handleAcademyClassesGet, handleAcademyClassesPost } from "@/lib/academy/classesHandlers";

async function _GET(req: NextRequest) {
  return handleAcademyClassesGet(req);
}

async function _POST(req: NextRequest) {
  return handleAcademyClassesPost(req);
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
