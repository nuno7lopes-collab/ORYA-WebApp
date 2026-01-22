export const runtime = "nodejs";

import { redirect } from "next/navigation";

export default async function OrganizationMensagensPage() {
  redirect("/organizacao/chat");
}
