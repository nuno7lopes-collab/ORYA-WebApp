/**
 * Resolve colisões de usernames entre perfis e organizações.
 * Usa: set -a; source .env.local; set +a; npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/resolve_organization_usernames.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { sanitizeUsername } from "../lib/username";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL for Prisma connection.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MAX_USERNAME_LEN = 30;

const buildCandidate = (root: string, suffix?: string) => {
  if (!suffix) return root;
  const room = MAX_USERNAME_LEN - suffix.length;
  const trimmed = room > 0 ? root.slice(0, room) : root.slice(0, MAX_USERNAME_LEN);
  return `${trimmed}${suffix}`;
};

const normalize = (value: string) => value.trim().toLowerCase();

async function main() {
  const profiles = await prisma.profile.findMany({
    where: { username: { not: null } },
    select: { username: true },
  });

  const organizations = await prisma.organization.findMany({
    where: { username: { not: null } },
    select: { id: true, username: true },
  });

  const used = new Set<string>();
  profiles.forEach((p) => {
    if (p.username) used.add(normalize(p.username));
  });

  const updates: Array<{ id: number; from: string | null; to: string }> = [];

  const sorted = [...organizations].sort((a, b) => a.id - b.id);
  for (const org of sorted) {
    const raw = org.username?.trim() ?? "";
    const normalized = raw ? normalize(raw) : "";

    if (normalized && !used.has(normalized)) {
      used.add(normalized);
      continue;
    }

    let root = sanitizeUsername(raw || `organization_${org.id}`);
    if (!root || root.length < 3) {
      root = sanitizeUsername(`organization_${org.id}`);
    }

    let candidate = root;
    if (used.has(candidate)) {
      candidate = buildCandidate(root, "_org");
    }

    let suffix = 2;
    while (used.has(candidate) || candidate.length < 3) {
      candidate = buildCandidate(root, `_org${suffix}`);
      suffix += 1;
    }

    if (candidate !== normalized) {
      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: org.id },
          data: { username: candidate },
        });
        await tx.globalUsername.deleteMany({
          where: {
            ownerType: "organization",
            ownerId: String(org.id),
            username: { not: candidate },
          },
        });
        await tx.globalUsername.upsert({
          where: { username: candidate },
          update: { ownerType: "organization", ownerId: String(org.id), updatedAt: new Date() },
          create: { username: candidate, ownerType: "organization", ownerId: String(org.id) },
        });
      });
      updates.push({ id: org.id, from: org.username ?? null, to: candidate });
      used.add(candidate);
    }
  }

  if (updates.length === 0) {
    console.log("[resolve_organization_usernames] Sem colisões detectadas.");
  } else {
    console.log(`[resolve_organization_usernames] Atualizadas ${updates.length} organizacoes:`);
    updates.forEach((u) => {
      console.log(`- org ${u.id}: ${u.from ?? "(null)"} -> ${u.to}`);
    });
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE app_v3.organizations
            ADD CONSTRAINT organizations_username_key UNIQUE (username);
        EXCEPTION WHEN others THEN
          -- ignore if already exists or conflicts
        END;
      END $$;
    `);
  } catch (err) {
    console.warn("[resolve_organization_usernames] Falha ao aplicar constraint de username:", err);
  }
}

main()
  .catch((err) => {
    console.error("[resolve_organization_usernames] Erro:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
