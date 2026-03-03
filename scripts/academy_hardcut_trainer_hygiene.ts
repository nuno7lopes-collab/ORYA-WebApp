import { prisma } from "@/lib/prisma";
import { runAcademyTrainerHardCutHygiene } from "@/lib/academy/trainerHardCutHygiene";

type CliOptions = {
  dryRun: boolean;
  organizationId: number | null;
  limit: number | null;
};

function parsePositiveInt(raw: string | undefined) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parseArgs(argv: string[]): CliOptions {
  const organizationArg = argv.find((arg) => arg.startsWith("--organizationId="));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const dryRun = !argv.includes("--execute");

  return {
    dryRun,
    organizationId: parsePositiveInt(organizationArg?.split("=")[1]),
    limit: parsePositiveInt(limitArg?.split("=")[1]),
  };
}

async function listTargetOrganizationIds(options: CliOptions) {
  if (options.organizationId) return [options.organizationId];

  const rows = await prisma.reservationProfessional.findMany({
    distinct: ["organizationId"],
    select: { organizationId: true },
    orderBy: { organizationId: "asc" },
    ...(options.limit ? { take: options.limit } : {}),
  });
  return rows.map((row) => row.organizationId);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetOrganizationIds = await listTargetOrganizationIds(options);

  if (targetOrganizationIds.length === 0) {
    console.log("[academy_hardcut_trainer_hygiene] sem organizações para processar.");
    return;
  }

  console.log(
    `[academy_hardcut_trainer_hygiene] mode=${options.dryRun ? "dry-run" : "execute"} orgs=${
      targetOrganizationIds.length
    }`,
  );

  let scannedProfessionals = 0;
  let invalidProfessionals = 0;
  let deactivatedProfessionals = 0;
  let purgedProfessionals = 0;
  let roleTitleCleared = 0;
  let canonicalNameUpdated = 0;
  let classServiceLinksRemoved = 0;
  let classSeriesUnlinked = 0;
  let futureClassSessionsUnlinked = 0;
  let trainerProfilesUnlinked = 0;

  for (const organizationId of targetOrganizationIds) {
    const summary = await runAcademyTrainerHardCutHygiene(organizationId, {
      dryRun: options.dryRun,
    });
    scannedProfessionals += summary.scannedProfessionals;
    invalidProfessionals += summary.invalidProfessionals;
    deactivatedProfessionals += summary.deactivatedProfessionals;
    purgedProfessionals += summary.purgedProfessionals;
    roleTitleCleared += summary.roleTitleCleared;
    canonicalNameUpdated += summary.canonicalNameUpdated;
    classServiceLinksRemoved += summary.classServiceLinksRemoved;
    classSeriesUnlinked += summary.classSeriesUnlinked;
    futureClassSessionsUnlinked += summary.futureClassSessionsUnlinked;
    trainerProfilesUnlinked += summary.trainerProfilesUnlinked;

    console.log(
      `[academy_hardcut_trainer_hygiene] org=${organizationId} scanned=${summary.scannedProfessionals} invalid=${summary.invalidProfessionals} deactivated=${summary.deactivatedProfessionals} purged=${summary.purgedProfessionals} roleTitleCleared=${summary.roleTitleCleared} canonicalNameUpdated=${summary.canonicalNameUpdated} classLinks=${summary.classServiceLinksRemoved} series=${summary.classSeriesUnlinked} sessions=${summary.futureClassSessionsUnlinked} trainerProfiles=${summary.trainerProfilesUnlinked}`,
    );
  }

  console.log(
    `[academy_hardcut_trainer_hygiene] total scanned=${scannedProfessionals} invalid=${invalidProfessionals} deactivated=${deactivatedProfessionals} purged=${purgedProfessionals} roleTitleCleared=${roleTitleCleared} canonicalNameUpdated=${canonicalNameUpdated} classLinks=${classServiceLinksRemoved} series=${classSeriesUnlinked} sessions=${futureClassSessionsUnlinked} trainerProfiles=${trainerProfilesUnlinked}`,
  );
}

main()
  .catch((error) => {
    console.error("[academy_hardcut_trainer_hygiene] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
