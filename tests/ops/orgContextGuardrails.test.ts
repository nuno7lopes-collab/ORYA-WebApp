import { describe, it } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const CONTEXT_TOKENS = [
  "organizationId",
  "organization_id",
  "resolveOrganizationIdFromRequest",
  "resolveOrganizationIdFromParams",
  "parseOrganizationId",
  "ensureMemberModuleAccess",
  "ensureGroupMemberRole",
  "resolveGroupMemberForOrg",
  "ensureOrganizationAccess",
  "requireOrgAccess",
  "ensureOrganizationWriteAccess",
  "getActiveOrganizationForUser",
];

const ALLOWLIST = new Set<string>([]);

const METADATA_ORG_ALLOWLIST = new Set<string>([
  "app/api/org-system/payouts/webhook/route.ts",
]);

function listRoutes(root: string): string[] {
  const raw = execSync(`rg --files -g "route.ts" ${root}`, { stdio: "pipe" })
    .toString()
    .trim();
  return raw ? raw.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function listOrgRoutes(): string[] {
  return listRoutes("app/api/org");
}

function usesPrisma(content: string) {
  return /\bprisma\./.test(content) || /\btx\./.test(content);
}

describe("org context guardrails", () => {
  it("requires org context tokens in org routes with prisma usage", () => {
    const offenders: string[] = [];
    const routes = listOrgRoutes();

    for (const route of routes) {
      if (ALLOWLIST.has(route)) continue;
      const content = readFileSync(route, "utf-8");
      if (!usesPrisma(content)) continue;
      const hasContext = CONTEXT_TOKENS.some((token) => content.includes(token));
      if (!hasContext) offenders.push(route);
    }

    if (offenders.length > 0) {
      throw new Error(`Missing org context tokens:\n${offenders.join("\n")}`);
    }
  });

  it("allowlists account.metadata organizationId resolution", () => {
    const output = execSync('rg -n "account\\\\.metadata\\\\??\\\\.organizationId" app/api -S', {
      stdio: "pipe",
    })
      .toString()
      .trim();
    if (!output) return;
    const offenders = output
      .split("\n")
      .map((line) => line.split(":")[0])
      .filter((file) => file && !METADATA_ORG_ALLOWLIST.has(file));

    if (offenders.length > 0) {
      throw new Error(`account.metadata org resolution outside allowlist:\n${offenders.join("\n")}`);
    }
  });
});
