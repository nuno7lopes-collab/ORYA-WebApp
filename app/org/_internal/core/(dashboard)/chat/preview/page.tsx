import { redirect } from "next/navigation";
import { resolveOrganizationIdFromCookies } from "@/lib/organizationId";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";

export default async function ChatPreviewPage() {
  const organizationId = await resolveOrganizationIdFromCookies();
  const target = organizationId ? buildOrgHref(organizationId, "/chat") : buildOrgHubHref("/organizations");
  redirect(target);
}
