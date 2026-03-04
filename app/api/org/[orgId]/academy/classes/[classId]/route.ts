import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  handleAcademyClassDelete,
  handleAcademyClassGet,
  handleAcademyClassPatch,
} from "@/lib/academy/classesHandlers";

export async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassGet(req, resolved.classId);
}

export async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassPatch(req, resolved.classId);
}

export async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  return handleAcademyClassDelete(req, resolved.classId);
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
