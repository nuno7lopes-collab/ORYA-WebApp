import { NextRequest } from "next/server";

function readPathSegments(req: NextRequest) {
  return req.nextUrl.pathname.split("/").filter(Boolean);
}

export function readPathParam(
  paramsValue: string | undefined,
  req: NextRequest,
  marker?: string,
  fallbackFromEnd = 2,
): string | null {
  if (paramsValue && paramsValue.trim()) return paramsValue;

  const segments = readPathSegments(req);
  if (marker) {
    const idx = segments.indexOf(marker);
    if (idx !== -1 && idx + 1 < segments.length) {
      return segments[idx + 1] ?? null;
    }
  }

  if (segments.length >= fallbackFromEnd) {
    return segments[segments.length - fallbackFromEnd] ?? null;
  }

  return null;
}

export function readNumericParam(
  paramsValue: string | undefined,
  req: NextRequest,
  marker?: string,
  fallbackFromEnd = 2,
): number | null {
  const raw = readPathParam(paramsValue, req, marker, fallbackFromEnd);
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
