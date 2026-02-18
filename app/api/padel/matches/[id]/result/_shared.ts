import { NextRequest } from "next/server";
import {
  OrganizationMemberRole,
  OrganizationModule,
  PadelResultValidationMode,
  Prisma,
  padel_match_status,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { asScoreObject, markPendingReviewExpired, normalizeResultWorkflowConfig } from "@/domain/padel/resultWorkflow";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { normalizePadelScoreRules } from "@/domain/padel/score";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const ADMIN_ROLES = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);

type MatchContext = {
  id: number;
  eventId: number;
  organizationId: number;
  categoryId: number | null;
  status: padel_match_status;
  score: Record<string, unknown>;
  scoreSets: Prisma.JsonValue | null;
  winnerSide: "A" | "B" | null;
  winnerParticipantId: number | null;
  roundType: string | null;
  roundLabel: string | null;
  participants: Array<{
    side: "A" | "B";
    slotOrder: number;
    participantId: number;
    userId: string | null;
  }>;
  resultValidationMode: PadelResultValidationMode;
  pendingConfirmationWindowMinutes: number;
  playerResultSubmissionEnabled: boolean;
};

type ActorContext = {
  userId: string;
  isOrgMember: boolean;
  isAdmin: boolean;
  canEditTournamentModule: boolean;
  organizationRole: OrganizationMemberRole | null;
  isParticipant: boolean;
  participantSides: Array<"A" | "B">;
};

export type ResultRouteContext = {
  match: MatchContext;
  actor: ActorContext;
};

export type ResultScoreRulesContext = {
  scoreRules: ReturnType<typeof normalizePadelScoreRules>;
  ruleSnapshot: {
    source: "VERSION" | "RULESET" | "DEFAULT";
    ruleSetId: number | null;
    ruleSetVersionId: number | null;
    capturedAt: string;
  };
};

function toParticipantSide(value: string | null | undefined): "A" | "B" | null {
  if (value === "A" || value === "B") return value;
  return null;
}

function parseClientRequestId(req: NextRequest, body: Record<string, unknown> | null | undefined) {
  const fromBody = typeof body?.clientRequestId === "string" ? body.clientRequestId.trim() : "";
  if (fromBody) return fromBody;
  const fromHeader = req.headers.get("x-idempotency-key")?.trim() ?? "";
  if (fromHeader) return fromHeader;
  return null;
}

function fail(error: string, status: number) {
  return { ok: false as const, error, status };
}

export function parseResultBody(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function parseReasonText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function parseReasonCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

export function parseTargetState(value: unknown): "IN_PROGRESS" | "RESULT_SUBMITTED" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "IN_PROGRESS") return "IN_PROGRESS";
  if (normalized === "RESULT_SUBMITTED") return "RESULT_SUBMITTED";
  return null;
}

export function parseResultWinner(value: unknown): "A" | "B" | null {
  if (value === "A" || value === "B") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    return normalized === "A" || normalized === "B" ? normalized : null;
  }
  return null;
}

export function parseResultType(value: unknown): "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY" {
  if (typeof value !== "string") return "NORMAL";
  const normalized = value.trim().toUpperCase();
  if (normalized === "WALKOVER") return "WALKOVER";
  if (normalized === "RETIREMENT") return "RETIREMENT";
  if (normalized === "INJURY") return "INJURY";
  return "NORMAL";
}

