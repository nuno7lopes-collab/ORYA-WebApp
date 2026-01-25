import { NextRequest, NextResponse } from "next/server";
import { PublicApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPublicApiKey, revokePublicApiKey } from "@/domain/publicApi/keys";

function requireInternalSecret(req: NextRequest) {
  const secret = req.headers.get("X-ORYA-CRON-SECRET");
  if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

function parseScopes(value: unknown): PublicApiScope[] {
  const allowed = new Set(Object.values(PublicApiScope));
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => allowed.has(v as PublicApiScope)) as PublicApiScope[];
}

export async function GET(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const params = req.nextUrl.searchParams;
  const organizationId = Number(params.get("organizationId"));
  if (!Number.isFinite(organizationId)) {
    return NextResponse.json({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
  }

  const keys = await prisma.publicApiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyPrefix: true,
      scopes: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, items: keys });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const organizationId = Number(body.organizationId);
  if (!Number.isFinite(organizationId)) {
    return NextResponse.json({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
  }

  const scopes = parseScopes(body.scopes);
  if (!scopes.length) {
    return NextResponse.json({ ok: false, error: "SCOPES_REQUIRED" }, { status: 400 });
  }

  const { record, plaintext } = await createPublicApiKey({
    organizationId,
    scopes,
  });

  return NextResponse.json({
    ok: true,
    key: {
      id: record.id,
      prefix: record.keyPrefix,
      scopes: record.scopes,
      createdAt: record.createdAt,
    },
    plaintext,
  });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, error: "KEY_ID_REQUIRED" }, { status: 400 });
  }

  await revokePublicApiKey(id);
  return NextResponse.json({ ok: true });
}
