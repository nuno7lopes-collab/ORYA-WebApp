import { notFound, redirect } from "next/navigation";
import { parseOrganizationId } from "@/lib/organizationIdUtils";

export default async function OrgFallbackPage({
  params,
}: {
  params: Promise<{ orgId: string; slug: string[] }>;
}) {
  const { orgId: orgIdRaw, slug } = await params;
  const orgId = parseOrganizationId(orgIdRaw);
  if (!orgId) {
    redirect("/org-hub/organizations");
  }

  const [headRaw] = slug;
  const head = (headRaw ?? "").toLowerCase();
  if (head === "organizations") {
    redirect("/org-hub/organizations");
  }
  notFound();
}
