import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationFormSubmissionStatus } from "@prisma/client";

const SUBMISSION_STATUS_LABEL: Record<OrganizationFormSubmissionStatus, string> = {
  SUBMITTED: "Submetida",
  IN_REVIEW: "Em análise",
  ACCEPTED: "Aceite",
  WAITLISTED: "Lista de espera",
  INVITED: "Convocado",
  REJECTED: "Recusada",
};

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

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  if (/[;\n"]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
      include: {
        fields: { orderBy: { order: "asc" } },
      },
    });
    if (!form) {
      return NextResponse.json({ ok: false, error: "FORMULARIO_NAO_ENCONTRADO" }, { status: 404 });
    }

    const headers = [
      "ID",
      "Data",
      "Estado",
      "Nome",
      "Email",
      ...form.fields.map((field) => field.label),
    ];

    const rows: string[][] = [];
    const batchSize = 500;
    let cursor: number | null = null;

    while (true) {
      const submissions = await prisma.organizationFormSubmission.findMany({
        where: { formId },
        orderBy: { id: "desc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });

      if (submissions.length === 0) break;

      submissions.forEach((submission) => {
        const answers =
          submission.answers && typeof submission.answers === "object"
            ? (submission.answers as Record<string, unknown>)
            : {};

        const nameField =
          form.fields.find((field) => field.label.toLowerCase().includes("nome")) ??
          form.fields.find((field) => field.fieldType === "TEXT") ??
          null;
        const nameAnswer =
          nameField && typeof answers[String(nameField.id)] === "string"
            ? String(answers[String(nameField.id)]).trim()
            : "";
        const name =
          submission.user?.fullName ||
          submission.user?.username ||
          nameAnswer ||
          "Participante";

        const emailField = form.fields.find((field) => field.fieldType === "EMAIL") ?? null;
        const emailAnswer =
          emailField && typeof answers[String(emailField.id)] === "string"
            ? String(answers[String(emailField.id)]).trim()
            : "";
        const email =
          emailAnswer ||
          submission.guestEmail ||
          submission.user?.username ||
          "";

        const row = [
          String(submission.id),
          new Date(submission.createdAt).toISOString(),
          SUBMISSION_STATUS_LABEL[submission.status],
          name,
          email,
          ...form.fields.map((field) => {
            const raw = answers[String(field.id)];
            if (raw === null || raw === undefined) return "";
            if (typeof raw === "boolean") return raw ? "Sim" : "Não";
            if (typeof raw === "number") return String(raw);
            if (typeof raw === "string") return raw;
            if (Array.isArray(raw)) return raw.map((entry) => String(entry)).join(", ");
            return "";
          }),
        ];

        rows.push(row);
      });

      if (submissions.length < batchSize) break;
      cursor = submissions[submissions.length - 1]?.id ?? null;
      if (!cursor) break;
    }

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
    const filename = `respostas_${safeSlug(form.title) || form.id}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[organização/inscricoes][GET:export]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
