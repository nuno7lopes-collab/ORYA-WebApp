import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

export default async function ChatPreviewPage() {
  const target = await appendOrganizationIdToRedirectHref("/organizacao/chat");
  redirect(target);
}
