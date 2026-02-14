import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationFormSubmissionStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const SUBMISSION_STATUSES: OrganizationFormSubmissionStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "ACCEPTED",
  "WAITLISTED",
  "INVITED",
  "REJECTED",
];

async function ensureInscricoesEnabled(organization: {
  id: number;
  username?: string | null;
}) {
  const enabled = await prisma.organizationModuleEntry.findFirst({
    where: { organizationId: organization.id, moduleKey: "INSCRICOES", enabled: true },
    select: { organizationId: true },
  });
  return Boolean(enabled);
}

async function _GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return jsonWrap({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    if (!(await ensureInscricoesEnabled(organization))) {
      return jsonWrap({ ok: false, error: "Módulo de formulários desativado." }, { status: 403 });
    }

    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return jsonWrap({ ok: false, error: "FORM_ID_INVALIDO" }, { status: 400 });
    }

    const form = await prisma.organizationForm.findFirst({
      where: { id: formId, organizationId: organization.id },
      select: { id: true },
    });
    if (!form) {
      return jsonWrap({ ok: false, error: "FORMULARIO_NAO_ENCONTRADO" }, { status: 404 });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalCount, last7Days, groupedStatuses, latestSubmission] = await Promise.all([
      prisma.organizationFormSubmission.count({ where: { formId } }),
      prisma.organizationFormSubmission.count({
        where: { formId, createdAt: { gte: since } },
      }),
      prisma.organizationFormSubmission.groupBy({
        by: ["status"],
        where: { formId },
        _count: { _all: true },
      }),
      prisma.organizationFormSubmission.findFirst({
        where: { formId },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      }),
    ]);

    const statusCounts = SUBMISSION_STATUSES.reduce<Record<OrganizationFormSubmissionStatus, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<OrganizationFormSubmissionStatus, number>,
    );
    groupedStatuses.forEach((group) => {
      statusCounts[group.status] = group._count._all;
    });

    return jsonWrap(
      {
        ok: true,
        totalCount,
        last7Days,
        statusCounts,
        latestSubmission: latestSubmission
          ? {
              id: latestSubmission.id,
              status: latestSubmission.status,
              createdAt: latestSubmission.createdAt,
              guestEmail: latestSubmission.guestEmail,
              user: latestSubmission.user,
              answers: latestSubmission.answers,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/inscricoes][GET:summary]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);