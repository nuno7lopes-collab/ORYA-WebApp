import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { normalizeEmail } from "@/lib/utils/email";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { validateUsername } from "@/lib/username";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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
    const emailGate = ensureOrganizationEmailVerified(event.organization, { reasonCode: "EVENTS_INVITES" });
    if (!emailGate.ok) {
      return { ...emailGate, status: 403 };
    }
  }

  return { ok: true as const, isAdmin: false };
}

async function fail(
  ctx: RequestContext,
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return fail(ctx, 400, "EVENT_ID_INVALID");
    }

    const access = await ensureInviteAccess(user.id, eventId, { requireVerifiedEmail: true });
    if (!access.ok) {
      return respondError(
        ctx,
        {
          errorCode: access.error ?? "FORBIDDEN",
          message: access.error ?? "Sem permissões.",
          retryable: false,
          details: access,
        },
        { status: access.status },
      );
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

    return respondOk(ctx, {
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
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("[organização/eventos/invites][GET]", err);
    return fail(ctx, 500, "Erro ao carregar convites.");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return fail(ctx, 400, "EVENT_ID_INVALID");
    }

    const access = await ensureInviteAccess(user.id, eventId, { requireVerifiedEmail: true });
    if (!access.ok) {
      return respondError(
        ctx,
        {
          errorCode: access.error ?? "FORBIDDEN",
          message: access.error ?? "Sem permissões.",
          retryable: false,
          details: access,
        },
        { status: access.status },
      );
    }

    let body: { identifier?: string; identifiers?: string[]; scope?: string } | null = null;
    try {
      body = (await req.json()) as { identifier?: string; identifiers?: string[]; scope?: string };
    } catch {
      return fail(ctx, 400, "BODY_INVALID");
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
      return fail(ctx, 400, "IDENTIFIER_REQUIRED");
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
      return fail(ctx, 400, errors[0]);
    }

    if (normalizedEntries.length === 0) {
      return fail(ctx, 400, errors[0] ?? "IDENTIFIER_INVALID");
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

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("[organização/eventos/invites][POST]", err);
    return fail(ctx, 500, "Erro ao criar convite.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return fail(ctx, 400, "EVENT_ID_INVALID");
    }

    const access = await ensureInviteAccess(user.id, eventId);
    if (!access.ok) {
      return respondError(
        ctx,
        {
          errorCode: access.error ?? "FORBIDDEN",
          message: access.error ?? "Sem permissões.",
          retryable: false,
          details: access,
        },
        { status: access.status },
      );
    }

    let body: { inviteId?: number } | null = null;
    try {
      body = (await req.json()) as { inviteId?: number };
    } catch {
      return fail(ctx, 400, "BODY_INVALID");
    }

    const inviteId = Number(body?.inviteId);
    if (!Number.isFinite(inviteId)) {
      return fail(ctx, 400, "INVITE_ID_INVALID");
    }

    const invite = await prisma.eventInvite.findUnique({
      where: { id: inviteId },
      select: { eventId: true },
    });
    if (!invite || invite.eventId !== eventId) {
      return fail(ctx, 404, "INVITE_NOT_FOUND");
    }

    await prisma.eventInvite.delete({ where: { id: inviteId } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("[organização/eventos/invites][DELETE]", err);
    return fail(ctx, 500, "Erro ao remover convite.");
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
