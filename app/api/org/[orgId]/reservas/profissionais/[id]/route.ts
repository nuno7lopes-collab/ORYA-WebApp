import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  handleAcademyTrainerDelete,
  handleAcademyTrainerPatch,
} from "@/lib/academy/trainersHandlers";

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  return handleAcademyTrainerPatch(req, resolved.id);
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  return handleAcademyTrainerDelete(req, resolved.id);
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
