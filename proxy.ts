// Proxy (Next.js) para manter a sessão do Supabase fresca e aplicar regras base de segurança.
// Inclui redirects canónicos/HTTPS, proteção de admin e headers de cache para rotas sensíveis.
import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  CORRELATION_ID_HEADER,
  ORYA_CORRELATION_ID_HEADER,
  ORYA_REQUEST_ID_HEADER,
  REQUEST_ID_HEADER,
} from "@/lib/http/headers";

const ADMIN_HOSTS = (process.env.ADMIN_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);
const CANONICAL_HOST = (process.env.CANONICAL_HOST ?? "").trim().toLowerCase();
const CANONICAL_PROTOCOL = (process.env.CANONICAL_PROTOCOL ?? "https").trim().toLowerCase();
const FORCE_HTTPS = process.env.FORCE_HTTPS !== "0";

const IS_PROD = process.env.NODE_ENV === "production";
const ALLOW_LOCAL_ADMIN = process.env.ALLOW_LOCAL_ADMIN === "1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const SENSITIVE_PATH_PREFIXES = [
  "/admin",
  "/api/admin",
  "/me",
  "/org",
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
    "";
  const candidate = forwarded.split(",")[0] ?? "";
  return normalizeIp(candidate);
}

function getForwardedProto(req: NextRequest) {
  const raw = req.headers.get("x-forwarded-proto");
  if (!raw) return "";
  return raw.split(",")[0]?.trim().toLowerCase() ?? "";
}

function resolveCookieDomainFromHost(hostname: string) {
  const safeHost = hostname.split(":")[0]?.toLowerCase();
  if (!safeHost) return "";
  // Em localhost evitamos "Domain=" (alguns browsers rejeitam e quebra a sessão).
  if (safeHost === "localhost" || safeHost.endsWith(".localhost")) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(safeHost) || safeHost.includes(":")) return "";
  const parts = safeHost.split(".").filter(Boolean);
  if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
  return "";
}

function normalizeHeaderValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveRequestContext(req: NextRequest) {
  const requestId =
    normalizeHeaderValue(req.headers.get(REQUEST_ID_HEADER)) ??
    normalizeHeaderValue(req.headers.get(ORYA_REQUEST_ID_HEADER)) ??
    crypto.randomUUID();
  const correlationId =
    normalizeHeaderValue(req.headers.get(CORRELATION_ID_HEADER)) ??
    normalizeHeaderValue(req.headers.get(ORYA_CORRELATION_ID_HEADER)) ??
    requestId;
  return { requestId, correlationId };
}

function applyRequestContextHeaders(headers: Headers, ctx: { requestId: string; correlationId: string }) {
  headers.set(REQUEST_ID_HEADER, ctx.requestId);
  headers.set(ORYA_REQUEST_ID_HEADER, ctx.requestId);
  headers.set(CORRELATION_ID_HEADER, ctx.correlationId);
  headers.set(ORYA_CORRELATION_ID_HEADER, ctx.correlationId);
}

