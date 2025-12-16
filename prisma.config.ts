// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // URL principal usada pelo Prisma Client
    url: env("DATABASE_URL"),
    // Se quiseres no futuro, podes ter um shadow DB:
    // shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});