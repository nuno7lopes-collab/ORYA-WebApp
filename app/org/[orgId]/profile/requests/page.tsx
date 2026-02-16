import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolved = await params;
  redirect(`/org/${resolved.orgId}/settings`);
}
