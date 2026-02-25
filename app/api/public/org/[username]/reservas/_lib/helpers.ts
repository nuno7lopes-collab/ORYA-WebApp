import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeUsernameInput } from "@/lib/username";

export function parsePositiveInt(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

export async function resolveOrganizationByUsername(rawUsername: string) {
  const username = normalizeUsernameInput(rawUsername);
  if (!username) return null;
  return prisma.organization.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      status: "ACTIVE",
    },
    select: {
      id: true,
      username: true,
      timezone: true,
      settings: {
        select: {
          bookingAcceptNewReservations: true,
        },
      },
    },
  });
}

export async function proxyJsonToServiceApi(params: {
  req: NextRequest;
  serviceId: number;
  pathnameSuffix: "calendario" | "reservar";
  method: "GET" | "POST";
  query?: URLSearchParams;
  body?: unknown;
}) {
  const url = new URL(`/api/servicos/${params.serviceId}/${params.pathnameSuffix}`, params.req.nextUrl.origin);
  if (params.query) {
    url.search = params.query.toString();
  }

  const cookie = params.req.headers.get("cookie");
  const userAgent = params.req.headers.get("user-agent");
  const upstream = await fetch(url, {
    method: params.method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(userAgent ? { "user-agent": userAgent } : {}),
      ...(params.method === "POST" ? { "content-type": "application/json" } : {}),
    },
    ...(params.method === "POST" ? { body: JSON.stringify(params.body ?? {}) } : {}),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
