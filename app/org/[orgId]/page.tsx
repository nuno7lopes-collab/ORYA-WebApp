import { redirect } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function OrgRootPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const parsed = Number(orgId);
  redirect(buildOrgHref(parsed, "/overview"));
}
