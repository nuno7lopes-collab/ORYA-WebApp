import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PADEL_FORMAT_CATALOG } from "@/domain/padel/formatCatalog";
import { PADEL_FORMAT_ENGINE_REGISTRY } from "@/domain/padel/formatEngine/registry";
import { PADEL_FORMAT_LABELS_PT, PADEL_FORMAT_OPTIONS_PT } from "@/domain/padel/formatPresentation";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel format surface parity", () => {
  it("keeps catalog and engine registry aligned for every supported format", () => {
    const catalogFormats = new Set(PADEL_FORMAT_CATALOG);
    const registryFormats = new Set(Object.keys(PADEL_FORMAT_ENGINE_REGISTRY));

    expect(registryFormats).toEqual(catalogFormats);
    expect(catalogFormats.size).toBe(9);
  });

  it("exposes all supported formats in wizard and hub labels", () => {
    const wizardSource = readLocal("app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx");
    const hubSource = readLocal("app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx");
    const discoverFilterSource = readLocal("app/descobrir/_explorar/ExplorarContent.tsx");
    const discoverCardsSource = readLocal("app/descobrir/_explorar/DiscoverCards.tsx");

    expect(PADEL_FORMAT_OPTIONS_PT.map((option) => option.value)).toEqual(PADEL_FORMAT_CATALOG);
    expect(new Set(Object.keys(PADEL_FORMAT_LABELS_PT))).toEqual(new Set(PADEL_FORMAT_CATALOG));
    expect(wizardSource).toContain("PADEL_FORMAT_OPTIONS_PT");
    expect(hubSource).toContain("PADEL_FORMAT_LABELS_PT");
    expect(discoverFilterSource).toContain("PADEL_FORMAT_OPTIONS_PT");
    expect(discoverCardsSource).toContain("toPadelFormatLabel");
    expect(wizardSource).toContain("plannerMode");
  });

  it("keeps format-specific runtime branches wired for dynamic formats", () => {
    const roundsAdvanceSource = readLocal("app/api/padel/rounds/advance/route.ts");
    const generateSource = readLocal("domain/padel/autoGenerateMatches.ts");
    const autoScheduleSource = readLocal("app/api/padel/calendar/auto-schedule/route.ts");
    const tabsSource = readLocal("app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx");
    const hubSource = readLocal("app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx");

    expect(roundsAdvanceSource).toContain("padel_format.NON_STOP");
    expect(roundsAdvanceSource).toContain("padel_format.AMERICANO");
    expect(roundsAdvanceSource).toContain("padel_format.MEXICANO");
    expect(roundsAdvanceSource).toContain("match.groupLabel === \"NS\"");
    expect(autoScheduleSource).toContain("match.groupLabel === \"NS\"");
    expect(generateSource).toContain("ACTIVE_QUEUE");
    expect(generateSource).toContain("ROUND_BY_ROUND");
    expect(tabsSource).toContain("saveFormatProfileConfig");
    expect(tabsSource).toContain("selectedCategoryProfile?.format");
    expect(tabsSource).toContain("renderPlanningPreviewPanel");
    expect(tabsSource).toContain("/api/padel/formats/plan");
    expect(tabsSource).toContain("Filtro live");
    expect(tabsSource).toContain("liveOpsFilter");
    expect(hubSource).toContain("saveRoundOpsFormatProfile");
    expect(hubSource).toContain("roundOpsPlanCategory");
    expect(hubSource).toContain("resolveCategoryTeamsForPlanning");
    expect(hubSource).toContain("/api/padel/formats/plan");
  });
});
