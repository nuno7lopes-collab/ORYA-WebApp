import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

export const runtime = "nodejs";

export default async function PadelCategoryPage() {
  const target = await appendOrganizationIdToRedirectHref(
    "/organizacao/torneios?section=padel-hub&padel=categories",
  );
  redirect(target);
}
