import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
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

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return fail(403, "Sem organização ativa.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "INSCRICOES" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    if (!(await ensureInscricoesEnabled(organization))) {
      return fail(403, "Módulo de formulários desativado.");
    }

    const forms = await prisma.organizationForm.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: { select: { submissions: true } },
      },
    });

    return respondOk(
      ctx,
      {
        items: forms.map((form) => ({
          id: form.id,
          title: form.title,
          description: form.description,
          status: form.status,
          capacity: form.capacity,
          waitlistEnabled: form.waitlistEnabled,
          startAt: form.startAt,
          endAt: form.endAt,
          createdAt: form.createdAt,
          submissionsCount: form._count.submissions,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/inscricoes][GET]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const user = await requireUser();
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization) {
      return fail(403, "Sem organização ativa.");
    }
    if (!(await ensureInscricoesEnabled(organization))) {
      return fail(403, "Módulo de formulários desativado.");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail(400, "INVALID_BODY");
    }

    const titleRaw = (body as Record<string, unknown>).title;
    const descriptionRaw = (body as Record<string, unknown>).description;
    const capacityRaw = (body as Record<string, unknown>).capacity;
    const waitlistRaw = (body as Record<string, unknown>).waitlistEnabled;
    const startAtRaw = (body as Record<string, unknown>).startAt;
    const endAtRaw = (body as Record<string, unknown>).endAt;

    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : null;
    const capacity =
      typeof capacityRaw === "number" && Number.isFinite(capacityRaw)
        ? Math.max(0, Math.floor(capacityRaw))
        : null;
    const waitlistEnabled = typeof waitlistRaw === "boolean" ? waitlistRaw : true;
    const startAt = parseDate(startAtRaw);
    const endAt = parseDate(endAtRaw);

    if (!title) {
      return fail(400, "Indica um título para o formulário.");
    }

    const form = await prisma.$transaction(async (tx) => {
      const created = await tx.organizationForm.create({
        data: {
          organizationId: organization.id,
          title,
          description,
          capacity,
          waitlistEnabled,
          startAt,
          endAt,
          status: "DRAFT",
        },
      });

      await tx.organizationFormField.createMany({
        data: [
          {
            formId: created.id,
            label: "Nome completo",
            fieldType: "TEXT",
            required: true,
            placeholder: "O teu nome",
            order: 0,
          },
          {
            formId: created.id,
            label: "Email",
            fieldType: "EMAIL",
            required: true,
            placeholder: "nome@email.com",
            order: 1,
          },
        ],
      });

      return created;
    });

    return respondOk(
      ctx,
      {
        form: {
          id: form.id,
          title: form.title,
          description: form.description,
          status: form.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[organização/inscricoes][POST]", err);
    return fail(500, "INTERNAL_ERROR");
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
