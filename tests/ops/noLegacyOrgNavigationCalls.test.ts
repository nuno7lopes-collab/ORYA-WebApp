import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("no legacy org navigation calls", () => {
  it("has no redirect/router.push/router.replace pointing to /organizacao", () => {
    const pattern =
      "redirect\\(\\\"/organizacao|redirect\\('/organizacao|router\\.(push|replace)\\(\\\"/organizacao|router\\.(push|replace)\\('/organizacao";

    let output = "";
    try {
      output = execFileSync(
        "rg",
        ["-n", pattern, "app", "--glob", "*.ts", "--glob", "*.tsx"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch (error) {
      const err = error as { status?: number; stdout?: string };
      if (err.status === 1) {
        output = "";
      } else {
        throw error;
      }
    }

    expect(output).toBe("");
  });

  it("has no redirect/router.push/router.replace pointing to /org legacy shorthand slugs", () => {
    const pattern =
      "redirect\\((\"|'|`)/org/(overview|manage|analyze|promote|profile|eventos|reservas|treinadores|crm/clientes|crm/segmentos|crm/campanhas|crm/relatorios|inscricoes|padel/clube|padel/torneios|chat|promo|scan|staff|become|organizations)|router\\.(push|replace)\\((\"|'|`)/org/(overview|manage|analyze|promote|profile|eventos|reservas|treinadores|crm/clientes|crm/segmentos|crm/campanhas|crm/relatorios|inscricoes|padel/clube|padel/torneios|chat|promo|scan|staff|become|organizations)";

    let output = "";
    try {
      output = execFileSync(
        "rg",
        ["-n", pattern, "app", "--glob", "*.ts", "--glob", "*.tsx"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch (error) {
      const err = error as { status?: number };
      if (err.status === 1) {
        output = "";
      } else {
        throw error;
      }
    }

    expect(output).toBe("");
  });
});
