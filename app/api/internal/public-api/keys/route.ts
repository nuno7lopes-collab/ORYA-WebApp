import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PublicApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPublicApiKey, revokePublicApiKey } from "@/domain/publicApi/keys";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isPublicApiEnabled } from "@/lib/featureFlags";

function parseScopes(value: unknown): PublicApiScope[] {
  const allowed = new Set(Object.values(PublicApiScope));
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => allowed.has(v as PublicApiScope)) as PublicApiScope[];
}

async function _GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isPublicApiEnabled()) {
    return jsonWrap({ ok: false, error: "PUBLIC_API_DISABLED" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const organizationId = Number(params.get("organizationId"));
  if (!Number.isFinite(organizationId)) {
    return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
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

  return jsonWrap({ ok: true, items: keys });
}

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isPublicApiEnabled()) {
    return jsonWrap({ ok: false, error: "PUBLIC_API_DISABLED" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const organizationId = Number(body.organizationId);
  if (!Number.isFinite(organizationId)) {
    return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
  }

  const scopes = parseScopes(body.scopes);
  if (!scopes.length) {
    return jsonWrap({ ok: false, error: "SCOPES_REQUIRED" }, { status: 400 });
  }

  const { record, plaintext } = await createPublicApiKey({
    organizationId,
    scopes,
  });

  return jsonWrap({
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

async function _DELETE(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isPublicApiEnabled()) {
    return jsonWrap({ ok: false, error: "PUBLIC_API_DISABLED" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) {
    return jsonWrap({ ok: false, error: "KEY_ID_REQUIRED" }, { status: 400 });
  }

  await revokePublicApiKey(id);
  return jsonWrap({ ok: true });
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
