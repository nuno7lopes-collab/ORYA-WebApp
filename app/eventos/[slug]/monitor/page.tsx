import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";
import MonitorClient from "./MonitorClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
};

export default async function EventMonitorPage({ params }: PageProps) {
  const resolved = await params;
  const event = await prisma.event.findUnique({
    where: { slug: resolved.slug, isDeleted: false },
    select: { id: true, slug: true, templateType: true },
  });

  if (!event) redirect("/?tab=torneios");
  if (event.templateType !== "PADEL") redirect(`/eventos/${event.slug}`);

  const live = await buildPadelLiveReadModel({ eventId: event.id, visibility: "public" });
  if (!live?.event?.isPublicEvent) {
    redirect(`/eventos/${event.slug}`);
  }

  return <MonitorClient slug={event.slug} />;
}
