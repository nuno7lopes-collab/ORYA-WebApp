import { prisma } from "@/lib/prisma";
import type { PublicApiKey, PublicApiScope, Prisma } from "@prisma/client";
import { generateApiKey, hashApiKey } from "@/domain/publicApi/keyMaterial";

export type CreatePublicApiKeyInput = {
  organizationId: number;
  scopes: PublicApiScope[];
};

export type PublicApiKeyMaterial = {
  plaintext: string;
  keyPrefix: string;
  keyHash: string;
};

export { hashApiKey, generateApiKey };

export async function createPublicApiKey(
  input: CreatePublicApiKeyInput,
  tx: Prisma.TransactionClient = prisma
) {
  const material = generateApiKey();
  const record = await tx.publicApiKey.create({
    data: {
      organizationId: input.organizationId,
      keyPrefix: material.keyPrefix,
      keyHash: material.keyHash,
      scopes: input.scopes,
    },
  });
  return { record, plaintext: material.plaintext };
}

export async function findPublicApiKeyByHash(hash: string) {
  return prisma.publicApiKey.findUnique({
    where: { keyHash: hash },
  });
}

export async function touchPublicApiKeyUsage(id: string) {
  return prisma.publicApiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

export async function revokePublicApiKey(id: string) {
  return prisma.publicApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export function isKeyRevoked(key: PublicApiKey) {
  return Boolean(key.revokedAt);
}
