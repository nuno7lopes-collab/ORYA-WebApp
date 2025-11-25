// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '@/lib/env'; // já tens este helper

// Adapter para Postgres (Prisma 7)
const adapter = new PrismaPg({
  connectionString: env.dbUrl, // env.dbUrl = DATABASE_URL no teu env.ts
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}