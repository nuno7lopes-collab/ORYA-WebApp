import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FORMAT_FILES = [
  "app/api/org/[orgId]/tournaments/create/route.ts",
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

  it("create canónico de torneio padel falha fechado sem fallback de formato", () => {
    const createRoute = readLocal("app/api/org/[orgId]/tournaments/create/route.ts");
    expect(createRoute).toContain("INVALID_FORMAT");
    expect(createRoute).toContain("parsePadelFormat");
    expect(createRoute).not.toContain("resolvePadelFormat");
    expect(createRoute).not.toContain("TODOS_CONTRA_TODOS");
  });

  it("formats/plan rejeita IDs decimais sem truncar", () => {
    const planRoute = readLocal("app/api/padel/formats/plan/route.ts");
    expect(planRoute).toContain("INVALID_COURT_IDS");
    expect(planRoute).toContain("INVALID_COURT_PRIORITY");
    expect(planRoute).toContain("INVALID_CATEGORIES");
    expect(planRoute).not.toContain("Math.floor(categoryIdRaw)");
  });

  it("motores de planeamento não truncam IDs de courts/categorias", () => {
    const autoGenerate = readLocal("domain/padel/autoGenerateMatches.ts");
    const capacity = readLocal("domain/padel/formatEngine/capacity.ts");
    expect(autoGenerate).not.toContain(".map((id) => Math.floor(id))");
    expect(capacity).not.toContain("Math.floor(category.categoryId)");
  });

  it("matches/generate valida enums de draw/seed/phase sem fallback silencioso", () => {
    const route = readLocal("app/api/padel/matches/generate/route.ts");
    expect(route).toContain("INVALID_PHASE");
    expect(route).toContain("INVALID_DRAW_POLICY");
    expect(route).toContain("INVALID_SEED_SOURCE");
  });
});

describe("padel club staff role guardrails (D18.09)", () => {
  it("força roles canónicos no write-path do staff de clube", () => {
    const routeContent = readLocal("app/api/padel/clubs/[id]/staff/route.ts");
    expect(routeContent).toContain("PADEL_CLUB_STAFF_ROLES");
    expect(routeContent).toContain("normalizePadelClubStaffRole");

    const roleUtil = readLocal("lib/padel/clubStaffRole.ts");
    expect(roleUtil).toContain("ADMIN_CLUBE");
    expect(roleUtil).toContain("DIRETOR_PROVA");
    expect(roleUtil).toContain("STAFF");
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

    const panel = readLocal("app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx");
    expect(panel).toContain("DIRETOR_PROVA");
  });

  it("remove legacy DIRECTOR do runtime Padel", () => {
    const files = [
      "app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx",
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
      "app/org/_internal/core/objectiveNav.ts",
      "app/org/_internal/core/DashboardClient.tsx",
      "app/org/_internal/core/OrganizationBreadcrumb.tsx",
      "app/org/_internal/core/OrganizationTopBar.tsx",
      "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx",
    ];

    for (const file of files) {
      const content = readLocal(file);
      expect(content, `${file} :: Ferramenta A`).not.toContain("Ferramenta A");
      expect(content, `${file} :: Ferramenta B`).not.toContain("Ferramenta B");
      expect(content, `${file} :: Módulos`).not.toContain("Módulos");
      expect(content, `${file} :: modulos`).not.toContain("modulos");
    }
  });
});

