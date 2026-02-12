import { redirect } from "next/navigation";
import { buildLegacyOrgHref } from "../_lib/legacyRedirect";

export default async function OrgOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { orgId } = await params;
  const target = await buildLegacyOrgHref({
    orgId: Number(orgId),
    legacyPath: "/organizacao/overview",
    searchParams,
  });
  redirect(target);
}
