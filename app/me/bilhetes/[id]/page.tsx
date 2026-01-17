import { redirect } from "next/navigation";
import TicketDetailClient from "./TicketDetailClient";

type Props = {
  params: Promise<{ id?: string }>;
};

export default async function TicketDetailPage({ params }: Props) {
  const resolved = await params;
  const entitlementId = resolved?.id;
  if (!entitlementId || typeof entitlementId !== "string") {
    redirect("/me/carteira");
  }
  return <TicketDetailClient entitlementId={entitlementId} />;
}