describe("padel lifecycle governance guardrails (N5)", () => {
  it("exige diretor de prova antes de publicar torneio padel", () => {
    const content = readLocal("app/api/padel/tournaments/lifecycle/route.ts");
    expect(content).toContain("PadelTournamentRole.DIRETOR_PROVA");
    expect(content).toContain("TOURNAMENT_DIRECTOR_REQUIRED");
    expect(content).toContain("STAFF_MISSING_FOR_PARTNER_CLUBS");
  });

  it("auto-atribui DIRETOR_PROVA no create de evento padel", () => {
    const content = readLocal("app/api/org/[orgId]/tournaments/create/route.ts");
    expect(content).toContain("padelTournamentRoleAssignment.upsert");
    expect(content).toContain("PadelTournamentRole.DIRETOR_PROVA");
  });

  it("remove write-path legado de Padel no events/create genérico", () => {
    const legacyCreate = readLocal("app/api/org/[orgId]/events/create/route.ts");
    expect(legacyCreate).toContain("PADEL_CREATE_MOVED");
    expect(legacyCreate).not.toContain("padelTournamentConfig.upsert");
    expect(legacyCreate).not.toContain("padelTournamentRoleAssignment.upsert");
    expect(legacyCreate).not.toContain("createTournamentForEvent(");
  });

  it("frontend de criação encaminha preset Padel para endpoint canónico", () => {
    const createPage = readLocal("app/org/_internal/core/(dashboard)/eventos/novo/page.tsx");
    expect(createPage).toContain("isPadelFlow");
    expect(createPage).toContain("/api/org/${activeOrganizationId}/tournaments/create");
    expect(createPage).toContain("/api/org/${activeOrganizationId}/events/create");
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
    const tabs = readLocal("app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx");
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
    expect(rankings).toContain("tierFilter");
    expect(rankings).toContain("clubIdFilter");
    expect(rankings).toContain("cityFilter");
    expect(engine).toContain("tier: contextTier");
    expect(engine).toContain("clubId: contextClubId");
    expect(engine).toContain("city: contextCity");
  });

  it("expõe rotas canónicas de rebuild e sanções", () => {
    const rebuild = readLocal("app/api/padel/rankings/rebuild/route.ts");
    const rebuildService = readLocal("domain/padel/rankingRebuild.ts");
    const sanctions = readLocal("app/api/padel/rankings/sanctions/route.ts");
    expect(rebuild).toContain("executePadelRankingRebuild");
    expect(rebuildService).toContain("rebuildPadelRatingsForEvent");
    expect(rebuild).toContain("export const POST = withApiEnvelope(_POST);");
    expect(sanctions).toContain("applyPadelRatingSanction");
    expect(sanctions).toContain("export const POST = withApiEnvelope(_POST);");
    expect(sanctions).toContain("Number.isInteger");
    expect(sanctions).not.toContain("Math.floor");
  });

  it("governa tiers OURO/MAJOR com approval e gate de lifecycle", () => {
    const request = readLocal("app/api/padel/tournaments/tier-approvals/request/route.ts");
    const approve = readLocal("app/api/padel/tournaments/tier-approvals/[id]/approve/route.ts");
    const reject = readLocal("app/api/padel/tournaments/tier-approvals/[id]/reject/route.ts");
    const lifecycle = readLocal("app/api/padel/tournaments/lifecycle/route.ts");
    expect(request).toContain("TIER_APPROVAL_NOT_REQUIRED");
    expect(request).toContain("tx.padelTournamentTierApproval.upsert");
    expect(approve).toContain("status: \"APPROVED\"");
    expect(reject).toContain("status: \"REJECTED\"");
    expect(lifecycle).toContain("TIER_APPROVAL_REQUIRED");
    expect(lifecycle).toContain("GOVERNED_TIERS");
  });
});

describe("padel tournament config input guardrails", () => {
  it("rejeita IDs decimais sem truncagem silenciosa", () => {
    const route = readLocal("app/api/padel/tournaments/config/route.ts");
    expect(route).toContain("INVALID_RULESET");
    expect(route).toContain("INVALID_FEATURED_MATCH");
    expect(route).toContain("INVALID_GROUPS_MODE");
    expect(route).toContain("INVALID_GROUPS_SEEDING");
    expect(route).not.toContain("Math.floor(ruleSetIdRaw)");
    expect(route).not.toContain("Math.floor(defaultCategoryRaw)");
  });
});

describe("padel scheduler fail-closed guardrails", () => {
  it("valida enums operacionais sem fallback silencioso", () => {
    const bulk = readLocal("app/api/padel/calendar/matches/bulk-reschedule/route.ts");
    const autoSchedule = readLocal("app/api/padel/calendar/auto-schedule/route.ts");
    const roundsAdvance = readLocal("app/api/padel/rounds/advance/route.ts");
    const broadcast = readLocal("app/api/org/[orgId]/padel/broadcast/route.ts");
    const reopen = readLocal("app/api/padel/pairings/[id]/reopen/route.ts");
    const pairingsCreate = readLocal("app/api/padel/pairings/route.ts");
    const walkover = readLocal("app/api/padel/matches/[id]/walkover/route.ts");
    expect(bulk).toContain("INVALID_MODE");
    expect(bulk).toContain("INVALID_PARTIAL_MODE");
    expect(autoSchedule).toContain("INVALID_PARTIAL_MODE");
    expect(autoSchedule).toContain("INVALID_EXECUTION_MODE");
    expect(autoSchedule).toContain("INVALID_STRATEGY");
    expect(autoSchedule).toContain("INVALID_PRIORITY");
    expect(roundsAdvance).toContain("INVALID_PARTIAL_MODE");
    expect(roundsAdvance).toContain("INVALID_EXECUTION_MODE");
    expect(roundsAdvance).toContain("INVALID_STRATEGY");
    expect(broadcast).toContain("INVALID_AUDIENCE");
    expect(reopen).toContain("INVALID_MODE");
    expect(pairingsCreate).toContain("INVALID_PAIRING_JOIN_MODE");
    expect(walkover).toContain("INVALID_RESULT_TYPE");
  });
});

