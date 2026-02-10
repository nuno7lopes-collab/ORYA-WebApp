import type { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import {
  readAdminHost,
  readMfaSessionCookie,
  shouldRequireAdminMfa,
  verifyMfaSession,
} from "@/lib/admin/mfaSession";
import { headers } from "next/headers";

type AdminAuthResult =
  | { ok: true; userId: string; userEmail: string | null }
  | { ok: false; status: number; error: string };

type RequireAdminOptions = {
  req?: NextRequest | Request;
  skipMfa?: boolean;
};

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

function parseAllowlist(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ipv4ToLong(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function cidrContains(cidr: string, ip: string) {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const ipLong = ipv4ToLong(ip);
  const baseLong = ipv4ToLong(base);
  if (ipLong === null || baseLong === null || !Number.isFinite(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (baseLong & mask);
}

function isIpAllowed(ip: string | null, allowlist: string[]) {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  if (allowlist.includes("*")) return true;
  for (const entry of allowlist) {
    if (entry.includes("/")) {
      if (cidrContains(entry, ip)) return true;
    } else if (entry === ip) {
      return true;
    }
  }
  return false;
}

async function readClientIp(req?: NextRequest | Request) {
  if (req && "headers" in req) {
    const header =
      (req as NextRequest).headers.get("x-forwarded-for") ||
      (req as NextRequest).headers.get("x-real-ip") ||
      "";
    const first = header.split(",")[0]?.trim();
    return first || null;
  }
  try {
    const hdrs = await headers();
    const header = hdrs.get("x-forwarded-for") || hdrs.get("x-real-ip") || "";
    const first = header.split(",")[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

export async function requireAdminUser(options: RequireAdminOptions = {}): Promise<AdminAuthResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  }

  const allowlistRaw = process.env.ADMIN_ACCESS_IP_ALLOWLIST ?? "";
  const allowlist = parseAllowlist(allowlistRaw);
  if (allowlist.length > 0) {
    const ip = await readClientIp(options.req);
    if (!isIpAllowed(ip, allowlist)) {
      return { ok: false, status: 403, error: "IP_NOT_ALLOWED" };
    }
  }

  const host = await readAdminHost(options.req);
  const safeHost = (host ?? "").split(":")[0].toLowerCase();
  const isLocalHost =
    safeHost === "localhost" ||
    safeHost === "127.0.0.1" ||
    safeHost === "0.0.0.0" ||
    safeHost.endsWith(".localhost");
  const allowLocalBypass = isLocalHost && process.env.ALLOW_LOCAL_ADMIN === "1";
  if (allowLocalBypass) {
    return { ok: true, userId: user.id, userEmail: user.email ?? null };
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

  if (!options.skipMfa) {
    if (shouldRequireAdminMfa(host)) {
      const token = await readMfaSessionCookie(options.req);
      const session = verifyMfaSession(token, user.id);
      if (!session.ok) {
        return { ok: false, status: 403, error: "MFA_REQUIRED" };
      }
    }
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
