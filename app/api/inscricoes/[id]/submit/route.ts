import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma, OrganizationFormSubmissionStatus } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTED_STATUSES: OrganizationFormSubmissionStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "ACCEPTED",
  "WAITLISTED",
  "INVITED",
];

function parseDateValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseCheckbox(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "on" || normalized === "1";
  }
  return false;
}

async function _POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return jsonWrap({ ok: false, error: "FORM_ID_INVALIDO" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const answersRaw = (body as Record<string, unknown>).answers;
    if (!answersRaw || typeof answersRaw !== "object") {
      return jsonWrap({ ok: false, error: "Respostas inválidas." }, { status: 400 });
    }

    const form = await prisma.organizationForm.findUnique({
      where: { id: formId },
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true,
        capacity: true,
        waitlistEnabled: true,
        fields: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            label: true,
            fieldType: true,
            required: true,
            options: true,
          },
        },
        organization: { select: { id: true, status: true, username: true } },
      },
    });

    if (!form || form.organization.status !== "ACTIVE") {
      return jsonWrap({ ok: false, error: "Formulário não disponível." }, { status: 404 });
    }

    const isPublic = form.status !== "ARCHIVED";
    if (!isPublic) {
      return jsonWrap({ ok: false, error: "Formulário não disponível." }, { status: 404 });
    }
    if (form.status !== "PUBLISHED") {
      return jsonWrap(
        { ok: false, error: "Formulário ainda não está publicado." },
        { status: 403 },
      );
    }
    const now = new Date();
    if (form.startAt && now < form.startAt) {
      return jsonWrap(
        { ok: false, error: "Este formulário ainda não abriu." },
        { status: 409 },
      );
    }
    if (form.endAt && now > form.endAt) {
      return jsonWrap(
        { ok: false, error: "Este formulário já fechou." },
        { status: 409 },
      );
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: form.organization.id, moduleKey: "INSCRICOES", enabled: true },
      select: { organizationId: true },
    });
    if (!moduleEnabled) {
      return jsonWrap({ ok: false, error: "Formulário não disponível." }, { status: 404 });
    }

    const normalizedAnswers: Record<string, unknown> = {};
    let emailAnswer: string | null = null;

    for (const field of form.fields) {
      const key = String(field.id);
      const raw = (answersRaw as Record<string, unknown>)[key];

      const trimmedString = typeof raw === "string" ? raw.trim() : "";

      switch (field.fieldType) {
        case "TEXT":
        case "TEXTAREA": {
          if (field.required && !trimmedString) {
            return jsonWrap({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
          }
          if (trimmedString) normalizedAnswers[key] = trimmedString;
          break;
        }
        case "EMAIL": {
          if (field.required && !trimmedString) {
            return jsonWrap({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
          }
          if (trimmedString) {
            if (!EMAIL_REGEX.test(trimmedString)) {
              return jsonWrap({ ok: false, error: `Email inválido em "${field.label}".` }, { status: 400 });
            }
            normalizedAnswers[key] = trimmedString;
            emailAnswer = trimmedString;
          }
          break;
        }
        case "PHONE": {
          if (field.required && !trimmedString) {
            return jsonWrap({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
          }
          if (trimmedString) {
            if (!isValidPhone(trimmedString)) {
              return jsonWrap({ ok: false, error: `Telefone inválido em "${field.label}".` }, { status: 400 });
            }
            normalizedAnswers[key] = normalizePhone(trimmedString) || trimmedString;
          }
          break;
        }
        case "NUMBER": {
          if (raw === null || raw === undefined || raw === "") {
            if (field.required) {
              return jsonWrap({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
            }
            break;
          }
          const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
          if (!Number.isFinite(value)) {
            return jsonWrap({ ok: false, error: `Número inválido em "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = value;
          break;
        }
        case "DATE": {
          if (!trimmedString) {
            if (field.required) {
              return jsonWrap({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
            }
            break;
          }
          const parsed = parseDateValue(trimmedString);
          if (!parsed) {
            return jsonWrap({ ok: false, error: `Data inválida em "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = parsed;
          break;
        }
        case "SELECT": {
          const options = Array.isArray(field.options) ? field.options.map((o) => String(o)) : [];
          if (!trimmedString) {
            if (field.required) {
              return jsonWrap({ ok: false, error: `Escolhe uma opção em "${field.label}".` }, { status: 400 });
            }
            break;
          }
          if (options.length > 0 && !options.includes(trimmedString)) {
            return jsonWrap({ ok: false, error: `Opção inválida em "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = trimmedString;
          break;
        }
        case "CHECKBOX": {
          const checked = parseCheckbox(raw);
          if (field.required && !checked) {
            return jsonWrap({ ok: false, error: `Confirma "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = checked;
          break;
        }
        default:
          break;
      }
    }

    const guestEmailRaw = (body as Record<string, unknown>).guestEmail;
    const guestEmail = !user
      ? emailAnswer || (typeof guestEmailRaw === "string" ? guestEmailRaw.trim() : null)
      : null;

    if (!user) {
      if (!guestEmail || !EMAIL_REGEX.test(guestEmail)) {
        return jsonWrap(
          { ok: false, error: "Indica um email válido para completar a resposta." },
          { status: 400 },
        );
      }
    }

    if (user) {
      const existing = await prisma.organizationFormSubmission.findFirst({
        where: { formId, userId: user.id },
        select: { id: true },
      });
      if (existing) {
        return jsonWrap({ ok: false, error: "Já enviaste uma resposta neste formulário." }, { status: 409 });
      }
    } else if (guestEmail) {
      const existing = await prisma.organizationFormSubmission.findFirst({
        where: { formId, guestEmail },
        select: { id: true },
      });
      if (existing) {
        return jsonWrap({ ok: false, error: "Este email já respondeu a este formulário." }, { status: 409 });
      }
    }

    let status: "SUBMITTED" | "WAITLISTED" = "SUBMITTED";
    if (form.capacity !== null && form.capacity !== undefined) {
      const count = await prisma.organizationFormSubmission.count({
        where: { formId, status: { in: COUNTED_STATUSES } },
      });
      if (count >= form.capacity) {
        if (form.waitlistEnabled) {
          status = "WAITLISTED";
        } else {
          return jsonWrap({ ok: false, error: "Formulário sem vagas disponíveis." }, { status: 409 });
        }
      }
    }

    const submission = await prisma.organizationFormSubmission.create({
      data: {
        formId,
        userId: user?.id ?? null,
        guestEmail: user ? null : guestEmail,
        status,
        answers: normalizedAnswers as Prisma.InputJsonValue,
      },
    });

    return jsonWrap(
      { ok: true, status: submission.status, submissionId: submission.id },
      { status: 201 },
    );
  } catch (err) {
    console.error("[inscricoes][submit]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
