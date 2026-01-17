import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
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
    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
    }
    if (!(await ensureInscricoesEnabled(organization))) {
      return NextResponse.json({ ok: false, error: "Módulo de formulários desativado." }, { status: 403 });
    }

    const forms = await prisma.organizationForm.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: { select: { submissions: true } },
      },
    });

    return NextResponse.json(
      {
        ok: true,
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
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Indica um título para o formulário." }, { status: 400 });
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

    return NextResponse.json(
      {
        ok: true,
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
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
