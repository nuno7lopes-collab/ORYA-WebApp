import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { padel_match_status } from "@prisma/client";
import { PADEL_MATCH_PENDING_REVIEW_STATUSES } from "@/domain/padel/liveStatus";
import { markPendingReviewExpired } from "@/domain/padel/resultWorkflow";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live standings-impact gating", () => {
  it("mantém estados pendentes bloqueantes para revisão de classificação", () => {
    expect(PADEL_MATCH_PENDING_REVIEW_STATUSES.has(padel_match_status.PENDING_CONFIRMATION)).toBe(true);
    expect(PADEL_MATCH_PENDING_REVIEW_STATUSES.has(padel_match_status.PENDING_REVIEW_EXPIRED)).toBe(true);
  });

  it("expiração de pendente não oficializa resultado automaticamente", () => {
    const expired = markPendingReviewExpired({
      currentStatus: padel_match_status.PENDING_CONFIRMATION,
      currentScore: {
        liveWorkflow: {
          pendingConfirmationExpiresAt: "2026-02-16T09:00:00.000Z",
        },
      },
      now: new Date("2026-02-16T09:01:00.000Z"),
    });

    expect(expired.changed).toBe(true);
    expect(expired.status).toBe(padel_match_status.PENDING_REVIEW_EXPIRED);
  });

  it("write-path impede submissão quando já existe revisão pendente", () => {
    const submitRoute = readLocal("app/api/padel/matches/[id]/result/submit/route.ts");
    expect(submitRoute).toContain("RESULT_REVIEW_IN_PROGRESS");
    expect(submitRoute).toContain("PENDING_REVIEW_EXPIRED");
    expect(submitRoute).toContain("PENDING_CONFIRMATION");
  });
});
