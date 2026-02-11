import { NextRequest } from "next/server";

export type MessageScope = "org" | "b2c";

export function getMessagesScope(req: NextRequest): MessageScope {
  const scope = req.nextUrl.searchParams.get("scope")?.trim().toLowerCase();
  return scope === "b2c" ? "b2c" : "org";
}

export function isB2CScope(req: NextRequest) {
  return getMessagesScope(req) === "b2c";
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
