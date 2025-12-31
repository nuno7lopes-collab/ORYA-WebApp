// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // URL usada pelo Prisma CLI (migrations/introspect). Usar ligação direta para evitar pgbouncer.
    url: env("DIRECT_URL"),
    // Se quiseres no futuro, podes ter um shadow DB:
    // shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
