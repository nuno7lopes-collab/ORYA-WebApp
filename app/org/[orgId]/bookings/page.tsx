import { redirect } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function BookingsHardCutPage({
  params,
}: {
  params: Promise<{ orgId: string }> | { orgId: string };
}) {
  const resolvedParams = (await Promise.resolve(params)) as { orgId: string };
  const orgId = Number(resolvedParams.orgId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    redirect("/org-hub/organizations");
  }
  redirect(buildOrgHref(orgId, "/academy/classes"));
}
