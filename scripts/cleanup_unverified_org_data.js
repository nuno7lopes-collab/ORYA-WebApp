/* eslint-disable no-console */
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL no ambiente.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const orgIdArg = process.argv.find((arg) => arg.startsWith("--org=") || arg.startsWith("--orgId="));
const orgIdList = orgIdArg
  ? orgIdArg.split("=").slice(1).join("=").split(",").map((value) => Number(value)).filter((id) => Number.isFinite(id))
  : [];

function resolveConnectStatus(stripeAccountId, chargesEnabled, payoutsEnabled) {
  if (!stripeAccountId) return "MISSING";
  if (!chargesEnabled || !payoutsEnabled) return "INCOMPLETE";
  return "READY";
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function runDelete(label, model, where) {
  if (!where || (Array.isArray(where?.organizationId?.in) && where.organizationId.in.length === 0)) {
    console.log(`[cleanup-email] ${label}: 0`);
    return;
  }
  if (!apply) {
    const count = await model.count({ where });
    console.log(`[cleanup-email][dry-run] ${label}: ${count}`);
    return;
  }
  const result = await model.deleteMany({ where });
  console.log(`[cleanup-email] ${label}: ${result.count}`);
}

async function main() {
  console.log("[cleanup-email] A iniciar limpeza de dados sem email verificado.");
  if (!apply) {
    console.log("[cleanup-email] Modo dry-run. Use --apply para apagar.");
  }

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      username: true,
      publicName: true,
      officialEmail: true,
      officialEmailVerifiedAt: true,
      orgType: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  const scopedOrganizations = orgIdList.length > 0
    ? organizations.filter((org) => orgIdList.includes(org.id))
    : organizations;

  const unverifiedOrgs = scopedOrganizations.filter(
    (org) => !org.officialEmail || !org.officialEmailVerifiedAt,
  );
  const unverifiedOrgIds = unverifiedOrgs.map((org) => org.id);

  const stripeBlockedOrgs = scopedOrganizations.filter((org) => {
    if (org.orgType === "PLATFORM") return false;
    const status = resolveConnectStatus(
      org.stripeAccountId,
      org.stripeChargesEnabled,
      org.stripePayoutsEnabled,
    );
    return status !== "READY";
  });
  const stripeBlockedOrgIds = stripeBlockedOrgs.map((org) => org.id);

  const serviceDeleteOrgIds = Array.from(new Set([...unverifiedOrgIds, ...stripeBlockedOrgIds]));

  console.log("[cleanup-email] Orgs alvo:");
  scopedOrganizations.forEach((org) => {
    const stripeStatus = resolveConnectStatus(
      org.stripeAccountId,
      org.stripeChargesEnabled,
      org.stripePayoutsEnabled,
    );
    console.log(
      `- ${org.id} ${org.username ?? "-"} ${org.publicName ?? "-"} email=${org.officialEmail ?? "-"} verified=${org.officialEmailVerifiedAt ? "yes" : "no"} stripe=${stripeStatus}`,
    );
  });

  console.log(`[cleanup-email] Orgs sem email verificado: ${unverifiedOrgIds.length}`);
  console.log(`[cleanup-email] Orgs com stripe incompleto (servicos): ${stripeBlockedOrgIds.length}`);

  await runDelete("OrganizationMemberInvite", prisma.organizationMemberInvite, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("OrganizationPolicy", prisma.organizationPolicy, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("OrganizationForm", prisma.organizationForm, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("Event", prisma.event, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("PromoCode", prisma.promoCode, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("ReservationProfessional", prisma.reservationProfessional, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("ReservationResource", prisma.reservationResource, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("WeeklyAvailabilityTemplate", prisma.weeklyAvailabilityTemplate, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("AvailabilityOverride", prisma.availabilityOverride, {
    organizationId: { in: unverifiedOrgIds },
  });
  await runDelete("Service", prisma.service, {
    organizationId: { in: serviceDeleteOrgIds },
  });

  if (apply) {
    const [policies, forms, events, services] = await Promise.all([
      prisma.organizationPolicy.count({ where: { organizationId: { in: unverifiedOrgIds } } }),
      prisma.organizationForm.count({ where: { organizationId: { in: unverifiedOrgIds } } }),
      prisma.event.count({ where: { organizationId: { in: unverifiedOrgIds } } }),
      prisma.service.count({ where: { organizationId: { in: serviceDeleteOrgIds } } }),
    ]);
    console.log("[cleanup-email] Verificacao final:");
    console.log(`- OrganizationPolicy: ${policies}`);
    console.log(`- OrganizationForm: ${forms}`);
    console.log(`- Event: ${events}`);
    console.log(`- Service: ${services}`);
  }

  console.log("[cleanup-email] Limpeza concluida.");
}

main()
  .catch((err) => {
    console.error("[cleanup-email] Erro:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
