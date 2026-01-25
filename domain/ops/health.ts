import { prisma } from "@/lib/prisma";

export async function getOpsHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      ts: new Date().toISOString(),
      db: { ok: true, latencyMs: Date.now() - startedAt },
    };
  } catch {
    return {
      ok: false,
      ts: new Date().toISOString(),
      db: { ok: false, latencyMs: Date.now() - startedAt },
    };
  }
}
