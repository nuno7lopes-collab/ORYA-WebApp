import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/marketing?marketing=promos`);
}
