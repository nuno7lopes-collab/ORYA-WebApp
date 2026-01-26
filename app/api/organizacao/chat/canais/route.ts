import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole, Prisma } from "@prisma/client";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.TRAINER,
];

const DEFAULT_CHANNELS = [
  { name: "Geral", description: "Conversas rápidas da equipa." },
  { name: "Operações", description: "Coordenação do dia-a-dia." },
  { name: "Financeiro", description: "Notas internas e alertas." },
];

function parseLimit(value: string | null) {
  const raw = Number(value ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(raw, 1), 200);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: organization.id, moduleKey: "MENSAGENS", enabled: true },
      select: { moduleKey: true },
    });
    if (!moduleEnabled) {
      return NextResponse.json({ ok: false, error: "Chat interno desativado." }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const includeArchived = params.get("includeArchived") === "true";
    const limit = parseLimit(params.get("limit"));

    await prisma.$transaction(async (tx) => {
      const count = await tx.internalChatChannel.count({
        where: { organizationId: organization.id },
      });
      if (count === 0) {
        await tx.internalChatChannel.createMany({
          data: DEFAULT_CHANNELS.map((channel) => ({
            organizationId: organization.id,
            name: channel.name,
            description: channel.description,
          })),
          skipDuplicates: true,
        });
      }
    });

    const channels = await prisma.internalChatChannel.findMany({
      where: {
        organizationId: organization.id,
        ...(includeArchived ? {} : { isArchived: false }),
      } as Prisma.InternalChatChannelWhereInput,
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, items: channels });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/chat/canais error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar canais." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: organization.id, moduleKey: "MENSAGENS", enabled: true },
      select: { moduleKey: true },
    });
    if (!moduleEnabled) {
      return NextResponse.json({ ok: false, error: "Chat interno desativado." }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : null;

    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Nome do canal inválido." }, { status: 400 });
    }

    let channel;
    try {
      channel = await prisma.internalChatChannel.create({
        data: {
          organizationId: organization.id,
          name,
          description: description || undefined,
          createdByUserId: user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json({ ok: false, error: "Canal já existe." }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true, channel });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/chat/canais error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar canal." }, { status: 500 });
  }
}
