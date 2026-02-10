import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizationFormFieldType } from "@prisma/client";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
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

const FIELD_TYPES = new Set<OrganizationFormFieldType>([
  "TEXT",
  "TEXTAREA",
  "EMAIL",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "CHECKBOX",
]);

const FORM_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptions(value: unknown) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return cleaned.length > 0 ? cleaned : null;
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
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
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
      include: {
        fields: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
      },
    });

    if (!form) {
      return fail(ctx, 404, "FORMULARIO_NAO_ENCONTRADO");
    }

    return respondOk(
      ctx,
      {
        form: {
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
          fields: form.fields.map((field) => ({
            id: field.id,
            label: field.label,
            fieldType: field.fieldType,
            required: field.required,
            helpText: field.helpText,
            placeholder: field.placeholder,
            options: Array.isArray(field.options)
              ? field.options.map((option) => String(option))
              : null,
            order: field.order,
          })),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/inscricoes][GET:id]", err);
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

    const titleRaw = (body as Record<string, unknown>).title;
    const descriptionRaw = (body as Record<string, unknown>).description;
    const statusRaw = (body as Record<string, unknown>).status;
    const capacityRaw = (body as Record<string, unknown>).capacity;
    const waitlistRaw = (body as Record<string, unknown>).waitlistEnabled;
    const startAtRaw = (body as Record<string, unknown>).startAt;
    const endAtRaw = (body as Record<string, unknown>).endAt;
    const fieldsRaw = (body as Record<string, unknown>).fields;

    const updates: Record<string, unknown> = {};
    if (typeof titleRaw === "string") {
      const title = titleRaw.trim();
      if (!title) {
        return fail(ctx, 400, "Título obrigatório.");
      }
      updates.title = title;
    }
    if (typeof descriptionRaw === "string") {
      updates.description = descriptionRaw.trim() || null;
    }
    if (typeof statusRaw === "string") {
      const status = statusRaw.trim().toUpperCase();
      if (!FORM_STATUSES.has(status)) {
        return fail(ctx, 400, "Estado inválido.");
      }
      updates.status = status;
    }
    if (typeof capacityRaw === "number" && Number.isFinite(capacityRaw)) {
      updates.capacity = Math.max(0, Math.floor(capacityRaw));
    } else if (capacityRaw === null) {
      updates.capacity = null;
    }
    if (typeof waitlistRaw === "boolean") {
      updates.waitlistEnabled = waitlistRaw;
    }
    if (typeof startAtRaw === "string") {
      updates.startAt = parseDate(startAtRaw);
    }
    if (typeof endAtRaw === "string") {
      updates.endAt = parseDate(endAtRaw);
    }

    const fieldsProvided = Object.prototype.hasOwnProperty.call(body, "fields");
    const parsedFields: Array<{
      label: string;
      fieldType: OrganizationFormFieldType;
      required: boolean;
      helpText: string | null;
      placeholder: string | null;
      options: string[] | null;
      order: number;
    }> = [];

    if (fieldsProvided) {
      if (!Array.isArray(fieldsRaw)) {
        return fail(ctx, 400, "Campos inválidos.");
      }
      fieldsRaw.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const candidate = entry as Record<string, unknown>;
        const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
        const fieldType =
          typeof candidate.fieldType === "string"
            ? (candidate.fieldType.trim().toUpperCase() as OrganizationFormFieldType)
            : null;
        const required = typeof candidate.required === "boolean" ? candidate.required : false;
        const helpText = typeof candidate.helpText === "string" ? candidate.helpText.trim() : "";
        const placeholder = typeof candidate.placeholder === "string" ? candidate.placeholder.trim() : "";
        const options = parseOptions(candidate.options);

        if (!label || !fieldType || !FIELD_TYPES.has(fieldType)) {
          return;
        }
        parsedFields.push({
          label,
          fieldType,
          required,
          helpText: helpText || null,
          placeholder: placeholder || null,
          options: fieldType === "SELECT" ? options : null,
          order: index,
        });
      });

      if (parsedFields.length === 0) {
        return fail(ctx, 400, "Adiciona pelo menos um campo.");
      }
    }

    const existing = await prisma.organizationForm.findFirst({
      where: { id: formId, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(ctx, 404, "FORMULARIO_NAO_ENCONTRADO");
    }
    if (fieldsProvided) {
      const submissionsCount = await prisma.organizationFormSubmission.count({
        where: { formId },
      });
      if (submissionsCount > 0) {
        return fail(ctx, 409, "Não podes alterar campos quando já existem respostas.");
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.organizationForm.update({
          where: { id: formId },
          data: updates,
        });
      }
      if (fieldsProvided) {
        await tx.organizationFormField.deleteMany({ where: { formId } });
        await tx.organizationFormField.createMany({
          data: parsedFields.map((field) => ({
            formId,
            label: field.label,
            fieldType: field.fieldType,
            required: field.required,
            helpText: field.helpText,
            placeholder: field.placeholder,
            options: field.options ?? undefined,
            order: field.order,
          })),
        });
      }
    });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/inscricoes][PATCH:id]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const existing = await prisma.organizationForm.findFirst({
      where: { id: formId, organizationId: organization.id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!existing) {
      return fail(ctx, 404, "FORMULARIO_NAO_ENCONTRADO");
    }
    if (existing._count.submissions > 0) {
      return fail(ctx, 409, "Não é possível apagar um formulário com respostas.");
    }

    await prisma.organizationForm.delete({ where: { id: formId } });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/inscricoes][DELETE:id]", err);
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
export const DELETE = withApiEnvelope(_DELETE);
