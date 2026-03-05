import { redirect } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function BookingsProfessionalDetailHardCutPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }> | { orgId: string; id: string };
}) {
  const resolvedParams = (await Promise.resolve(params)) as {
    orgId: string;
    id: string;
  };
  const orgId = Number(resolvedParams.orgId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    redirect("/org-hub/organizations");
  }
  redirect(buildOrgHref(orgId, "/academy/trainers"));
}
