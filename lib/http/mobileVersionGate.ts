import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";

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
  if (!va || !vb) return null;
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

function getClientPlatform(req: NextRequest) {
  const platform =
    req.headers.get("x-client-platform") ||
    req.headers.get("x-app-platform") ||
    req.headers.get("x-platform");
  return platform?.trim().toLowerCase() ?? "";
}

function isMobileRequest(req: NextRequest) {
  const platform = getClientPlatform(req);
  return platform === "mobile" || platform === "ios" || platform === "android";
}

type MobileRuntimePlatform = "ios" | "android" | "unknown";

function resolveMobileRuntimePlatform(req: NextRequest): MobileRuntimePlatform {
  const explicitPlatform = getClientPlatform(req);
  if (explicitPlatform === "ios" || explicitPlatform === "android") {
    return explicitPlatform;
  }
  const os =
    req.headers.get("x-app-os") ||
    req.headers.get("x-mobile-os") ||
    req.headers.get("x-device-platform") ||
    req.nextUrl.searchParams.get("os");
  const normalized = os?.trim().toLowerCase() ?? "";
  if (normalized === "ios" || normalized === "android") return normalized;
  return "unknown";
}

function resolveMinSupportedMobileVersion(platform: MobileRuntimePlatform) {
  if (platform === "ios") {
    return (
      process.env.MIN_SUPPORTED_MOBILE_VERSION_IOS?.trim() ||
      process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() ||
      null
    );
  }
  if (platform === "android") {
    return (
      process.env.MIN_SUPPORTED_MOBILE_VERSION_ANDROID?.trim() ||
      process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() ||
      null
    );
  }
  return process.env.MIN_SUPPORTED_MOBILE_VERSION?.trim() || null;
}

function isPlatformKillSwitchEnabled(platform: MobileRuntimePlatform, appVersion: string) {
  const globalSwitch = process.env.MOBILE_KILL_SWITCH_ALL?.trim();
  if (globalSwitch === "1") return true;
  if (platform === "unknown") return false;
  const scopedRaw =
    platform === "ios"
      ? process.env.MOBILE_KILL_SWITCH_IOS?.trim()
      : process.env.MOBILE_KILL_SWITCH_ANDROID?.trim();
  if (!scopedRaw) return false;
  if (scopedRaw === "1" || scopedRaw === "*") return true;
  const blockedVersions = scopedRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return blockedVersions.includes(appVersion.trim());
}

export function enforceMobileVersionGate(req: NextRequest): Response | null {
  if (!isMobileRequest(req)) return null;
  const runtimePlatform = resolveMobileRuntimePlatform(req);
  const minVersion = resolveMinSupportedMobileVersion(runtimePlatform);
  if (!minVersion || !parseSemver(minVersion)) {
    return null;
  }
  const appVersion = req.headers.get("x-app-version") || req.headers.get("x-client-version");
  if (!appVersion) {
    return jsonWrap(
      {
        ok: false,
        error: "UPGRADE_REQUIRED",
        minVersion,
        reason: "APP_VERSION_HEADER_REQUIRED",
      },
      { status: 426 },
    );
  }
  if (!parseSemver(appVersion)) {
    return jsonWrap(
      {
        ok: false,
        error: "UPGRADE_REQUIRED",
        minVersion,
        reason: "APP_VERSION_INVALID",
      },
      { status: 426 },
    );
  }
  if (isPlatformKillSwitchEnabled(runtimePlatform, appVersion)) {
    return jsonWrap(
      {
        ok: false,
        error: "UPGRADE_REQUIRED",
        minVersion,
        reason: "PLATFORM_KILL_SWITCH",
      },
      { status: 426 },
    );
  }
  if ((compareSemver(appVersion, minVersion) ?? -1) < 0) {
    return jsonWrap(
      {
        ok: false,
        error: "UPGRADE_REQUIRED",
        minVersion,
      },
      { status: 426 },
    );
  }
  return null;
}
