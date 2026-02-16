import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runRg(args: string[]) {
  try {
    return execFileSync("rg", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const err = error as { status?: number; stdout?: string };
    if (err.status === 1) return "";
    throw error;
  }
}

describe("canonical org UI href guardrail", () => {
  it("blocks literal /organizacao hrefs in canonical org UI surfaces", () => {
    const output = runRg([
      "-n",
      "['\"]/organizacao",
      "app/org",
      "app/org/_internal/core/OrganizationTopBar.tsx",
      "app/org/_components/subnav",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
    ]);

    expect(output).toBe("");
  });

  it("blocks literal /org legacy shorthand hrefs in canonical org UI surfaces", () => {
    const output = runRg([
      "-n",
      "(href\\s*=\\s*\\{?['\"]|pathname\\s*:\\s*['\"])/org/(overview|manage|analyze|promote|profile|eventos|reservas|treinadores|crm/clientes|crm/segmentos|crm/campanhas|crm/relatorios|inscricoes|padel/clube|padel/torneios|chat|promo|scan|staff|become|organizations)",
      "app/org",
      "app/components",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
    ]);

    expect(output).toBe("");
  });
});
