export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

export default async function OrganizationMensagensPage() {
  const target = await appendOrganizationIdToRedirectHref("/organizacao/chat");
  redirect(target);
}
