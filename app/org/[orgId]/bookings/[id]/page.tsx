import { redirect } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function BookingsClassDetailHardCutPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }> | { orgId: string; id: string };
}) {
  const resolvedParams = (await Promise.resolve(params)) as { orgId: string; id: string };
  const orgId = Number(resolvedParams.orgId);
  const classId = Number(resolvedParams.id);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    redirect("/org-hub/organizations");
  }
  if (!Number.isFinite(classId) || classId <= 0) {
    redirect(buildOrgHref(orgId, "/academy/classes"));
  }
  redirect(buildOrgHref(orgId, `/academy/classes/${classId}`));
}
