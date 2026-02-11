import { describe, it } from "vitest";
import { execSync } from "child_process";

const COMMAND =
  "rg -n \"\\b(prisma|tx)\\.(calendarBlock|eventMatchSlot|booking|softBlock)\\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\" app/api domain -S";

const ALLOWLIST = new Set([
  "domain/hardBlocks/commands.ts",
  "domain/softBlocks/commands.ts",
  "domain/padel/autoGenerateMatches.ts",
  "domain/padel/outbox.ts",
  "app/api/servicos/[id]/reservar/route.ts",
  "app/api/servicos/[id]/checkout/route.ts",
  "app/api/cron/bookings/cleanup/route.ts",
  "app/api/organizacao/reservas/route.ts",
  "app/api/organizacao/reservas/[id]/reschedule/route.ts",
  "app/api/organizacao/reservas/[id]/checkout/route.ts",
  "app/api/organizacao/reservas/[id]/cancel/route.ts",
  "app/api/organizacao/reservas/[id]/no-show/route.ts",
  "app/api/me/reservas/[id]/reschedule/respond/route.ts",
  "app/api/me/reservas/[id]/cancel/route.ts",
  "app/api/padel/event-categories/route.ts",
  "app/api/padel/calendar/route.ts",
  "app/api/padel/matches/route.ts",
  "app/api/padel/matches/assign/route.ts",
  "app/api/padel/matches/[id]/dispute/route.ts",
  "app/api/padel/matches/[id]/undo/route.ts",
  "app/api/padel/matches/[id]/walkover/route.ts",
  "app/api/admin/eventos/purge/route.ts",
]);

function isDomainCommand(file: string) {
  return file.startsWith("domain/") && file.endsWith("/commands.ts");
}

function listMatches(command: string) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err: any) {
    if (typeof err?.status === "number" && err.status === 1) return "";
    const output = err?.stdout ? String(err.stdout) : "";
    const stderr = err?.stderr ? String(err.stderr) : "";
    throw new Error(`Agenda drift guard failed\n${output}${stderr}`);
  }
}

describe("agenda drift guardrails", () => {
  it("permite apenas allowlist atual (D3.5 a apertar)", () => {
    const raw = listMatches(COMMAND);
    const files = new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(":")[0]),
    );

    const unexpected = Array.from(files).filter((file) => !isDomainCommand(file) && !ALLOWLIST.has(file));
    if (unexpected.length) {
      throw new Error(`Agenda drift allowlist violation: ${unexpected.join(", ")}`);
    }

    // Log allowlisted drift for visibility (does not fail when unchanged).
    console.info("agenda drift allowlist", Array.from(files).sort());
  });
});
