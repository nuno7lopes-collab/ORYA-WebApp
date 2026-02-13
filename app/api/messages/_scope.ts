import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

export type MessageScope = "org" | "b2c";

export function getMessagesScope(req: NextRequest): MessageScope {
  const scope = req.nextUrl.searchParams.get("scope")?.trim().toLowerCase();
  return scope === "b2c" ? "b2c" : "org";
}

export function isB2CScope(req: NextRequest) {
  return getMessagesScope(req) === "b2c";
}

function getClientPlatform(req: NextRequest) {
  const platform =
    req.headers.get("x-client-platform") ||
    req.headers.get("x-app-platform") ||
    req.headers.get("x-platform");
  return platform?.trim().toLowerCase() ?? "";
}

export function isMobileClientRequest(req: NextRequest) {
  return getClientPlatform(req) === "mobile";
}

export function enforceMobileClientRequest(req: NextRequest): Response | null {
  if (!isMobileClientRequest(req)) {
    return jsonWrap(
      {
        ok: false,
        error: "MOBILE_APP_REQUIRED",
      },
      { status: 403 },
    );
  }
  return enforceMobileVersionGate(req);
}

export function enforceB2CMobileOnly(req: NextRequest): Response | null {
  if (!isB2CScope(req)) return null;
  return enforceMobileClientRequest(req);
}

export async function cloneWithJsonBody(req: NextRequest, body: unknown) {
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return new NextRequest(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(body),
  });
}
