import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const header =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "";
  const first = header.split(",")[0]?.trim();
  return first || "unknown";
}

export function isSameOrigin(
  req: NextRequest,
  options?: { allowMissing?: boolean }
): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return Boolean(options?.allowMissing);
  try {
    const originUrl = new URL(origin);
    const reqUrl = new URL(req.nextUrl.origin);
    if (originUrl.origin === reqUrl.origin) return true;
    const originHost = originUrl.hostname;
    const reqHost = reqUrl.hostname;
    const isLocalhost =
      (originHost === "localhost" || originHost.endsWith(".localhost")) &&
      (reqHost === "localhost" || reqHost.endsWith(".localhost"));
    return isLocalhost;
  } catch {
    return false;
  }
}

export function isAppRequest(req: NextRequest): boolean {
  const secret = process.env.ORYA_APP_SECRET;
  if (!secret) return false;
  const header =
    req.headers.get("x-orya-app") ||
    req.headers.get("x-orya-app-secret") ||
    "";
  return header === secret;
}

export function isSameOriginOrApp(req: NextRequest): boolean {
  if (isAppRequest(req)) return true;
  return isSameOrigin(req);
}
