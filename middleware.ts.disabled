import { NextResponse, type NextRequest } from "next/server";

const ADMIN_PATH_MATCH = ["/admin", "/api/admin"];

function normalizeHost(host: string | null) {
  if (!host) return "";
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

function parseAllowlist(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  return req.ip ?? null;
}

function ipv4ToInt(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function matchesCidr(ip: string, cidr: string) {
  const [base, bitsRaw] = cidr.split("/");
  if (!bitsRaw) return ip === base;
  const bits = Number(bitsRaw);
  if (!Number.isFinite(bits)) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isAllowedIp(ip: string, allowlist: string[]) {
  if (!allowlist.length) return true;
  if (allowlist.includes("*")) return true;
  const isIpv6 = ip.includes(":");
  for (const entry of allowlist) {
    if (entry === "0.0.0.0/0") return true;
    if (entry.includes(":")) {
      if (isIpv6 && entry === ip) return true;
      continue;
    }
    if (entry.includes("/")) {
      if (!isIpv6 && matchesCidr(ip, entry)) return true;
      continue;
    }
    if (!isIpv6 && entry === ip) return true;
  }
  return false;
}

function hasBreakglass(req: NextRequest, token: string | undefined) {
  if (!token) return false;
  const header = req.headers.get("x-breakglass-token")?.trim();
  if (header && header === token) return true;
  const query = req.nextUrl.searchParams.get("breakglass")?.trim();
  return Boolean(query && query === token);
}

function shouldCheckAdmin(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  return ADMIN_PATH_MATCH.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(req: NextRequest) {
  if (!shouldCheckAdmin(req)) return NextResponse.next();

  const host = normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
  if (!host || isLocalHost(host)) return NextResponse.next();

  const envRaw = (process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "prod").toLowerCase();
  const isProd = envRaw === "prod" || envRaw === "production" || host === "admin.orya.pt";
  if (!isProd) return NextResponse.next();

  const breakglassToken = process.env.ADMIN_BREAKGLASS_TOKEN;
  if (hasBreakglass(req, breakglassToken)) {
    console.warn("[admin.allowlist] breakglass used", { ip: parseIp(req), host });
    return NextResponse.next();
  }

  const allowlist = parseAllowlist(process.env.ADMIN_IP_ALLOWLIST);
  const ip = parseIp(req);
  if (!ip || !isAllowedIp(ip, allowlist)) {
    console.warn("[admin.allowlist] blocked", { ip, host });
    return NextResponse.json(
      { ok: false, errorCode: "ADMIN_IP_BLOCKED", message: "Admin access blocked by IP allowlist." },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
