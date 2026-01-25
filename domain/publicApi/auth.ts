import type { NextRequest } from "next/server";
import { PublicApiScope } from "@prisma/client";
import { findPublicApiKeyByHash, hashApiKey, isKeyRevoked, touchPublicApiKeyUsage } from "@/domain/publicApi/keys";

export class PublicApiAuthError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 401, code = "PUBLIC_API_UNAUTHORIZED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type PublicApiContext = {
  apiKeyId: string;
  organizationId: number;
  scopes: PublicApiScope[];
};

function extractApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const headerKey = req.headers.get("x-api-key");
  if (headerKey) return headerKey.trim();
  return null;
}

export async function requirePublicApiKey(
  req: NextRequest,
  requiredScope: PublicApiScope
): Promise<PublicApiContext> {
  const raw = extractApiKey(req);
  if (!raw) {
    throw new PublicApiAuthError("API key em falta");
  }

  const keyHash = hashApiKey(raw);
  const key = await findPublicApiKeyByHash(keyHash);
  if (!key || isKeyRevoked(key)) {
    throw new PublicApiAuthError("API key inválida");
  }

  if (!key.scopes.includes(requiredScope)) {
    throw new PublicApiAuthError("Scope insuficiente", 403, "PUBLIC_API_FORBIDDEN");
  }

  await touchPublicApiKeyUsage(key.id);
  return {
    apiKeyId: key.id,
    organizationId: key.organizationId,
    scopes: key.scopes,
  };
}
