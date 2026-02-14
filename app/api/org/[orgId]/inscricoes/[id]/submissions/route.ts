import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const SUBMISSION_STATUSES = new Set([
  "SUBMITTED",
  "IN_REVIEW",
  "ACCEPTED",
  "WAITLISTED",
  "INVITED",
  "REJECTED",
]);

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

async function _GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return fail(ctx, 403, "Sem organização ativa.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "INSCRICOES" });
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

    if (!(await ensureInscricoesEnabled(organization))) {
      return fail(ctx, 403, "Módulo de formulários desativado.");
    }

    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return fail(ctx, 400, "FORM_ID_INVALIDO");
    }

    const form = await prisma.organizationForm.findFirst({
      where: { id: formId, organizationId: organization.id },
      select: { id: true },
    });
    if (!form) {
      return fail(ctx, 404, "FORMULARIO_NAO_ENCONTRADO");
    }

    const takeRaw = req.nextUrl.searchParams.get("take");
    const skipRaw = req.nextUrl.searchParams.get("skip");
    const takeValue = takeRaw ? Number(takeRaw) : NaN;
    const take = Math.min(200, Math.max(1, Number.isFinite(takeValue) ? takeValue : 50));
    const skip = Math.max(0, Number.isFinite(Number(skipRaw)) ? Number(skipRaw) : 0);

    const submissions = await prisma.organizationFormSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
    });

    return respondOk(
      ctx,
      {
        items: submissions.map((submission) => ({
          id: submission.id,
          status: submission.status,
          createdAt: submission.createdAt,
          guestEmail: submission.guestEmail,
          user: submission.user,
          answers: submission.answers,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/inscricoes][GET:submissions]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return fail(ctx, 403, "Sem organização ativa.");
    }

    if (!(await ensureInscricoesEnabled(organization))) {
      return fail(ctx, 403, "Módulo de formulários desativado.");
    }

    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return fail(ctx, 400, "FORM_ID_INVALIDO");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail(ctx, 400, "INVALID_BODY");
    }

    const submissionIdRaw = (body as Record<string, unknown>).submissionId;
    const statusRaw = (body as Record<string, unknown>).status;
    const submissionId = typeof submissionIdRaw === "number" ? submissionIdRaw : Number(submissionIdRaw);
    if (!submissionId || Number.isNaN(submissionId)) {
      return fail(ctx, 400, "SUBMISSION_ID_INVALIDO");
    }

    const status = typeof statusRaw === "string" ? statusRaw.trim().toUpperCase() : "";
    if (!SUBMISSION_STATUSES.has(status)) {
      return fail(ctx, 400, "Estado inválido.");
    }

    const submission = await prisma.organizationFormSubmission.findFirst({
      where: { id: submissionId, formId },
      include: { form: { select: { organizationId: true } } },
    });

    if (!submission || submission.form.organizationId !== organization.id) {
      return fail(ctx, 404, "SUBMISSAO_NAO_ENCONTRADA");
    }

    await prisma.organizationFormSubmission.update({
      where: { id: submissionId },
      data: { status: status as typeof submission.status },
    });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/inscricoes][PATCH:submissions]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
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
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
