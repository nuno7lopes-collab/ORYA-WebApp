import { redirect } from "next/navigation";

export default async function TeamTrainersRedirectPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/padel/clubs?tab=manage&section=padel-club&padel=trainers`);
}
