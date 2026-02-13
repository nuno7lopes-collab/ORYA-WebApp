import { redirect } from "next/navigation";

export default async function OrgCrmPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/crm/clientes`);
}
