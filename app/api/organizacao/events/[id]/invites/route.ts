import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { normalizeEmail } from "@/lib/utils/email";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { validateUsername } from "@/lib/username";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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

async function ensureInviteAccess(
  userId: string,
  eventId: number,
  options?: { requireVerifiedEmail?: boolean },
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!event) return { ok: false as const, status: 404, error: "EVENT_NOT_FOUND" };

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true, onboardingDone: true, fullName: true, username: true },
  });
  if (!profile) {
    return {
      ok: false as const,
      status: 403,
      error: "Perfil não encontrado. Completa o onboarding de utilizador.",
    };
  }
  const hasUserOnboarding =
    profile.onboardingDone ||
    (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
  if (!hasUserOnboarding) {
    return {
      ok: false as const,
      status: 403,
      error:
        "Completa o onboarding de utilizador (nome e username) antes de gerires convites de eventos.",
    };
  }

  const isAdmin = Array.isArray(profile.roles) && profile.roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  if (event.organizationId == null) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }
  const organizationId = event.organizationId;

  const access = await ensureGroupMemberModuleAccess({
    organizationId,
    userId,
    moduleKey: OrganizationModule.EVENTOS,
    required: "EDIT",
  });
  if (!access.ok) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }

  if (options?.requireVerifiedEmail && event.organization) {
    const emailGate = ensureOrganizationEmailVerified(event.organization);
    if (!emailGate.ok) {
      return { ok: false as const, status: 403, error: emailGate.error };
    }
  }

  return { ok: true as const, isAdmin: false };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
    }

    const access = await ensureInviteAccess(user.id, eventId, { requireVerifiedEmail: true });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: access.error }, { status: access.status });
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

    return jsonWrap({
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
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organização/eventos/invites][GET]", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar convites." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
    }

    const access = await ensureInviteAccess(user.id, eventId, { requireVerifiedEmail: true });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: access.error }, { status: access.status });
    }

    let body: { identifier?: string; identifiers?: string[]; scope?: string } | null = null;
    try {
      body = (await req.json()) as { identifier?: string; identifiers?: string[]; scope?: string };
    } catch {
      return jsonWrap({ ok: false, error: "BODY_INVALID" }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "IDENTIFIER_REQUIRED" }, { status: 400 });
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
      return jsonWrap({ ok: false, error: errors[0] }, { status: 400 });
    }

    if (normalizedEntries.length === 0) {
      return jsonWrap({ ok: false, error: errors[0] ?? "IDENTIFIER_INVALID" }, { status: 400 });
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

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organização/eventos/invites][POST]", err);
    return jsonWrap({ ok: false, error: "Erro ao criar convite." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
    }

    const access = await ensureInviteAccess(user.id, eventId);
    if (!access.ok) {
      return jsonWrap({ ok: false, error: access.error }, { status: access.status });
    }

    let body: { inviteId?: number } | null = null;
    try {
      body = (await req.json()) as { inviteId?: number };
    } catch {
      return jsonWrap({ ok: false, error: "BODY_INVALID" }, { status: 400 });
    }

    const inviteId = Number(body?.inviteId);
    if (!Number.isFinite(inviteId)) {
      return jsonWrap({ ok: false, error: "INVITE_ID_INVALID" }, { status: 400 });
    }

    const invite = await prisma.eventInvite.findUnique({
      where: { id: inviteId },
      select: { eventId: true },
    });
    if (!invite || invite.eventId !== eventId) {
      return jsonWrap({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    await prisma.eventInvite.delete({ where: { id: inviteId } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organização/eventos/invites][DELETE]", err);
    return jsonWrap({ ok: false, error: "Erro ao remover convite." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
