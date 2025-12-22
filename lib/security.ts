// lib/security.ts
//
// Helpers simples de segurança/autorização para ser usados nas rotas/API.
//

import type { SupabaseClient, User } from "@supabase/supabase-js";

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UNAUTHENTICATED";
  }
}

export function isUnauthenticatedError(err: unknown): boolean {
  return err instanceof UnauthenticatedError || (err instanceof Error && err.message === "UNAUTHENTICATED");
}

/**
 * Garante que existe um utilizador autenticado.
 * - Se não houver sessão, lança um erro "UNAUTHENTICATED".
 * - Se houver, devolve o user do Supabase.
 */
export async function ensureAuthenticated(
  supabase: SupabaseClient
): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthenticatedError();
  }

  return user;
}

/**
 * Tipo mínimo de evento necessário para validações de ownership.
 * Não depende de Prisma, apenas da forma dos campos usados nas checks.
 */
export type BasicEventForSecurity = {
  id: string;
  ownerUserId: string;
  type: string;
};

/**
 * Garante que o utilizador é o dono de um evento do utilizador (event.type = "EXPERIENCE").
 * - Lança "EVENT_NOT_FOUND" se o evento vier nulo/undefined.
 * - Lança "NOT_USER_EVENT" se não for um evento do utilizador.
 * - Lança "NOT_EVENT_OWNER" se o ownerUserId não coincidir com o userId.
 * Se tudo estiver OK, não devolve nada (return void).
 */
export function assertUserEventOwner(
  userId: string,
  event: BasicEventForSecurity | null | undefined
): void {
  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  if (event.type !== "EXPERIENCE") {
    throw new Error("NOT_USER_EVENT");
  }

  if (event.ownerUserId !== userId) {
    throw new Error("NOT_EVENT_OWNER");
  }
}

export function isOrganizer(
  profile:
    | { roles?: string[] | null }
    | null
    | undefined
): boolean {
  if (!profile || !profile.roles) return false;
  return profile.roles.includes("organizer");
}

export function assertOrganizer(
  user: User | null | undefined,
  profile:
    | { id: string; roles?: string[] | null }
    | null
    | undefined,
  _organizer?: { userId: string } | null
): void {
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!isOrganizer(profile)) {
    throw new Error("NOT_ORGANIZER");
  }
}

export type BasicStaffAssignment = {
  organizerId: number | null;
  eventId: number | null;
  scope: "GLOBAL" | "EVENT";
  revokedAt?: Date | null;
};

export type BasicEventForStaff = {
  id: number;
  organizerId: number | null;
};

export function isStaffAssignmentForEvent(
  assignments: BasicStaffAssignment[] | null | undefined,
  event: BasicEventForStaff | null | undefined
): boolean {
  if (!assignments || !event) return false;

  const eventId = event.id;
  const organizerId = event.organizerId;

  return assignments.some((assignment) => {
    if (assignment.revokedAt) return false;

    if (assignment.scope === "EVENT" && assignment.eventId === eventId) {
      return true;
    }

    if (
      assignment.scope === "GLOBAL" &&
      organizerId != null &&
      assignment.organizerId === organizerId
    ) {
      return true;
    }

    return false;
  });
}

export function assertStaffForEvent(
  user: User | null | undefined,
  assignments: BasicStaffAssignment[] | null | undefined,
  event: BasicEventForStaff | null | undefined
): void {
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const hasAccess = isStaffAssignmentForEvent(assignments, event);

  if (!hasAccess) {
    throw new Error("NOT_STAFF_FOR_EVENT");
  }
}
