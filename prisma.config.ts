// prisma.config.ts
import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: ".env.local", override: true });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // URL usada pelo Prisma CLI (migrations/introspect). Usar ligação direta para evitar pgbouncer.
    url: env("DIRECT_URL"),
    // shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
