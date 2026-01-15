import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrganizationEventDetailPage from "@/app/organizacao/(dashboard)/eventos/[id]/page";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrganizationTorneioDetailPage(props: PageProps) {
  const resolved = await props.params;
  const eventId = Number.parseInt(resolved.id, 10);
  if (!Number.isFinite(eventId)) {
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { templateType: true },
  });
  if (!event) {
    notFound();
  }
  if (event.templateType !== "PADEL") {
    redirect(`/organizacao/eventos/${eventId}`);
  }

  return OrganizationEventDetailPage(props);
}
