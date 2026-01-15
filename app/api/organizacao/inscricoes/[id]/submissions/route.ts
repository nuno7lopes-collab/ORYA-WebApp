import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";

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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    if (!(await ensureInscricoesEnabled(organization))) {
      return NextResponse.json({ ok: false, error: "Módulo de formulários desativado." }, { status: 403 });
    }

    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return NextResponse.json({ ok: false, error: "FORM_ID_INVALIDO" }, { status: 400 });
    }

    const form = await prisma.organizationForm.findFirst({
      where: { id: formId, organizationId: organization.id },
      select: { id: true },
    });
    if (!form) {
      return NextResponse.json({ ok: false, error: "FORMULARIO_NAO_ENCONTRADO" }, { status: 404 });
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

    return NextResponse.json(
      {
        ok: true,
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
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }

    if (!(await ensureInscricoesEnabled(organization))) {
      return NextResponse.json({ ok: false, error: "Módulo de formulários desativado." }, { status: 403 });
    }

    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return NextResponse.json({ ok: false, error: "FORM_ID_INVALIDO" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const submissionIdRaw = (body as Record<string, unknown>).submissionId;
    const statusRaw = (body as Record<string, unknown>).status;
    const submissionId = typeof submissionIdRaw === "number" ? submissionIdRaw : Number(submissionIdRaw);
    if (!submissionId || Number.isNaN(submissionId)) {
      return NextResponse.json({ ok: false, error: "SUBMISSION_ID_INVALIDO" }, { status: 400 });
    }

    const status = typeof statusRaw === "string" ? statusRaw.trim().toUpperCase() : "";
    if (!SUBMISSION_STATUSES.has(status)) {
      return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
    }

    const submission = await prisma.organizationFormSubmission.findFirst({
      where: { id: submissionId, formId },
      include: { form: { select: { organizationId: true } } },
    });

    if (!submission || submission.form.organizationId !== organization.id) {
      return NextResponse.json({ ok: false, error: "SUBMISSAO_NAO_ENCONTRADA" }, { status: 404 });
    }

    await prisma.organizationFormSubmission.update({
      where: { id: submissionId },
      data: { status: status as typeof submission.status },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/inscricoes][PATCH:submissions]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
