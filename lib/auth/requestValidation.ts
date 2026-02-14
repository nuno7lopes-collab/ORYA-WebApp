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
  const secFetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite) {
    if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
      return true;
    }
    return false;
  }
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return Boolean(options?.allowMissing);
  try {
    const originUrl = new URL(origin);
    const reqUrl = new URL(req.nextUrl.origin);
    if (originUrl.origin === reqUrl.origin) return true;

    // In local/dev proxies, req.nextUrl may resolve to loopback.
    // Accept the incoming host/proto headers as canonical request origin.
    const forwardedHostRaw = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const forwardedHost = forwardedHostRaw.split(",")[0]?.trim().toLowerCase() || "";
    const forwardedProtoRaw = req.headers.get("x-forwarded-proto") || "";
    const forwardedProto = forwardedProtoRaw.split(",")[0]?.trim().toLowerCase() || "";
    const originHostWithPort = originUrl.host.toLowerCase();
    const originProto = originUrl.protocol.replace(/:$/, "").toLowerCase();

    if (forwardedHost && originHostWithPort === forwardedHost) {
      if (!forwardedProto || forwardedProto === originProto) return true;
    }

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
