import { NextRequest } from "next/server";
import { CrmJourneyStepType, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

type JourneyStepInput = {
  stepKey?: unknown;
  position?: unknown;
  stepType?: unknown;
  config?: unknown;
};

function normalizeStepType(value: unknown): CrmJourneyStepType | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase();
  return Object.values(CrmJourneyStepType).includes(token as CrmJourneyStepType)
    ? (token as CrmJourneyStepType)
    : null;
}

function normalizeSteps(value: unknown): Array<{ stepKey: string; position: number; stepType: CrmJourneyStepType; config: Record<string, unknown> }> {
  if (!Array.isArray(value)) return [];
  const steps: Array<{ stepKey: string; position: number; stepType: CrmJourneyStepType; config: Record<string, unknown> }> = [];
  value.forEach((entry, index) => {
    const step = entry && typeof entry === "object" ? (entry as JourneyStepInput) : null;
    if (!step) return;
    const stepType = normalizeStepType(step.stepType) ?? CrmJourneyStepType.ACTION;
    const stepKey =
      typeof step.stepKey === "string" && step.stepKey.trim()
        ? step.stepKey.trim()
        : `step_${index + 1}`;
    const rawPosition = typeof step.position === "number" && Number.isFinite(step.position) ? Math.trunc(step.position) : index;
    const position = rawPosition < 0 ? index : rawPosition;
    const config =
      step.config && typeof step.config === "object" && !Array.isArray(step.config)
        ? (step.config as Record<string, unknown>)
        : {};

    steps.push({ stepKey, position, stepType, config });
  });
  return steps.sort((a, b) => a.position - b.position).map((step, index) => ({ ...step, position: index }));
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const items = await prisma.crmJourney.findMany({
    where: { organizationId: access.organization.id },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      publishedAt: true,
      pausedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { steps: true, enrollments: true } },
    },
  });

  return respondOk(ctx, {
    items: items.map((journey) => ({
      ...journey,
      stepsCount: journey._count.steps,
      enrollmentsCount: journey._count.enrollments,
    })),
  });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_JOURNEYS" });
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    definition?: unknown;
    steps?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return crmFail(req, 400, "Nome inválido.");
  }

  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const definition = body?.definition && typeof body.definition === "object" && !Array.isArray(body.definition)
    ? (body.definition as Record<string, unknown>)
    : {};
  const steps = normalizeSteps(body?.steps);

  const journey = await prisma.$transaction(async (tx) => {
    const created = await tx.crmJourney.create({
      data: {
        organizationId: access.organization.id,
        name,
        description,
        definition: definition as Prisma.InputJsonValue,
        createdByUserId: access.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        definition: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (steps.length) {
      await tx.crmJourneyStep.createMany({
        data: steps.map((step) => ({
          organizationId: access.organization.id,
          journeyId: created.id,
          stepKey: step.stepKey,
          position: step.position,
          stepType: step.stepType,
          config: step.config as Prisma.InputJsonValue,
        })),
      });
    }

    return created;
  });

  return respondOk(ctx, { journey });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
