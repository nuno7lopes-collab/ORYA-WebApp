import { padel_match_status } from "@prisma/client";
import { isPadelOfficialStatus } from "@/domain/padel/liveStatus";

type ScoreLike = Record<string, unknown> | null | undefined;

export function isPadelOfficialPublicResult(params: {
  status: padel_match_status | string | null | undefined;
  score?: ScoreLike;
}) {
  if (!isPadelOfficialStatus(params.status)) return false;
  const score = params.score && typeof params.score === "object" ? params.score : null;
  return score?.disputeStatus !== "OPEN";
}
