"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { getOutboxOpsSummary } from "@/lib/ops/outboxSummary";
import { replayOutboxEvents } from "@/lib/ops/outboxReplay";

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((role): role is string => typeof role === "string");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((role): role is string => typeof role === "string");
        }
      } catch {
        /* ignore */
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1);
      if (!inner) return [];
      return inner
        .split(",")
        .map((role) => role.trim().replace(/^\"|\"$/g, ""))
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export async function adminLoadOpsSummary() {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return { ok: false as const, error: admin.error, status: admin.status };
  }
  const summary = await getOutboxOpsSummary();
  return { ok: true as const, ...summary };
}

export async function adminReplayOutboxEvents(input: {
  eventIds: string[];
  requestId?: string | null;
}) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return { ok: false as const, error: admin.error, status: admin.status, requestId: input.requestId ?? null };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: admin.userId },
    select: { roles: true },
  });
  const roles = normalizeRoles(profile?.roles);
  if (!roles.includes("ops")) {
    return { ok: false as const, error: "OPS_FORBIDDEN", status: 403, requestId: input.requestId ?? null };
  }

  return replayOutboxEvents({ eventIds: input.eventIds, requestId: input.requestId ?? null });
}
