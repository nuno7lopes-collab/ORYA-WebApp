import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PadelResultValidationMode, padel_match_status } from "@prisma/client";
import { buildSubmitTransition } from "@/domain/padel/resultWorkflow";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live permissions matrix", () => {
  it("bloqueia submissão por jogador quando a opção do torneio está desativada", () => {
    expect(() =>
      buildSubmitTransition({
        config: {
          resultValidationMode: PadelResultValidationMode.IMMEDIATE_PENDING_THEN_OFFICIAL,
          pendingConfirmationWindowMinutes: 15,
          playerResultSubmissionEnabled: false,
        },
        actorKind: "PLAYER",
        currentStatus: padel_match_status.IN_PROGRESS,
        currentScore: {},
        incomingScorePatch: { resultType: "NORMAL", winnerSide: "A" },
        actorId: "player-1",
      }),
    ).toThrow("PLAYER_SUBMISSION_DISABLED");
  });

  it("força pendente quando submissão é feita por jogador", () => {
    const submitted = buildSubmitTransition({
      config: {
        resultValidationMode: PadelResultValidationMode.IMMEDIATE_OFFICIAL,
        pendingConfirmationWindowMinutes: 15,
        playerResultSubmissionEnabled: true,
      },
      actorKind: "PLAYER",
      currentStatus: padel_match_status.IN_PROGRESS,
      currentScore: {},
      incomingScorePatch: { resultType: "NORMAL", winnerSide: "B" },
      actorId: "player-1",
    });

    expect(submitted.status).toBe(padel_match_status.PENDING_CONFIRMATION);
  });

  it("mantém guardas de staff nas rotas críticas de confirmação/rejeição/override/reset", () => {
    const confirmRoute = readLocal("app/api/padel/matches/[id]/result/confirm/route.ts");
    const rejectRoute = readLocal("app/api/padel/matches/[id]/result/reject/route.ts");
    const overrideRoute = readLocal("app/api/padel/matches/[id]/result/override/route.ts");
    const resetRoute = readLocal("app/api/padel/matches/[id]/result/reset-pending/route.ts");

    const guard = "!context.actor.canEditTournamentModule || !context.actor.organizationRole";
    expect(confirmRoute).toContain(guard);
    expect(rejectRoute).toContain(guard);
    expect(overrideRoute).toContain(guard);
    expect(resetRoute).toContain(guard);
  });
});
