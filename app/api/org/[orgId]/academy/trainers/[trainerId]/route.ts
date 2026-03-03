import { NextRequest } from "next/server";
import {
  PATCH as LegacyPatch,
  DELETE as LegacyDelete,
} from "@/app/api/org/[orgId]/reservas/profissionais/[id]/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function mapParams(trainerId: string) {
  return Promise.resolve({ id: trainerId });
}

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const resolved = await params;
  return LegacyPatch(req, { params: mapParams(resolved.trainerId) });
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const resolved = await params;
  return LegacyDelete(req, { params: mapParams(resolved.trainerId) });
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
