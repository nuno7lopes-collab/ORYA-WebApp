import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FORMAT_FILES = [
  "app/api/organizacao/events/create/route.ts",
  "app/api/padel/tournaments/config/route.ts",
  "app/api/padel/discover/route.ts",
  "app/api/padel/event-categories/route.ts",
  "app/api/padel/matches/generate/route.ts",
];

const FORMAT_IMPORT = "@/domain/padel/formatCatalog";
const BANNED_PATTERNS = [
  "ALLOWED_PADEL_FORMATS",
  "SUPPORTED_FORMATS",
  "Object.values(padel_format)",
];

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel format catalog guardrails (D18.11)", () => {
  it("rotas usam catálogo canónico de formatos", () => {
    for (const file of FORMAT_FILES) {
      const content = readLocal(file);
      expect(content, file).toContain(FORMAT_IMPORT);
    }
  });

  it("evita listas locais de formatos duplicadas", () => {
    for (const file of FORMAT_FILES) {
      const content = readLocal(file);
      for (const pattern of BANNED_PATTERNS) {
        expect(content, `${file} :: ${pattern}`).not.toContain(pattern);
      }
    }
  });
});

describe("padel club staff role guardrails (D18.09)", () => {
  it("força roles canónicos no write-path do staff de clube", () => {
    const content = readLocal("app/api/padel/clubs/[id]/staff/route.ts");
    expect(content).toContain("PADEL_CLUB_STAFF_ROLES");
    expect(content).toContain("normalizePadelClubStaffRole");
    expect(content).toContain("ADMIN_CLUBE");
    expect(content).toContain("DIRETOR_PROVA");
    expect(content).toContain("STAFF");
  });

  it("fecha role em enum canónico no schema e na migração", () => {
    const schema = readLocal("prisma/schema.prisma");
    expect(schema).toContain("model PadelClubStaff {");
    expect(schema).toContain("role            PadelClubStaffRole");
    expect(schema).toContain("enum PadelClubStaffRole {");
    expect(schema).toContain("ADMIN_CLUBE");
    expect(schema).toContain("DIRETOR_PROVA");
    expect(schema).toContain("STAFF");

    const migration = readLocal("prisma/migrations/20260212124500_padel_club_staff_role_enum/migration.sql");
    expect(migration).toContain('CREATE TYPE app_v3."PadelClubStaffRole"');
    expect(migration).toContain('ALTER COLUMN role TYPE app_v3."PadelClubStaffRole"');
  });
});
