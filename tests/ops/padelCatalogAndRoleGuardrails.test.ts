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

  it("fecha formatos oficiais no schema e catálogo canónico", () => {
    const schema = readLocal("prisma/schema.prisma");
    expect(schema).toContain("enum padel_format {");
    expect(schema).toContain("AMERICANO");
    expect(schema).toContain("MEXICANO");

    const catalog = readLocal("domain/padel/formatCatalog.ts");
    expect(catalog).toContain("padel_format.AMERICANO");
    expect(catalog).toContain("padel_format.MEXICANO");
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

describe("padel tournament role guardrails (D18.09)", () => {
  it("usa DIRETOR_PROVA como papel operacional canónico de torneio", () => {
    const schema = readLocal("prisma/schema.prisma");
    expect(schema).toContain("enum PadelTournamentRole {");
    expect(schema).toContain("DIRETOR_PROVA");
    expect(schema).not.toContain("\n  DIRECTOR\n");

    const panel = readLocal("app/organizacao/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx");
    expect(panel).toContain("DIRETOR_PROVA");
  });

  it("remove legacy DIRECTOR do runtime Padel", () => {
    const files = [
      "app/organizacao/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx",
      "app/api/padel/clubs/[id]/staff/route.ts",
      "app/api/padel/tournaments/roles/route.ts",
    ];

    for (const file of files) {
      const content = readLocal(file);
      expect(content, file).not.toContain("DIRECTOR");
    }
  });
});

describe("padel ui naming guardrails (N7)", () => {
  it("remove labels legacy na navegação organizacional Padel", () => {
    const files = [
      "app/organizacao/objectiveNav.ts",
      "app/organizacao/DashboardClient.tsx",
      "app/organizacao/OrganizationBreadcrumb.tsx",
      "app/organizacao/OrganizationTopBar.tsx",
      "app/organizacao/(dashboard)/padel/PadelHubClient.tsx",
    ];

    for (const file of files) {
      const content = readLocal(file);
      expect(content, `${file} :: Ferramenta A`).not.toContain("Ferramenta A");
      expect(content, `${file} :: Ferramenta B`).not.toContain("Ferramenta B");
      expect(content, `${file} :: Ferramentas`).not.toContain("Ferramentas");
    }
  });
});

describe("padel lifecycle governance guardrails (N5)", () => {
  it("exige diretor de prova antes de publicar torneio padel", () => {
    const content = readLocal("app/api/padel/tournaments/lifecycle/route.ts");
    expect(content).toContain("PadelTournamentRole.DIRETOR_PROVA");
    expect(content).toContain("TOURNAMENT_DIRECTOR_REQUIRED");
  });

  it("auto-atribui DIRETOR_PROVA no create de evento padel", () => {
    const content = readLocal("app/api/organizacao/events/create/route.ts");
    expect(content).toContain("padelTournamentRoleAssignment.upsert");
    expect(content).toContain("PadelTournamentRole.DIRETOR_PROVA");
  });

  it("endurece incidentes com autoridade operacional e metadados obrigatórios", () => {
    const walkover = readLocal("app/api/padel/matches/[id]/walkover/route.ts");
    const dispute = readLocal("app/api/padel/matches/[id]/dispute/route.ts");
    const matchesRoute = readLocal("app/api/padel/matches/route.ts");
    expect(walkover).toContain("resolveIncidentAuthority");
    expect(walkover).toContain("MISSING_CONFIRMED_BY_ROLE");
    expect(walkover).toContain("MISSING_CONFIRMATION_SOURCE");
    expect(dispute).toContain("resolveIncidentAuthority");
    expect(dispute).toContain("MISSING_CONFIRMATION_SOURCE");
    expect(dispute).toContain("MISSING_RESOLUTION_STATUS");
    expect(matchesRoute).toContain("SPECIAL_RESULT_REQUIRES_INCIDENT_ENDPOINT");
  });

  it("UI operacional usa endpoint dedicado para incidentes especiais", () => {
    const live = readLocal("app/eventos/[slug]/EventLiveClient.tsx");
    const monitor = readLocal("app/eventos/[slug]/monitor/PadelMonitorClient.tsx");
    const tabs = readLocal("app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx");
    expect(live).toContain("/walkover");
    expect(monitor).toContain("/walkover");
    expect(tabs).toContain("/walkover");
  });
});

describe("padel ranking v2 guardrails (N6)", () => {
  it("fecha modelos canónicos de rating no schema", () => {
    const schema = readLocal("prisma/schema.prisma");
    expect(schema).toContain("model PadelRatingProfile {");
    expect(schema).toContain("model PadelRatingEvent {");
    expect(schema).toContain("model PadelRatingSanction {");
    expect(schema).toContain("model PadelTournamentTierApproval {");
    expect(schema).toContain("enum PadelRatingSanctionType {");
    expect(schema).toContain("enum PadelRatingSanctionStatus {");
    expect(schema).toContain("enum PadelTournamentTierApprovalStatus {");
  });

  it("usa motor de rating dedicado e mantém ranking entry como read-model", () => {
    const engine = readLocal("domain/padel/ratingEngine.ts");
    const rankings = readLocal("app/api/padel/rankings/route.ts");
    expect(engine).toContain("export function glicko2Update");
    expect(engine).toContain("rebuildPadelRatingsForEvent");
    expect(engine).toContain("applyPadelRatingSanction");
    expect(rankings).toContain("prisma.padelRatingProfile");
    expect(rankings).toContain("prisma.padelRankingEntry");
    expect(rankings).toContain("computeVisualLevel");
  });

  it("expõe rotas canónicas de rebuild e sanções", () => {
    const rebuild = readLocal("app/api/padel/rankings/rebuild/route.ts");
    const sanctions = readLocal("app/api/padel/rankings/sanctions/route.ts");
    expect(rebuild).toContain("rebuildPadelRatingsForEvent");
    expect(rebuild).toContain("export const POST = withApiEnvelope(_POST);");
    expect(sanctions).toContain("applyPadelRatingSanction");
    expect(sanctions).toContain("export const POST = withApiEnvelope(_POST);");
  });
});
