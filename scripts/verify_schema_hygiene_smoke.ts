import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

async function main() {
  const canonicalChecks: Array<[string, () => Promise<number>]> = [
    ["event", () => prisma.event.count()],
    ["chatConversation", () => prisma.chatConversation.count()],
    ["chatConversationMember", () => prisma.chatConversationMember.count()],
    ["chatConversationMessage", () => prisma.chatConversationMessage.count()],
    ["chatAccessGrant", () => prisma.chatAccessGrant.count()],
    ["storeOrder", () => prisma.storeOrder.count()],
  ];

  for (const [name, op] of canonicalChecks) {
    const value = await op();
    console.log(`OK ${name} ${value}`);
  }

  const blockedChecks: Array<[string, () => Promise<number>]> = [
    ["padelTournamentRoleAssignment", () => prisma.padelTournamentRoleAssignment.count()],
    ["refundPolicyVersion", () => prisma.refundPolicyVersion.count()],
  ];

  for (const [name, op] of blockedChecks) {
    try {
      const value = await op();
      console.log(`BLOCKED_OK ${name} ${value}`);
    } catch (error: any) {
      console.log(`BLOCKED_MISSING ${name} ${error?.code ?? "ERR"}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("[verify_schema_hygiene_smoke] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  });
