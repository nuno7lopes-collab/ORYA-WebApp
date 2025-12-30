import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const ORGANIZER_COOKIE_NAME = "orya_org";

export function parseOrganizerId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function resolveOrganizerIdFromCookies(): Promise<number | null> {
  try {
    const cookieStore = await cookies();
    return parseOrganizerId(cookieStore.get(ORGANIZER_COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

export function resolveOrganizerIdFromRequest(req: NextRequest): number | null {
  const params = req.nextUrl.searchParams;
  const paramValue = params.get("organizerId") ?? params.get("org");
  return parseOrganizerId(paramValue) ?? parseOrganizerId(req.cookies.get(ORGANIZER_COOKIE_NAME)?.value);
}
