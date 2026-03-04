import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  handleAcademyTrainersGet,
  handleAcademyTrainersPost,
} from "@/lib/academy/trainersHandlers";

async function _GET(req: NextRequest) {
  return handleAcademyTrainersGet(req);
}

async function _POST(req: NextRequest) {
  return handleAcademyTrainersPost(req);
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
