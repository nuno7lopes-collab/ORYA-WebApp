import { redirect } from "next/navigation";

export default async function OrgProfilePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings`);
}
