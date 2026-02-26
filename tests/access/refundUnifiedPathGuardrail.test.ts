import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

function rgMatches(pattern: string, paths: string[]) {
  const cwd = process.cwd();
  const quotedPaths = paths.map((path) => `"${path}"`).join(" ");
  const cmd = `rg -n --no-heading --glob '!tests/**' "${pattern}" ${quotedPaths}`;
  try {
    const output = execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
    return output ? output.split("\n") : [];
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer };
    if (e?.status === 1) return [];
    if (e?.stdout) {
      const output = e.stdout.toString().trim();
      return output ? output.split("\n") : [];
    }
    throw err;
  }
}

describe("refund unified path guardrail", () => {
  it("não permite imports runtime de refundService legacy", () => {
    const matches = rgMatches('from "@/lib/refunds/refundService"|require\\("@/lib/refunds/refundService"\\)', [
      resolve(process.cwd(), "app"),
      resolve(process.cwd(), "lib"),
      resolve(process.cwd(), "domain"),
    ]);
    expect(matches).toEqual([]);
  });

  it("não permite imports runtime de bookingRefund legacy", () => {
    const matches = rgMatches('from "@/lib/reservas/bookingRefund"|require\\("@/lib/reservas/bookingRefund"\\)', [
      resolve(process.cwd(), "app"),
      resolve(process.cwd(), "lib"),
      resolve(process.cwd(), "domain"),
    ]);
    expect(matches).toEqual([]);
  });

  it("não permite enfileirar PROCESS_REFUND_SINGLE", () => {
    const matches = rgMatches('operationType:\\s*"PROCESS_REFUND_SINGLE"', [
      resolve(process.cwd(), "app"),
      resolve(process.cwd(), "lib"),
      resolve(process.cwd(), "domain"),
    ]);
    expect(matches).toEqual([]);
  });
});

