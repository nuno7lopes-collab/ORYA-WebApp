import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

type AdminAuthResult =
  | { ok: true; userId: string; userEmail: string | null }
  | { ok: false; status: number; error: string };

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export async function requireAdminUser(): Promise<AdminAuthResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  }

  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(user.id)) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });

  const roles = normalizeRoles(profile?.roles);
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true, userId: user.id, userEmail: user.email ?? null };
}

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
