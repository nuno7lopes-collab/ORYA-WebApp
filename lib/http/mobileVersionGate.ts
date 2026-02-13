import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";

export const MIN_SUPPORTED_MOBILE_VERSION = process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() || "1.0.0";

function parseSemver(raw: string) {
  const value = raw.trim().replace(/^v/i, "");
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(a: string, b: string) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return 0;
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

function isMobileRequest(req: NextRequest) {
  const platform =
    req.headers.get("x-client-platform") ||
    req.headers.get("x-app-platform") ||
    req.headers.get("x-platform");
  return typeof platform === "string" && platform.trim().toLowerCase() === "mobile";
}

export function enforceMobileVersionGate(req: NextRequest): NextResponse | null {
  if (!isMobileRequest(req)) return null;
  const appVersion = req.headers.get("x-app-version") || req.headers.get("x-client-version");
  if (!appVersion) {
    return jsonWrap(
      {
        ok: false,
        error: "UPGRADE_REQUIRED",
        minVersion: MIN_SUPPORTED_MOBILE_VERSION,
        reason: "APP_VERSION_HEADER_REQUIRED",
      },
      { status: 426 },
    );
  }
  if (compareSemver(appVersion, MIN_SUPPORTED_MOBILE_VERSION) < 0) {
    return jsonWrap(
      {
        ok: false,
        error: "UPGRADE_REQUIRED",
        minVersion: MIN_SUPPORTED_MOBILE_VERSION,
      },
      { status: 426 },
    );
  }
  return null;
}
