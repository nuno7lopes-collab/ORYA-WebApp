// Middleware para manter a sessão do Supabase fresca e aplicar regras base de segurança.
// Inclui redirects canónicos/HTTPS, proteção de admin e headers de cache para rotas sensíveis.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ADMIN_HOSTS = (process.env.ADMIN_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);
const CANONICAL_HOST = (process.env.CANONICAL_HOST ?? "orya.pt").trim().toLowerCase();
const CANONICAL_PROTOCOL = (process.env.CANONICAL_PROTOCOL ?? "https").trim().toLowerCase();
const FORCE_HTTPS = process.env.FORCE_HTTPS !== "0";

const IS_PROD = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production"
  : process.env.NODE_ENV === "production";
const ALLOW_LOCAL_ADMIN = process.env.ALLOW_LOCAL_ADMIN === "1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const SENSITIVE_PATH_PREFIXES = [
  "/admin",
  "/api/admin",
  "/me",
  "/organizacao",
  "/login",
  "/signup",
  "/auth",
  "/reset-password",
  "/api/auth",
];

function getHostname(req: NextRequest) {
  const raw =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "";
  return raw.split(":")[0].toLowerCase();
}

function isAdminHost(hostname: string) {
  if (!hostname) return false;
  if (ADMIN_HOSTS.length > 0) return ADMIN_HOSTS.includes(hostname);
  return hostname.startsWith("admin.");
}

function isLocalHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

function normalizeIp(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

function parseIpv4(raw: string) {
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8) + n;
  }
  return value >>> 0;
}

function isIpv4InCidr(ip: string, cidr: string) {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = parseIpv4(ip);
  const baseInt = parseIpv4(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function getClientIp(req: NextRequest) {
  const forwarded =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-vercel-forwarded-for") ??
    "";
  const candidate = forwarded.split(",")[0] ?? "";
  return normalizeIp(candidate);
}

function getForwardedProto(req: NextRequest) {
  const raw = req.headers.get("x-forwarded-proto");
  if (!raw) return "";
  return raw.split(",")[0]?.trim().toLowerCase() ?? "";
}

function isSensitivePath(pathname: string) {
  if (!pathname) return false;
  for (const prefix of SENSITIVE_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function buildRedirectUrl(req: NextRequest, protocol: string, host: string) {
  const url = req.nextUrl.clone();
  const normalizedProtocol = protocol.endsWith(":") ? protocol : `${protocol}:`;
  url.protocol = normalizedProtocol;
  url.host = host;
  return url;
}

function isAllowedAdminIp(ip: string, hostname: string) {
  if (ADMIN_ALLOWED_IPS.length === 0) return true;
  if (!ip) {
    if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost")) return true;
    return false;
  }
  const normalized = normalizeIp(ip);
  for (const allowedRaw of ADMIN_ALLOWED_IPS) {
    const allowed = normalizeIp(allowedRaw);
    if (!allowed) continue;
    if (allowed.includes("/")) {
      if (isIpv4InCidr(normalized, allowed)) return true;
      continue;
    }
    if (allowed === normalized) return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const hostname = getHostname(req);
  const adminHost =
    isAdminHost(hostname) ||
    (ALLOW_LOCAL_ADMIN && (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost")));
  const localHost = isLocalHost(hostname);
  const forwardedProto = getForwardedProto(req);
  const shouldForceHttps =
    IS_PROD &&
    !localHost &&
    FORCE_HTTPS &&
    forwardedProto === "http" &&
    hostname;
  const shouldRedirectCanonical =
    IS_PROD &&
    !localHost &&
    CANONICAL_HOST &&
    hostname &&
    hostname !== CANONICAL_HOST &&
    !adminHost;
  if (shouldForceHttps || shouldRedirectCanonical) {
    const redirectHost = shouldRedirectCanonical ? CANONICAL_HOST : hostname;
    const redirectProtocol = shouldForceHttps ? "https" : CANONICAL_PROTOCOL || "https";
    const redirectUrl = buildRedirectUrl(req, redirectProtocol, redirectHost);
    return NextResponse.redirect(redirectUrl, 301);
  }

  const url = req.nextUrl.clone();
  const shouldRewriteRoot = adminHost && url.pathname === "/";
  if (shouldRewriteRoot) {
    url.pathname = "/admin";
  }

  const pathname = url.pathname;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  const isAdminRequest = isAdminPath || isAdminApi;

  const enforceAdminHost = IS_PROD || ADMIN_HOSTS.length > 0;
  if (isAdminRequest && !adminHost && enforceAdminHost) {
    return new NextResponse(null, { status: 404 });
  }
  if (isAdminRequest && adminHost && !isAllowedAdminIp(getClientIp(req), hostname)) {
    return new NextResponse(null, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const res = shouldRewriteRoot
    ? NextResponse.rewrite(url)
    : NextResponse.next({ request: { headers: req.headers } });

  const sensitivePath = isSensitivePath(pathname);
  if (sensitivePath) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  const needsSessionRefresh =
    pathname.startsWith("/me") ||
    pathname.startsWith("/organizacao") ||
    isAdminPath;

  if (!supabaseUrl || !supabaseAnonKey || !needsSessionRefresh) {
    return res;
  }
  const orgParam =
    req.nextUrl.searchParams.get("org") ??
    req.nextUrl.searchParams.get("organizationId");
  if (orgParam && /^\d+$/.test(orgParam)) {
    res.cookies.set("orya_organization", orgParam, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const raw = req.cookies.get(name)?.value;
        return raw ?? undefined;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
