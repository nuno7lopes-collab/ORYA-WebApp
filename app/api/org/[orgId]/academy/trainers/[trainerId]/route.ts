import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  handleAcademyTrainerDelete,
  handleAcademyTrainerPatch,
} from "@/lib/academy/trainersHandlers";

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const resolved = await params;
  return handleAcademyTrainerPatch(req, resolved.trainerId);
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const resolved = await params;
  return handleAcademyTrainerDelete(req, resolved.trainerId);
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
