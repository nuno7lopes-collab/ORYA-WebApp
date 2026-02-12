import { describe, it } from "vitest";
import { execSync } from "node:child_process";

const TOURNAMENT_ENTRY_WRITE_CMD =
  "rg -n \"\\b(prisma|tx)\\.tournamentEntry\\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\" app/api domain lib -S";

const TOURNAMENT_MATCH_WRITE_IN_PADEL_CMD =
  "rg -n \"\\b(prisma|tx)\\.tournamentMatch\\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\" app/api/padel domain/padel -S";

const ENTRY_ALLOWLIST = new Set([
  "domain/tournaments/ensureEntriesForConfirmedPairing.ts",
  "app/api/padel/event-categories/route.ts",
  "app/api/admin/eventos/purge/route.ts",
  "lib/ownership/claimIdentity.ts",
]);

function run(command: string) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err: any) {
    if (typeof err?.status === "number" && err.status === 1) return "";
    const stdout = err?.stdout ? String(err.stdout) : "";
    const stderr = err?.stderr ? String(err.stderr) : "";
    throw new Error(`Guardrail command failed\n${stdout}${stderr}`);
  }
}

describe("padel entry/match write guardrails (D18.01, D18.06, D18.07)", () => {
  it("TournamentEntry writes ficam limitados ao fluxo de projeção/ownership", () => {
    const raw = run(TOURNAMENT_ENTRY_WRITE_CMD);
    const files = new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(":")[0]),
    );

    const unexpected = Array.from(files).filter((file) => !ENTRY_ALLOWLIST.has(file));
    if (unexpected.length) {
      throw new Error(`TournamentEntry write allowlist violation: ${unexpected.join(", ")}`);
    }
  });

  it("não permite writes de TournamentMatch dentro de módulos Padel", () => {
    const raw = run(TOURNAMENT_MATCH_WRITE_IN_PADEL_CMD);
    if (raw) {
      throw new Error(`TournamentMatch write found in Padel scope:\n${raw}`);
    }
  });
});
