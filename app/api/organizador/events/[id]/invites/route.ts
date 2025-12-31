import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { canManageEvents } from "@/lib/organizerPermissions";
import { normalizeEmail } from "@/lib/utils/email";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { validateUsername } from "@/lib/username";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const VALID_SCOPES = new Set(["PUBLIC", "PARTICIPANT"]);

function normalizeScope(raw: string | null | undefined) {
  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return VALID_SCOPES.has(normalized) ? (normalized as "PUBLIC" | "PARTICIPANT") : null;
}

function normalizeInviteIdentifier(raw: string) {
  const value = raw.trim();
  if (!value) return { ok: false as const, error: "Identificador vazio." };

  const explicitUsername = value.startsWith("@") && !value.slice(1).includes("@");
  if (explicitUsername) {
    const withoutAt = value.slice(1);
    const validation = validateUsername(withoutAt);
    if (!validation.valid) {
      return { ok: false as const, error: validation.error };
    }
    return { ok: true as const, normalized: validation.normalized, type: "username" as const };
  }

  if (value.includes("@")) {
    if (!EMAIL_REGEX.test(value)) {
      return { ok: false as const, error: "Email inválido." };
    }
    const normalized = normalizeEmail(value);
    if (!normalized) {
      return { ok: false as const, error: "Email inválido." };
    }
    return { ok: true as const, normalized, type: "email" as const };
  }

  const validation = validateUsername(value);
  if (!validation.valid) {
    return { ok: false as const, error: validation.error };
  }
  return { ok: true as const, normalized: validation.normalized, type: "username" as const };
}

async function ensureInviteAccess(userId: string, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  if (!event) return { ok: false as const, status: 404, error: "EVENT_NOT_FOUND" };

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  const isAdmin = Array.isArray(profile?.roles) && profile?.roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  if (!event.organizerId) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }

  const membership = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId: event.organizerId, userId } },
    select: { role: true },
  });
  if (!membership || !canManageEvents(membership.role)) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true as const, isAdmin: false };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const eventId = Number(params.id);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
    }

    const access = await ensureInviteAccess(user.id, eventId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    const scope = normalizeScope(req.nextUrl.searchParams.get("scope"));

    const invites = await prisma.eventInvite.findMany({
      where: { eventId, ...(scope ? { scope } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        targetIdentifier: true,
        targetUserId: true,
        scope: true,
        createdAt: true,
        targetUser: {
          select: { id: true, username: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      items: invites.map((invite) => ({
        id: invite.id,
        targetIdentifier: invite.targetIdentifier,
        targetUserId: invite.targetUserId,
        scope: invite.scope,
        createdAt: invite.createdAt,
        targetUser: invite.targetUser,
      })),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organizador/eventos/invites][GET]", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar convites." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const eventId = Number(params.id);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
    }

    const access = await ensureInviteAccess(user.id, eventId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    let body: { identifier?: string; identifiers?: string[]; scope?: string } | null = null;
    try {
      body = (await req.json()) as { identifier?: string; identifiers?: string[]; scope?: string };
    } catch {
      return NextResponse.json({ ok: false, error: "BODY_INVALID" }, { status: 400 });
    }

    const scope = normalizeScope(body?.scope) ?? "PUBLIC";

    const rawList = Array.isArray(body?.identifiers)
      ? body.identifiers
      : typeof body?.identifier === "string"
        ? [body.identifier]
        : [];

    const cleaned = rawList
      .flatMap((value) => value.split(/[\n,;]/g))
      .map((value) => value.trim())
      .filter(Boolean);

    if (cleaned.length === 0) {
      return NextResponse.json({ ok: false, error: "IDENTIFIER_REQUIRED" }, { status: 400 });
    }

    const normalizedEntries: {
      normalized: string;
      type: "email" | "username";
      targetUserId: string | null;
    }[] = [];
    const errors: string[] = [];

    for (const raw of cleaned) {
      const normalized = normalizeInviteIdentifier(raw);
      if (!normalized.ok) {
        errors.push(normalized.error);
        continue;
      }
      const resolved = await resolveUserIdentifier(normalized.normalized).catch(() => null);
      if (normalized.type === "username" && !resolved?.userId) {
        errors.push("Username não encontrado. Usa convite por email para pessoas sem conta.");
        continue;
      }
      normalizedEntries.push({
        normalized: normalized.normalized,
        type: normalized.type,
        targetUserId: resolved?.userId ?? null,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, error: errors[0] }, { status: 400 });
    }

    if (normalizedEntries.length === 0) {
      return NextResponse.json({ ok: false, error: errors[0] ?? "IDENTIFIER_INVALID" }, { status: 400 });
    }

    await prisma.eventInvite.createMany({
      data: normalizedEntries.map((entry) => ({
        eventId,
        invitedByUserId: user.id,
        targetIdentifier: entry.normalized,
        targetUserId: entry.targetUserId ?? undefined,
        scope,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organizador/eventos/invites][POST]", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar convite." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const eventId = Number(params.id);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
    }

    const access = await ensureInviteAccess(user.id, eventId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    let body: { inviteId?: number } | null = null;
    try {
      body = (await req.json()) as { inviteId?: number };
    } catch {
      return NextResponse.json({ ok: false, error: "BODY_INVALID" }, { status: 400 });
    }

    const inviteId = Number(body?.inviteId);
    if (!Number.isFinite(inviteId)) {
      return NextResponse.json({ ok: false, error: "INVITE_ID_INVALID" }, { status: 400 });
    }

    const invite = await prisma.eventInvite.findUnique({
      where: { id: inviteId },
      select: { eventId: true },
    });
    if (!invite || invite.eventId !== eventId) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    await prisma.eventInvite.delete({ where: { id: inviteId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organizador/eventos/invites][DELETE]", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover convite." }, { status: 500 });
  }
}
