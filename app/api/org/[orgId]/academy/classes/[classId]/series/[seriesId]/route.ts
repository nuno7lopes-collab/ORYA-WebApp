import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  handleAcademyClassSeriesDelete,
  handleAcademyClassSeriesPatch,
} from "@/lib/academy/classSeriesHandlers";

export async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; seriesId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassSeriesPatch(req, resolved.classId, resolved.seriesId);
}

export async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; seriesId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassSeriesDelete(req, resolved.classId, resolved.seriesId);
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
