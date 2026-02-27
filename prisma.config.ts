// prisma.config.ts
import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Não sobrepor variáveis já fornecidas pelo shell/CI.
dotenv.config({ path: ".env.local", override: false });
dotenv.config({ override: false });

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
