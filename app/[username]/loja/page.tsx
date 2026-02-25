import { notFound, redirect } from "next/navigation";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { normalizeUsernameInput } from "@/lib/username";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function PublicStorePage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawUsername = resolvedParams?.username ?? "";
  const username = normalizeUsernameInput(rawUsername);

  if (!username) notFound();
  if (username === "me") redirect("/me");
  if (isReservedUsername(username)) notFound();

  redirect(`/${username}?sec=loja`);
}
