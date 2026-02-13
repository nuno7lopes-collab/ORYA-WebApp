import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runRg(args: string[]) {
  try {
    return execFileSync("rg", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 1) return "";
    throw error;
  }
}

describe("canonical org web slugs guardrail", () => {
  it("blocks PT/legacy /org/:orgId slug literals in canonical surfaces", () => {
    const output = runRg([
      "-n",
      "/org/(\\$\\{[^}]+\\}|\\[orgId\\]|\\d+)/(financas|loja|checkin|manage|promote|tournaments|trainers|crm/(clientes|segmentos|campanhas|relatorios)|padel/(clube|torneios))",
      "app/org",
      "app/organizacao/DashboardClient.tsx",
      "app/organizacao/OrganizationPublicProfilePanel.tsx",
      "app/organizacao/(dashboard)/loja/page.tsx",
      "app/organizacao/(dashboard)/padel/PadelHubClient.tsx",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
    ]);

    expect(output).toBe("");
  });
});
