import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole } from "@prisma/client";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.TRAINER,
];

function parseLimit(value: string | null) {
  const raw = Number(value ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(raw, 1), 200);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
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

    const { channelId } = await context.params;
    const channel = await prisma.internalChatChannel.findFirst({
      where: { id: channelId, organizationId: organization.id },
      select: { id: true, name: true },
    });
    if (!channel) {
      return NextResponse.json({ ok: false, error: "Canal não encontrado." }, { status: 404 });
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const messages = await prisma.internalChatMessage.findMany({
      where: { organizationId: organization.id, channelId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      channel,
      items: messages.slice().reverse(),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/chat/canais/[channelId]/mensagens error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar mensagens." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
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

    const { channelId } = await context.params;
    const channel = await prisma.internalChatChannel.findFirst({
      where: { id: channelId, organizationId: organization.id, isArchived: false },
      select: { id: true, organizationId: true },
    });
    if (!channel) {
      return NextResponse.json({ ok: false, error: "Canal não encontrado." }, { status: 404 });
    }

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (body.length < 1) {
      return NextResponse.json({ ok: false, error: "Mensagem inválida." }, { status: 400 });
    }

    const message = await prisma.internalChatMessage.create({
      data: {
        body,
        organization: { connect: { id: channel.organizationId } },
        channel: { connect: { id: channelId } },
        author: { connect: { id: user.id } },
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, message });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/chat/canais/[channelId]/mensagens error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
