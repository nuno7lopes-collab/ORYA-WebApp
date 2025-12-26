import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, OrganizationFormSubmissionStatus } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { getCustomPremiumProfileModules, isCustomPremiumActive } from "@/lib/organizerPremium";

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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const formId = Number(id);
    if (!formId || Number.isNaN(formId)) {
      return NextResponse.json({ ok: false, error: "FORM_ID_INVALIDO" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const answersRaw = (body as Record<string, unknown>).answers;
    if (!answersRaw || typeof answersRaw !== "object") {
      return NextResponse.json({ ok: false, error: "Respostas inválidas." }, { status: 400 });
    }

    const form = await prisma.organizationForm.findUnique({
      where: { id: formId },
      include: {
        fields: { orderBy: { order: "asc" } },
        organizer: { select: { id: true, status: true, username: true, liveHubPremiumEnabled: true } },
      },
    });

    if (!form || form.organizer.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: "Formulário não disponível." }, { status: 404 });
    }

    const premiumActive = isCustomPremiumActive(form.organizer);
    const premiumModules = premiumActive ? getCustomPremiumProfileModules(form.organizer) ?? {} : {};
    const allowInscricoes = Boolean(premiumModules.inscricoes);
    const isPublic = form.status !== "ARCHIVED";
    if (!isPublic) {
      return NextResponse.json({ ok: false, error: "Formulário não disponível." }, { status: 404 });
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizerId: form.organizer.id, moduleKey: "INSCRICOES", enabled: true },
      select: { organizerId: true },
    });
    if (!moduleEnabled || !allowInscricoes) {
      return NextResponse.json({ ok: false, error: "Formulário não disponível." }, { status: 404 });
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
            return NextResponse.json({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
          }
          if (trimmedString) normalizedAnswers[key] = trimmedString;
          break;
        }
        case "EMAIL": {
          if (field.required && !trimmedString) {
            return NextResponse.json({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
          }
          if (trimmedString) {
            if (!EMAIL_REGEX.test(trimmedString)) {
              return NextResponse.json({ ok: false, error: `Email inválido em "${field.label}".` }, { status: 400 });
            }
            normalizedAnswers[key] = trimmedString;
            emailAnswer = trimmedString;
          }
          break;
        }
        case "PHONE": {
          if (field.required && !trimmedString) {
            return NextResponse.json({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
          }
          if (trimmedString) {
            if (!isValidPhone(trimmedString)) {
              return NextResponse.json({ ok: false, error: `Telefone inválido em "${field.label}".` }, { status: 400 });
            }
            normalizedAnswers[key] = normalizePhone(trimmedString) || trimmedString;
          }
          break;
        }
        case "NUMBER": {
          if (raw === null || raw === undefined || raw === "") {
            if (field.required) {
              return NextResponse.json({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
            }
            break;
          }
          const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
          if (!Number.isFinite(value)) {
            return NextResponse.json({ ok: false, error: `Número inválido em "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = value;
          break;
        }
        case "DATE": {
          if (!trimmedString) {
            if (field.required) {
              return NextResponse.json({ ok: false, error: `Preenche o campo "${field.label}".` }, { status: 400 });
            }
            break;
          }
          const parsed = parseDateValue(trimmedString);
          if (!parsed) {
            return NextResponse.json({ ok: false, error: `Data inválida em "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = parsed;
          break;
        }
        case "SELECT": {
          const options = Array.isArray(field.options) ? field.options.map((o) => String(o)) : [];
          if (!trimmedString) {
            if (field.required) {
              return NextResponse.json({ ok: false, error: `Escolhe uma opção em "${field.label}".` }, { status: 400 });
            }
            break;
          }
          if (options.length > 0 && !options.includes(trimmedString)) {
            return NextResponse.json({ ok: false, error: `Opção inválida em "${field.label}".` }, { status: 400 });
          }
          normalizedAnswers[key] = trimmedString;
          break;
        }
        case "CHECKBOX": {
          const checked = parseCheckbox(raw);
          if (field.required && !checked) {
            return NextResponse.json({ ok: false, error: `Confirma "${field.label}".` }, { status: 400 });
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
        return NextResponse.json(
          { ok: false, error: "Indica um email válido para completar a inscrição." },
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
        return NextResponse.json({ ok: false, error: "Já tens uma inscrição neste formulário." }, { status: 409 });
      }
    } else if (guestEmail) {
      const existing = await prisma.organizationFormSubmission.findFirst({
        where: { formId, guestEmail },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ ok: false, error: "Este email já está inscrito." }, { status: 409 });
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
          return NextResponse.json({ ok: false, error: "Formulário sem vagas disponíveis." }, { status: 409 });
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

    return NextResponse.json(
      { ok: true, status: submission.status, submissionId: submission.id },
      { status: 201 },
    );
  } catch (err) {
    console.error("[inscricoes][submit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
