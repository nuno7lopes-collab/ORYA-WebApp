import { redirect } from "next/navigation";
import { buildLegacyOrgHref } from "../_lib/legacyRedirect";

export default async function OrgFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { orgId } = await params;
  const tabRaw = searchParams?.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const target = await buildLegacyOrgHref({
    orgId: Number(orgId),
    legacyPath: "/organizacao/analyze",
    searchParams,
    override: {
      section: tab === "invoices" ? "invoices" : "financas",
      tab: null,
    },
  });
  redirect(target);
}
