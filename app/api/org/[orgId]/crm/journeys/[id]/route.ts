import { NextRequest } from "next/server";
import { CrmJourneyStepType, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

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
    const step = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
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

async function _GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const journey = await prisma.crmJourney.findFirst({
    where: { id, organizationId: access.organization.id },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      definition: true,
      publishedAt: true,
      pausedAt: true,
      createdAt: true,
      updatedAt: true,
      steps: {
        select: { id: true, stepKey: true, position: true, stepType: true, config: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!journey) {
    return crmFail(req, 404, "Journey não encontrada.");
  }

  return respondOk(ctx, { journey });
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_JOURNEYS" });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    definition?: unknown;
    steps?: unknown;
  } | null;

  const existing = await prisma.crmJourney.findFirst({
    where: { id, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!existing) {
    return crmFail(req, 404, "Journey não encontrada.");
  }

  const updateData: Prisma.CrmJourneyUncheckedUpdateInput = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return crmFail(req, 400, "Nome inválido.");
    updateData.name = name;
  }
  if (typeof body?.description === "string" || body?.description === null) {
    updateData.description = typeof body.description === "string" ? body.description.trim() : null;
  }
  if (body?.definition && typeof body.definition === "object" && !Array.isArray(body.definition)) {
    updateData.definition = body.definition as Prisma.InputJsonValue;
  }

  const steps = body && Object.prototype.hasOwnProperty.call(body, "steps") ? normalizeSteps(body.steps) : null;

  const journey = await prisma.$transaction(async (tx) => {
    const updated = await tx.crmJourney.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        definition: true,
        publishedAt: true,
        pausedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (steps) {
      await tx.crmJourneyStep.deleteMany({ where: { journeyId: existing.id } });
      if (steps.length) {
        await tx.crmJourneyStep.createMany({
          data: steps.map((step) => ({
            organizationId: access.organization.id,
            journeyId: existing.id,
            stepKey: step.stepKey,
            position: step.position,
            stepType: step.stepType,
            config: step.config as Prisma.InputJsonValue,
          })),
        });
      }
    }

    const refreshedSteps = await tx.crmJourneyStep.findMany({
      where: { journeyId: existing.id },
      select: { id: true, stepKey: true, position: true, stepType: true, config: true },
      orderBy: { position: "asc" },
    });

    return {
      ...updated,
      steps: refreshedSteps,
    };
  });

  return respondOk(ctx, { journey });
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
