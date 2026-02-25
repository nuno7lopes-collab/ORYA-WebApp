import type { NextRequest } from "next/server";
import { isIP } from "node:net";

function normalizeIpCandidate(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;
  let value = rawValue.trim();
  if (!value) return null;

  // RFC 7239: for=1.2.3.4;proto=https
  if (value.toLowerCase().startsWith("for=")) {
    const token = value.split(";")[0] ?? value;
    value = token.slice(4).trim();
  }

  if (value.startsWith("\"") && value.endsWith("\"")) {
    value = value.slice(1, -1).trim();
  }

  // [2001:db8::1]:443
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 1) {
      value = value.slice(1, end);
    }
  } else if (value.includes(":") && (value.match(/:/g)?.length ?? 0) === 1) {
    // IPv4 with port.
    const [host, maybePort] = value.split(":");
    if (host && maybePort && /^\d+$/.test(maybePort) && isIP(host) === 4) {
      value = host;
    }
  }

  // Strip zone id from IPv6 literal (fe80::1%eth0).
  const zoneIndex = value.indexOf("%");
  if (zoneIndex > 0) {
    value = value.slice(0, zoneIndex);
  }

  return isIP(value) ? value : null;
}

function parseForwardedFor(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const tokens = forwardedFor
    .split(",")
    .map((token) => normalizeIpCandidate(token))
    .filter((token): token is string => Boolean(token));
  if (!tokens.length) return null;

  // Right-most hop is closest to this app and less spoofable than left-most.
  return tokens[tokens.length - 1] ?? null;
}

function parseForwardedHeader(forwardedHeader: string | null): string | null {
  if (!forwardedHeader) return null;
  const tokens = forwardedHeader
    .split(",")
    .map((token) => token.trim())
    .map((token) => normalizeIpCandidate(token))
    .filter((token): token is string => Boolean(token));
  if (!tokens.length) return null;
  return tokens[tokens.length - 1] ?? null;
}

export function getClientIp(req: NextRequest): string {
  const preferredHeaders = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
    req.headers.get("x-real-ip"),
    parseForwardedHeader(req.headers.get("forwarded")),
    parseForwardedFor(req.headers.get("x-forwarded-for")),
  ];

  for (const candidate of preferredHeaders) {
    const normalized = normalizeIpCandidate(candidate);
    if (normalized) return normalized;
  }

  return "unknown";
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
