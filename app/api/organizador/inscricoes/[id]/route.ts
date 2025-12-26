import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizationFormFieldType } from "@prisma/client";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { getCustomPremiumProfileModules, isCustomPremiumActive } from "@/lib/organizerPremium";

async function ensureInscricoesEnabled(organizer: {
  id: number;
  username?: string | null;
  liveHubPremiumEnabled?: boolean | null;
}) {
  const premiumActive = isCustomPremiumActive(organizer);
  const premiumModules = premiumActive ? getCustomPremiumProfileModules(organizer) ?? {} : {};
  if (!premiumModules.inscricoes) return false;
  const enabled = await prisma.organizationModuleEntry.findFirst({
    where: { organizerId: organizer.id, moduleKey: "INSCRICOES", enabled: true },
    select: { organizerId: true },
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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }
    if (!(await ensureInscricoesEnabled(organizer))) {
      return NextResponse.json({ ok: false, error: "Módulo de inscrições desativado." }, { status: 403 });
    }

    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return NextResponse.json({ ok: false, error: "FORM_ID_INVALIDO" }, { status: 400 });
    }

    const form = await prisma.organizationForm.findFirst({
      where: { id: formId, organizerId: organizer.id },
      include: {
        fields: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
      },
    });

    if (!form) {
      return NextResponse.json({ ok: false, error: "FORMULARIO_NAO_ENCONTRADO" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
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
    console.error("[organizador/inscricoes][GET:id]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Sem organização ativa." }, { status: 403 });
    }
    if (!(await ensureInscricoesEnabled(organizer))) {
      return NextResponse.json({ ok: false, error: "Módulo de inscrições desativado." }, { status: 403 });
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
        return NextResponse.json({ ok: false, error: "Título obrigatório." }, { status: 400 });
      }
      updates.title = title;
    }
    if (typeof descriptionRaw === "string") {
      updates.description = descriptionRaw.trim() || null;
    }
    if (typeof statusRaw === "string") {
      const status = statusRaw.trim().toUpperCase();
      if (!FORM_STATUSES.has(status)) {
        return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
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
        return NextResponse.json({ ok: false, error: "Campos inválidos." }, { status: 400 });
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
        return NextResponse.json({ ok: false, error: "Adiciona pelo menos um campo." }, { status: 400 });
      }
    }

    const existing = await prisma.organizationForm.findFirst({
      where: { id: formId, organizerId: organizer.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "FORMULARIO_NAO_ENCONTRADO" }, { status: 404 });
    }
    if (fieldsProvided) {
      const submissionsCount = await prisma.organizationFormSubmission.count({
        where: { formId },
      });
      if (submissionsCount > 0) {
        return NextResponse.json(
          { ok: false, error: "Não podes alterar campos quando já existem inscrições." },
          { status: 409 },
        );
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/inscricoes][PATCH:id]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