function isSensitivePath(pathname: string) {
  if (!pathname) return false;
  for (const prefix of SENSITIVE_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function shouldRefreshSupabaseSession(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/me")) return true;
  if (pathname.startsWith("/org")) return true;
  if (pathname.startsWith("/organizacao")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  // Também refresca quando já existem cookies sb-* (evita estado preso em navegação normal)
  return req.cookies.getAll().some((c) => c.name.startsWith("sb-"));
}

function parsePositiveOrgId(raw: string | null | undefined) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function mapLegacyOrganizationAlias(
  req: NextRequest,
  cookieOrgRaw: string | undefined,
): URL | null {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith("/organizacao")) return null;

  const params = new URLSearchParams(req.nextUrl.searchParams);
  const orgId =
    parsePositiveOrgId(params.get("organizationId")) ??
    parsePositiveOrgId(params.get("org")) ??
    parsePositiveOrgId(cookieOrgRaw);
  if (!orgId) return null;

  params.delete("organizationId");
  params.delete("org");
  const suffix = pathname.slice("/organizacao".length);
  let canonicalPath: string | null = null;

  if (suffix === "" || suffix === "/" || suffix === "/overview") {
    const tab = params.get("tab");
    const section = params.get("section");
    params.delete("tab");
    params.delete("section");
    if (tab === "manage") {
      canonicalPath = `/org/${orgId}/manage`;
    } else if (tab === "promote") {
      canonicalPath = `/org/${orgId}/promote`;
    } else if (tab === "profile") {
      canonicalPath = `/org/${orgId}/profile`;
    } else if (tab === "analyze") {
      if (section === "financas" || section === "invoices") {
        canonicalPath = `/org/${orgId}/financas`;
        if (section === "invoices") params.set("tab", "invoices");
      } else {
        canonicalPath = `/org/${orgId}/analytics`;
        if (section === "ops" || section === "vendas") {
          params.set("tab", section);
        } else {
          params.set("tab", "overview");
        }
      }
    } else {
      canonicalPath = `/org/${orgId}/overview`;
    }
  } else if (suffix === "/manage") {
    canonicalPath = `/org/${orgId}/manage`;
  } else if (suffix === "/promote") {
    canonicalPath = `/org/${orgId}/promote`;
  } else if (suffix === "/profile") {
    const section = params.get("section");
    if (section === "followers") {
      params.delete("section");
      canonicalPath = `/org/${orgId}/perfil/seguidores`;
    } else {
      canonicalPath = `/org/${orgId}/profile`;
    }
  } else if (suffix === "/profile/seguidores") {
    canonicalPath = `/org/${orgId}/perfil/seguidores`;
  } else if (suffix === "/scan") {
    canonicalPath = `/org/${orgId}/checkin`;
    if (!params.get("tab")) params.set("tab", "scanner");
  } else if (suffix === "/reservas" || suffix === "/reservas/") {
    canonicalPath = `/org/${orgId}/servicos`;
  } else if (suffix === "/settings") {
    canonicalPath = `/org/${orgId}/settings`;
  } else if (suffix.startsWith("/settings/")) {
    canonicalPath = `/org/${orgId}${suffix}`;
  } else if (suffix.startsWith("/owner/confirm")) {
    canonicalPath = `/org/${orgId}/settings`;
  } else if (suffix === "/pagamentos" || suffix.startsWith("/pagamentos/") || suffix === "/faturacao") {
    canonicalPath = `/org/${orgId}/financas`;
    if (suffix.includes("/invoices")) params.set("tab", "invoices");
  } else if (suffix === "/estatisticas" || suffix === "/analyze") {
    const section = params.get("section");
    params.delete("section");
    if (section === "financas" || section === "invoices") {
      canonicalPath = `/org/${orgId}/financas`;
      if (section === "invoices") params.set("tab", "invoices");
    } else {
      canonicalPath = `/org/${orgId}/analytics`;
      if (section === "ops" || section === "vendas") {
        params.set("tab", section);
      } else if (!params.get("tab")) {
        params.set("tab", "overview");
      }
    }
  } else if (suffix === "/loja") {
    canonicalPath = `/org/${orgId}/loja`;
  }

  if (!canonicalPath) return null;
  const target = req.nextUrl.clone();
  target.pathname = canonicalPath;
  target.search = params.toString() ? `?${params.toString()}` : "";
  if (target.pathname === req.nextUrl.pathname && target.search === req.nextUrl.search) return null;
  return target;
}

function mapCanonicalOrgAliasRewrite(req: NextRequest): URL | null {
  const pathname = req.nextUrl.pathname;
  const match = pathname.match(/^\/org\/(\d+)(?:\/(.*))?$/i);
  if (!match) return null;

  const orgId = parsePositiveOrgId(match[1]);
  if (!orgId) return null;

  const rest = `/${match[2] ?? ""}`.replace(/\/+$/, "") || "/";
  if (rest === "/loja" || rest.startsWith("/loja/")) return null;

  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.set("organizationId", String(orgId));
  let legacyPath: string | null = null;

  if (rest === "/" || rest === "/overview") {
    legacyPath = "/organizacao/overview";
  } else if (rest === "/manage") {
    legacyPath = "/organizacao/manage";
  } else if (rest === "/promote") {
    legacyPath = "/organizacao/promote";
  } else if (rest === "/profile") {
    legacyPath = "/organizacao/profile";
  } else if (rest === "/perfil/seguidores") {
    legacyPath = "/organizacao/profile";
    params.set("section", "followers");
  } else if (rest === "/analytics") {
    legacyPath = "/organizacao/analyze";
    const tab = params.get("tab");
    params.delete("tab");
    if (tab === "vendas" || tab === "ops") {
      params.set("section", tab);
    } else {
      params.set("section", "overview");
    }
  } else if (rest === "/financas") {
    legacyPath = "/organizacao/analyze";
    const tab = params.get("tab");
    params.delete("tab");
    params.set("section", tab === "invoices" ? "invoices" : "financas");
  } else if (rest === "/checkin") {
    legacyPath = "/organizacao/scan";
    if (!params.get("tab")) params.set("tab", "scanner");
  } else if (rest === "/servicos") {
    legacyPath = "/organizacao/reservas";
  } else if (rest === "/settings" || rest.startsWith("/settings/")) {
    legacyPath = `/organizacao${rest}`;
  }

  if (!legacyPath) return null;

  const rewritten = req.nextUrl.clone();
  rewritten.pathname = legacyPath;
  rewritten.search = params.toString() ? `?${params.toString()}` : "";
  return rewritten;
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

export async function proxy(req: NextRequest) {
  const requestContext = resolveRequestContext(req);
  const requestHeaders = new Headers(req.headers);
  applyRequestContextHeaders(requestHeaders, requestContext);

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
    const res = NextResponse.redirect(redirectUrl, 301);
    applyRequestContextHeaders(res.headers, requestContext);
    return res;
  }

  const legacyAliasRedirect = mapLegacyOrganizationAlias(req, req.cookies.get("orya_organization")?.value);
  if (legacyAliasRedirect) {
    const res = NextResponse.redirect(legacyAliasRedirect, 301);
    applyRequestContextHeaders(res.headers, requestContext);
    return res;
  }

  const canonicalAliasRewrite = mapCanonicalOrgAliasRewrite(req);

  const url = canonicalAliasRewrite ?? req.nextUrl.clone();
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
    const res = new NextResponse(null, { status: 404 });
    applyRequestContextHeaders(res.headers, requestContext);
    return res;
  }
  if (isAdminRequest && adminHost && !isAllowedAdminIp(getClientIp(req), hostname)) {
    const res = new NextResponse(null, { status: 403 });
    applyRequestContextHeaders(res.headers, requestContext);
    return res;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const res = shouldRewriteRoot || Boolean(canonicalAliasRewrite)
    ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  applyRequestContextHeaders(res.headers, requestContext);

  const sensitivePath = isSensitivePath(pathname);
  if (sensitivePath) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  const needsSessionRefresh = shouldRefreshSupabaseSession(req);

  if (!supabaseUrl || !supabaseAnonKey || !needsSessionRefresh) {
    return res;
  }
  const orgParam =
    url.searchParams.get("org") ??
    url.searchParams.get("organizationId") ??
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

  const envCookieDomain = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN?.trim() || "";
  const cookieDomain = envCookieDomain || resolveCookieDomainFromHost(hostname);
  const isSecure = forwardedProto === "https" || req.nextUrl.protocol === "https:";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: cookieDomain
      ? {
          domain: cookieDomain,
          path: "/",
          sameSite: "lax",
          ...(isSecure ? { secure: true } : {}),
        }
      : undefined,
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set({ name, value, ...options });
        }
      },
    },
  });

  await supabase.auth.getUser();

  return res;
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
