import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  handleAcademyClassSeriesGet,
  handleAcademyClassSeriesPost,
} from "@/lib/academy/classSeriesHandlers";

export async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassSeriesGet(req, resolved.classId);
}

export async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassSeriesPost(req, resolved.classId);
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