export async function resolveResultRouteContext(params: { matchId: number; actorUserId: string }) {
  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: params.matchId },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      status: true,
      score: true,
      scoreSets: true,
      winnerSide: true,
      winnerParticipantId: true,
      roundType: true,
      roundLabel: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          participantId: true,
          side: true,
          slotOrder: true,
          participant: {
            select: {
              playerProfile: {
                select: { userId: true },
              },
            },
          },
        },
      },
      event: {
        select: {
          organizationId: true,
          padelTournamentConfig: {
            select: {
              resultValidationMode: true,
              pendingConfirmationWindowMinutes: true,
              playerResultSubmissionEnabled: true,
            },
          },
        },
      },
    },
  });

  if (!match || !match.event?.organizationId) {
    return fail("MATCH_NOT_FOUND", 404);
  }

  const organizationId = match.event.organizationId;
  const participantSides = Array.from(
    new Set(
      match.participants
        .filter((row) => row.participant?.playerProfile?.userId === params.actorUserId)
        .map((row) => toParticipantSide(row.side))
        .filter((side): side is "A" | "B" => side === "A" || side === "B"),
    ),
  );
  const isParticipant = participantSides.length > 0;

  const { organization, membership } = await getActiveOrganizationForUser(params.actorUserId, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  const isOrgMember = Boolean(organization && membership);
  const isAdmin = Boolean(membership && ADMIN_ROLES.has(membership.role));

  let canEditTournamentModule = false;
  if (organization && membership) {
    const permission = await ensureMemberModuleAccess({
      organizationId,
      userId: params.actorUserId,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    canEditTournamentModule = permission.ok;
  }

  const config = normalizeResultWorkflowConfig({
    resultValidationMode: match.event.padelTournamentConfig?.resultValidationMode ?? null,
    pendingConfirmationWindowMinutes: match.event.padelTournamentConfig?.pendingConfirmationWindowMinutes ?? null,
    playerResultSubmissionEnabled: match.event.padelTournamentConfig?.playerResultSubmissionEnabled ?? null,
  });

  return {
    ok: true as const,
    ctx: {
      match: {
        id: match.id,
        eventId: match.eventId,
        organizationId,
        categoryId: match.categoryId ?? null,
        status: match.status,
        score: asScoreObject(match.score),
        scoreSets: match.scoreSets,
        winnerSide: match.winnerSide,
        winnerParticipantId: match.winnerParticipantId,
        roundType: match.roundType,
        roundLabel: match.roundLabel,
        participants: match.participants.map((row) => ({
          side: row.side === "B" ? "B" : "A",
          slotOrder: row.slotOrder,
          participantId: row.participantId,
          userId: row.participant?.playerProfile?.userId ?? null,
        })),
        resultValidationMode: config.resultValidationMode,
        pendingConfirmationWindowMinutes: config.pendingConfirmationWindowMinutes,
        playerResultSubmissionEnabled: config.playerResultSubmissionEnabled,
      },
      actor: {
        userId: params.actorUserId,
        isOrgMember,
        isAdmin,
        canEditTournamentModule,
        organizationRole: membership?.role ?? null,
        isParticipant,
        participantSides,
      },
    } satisfies ResultRouteContext,
  };
}

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return fail("UNAUTHENTICATED", 401);
  }

  return {
    ok: true as const,
    user,
  };
}

export function resolveClientRequestId(req: NextRequest, body: Record<string, unknown> | null | undefined) {
  return parseClientRequestId(req, body);
}

export async function resolveResultScoreRulesContext(eventId: number): Promise<ResultScoreRulesContext> {
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { advancedSettings: true, ruleSetId: true, ruleSetVersionId: true },
  });
  return {
    scoreRules: normalizePadelScoreRules((config?.advancedSettings as Record<string, unknown> | null)?.scoreRules),
    ruleSnapshot: {
      source:
        config?.ruleSetVersionId != null
          ? "VERSION"
          : config?.ruleSetId != null
            ? "RULESET"
            : "DEFAULT",
      ruleSetId: config?.ruleSetId ?? null,
      ruleSetVersionId: config?.ruleSetVersionId ?? null,
      capturedAt: new Date().toISOString(),
    },
  };
}

export async function applyPendingExpiryIfNeeded(params: {
  context: ResultRouteContext;
  actorUserId: string;
}) {
  const expiry = markPendingReviewExpired({
    currentStatus: params.context.match.status,
    currentScore: params.context.match.score,
  });

  if (!expiry.changed || !expiry.status) {
    return {
      changed: false,
      match: params.context.match,
    };
  }

  const { match: updated } = await updatePadelMatch({
    matchId: params.context.match.id,
    eventId: params.context.match.eventId,
    organizationId: params.context.match.organizationId,
    actorUserId: params.actorUserId,
    beforeStatus: params.context.match.status,
    eventType: "PADEL_MATCH_PENDING_EXPIRED",
    outboxEventType: "PADEL_MATCH_PENDING_EXPIRED",
    data: {
      status: expiry.status,
      score: expiry.score as Prisma.InputJsonValue,
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: params.context.match.organizationId,
    actorUserId: params.actorUserId,
    action: "PADEL_MATCH_PENDING_EXPIRED",
    metadata: {
      matchId: params.context.match.id,
      eventId: params.context.match.eventId,
      fromStatus: params.context.match.status,
      toStatus: expiry.status,
    },
  });

  return {
    changed: true,
    match: {
      ...params.context.match,
      status: expiry.status,
      score: asScoreObject(updated.score),
      scoreSets: updated.scoreSets,
      winnerSide: updated.winnerSide,
      winnerParticipantId: updated.winnerParticipantId,
    } satisfies MatchContext,
  };
}
