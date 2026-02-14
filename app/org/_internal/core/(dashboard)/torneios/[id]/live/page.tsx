import { notFound, redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";
import { prisma } from "@/lib/prisma";
import OrganizationEventLivePrepPage from "@/app/org/_internal/core/(dashboard)/eventos/[id]/live/page";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationTorneioLivePage(props: PageProps) {
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
    const target = await appendOrganizationIdToRedirectHref(`/org/eventos/${eventId}/live`);
    redirect(target);
  }

  return OrganizationEventLivePrepPage(props);
}