describe("padel api contract guardrails", () => {
  it("rotas legacy expõem errorCode estável mantendo mensagem humana", () => {
    const categories = readLocal("app/api/padel/categories/my/route.ts");
    const clubs = readLocal("app/api/padel/clubs/route.ts");
    const clubStaff = readLocal("app/api/padel/clubs/[id]/staff/route.ts");
    const clubStaffInvites = readLocal("app/api/padel/clubs/[id]/staff/invites/route.ts");
    const calendar = readLocal("app/api/padel/calendar/route.ts");
    const onboarding = readLocal("app/api/padel/onboarding/route.ts");
    expect(categories).toContain("failText(");
    expect(categories).toContain("RESERVED_LABEL");
    expect(categories).toContain("DUPLICATE_LABEL");
    expect(clubs).toContain("ADDRESS_REQUIRED");
    expect(clubs).toContain("INVALID_ADDRESS");
    expect(clubs).toContain("CLUB_IN_USE");
    expect(clubStaff).toContain("errorCode: \"INVALID_ROLE\"");
    expect(clubStaffInvites).toContain("errorCode: \"INVALID_ROLE\"");
    expect(clubStaff).toContain("INVALID_INHERIT_TO_EVENTS");
    expect(clubStaffInvites).toContain("INVALID_INHERIT_TO_EVENTS");
    expect(calendar).toContain("BLOCK_OVERLAP");
    expect(calendar).toContain("AVAILABILITY_OVERLAP");
    expect(calendar).toContain("MATCH_OVERLAP");
    expect(calendar).toContain("MATCH_BLOCK_CONFLICT");
    expect(onboarding).toContain("errorCode: \"USERNAME_TAKEN\"");
    expect(onboarding).toContain("errorCode: \"INTERNAL_ERROR\"");
    expect(onboarding).not.toContain("code: \"USERNAME_TAKEN\"");
  });
});

describe("padel lessons + trainers booking guardrails", () => {
  it("publicar/aprovar treinador faz sync canónico para ReservationProfessional", () => {
    const trainersRoute = readLocal("app/api/org/[orgId]/trainers/route.ts");
    expect(trainersRoute).toContain("reservationProfessional.upsert");
    expect(trainersRoute).toContain("reservationProfessionalId");
  });

  it("serviços de aula exigem instrutor com profissional ativo", () => {
    const createService = readLocal("app/api/org/[orgId]/servicos/route.ts");
    const patchService = readLocal("app/api/org/[orgId]/servicos/[id]/route.ts");
    expect(createService).toContain("CLASS_REQUIRES_PROFESSIONAL_MODE");
    expect(createService).toContain("INSTRUCTOR_NOT_PROFESSIONAL");
    expect(createService).toContain("INSTRUCTOR_PROFESSIONAL_INACTIVE");
    expect(patchService).toContain("CLASS_REQUIRES_PROFESSIONAL_MODE");
    expect(patchService).toContain("INSTRUCTOR_NOT_PROFESSIONAL");
    expect(patchService).toContain("INSTRUCTOR_PROFESSIONAL_INACTIVE");
  });

  it("class-series valida startMinute pela grelha da organização", () => {
    const createSeries = readLocal("app/api/org/[orgId]/servicos/[id]/class-series/route.ts");
    const patchSeries = readLocal("app/api/org/[orgId]/servicos/[id]/class-series/[seriesId]/route.ts");
    expect(createSeries).toContain("getOrganizationBookingPolicy");
    expect(createSeries).toContain("validateStartMinuteAgainstPolicy");
    expect(createSeries).not.toContain("SLOT_STEP_MINUTES = 15");
    expect(patchSeries).toContain("getOrganizationBookingPolicy");
    expect(patchSeries).toContain("validateStartMinuteAgainstPolicy");
    expect(patchSeries).not.toContain("SLOT_STEP_MINUTES = 15");
  });

  it("padel hub oferece provisionamento em reservas antes de criar aula recorrente", () => {
    const hub = readLocal("app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx");
    expect(hub).toContain("handleProvisionLessonTrainer");
    expect(hub).toContain("Criar em reservas");
    expect(hub).toContain("/class-series");
  });
});
