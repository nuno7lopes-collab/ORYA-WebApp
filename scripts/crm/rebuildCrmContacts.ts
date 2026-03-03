import process from "node:process";
import { rebuildCrmContacts } from "@/lib/crm/rebuild";

function parseOrgId(argv: string[]) {
  const arg = argv.find((token) => token.startsWith("--org-id="));
  if (!arg) return null;
  const value = Number(arg.slice("--org-id=".length));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

async function main() {
  const orgId = parseOrgId(process.argv.slice(2));
  const startedAt = Date.now();

  const result = await rebuildCrmContacts({
    organizationId: orgId,
  });

  const elapsedMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        scope: orgId ? `organization:${orgId}` : "all",
        elapsedMs,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[crm-rebuild] failed", err);
  process.exit(1);
});
