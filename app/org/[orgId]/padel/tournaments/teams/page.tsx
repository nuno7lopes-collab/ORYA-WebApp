import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/padel/tournaments?tab=manage&section=padel-tournaments&padel=teams`);
}
