import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import {
  LoyaltyProgramStatus,
  LoyaltyRewardType,
  LoyaltyRuleTrigger,
  OrganizationMemberRole,
  Prisma,
} from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES = Object.values(OrganizationMemberRole);

const PADEL_RULE_BLUEPRINTS: Array<{
  name: string;
  trigger: LoyaltyRuleTrigger;
  points: number;
  maxPointsPerDay: number | null;
  maxPointsPerUser: number | null;
  conditions: Prisma.InputJsonValue;
}> = [
  {
    name: "Padel Assiduidade Semanal",
    trigger: LoyaltyRuleTrigger.BOOKING_COMPLETED,
    points: 40,
    maxPointsPerDay: 80,
    maxPointsPerUser: 400,
    conditions: {
      requiredInteractionTypes: ["PADEL_MATCH_PLAYED", "PADEL_CLASS_ATTENDED"],
      minMatches30d: 2,
      maxNoShowRate90d: 0.12,
    },
  },
  {
    name: "Padel Fair-Play",
    trigger: LoyaltyRuleTrigger.BOOKING_COMPLETED,
    points: 25,
    maxPointsPerDay: 50,
    maxPointsPerUser: 300,
    conditions: {
      requiredInteractionTypes: ["PADEL_MATCH_PLAYED", "PADEL_CLASS_ATTENDED"],
      requireFairPlay: true,
      maxNoShowRate90d: 0.05,
    },
  },
  {
    name: "Padel Competitivo",
    trigger: LoyaltyRuleTrigger.TOURNAMENT_PARTICIPATION,
    points: 60,
    maxPointsPerDay: 120,
    maxPointsPerUser: 600,
    conditions: {
      requiredInteractionTypes: [
        "PADEL_TOURNAMENT_REGISTERED",
        "PADEL_TOURNAMENT_PLAYED",
        "PADEL_TOURNAMENT_PODIUM",
      ],
      requiredCompetitiveTiers: ["ADVANCED", "COMPETITIVE"],
    },
  },
  {
    name: "Padel Reativação",
    trigger: LoyaltyRuleTrigger.EVENT_CHECKIN,
    points: 30,
    maxPointsPerDay: 60,
    maxPointsPerUser: 240,
    conditions: {
      requiredInteractionTypes: ["PADEL_CLASS_ATTENDED"],
      requiredActivityStatuses: ["COLD", "DORMANT"],
      maxNoShowRate90d: 0.2,
    },
  },
];

const PADEL_REWARD_BLUEPRINTS: Array<{
  name: string;
  type: LoyaltyRewardType;
  pointsCost: number;
  stock: number | null;
  payload: Prisma.InputJsonValue;
}> = [
  {
    name: "Aula Padel Grátis",
    type: LoyaltyRewardType.FREE_CLASS,
    pointsCost: 500,
    stock: null,
    payload: { classRef: "padel-starter" },
  },
  {
    name: "Entrada Torneio Padel",
    type: LoyaltyRewardType.FREE_EVENT,
    pointsCost: 700,
    stock: null,
    payload: { eventRef: "padel-tournament" },
  },
];

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões.");
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "LOYALTY_RULES" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return fail(ctx, 403, crmAccess.error);
    }

    const program = await prisma.loyaltyProgram.upsert({
      where: { organizationId: organization.id },
      update: {
        status: LoyaltyProgramStatus.ACTIVE,
      },
      create: {
        organizationId: organization.id,
        status: LoyaltyProgramStatus.ACTIVE,
        name: "Padel Rewards ORYA",
        pointsName: "Pontos Padel",
      },
      select: { id: true },
    });

    const [existingRules, existingRewards] = await Promise.all([
      prisma.loyaltyRule.findMany({
        where: { programId: program.id },
        select: { id: true, name: true },
      }),
      prisma.loyaltyReward.findMany({
        where: { programId: program.id },
        select: { id: true, name: true },
      }),
    ]);

    const existingRuleNames = new Set(existingRules.map((item) => item.name.trim().toLowerCase()));
    const existingRewardNames = new Set(existingRewards.map((item) => item.name.trim().toLowerCase()));

    const rulesToCreate = PADEL_RULE_BLUEPRINTS.filter(
      (item) => !existingRuleNames.has(item.name.trim().toLowerCase()),
    );
    const rewardsToCreate = PADEL_REWARD_BLUEPRINTS.filter(
      (item) => !existingRewardNames.has(item.name.trim().toLowerCase()),
    );

    if (rulesToCreate.length) {
      await prisma.loyaltyRule.createMany({
        data: rulesToCreate.map((rule) => ({
          programId: program.id,
          name: rule.name,
          trigger: rule.trigger,
          points: rule.points,
          maxPointsPerDay: rule.maxPointsPerDay,
          maxPointsPerUser: rule.maxPointsPerUser,
          conditions: rule.conditions,
          isActive: true,
        })),
      });
    }

    if (rewardsToCreate.length) {
      await prisma.loyaltyReward.createMany({
        data: rewardsToCreate.map((reward) => ({
          programId: program.id,
          name: reward.name,
          type: reward.type,
          pointsCost: reward.pointsCost,
          stock: reward.stock,
          payload: reward.payload,
          isActive: true,
        })),
      });
    }

    return respondOk(ctx, {
      programId: program.id,
      createdRules: rulesToCreate.length,
      createdRewards: rewardsToCreate.length,
      totalRules: existingRules.length + rulesToCreate.length,
      totalRewards: existingRewards.length + rewardsToCreate.length,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("POST /api/org/[orgId]/loyalty/padel-presets error:", err);
    return fail(ctx, 500, "Erro ao aplicar presets padel.");
  }
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

export const POST = withApiEnvelope(_POST);
